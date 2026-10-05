import { NextRequest, NextResponse } from "next/server";
import { getKey } from "../../../../lib/upstash";

export const dynamic = "force-dynamic";

/**
 * Check if a wallet already has a referrer
 * GET /api/referral/check?wallet=0x...
 */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet")?.trim().toLowerCase();
    
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Check if referral:WALLET key exists
    const referralData = await getKey<string | Record<string, unknown> | null>(
      `referral:${wallet}`
    );

    const hasReferrer = referralData !== null;

    return NextResponse.json({
      hasReferrer,
      wallet,
    });
  } catch (error: any) {
    console.error("❌ [REFERRAL CHECK] Error:", error);
    return NextResponse.json(
      { error: "Failed to check referral status" },
      { status: 500 }
    );
  }
}
