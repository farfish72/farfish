import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, setKey } from "../../../../lib/upstash";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = "force-dynamic";

const createReferralCode = () => randomBytes(6).toString("hex").slice(0, 8);

export async function GET(req: NextRequest) {
  const userFromHeader = req.headers.get("x-user-wallet")?.trim();
  const userFromQuery = req.nextUrl.searchParams.get("user")?.trim();
  const wallet = (userFromHeader || userFromQuery || "").toLowerCase();

  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  try {
    // Validate env only when touching KV
    try {
      ensureReferralEnv();
    } catch (error: any) {
      return NextResponse.json({
        bound: false,
        referrer: "",
        link: `https://farfish.vercel.app?ref=${wallet.slice(-8).toLowerCase()}`,
        referralsCount: 0,
      });
    }

    // Keep each wallet's code stable. Adopt an existing legacy code when it
    // already points to this wallet so existing links remain valid.
    const dedicatedCodeKey = `referral-code:${wallet}`;
    let refCode = await getKey<string>(dedicatedCodeKey);
    const legacyCode = wallet.slice(-8).toLowerCase();
    const legacyWallet = await getKey<string>(`refcode:${legacyCode}`);

    if (!refCode && legacyWallet?.toLowerCase() === wallet) {
      refCode = legacyCode;
    }

    if (!refCode) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = createReferralCode();
        const existingWallet = await getKey<string>(`refcode:${candidate}`);
        if (!existingWallet || existingWallet.toLowerCase() === wallet) {
          refCode = candidate;
          break;
        }
      }
    }

    if (!refCode) {
      throw new Error("Unable to allocate a unique referral code");
    }

    await setKey(dedicatedCodeKey, refCode);
    await setKey(`refcode:${refCode}`, wallet);

    const refRecordRaw = await getKey<string | null>(`referral:${wallet}`);

    let referrer = "";
    let bound = false;

    if (refRecordRaw) {
      bound = true;
      try {
        const parsed = JSON.parse(refRecordRaw as string);
        referrer = parsed?.referrer || "";
      } catch {
        referrer = typeof refRecordRaw === "string" ? refRecordRaw : "";
      }
    }

    // Unified referral count
    const countRaw = await getKey<number | string | null>(`refcount:${wallet}`);
    const referralsCount = Number(countRaw ?? 0);

    // Referral link format for standalone app
    const link = `https://farfish.vercel.app?ref=${refCode}`;

    return NextResponse.json({
      bound,
      referrer,
      link,
      referralsCount: Number.isFinite(referralsCount) && referralsCount > 0 ? referralsCount : 0,
    });
  } catch (error: any) {
    console.error("Referral link lookup failed:", error);
    return NextResponse.json({
      bound: false,
      referrer: "",
      link: `https://farfish.vercel.app?ref=${wallet.slice(-8).toLowerCase()}`,
      referralsCount: 0,
    });
  }
}
