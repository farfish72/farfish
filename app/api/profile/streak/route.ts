import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey } from "../../../../lib/upstash";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Missing required environment variables" }, { status: 500 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim().toLowerCase();
  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  try {
    // Get chest streak from KV
    // Assuming streak is stored as `streak:${wallet}` or similar
    // If not found, check for daily chest claim pattern
    const streakRaw = await getKey<number | string | null>(`streak:${wallet}`);
    let streakDays = 0;
    
    if (streakRaw !== null && streakRaw !== undefined) {
      streakDays = Number(streakRaw) || 0;
    }

    return NextResponse.json({ streakDays });
  } catch (error: any) {
    console.error("Failed to fetch chest streak:", error);
    return NextResponse.json({ error: error?.message || "Failed to fetch chest streak" }, { status: 500 });
  }
}
