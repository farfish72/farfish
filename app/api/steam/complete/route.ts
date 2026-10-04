import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, setKey } from "../../../../lib/upstash";

export const dynamic = "force-dynamic";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

type TaskCompletionBody = {
  wallet: string;
  taskId: string;
};

export async function POST(req: NextRequest) {
  let body: TaskCompletionBody;
  try {
    body = (await req.json()) as TaskCompletionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const wallet = body.wallet?.trim().toLowerCase();
  const taskId = body.taskId?.trim();

  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
  }

  try {
    ensureReferralEnv();
  } catch (error: any) {
    return NextResponse.json({ error: "Task completion unavailable" }, { status: 500 });
  }

  try {
    // Get current user data
    const userDataRaw = await getKey<string | Record<string, unknown> | null>(`user:${wallet}`);
    let userData: Record<string, any> = {};

    if (userDataRaw) {
      if (typeof userDataRaw === "string") {
        try {
          userData = JSON.parse(userDataRaw);
        } catch {
          userData = {};
        }
      } else if (typeof userDataRaw === "object" && userDataRaw !== null) {
        userData = { ...userDataRaw };
      }
    }

    // Handle different task types
    switch (taskId) {
      default:
        return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    // Save updated user data
    await setKey(`user:${wallet}`, userData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Task completion failed:", error);
    return NextResponse.json({ error: "Task completion failed" }, { status: 500 });
  }
}