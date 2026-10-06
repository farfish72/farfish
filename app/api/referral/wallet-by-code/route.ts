import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey } from "../../../../lib/upstash";

export const dynamic = "force-dynamic";

/**
 * Lookup wallet address by refCode (last 8 chars of wallet)
 * refCode is stored as key: refcode:xxxxxxxx -> wallet address
 */
export async function GET(req: NextRequest) {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Missing required environment variables" }, { status: 500 });
  }

  const refCode = req.nextUrl.searchParams.get("code")?.trim().toLowerCase();
  if (!refCode || refCode.length !== 8) {
    return NextResponse.json({ error: "Invalid refCode" }, { status: 400 });
  }

  try {
    const wallet = await getKey<string>(`refcode:${refCode}`);
    if (!wallet) {
      return NextResponse.json({ error: "RefCode not found" }, { status: 404 });
    }

    return NextResponse.json({ wallet });
  } catch (error: any) {
    console.error("Wallet lookup by refCode failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to lookup wallet" }, { status: 500 });
  }
}
