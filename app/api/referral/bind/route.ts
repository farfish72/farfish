import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Legacy endpoint kept as a safe no-op for backwards compatibility.
// Referral binding and counting are now handled exclusively by /api/referral/record.
export async function POST() {
  return NextResponse.json({
    success: false,
    message: "Referral binding is handled automatically. This endpoint is a no-op.",
  });
}

