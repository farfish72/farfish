import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, incrKey, setKey, sadd, smembers, keys } from "../../../../lib/upstash";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = "force-dynamic";

type RecordReferralBody = {
  wallet: string;
  refCode: string;
};

/**
 * Minimal referral capture endpoint.
 *
 * Flow:
 * - User opens app via referral link (?ref=XXXXXXXX)
 * - App detects connected wallet and POSTs { wallet, refCode }
 * - This endpoint stores ONE record per referred wallet:
 *   key:   referral:{wallet}
 *   value: { referrer: string, createdAt: string }
 *
 * Rules:
 * - Do NOT overwrite an existing referral entry
 * - Do NOT verify tasks or track task completion
 */
export async function POST(req: NextRequest) {
  let body: RecordReferralBody;
  try {
    body = (await req.json()) as RecordReferralBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawWallet = body.wallet?.trim();
  const wallet = rawWallet?.toLowerCase();
  const refCode = body.refCode?.trim().toLowerCase();

  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  if (!refCode || refCode.length !== 8) {
    return NextResponse.json({ error: "Invalid refCode (must be 8 characters)" }, { status: 400 });
  }

  try {
    // Validate env only when we are about to touch KV
    try {
      ensureReferralEnv();
    } catch (error: any) {
      // Soft-fail if env/KV missing - do not crash client, just skip recording
      console.error("[REFERRAL] Environment validation failed:", error?.message);
      return NextResponse.json(
        { success: false, error: error?.message || "Referral storage unavailable" },
        { status: 200 },
      );
    }

    // If this wallet already has a referral record, do nothing
    const existing = await getKey<string | Record<string, unknown> | null>(`referral:${wallet}`);
    if (existing) {
      console.log("ℹ️ [REFERRAL] Wallet already has referral record:", wallet);
      return NextResponse.json({ success: true, alreadyRecorded: true });
    }

    let referrer: string;
    
    // First try the cache for performance
    const cachedReferrerWallet = await getKey<string>(`refcode:${refCode}`);
    if (cachedReferrerWallet) {
      referrer = cachedReferrerWallet.toLowerCase();
    } else {
      // Cache miss - rebuild from existing data sources
      // Look through all known wallets to find one ending with refCode
      let matchingReferrer: string | null = null;
      
      // 1. Check existing referrers set (most reliable source)
      const allReferrers = await smembers(`set:referrers`);
      matchingReferrer = allReferrers.find(wallet => 
        wallet.toLowerCase().slice(-8) === refCode
      ) || null;
      
      // 2. If not found, check refcount keys (wallets with referral counts)
      if (!matchingReferrer) {
        const refcountKeys = await keys("refcount:*");
        
        for (const key of refcountKeys) {
          const wallet = key.replace("refcount:", "");
          if (wallet.toLowerCase().slice(-8) === refCode) {
            matchingReferrer = wallet;
            break;
          }
        }
      }
      
      // 3. If still not found, check all referral records for referrer wallets
      if (!matchingReferrer) {
        const referralKeys = await keys("referral:*");
        
        for (const key of referralKeys) {
          try {
            const record = await getKey<string>(key);
            if (record) {
              let referrerWallet: string;
              try {
                const parsed = JSON.parse(record);
                referrerWallet = parsed?.referrer;
              } catch {
                referrerWallet = record;
              }
              
              if (referrerWallet && referrerWallet.toLowerCase().slice(-8) === refCode) {
                matchingReferrer = referrerWallet;
                break;
              }
            }
          } catch {
            // Skip invalid records
          }
        }
      }
      
      if (matchingReferrer) {
        referrer = matchingReferrer.toLowerCase();
        // Rebuild the cache entry for future lookups
        await setKey(`refcode:${refCode}`, referrer);
      } else {
        // No existing wallet found - this could be a first-time referrer
        // Since we can't safely reconstruct the full wallet from 8 chars,
        // and the requirements forbid wallet guessing, we must reject this
        return NextResponse.json({ error: "RefCode not found" }, { status: 404 });
      }
    }

    // Block self-referral based purely on wallet + refCode pattern
    const walletLast8 = wallet.slice(-8).toLowerCase();
    if (walletLast8 === refCode || wallet === referrer) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    const payload = {
      referrer,
      createdAt: new Date().toISOString(),
    };

    // Bind referrer -> referee exactly once
    await setKey(`referral:${wallet}`, payload);

    // Increment unified referral count for referrer
    const newCount = await incrKey(`refcount:${referrer}`);

    // ✨ NEW: Update sorted set for atomic leaderboard (CRITICAL!)
    try {
      await upstashRequestDirect(`zincrby/leaderboard/1/${encodeURIComponent(referrer)}`, {
        method: 'POST'
      });
      console.log(`✅ [REFERRAL] Updated sorted set for ${referrer}`);
    } catch (error) {
      console.error(`⚠️ [REFERRAL] Failed to update sorted set:`, error);
      // Continue - refcount is still updated
    }

    // Add new referee to sorted set with score 0 (if not exists)
    try {
      await upstashRequestDirect(`zadd/leaderboard/nx/0/${encodeURIComponent(wallet)}`, {
        method: 'POST'
      });
    } catch (error) {
      console.error(`⚠️ [REFERRAL] Failed to add referee to sorted set:`, error);
    }

    // Add referrer to set:referrers if this is their first referral (count becomes 1)
    // This ensures they appear in leaderboard queries
    if (newCount === 1) {
      await sadd("set:referrers", referrer);
    }

    console.log("[REFERRAL] Successfully recorded:", {
      referee: wallet, 
      referrer, 
      refCode, 
      newReferrerCount: newCount 
    });

    return NextResponse.json({ success: true, referrer });
  } catch (error: any) {
    console.error("Referral recording failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to record referral" },
      { status: 500 },
    );
  }
}

// Helper for direct Upstash requests
async function upstashRequestDirect(path: string, init?: RequestInit) {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!upstashUrl || !upstashToken) {
    throw new Error('Upstash credentials missing');
  }
  
  const baseUrl = upstashUrl.endsWith("/") ? upstashUrl.slice(0, -1) : upstashUrl;
  
  const res = await fetch(`${baseUrl}/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${upstashToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash request failed (${res.status}): ${text}`);
  }

  return await res.json();
}