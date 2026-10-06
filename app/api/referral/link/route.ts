import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, setKey } from "../../../../lib/upstash";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = "force-dynamic";

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

    // Generate refCode from wallet (last 8 chars)
    const refCode = wallet.slice(-8).toLowerCase();

    // Store refCode -> wallet mapping for lookup (KV stores full wallet)
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
