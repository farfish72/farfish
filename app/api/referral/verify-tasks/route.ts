import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Task verification has been deprecated.
 *
 * This endpoint is now a pure UX no-op:
 * - Accepts any payload shape
 * - Does NOT read or write KV
 * - Does NOT affect referral counts or leaderboard
 */
export async function POST() {
  return NextResponse.json({ success: true });
}
