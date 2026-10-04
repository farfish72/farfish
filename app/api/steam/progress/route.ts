import { NextRequest, NextResponse } from "next/server";
import { ensureReferralEnv } from "../../../config/referral";
import { getKey, setKey } from "../../../../lib/upstash";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig } from "../../../lib/wagmi";
import { NFT_CONTRACT_ADDRESS, STAKING_CONTRACT_ADDRESS } from "../../../constants";
import nftDropAbi from "../../../abi/nftDrop.json";
import stakeAbi from "../../../abi/stake.json";

export const dynamic = "force-dynamic";

const walletRegex = /^0x[a-fA-F0-9]{40}$/;

// Helper function to verify NFT ownership or staking (same as verify endpoint)
const checkNFTOwnership = async (wallet: string): Promise<boolean> => {
  if (!NFT_CONTRACT_ADDRESS) return false;

  try {
    const publicClient = getPublicClient(wagmiConfig);
    if (!publicClient) return false;

    // Check NFT balance for token IDs 0-15
    for (let tokenId = 0; tokenId <= 15; tokenId++) {
      try {
        const balance = await (publicClient.readContract as any)({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: nftDropAbi as any,
          functionName: "balanceOf",
          args: [wallet as `0x${string}`, BigInt(tokenId)],
        }) as bigint;

        if (balance && Number(balance) > 0) {
          return true;
        }
      } catch {
        // Continue checking other token IDs
      }
    }

    // Check staking - if user has any active stakes
    if (STAKING_CONTRACT_ADDRESS) {
      try {
        const stakeIds = await (publicClient.readContract as any)({
          address: STAKING_CONTRACT_ADDRESS as `0x${string}`,
          abi: stakeAbi as any,
          functionName: "getUserStakeIds",
          args: [wallet as `0x${string}`],
        }) as bigint[];

        // Check if user has any stake IDs in valid range (0-50000)
        for (const stakeId of stakeIds) {
          const stakeIdNum = Number(stakeId);
          if (stakeIdNum >= 0 && stakeIdNum <= 50000) {
            // Verify the stake is still active (not unstaked)
            try {
              const stakeInfo = await (publicClient.readContract as any)({
                address: STAKING_CONTRACT_ADDRESS as `0x${string}`,
                abi: stakeAbi as any,
                functionName: "getStakeInfo",
                args: [stakeId],
              }) as any;

              // If stake exists and is not unstaked, user qualifies
              if (stakeInfo && !stakeInfo.unstaked) {
                return true;
              }
            } catch {
              // Continue checking other stakes
            }
          }
        }
      } catch {
        // Staking check failed, but NFT check already passed or failed above
      }
    }

    return false;
  } catch (error) {
    console.error("NFT ownership check failed:", error);
    return false;
  }
};

export async function GET(req: NextRequest) {
  try {
    ensureReferralEnv();
  } catch (error: any) {
    // Missing env/KV - return empty progress
    return NextResponse.json({ progress: {}, referralCount: 0 });
  }

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim().toLowerCase();
  if (!wallet || !walletRegex.test(wallet)) {
    return NextResponse.json({ error: "Missing or invalid wallet" }, { status: 400 });
  }

  try {
    // Get user progress from KV (READ-ONLY)
    const userDataRaw = await getKey<string | Record<string, unknown> | null>(`user:${wallet}`);
    let progress: any = {};

    if (userDataRaw) {
      if (typeof userDataRaw === "string") {
        try {
          progress = JSON.parse(userDataRaw);
        } catch {
          progress = {};
        }
      } else if (typeof userDataRaw === "object" && userDataRaw !== null) {
        progress = { ...userDataRaw };
      }
    }

    // Initialize tasks object if it doesn't exist
    if (!progress.tasks) {
      progress.tasks = {};
    }

    // Only auto-verify NFT task (on-chain verification, no Farcaster identity needed)
    if (!progress.tasks.nft_mint) {
      try {
        const hasNFTOrStake = await checkNFTOwnership(wallet);
        if (hasNFTOrStake) {
          progress.tasks.nft_mint = true;
          // Save updated progress to KV
          await setKey(`user:${wallet}`, progress);
        }
      } catch (error) {
        console.error("Failed to auto-verify NFT task:", error);
      }
    }

    // Get referral count from existing referral system (read-only)
    const referralCountRaw = await getKey<number | string | null>(`refcount:${wallet}`);
    const referralCount = Number(referralCountRaw ?? 0);

    return NextResponse.json({ progress, referralCount });
  } catch (error: any) {
    console.error("Failed to fetch task progress:", error);
    return NextResponse.json({ progress: {}, referralCount: 0 });
  }
}