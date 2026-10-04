import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Task status is no longer persisted; this endpoint is retained as a safe stub.
export async function GET() {
  return NextResponse.json({
    followComplete: false,
    recastComplete: false,
  });
}
