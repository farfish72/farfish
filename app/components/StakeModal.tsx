"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useReadContract } from "wagmi";
import { STAKING_CONTRACT_ADDRESS, NFT_CONTRACT_ADDRESS, getNameFromTokenId } from "../constants";
import stakeAbi from "../abi/stake.json";
import nftDropAbi from "../abi/nftDrop.json";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig } from "../lib/wagmi";
import { base } from "viem/chains";
import { X } from "@phosphor-icons/react";
import { AppIcon } from "./ui";

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const LOCK_DURATIONS = [30, 90, 180, 360] as const;
type LockDuration = typeof LOCK_DURATIONS[number];

// Category to token range map (on-chain reality)
const NFT_CATEGORIES = {
  BlueFin: [0, 1, 2, 3, 4, 5, 6],
  GoldRay: [7, 8, 9, 10, 11],
  RedSpike: [12, 13, 14],
  ShadowGill: [15],
} as const;

type NFTCategory = keyof typeof NFT_CATEGORIES;

const BASESCAN_URL = "https://basescan.org/tx";
const BASE_CHAIN_ID = 8453;

export default function StakeModal({ isOpen, onClose, onSuccess }: StakeModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedCategory, setSelectedCategory] = useState<NFTCategory | null>(null);
  const [resolvedTokenId, setResolvedTokenId] = useState<number | null>(null);
  const [isResolvingTokenId, setIsResolvingTokenId] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<LockDuration>(30);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null);
  // Default to requiring approval until we know otherwise so the button is never stuck in a permanent "Loading..." state.
  const [needsApproval, setNeedsApproval] = useState<boolean | null>(true);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | null>(null);
  const [stakeTxHash, setStakeTxHash] = useState<`0x${string}` | null>(null);

  const expectedChainId = process.env.NEXT_PUBLIC_CHAIN_ID ? Number(process.env.NEXT_PUBLIC_CHAIN_ID) : BASE_CHAIN_ID;
  const isBaseNetwork = chainId === expectedChainId;
  const readEnabled = Boolean(isConnected && address && NFT_CONTRACT_ADDRESS && STAKING_CONTRACT_ADDRESS && isBaseNetwork);

  // Check if user has approved the staking contract
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: NFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: nftDropAbi as any,
    functionName: "isApprovedForAll",
    args: address && STAKING_CONTRACT_ADDRESS ? [address as `0x${string}`, STAKING_CONTRACT_ADDRESS as `0x${string}`] : undefined,
    query: { enabled: readEnabled },
  } as any);

  const { writeContract: writeApproval, data: approvalTx, isPending: isApprovalPending, error: approvalError } = useWriteContract();
  const { writeContract: writeStake, data: stakeTx, isPending: isStakePending, error: stakeError } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isApprovalConfirming, isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTx,
  });

  // Wait for stake transaction
  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeTx,
  });

  const isPending = isApprovalPending || isApprovalConfirming || isStakePending || isStakeConfirming;
  const currentTxHash = approvalTx || stakeTx;

  const canStake = isConnected && isBaseNetwork && resolvedTokenId !== null && selectedDuration && !isResolvingTokenId && !ownershipError;

  // Update needsApproval when approval status changes
  useEffect(() => {
    if (isApproved !== undefined) {
      setNeedsApproval(!isApproved);
    }
  }, [isApproved]);

  // Resolve tokenId when category is selected
  useEffect(() => {
    const resolveTokenId = async () => {
      if (!selectedCategory || !readEnabled || !address || !NFT_CONTRACT_ADDRESS) {
        setResolvedTokenId(null);
        setOwnershipError(null);
        return;
      }

      setIsResolvingTokenId(true);
      setOwnershipError(null);

      try {
        const publicClient = getPublicClient(wagmiConfig, { chainId: base.id });
        if (!publicClient) {
          setResolvedTokenId(null);
          setOwnershipError(null);
          setIsResolvingTokenId(false);
          return;
        }

        const tokenIds = NFT_CATEGORIES[selectedCategory];
        
        // Iterate through tokenIds and find first one with balance > 0
        for (const tokenId of tokenIds) {
          try {
            const balance = await (publicClient.readContract as any)({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              abi: nftDropAbi as any,
              functionName: "balanceOf",
              args: [address as `0x${string}`, BigInt(tokenId)],
            }) as bigint;

            if (balance > BigInt(0)) {
              setResolvedTokenId(tokenId);
              setOwnershipError(null);
              setIsResolvingTokenId(false);
              return;
            }
          } catch (err) {
            console.error(`Failed to check balance for tokenId ${tokenId}:`, err);
            // Continue to next tokenId
          }
        }

        // No tokenId found with balance > 0
        setResolvedTokenId(null);
        setOwnershipError("None of this type in your wallet");
        setIsResolvingTokenId(false);
      } catch (error) {
        console.error("Failed to resolve tokenId:", error);
        setResolvedTokenId(null);
        setOwnershipError(null);
        setIsResolvingTokenId(false);
      }
    };

    resolveTokenId();
  }, [selectedCategory, readEnabled, address, NFT_CONTRACT_ADDRESS]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCategory(null);
      setResolvedTokenId(null);
      setIsResolvingTokenId(false);
      setOwnershipError(null);
      setSelectedDuration(30);
      setToast(null);
      setNeedsApproval(null);
      setApprovalTxHash(null);
      setStakeTxHash(null);
    }
  }, [isOpen]);

  // Refetch approval status when modal opens
  useEffect(() => {
    if (isOpen && readEnabled) {
      refetchApproval();
    }
  }, [isOpen, readEnabled, refetchApproval]);

  const proceedWithStake = useCallback(() => {
    if (!address || !STAKING_CONTRACT_ADDRESS || resolvedTokenId === null || !selectedDuration) return;

    const lockDurationSeconds = BigInt(selectedDuration * 86400);

    try {
      writeStake({
        address: STAKING_CONTRACT_ADDRESS as `0x${string}`,
        abi: stakeAbi as any,
        functionName: "stake",
        args: [BigInt(resolvedTokenId), lockDurationSeconds],
      } as any);
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error("Stake error:", error);
      if (errorMsg.includes("mint") || errorMsg.includes("Mint") || errorMsg.includes("revert")) {
        setToast({ type: "error", message: "Rewards paused — contact support." });
      } else {
        setToast({ type: "error", message: `Transaction failed: ${errorMsg}` });
      }
    }
  }, [address, STAKING_CONTRACT_ADDRESS, resolvedTokenId, selectedDuration, writeStake]);

  // Handle approval transaction success
  useEffect(() => {
    if (isApprovalSuccess && approvalTx) {
      setApprovalTxHash(approvalTx);
      setToast({ type: "success", message: "Approved. Locking NFT…" });
      refetchApproval();
      // After approval, automatically proceed to stake
      setTimeout(() => {
        proceedWithStake();
      }, 1000);
    }
  }, [isApprovalSuccess, approvalTx, refetchApproval, proceedWithStake]);

  // Handle stake transaction success
  useEffect(() => {
    if (isStakeSuccess && stakeTx) {
      setStakeTxHash(stakeTx);
      setToast({ type: "success", message: "NFT locked." });

      // Broadcast a global staking update so other parts of the app (Profile, Chest, Stake page)
      // can refetch on-chain data such as getUserStakeIds, profile stats, and chest eligibility.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("farfish:staking-updated", {
            detail: { type: "stake", txHash: stakeTx },
          }),
        );
      }

      // Let the parent trigger its own refetch and close the modal after a brief success state.
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    }
  }, [isStakeSuccess, stakeTx, onSuccess, onClose]);

  // Reset pending states when modal closes to prevent stuck loading
  useEffect(() => {
    if (!isOpen) {
      // Force reset by clearing any pending transaction states
      // The wagmi hooks will handle the actual state, but we ensure modal is clean
    }
  }, [isOpen]);

  // Handle approval errors
  useEffect(() => {
    if (approvalError) {
      const errorMsg = approvalError.message || String(approvalError);
      console.error("Approval error:", approvalError);
      setToast({ type: "error", message: `Approval failed: ${errorMsg}` });
    }
  }, [approvalError]);

  // Handle stake errors
  useEffect(() => {
    if (stakeError) {
      const errorMsg = stakeError.message || String(stakeError);
      console.error("Stake error:", stakeError);
      if (errorMsg.includes("mint") || errorMsg.includes("Mint") || errorMsg.includes("revert")) {
        setToast({ type: "error", message: "Rewards paused — contact support." });
      } else {
        setToast({ type: "error", message: `Transaction failed: ${errorMsg}` });
      }
    }
  }, [stakeError]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleStake = () => {
    if (!canStake || !address || !STAKING_CONTRACT_ADDRESS || !NFT_CONTRACT_ADDRESS || resolvedTokenId === null || !selectedDuration) return;

    // Precondition checks
    if (!isConnected) {
      setToast({ type: "error", message: "Connect your wallet first." });
      return;
    }

    if (!isBaseNetwork) {
      setToast({ type: "error", message: "Switch to Base network to continue." });
      return;
    }

    // Check if approval is needed
    if (needsApproval === true) {
      // Request approval from user wallet
      try {
        writeApproval({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: nftDropAbi as any,
          functionName: "setApprovalForAll",
          args: [STAKING_CONTRACT_ADDRESS as `0x${string}`, true],
        } as any);
        setToast({ type: "success", message: "Approve in your wallet…" });
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error("Approval error:", error);
        setToast({ type: "error", message: `Approval failed: ${errorMsg}` });
      }
    } else if (needsApproval === false) {
      // Already approved, proceed with staking
      proceedWithStake();
    } else {
      // Approval status not yet loaded, wait a moment and retry
      setTimeout(() => {
        refetchApproval();
        if (isApproved) {
          proceedWithStake();
        } else {
          setToast({ type: "error", message: "Waiting for approval status…" });
        }
      }, 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="app-panel w-full max-w-md bg-ink shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Lock NFT</h2>
          <button
            onClick={onClose}
            className="app-control text-white/70 hover:text-white transition"
            aria-label="Close modal"
          >
            <AppIcon icon={X} size="md" weight="bold" />
          </button>
        </div>

        {!isConnected && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-200">Connect your wallet to continue.</p>
          </div>
        )}

        {isConnected && !isBaseNetwork && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-200">Switch to Base network to continue.</p>
          </div>
        )}

        {/* Category Selection - Show only 4 names: BlueFin, GoldRay, RedSpike, ShadowGill */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Choose NFT</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(NFT_CATEGORIES) as NFTCategory[]).map((category) => {
              return (
                <button
                  key={category}
                  type="button"
                  aria-label={`Select ${category} NFT`}
                  data-selection="nft"
                  onClick={() => setSelectedCategory(category)}
                  disabled={isPending || isResolvingTokenId}
                  className={`h-auto border rounded-xl px-3 py-2 text-left transition-all ${
                    selectedCategory === category
                      ? "border-mint bg-mint/20 text-white shadow-lg shadow-mint/20"
                      : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  } ${isPending || isResolvingTokenId ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="text-sm font-semibold block">{category}</span>
                  {selectedCategory === category && !isResolvingTokenId && (
                    <span className="text-xs text-mint mt-0.5 block">✓ Selected</span>
                  )}
                  {selectedCategory === category && isResolvingTokenId && (
                    <span className="text-xs mt-1 opacity-60">Checking...</span>
                  )}
                </button>
              );
            })}
          </div>
          {ownershipError && selectedCategory && (
            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-200">{ownershipError}</p>
            </div>
          )}
        </div>

        {/* Lock Duration Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Lock Period</label>
          <div className="grid grid-cols-4 gap-2">
            {LOCK_DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                aria-label={`Lock for ${duration} days`}
                data-selection="duration"
                onClick={() => setSelectedDuration(duration)}
                disabled={isPending}
                className={`h-auto border rounded-xl px-3 py-2 text-center transition-all ${
                  selectedDuration === duration
                    ? "border-mint bg-mint/20 text-white shadow-lg shadow-mint/20"
                    : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className="text-sm font-semibold block">{duration}d</span>
                {selectedDuration === duration && (
                  <span className="text-xs text-mint block mt-0.5">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Approval Status */}
        {needsApproval === true && !isApprovalSuccess && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-200">
              One-time approval needed for the staking contract.
            </p>
          </div>
        )}

        {/* Transaction Status */}
        {isPending && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-200">
              {isApprovalPending || isApprovalConfirming
                ? isApprovalConfirming
                  ? "Confirming approval..."
                  : "Approval transaction pending..."
                : isStakeConfirming
                ? "Confirming stake..."
                : "Stake transaction pending..."}
            </p>
            {currentTxHash && (
              <a
                href={`${BASESCAN_URL}/${currentTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-teal hover:underline mt-2 block"
              >
                View on BaseScan
              </a>
            )}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg border ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200"
                : "bg-red-500/10 border-red-500/20 text-red-200"
            }`}
          >
            <p className="text-sm">{toast.message}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-auto flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="app-control flex-1 border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleStake}
            // Only block interaction while we know a transaction or ownership check is in-flight, or input is invalid.
            // This avoids a "Loading..." label that can get stuck if the approval status never resolves.
            disabled={!canStake || isPending || isResolvingTokenId || !!ownershipError}
            className={`app-button flex-1 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
              canStake && !isPending && !isResolvingTokenId && !ownershipError
                ? "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {isResolvingTokenId ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Checking...
              </div>
            ) : isPending ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {isApprovalPending || isApprovalConfirming ? "Approving..." : "Staking..."}
              </div>
            ) : ownershipError ? (
              "Not Owned"
            ) : needsApproval === true ? (
              "Approve & Stake"
            ) : (
              "Stake"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
