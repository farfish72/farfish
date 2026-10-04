"use client";

import React, { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { AppIcon } from "./ui";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, usePublicClient, useBlockNumber } from "wagmi";
import { base } from "viem/chains";
import { STAKING_CONTRACT_ADDRESS } from "../constants";
import stakeAbi from "../abi/stake.json";
import useUserStakes from "../hooks/useUserStakes";

interface UnstakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Optional UX hint from parent: which stakeId to pre-select when opening.
  initialStakeId?: bigint | null;
}

const BASE_CHAIN_ID = 8453;

const getExpectedChainId = () => {
  return process.env.NEXT_PUBLIC_CHAIN_ID ? Number(process.env.NEXT_PUBLIC_CHAIN_ID) : BASE_CHAIN_ID;
};

export default function UnstakeModal({ isOpen, onClose, onSuccess, initialStakeId }: UnstakeModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [selectedPosition, setSelectedPosition] = useState<ReturnType<typeof useUserStakes>["activeStakes"][number] | null>(null);

  const expectedChainId = getExpectedChainId();
  const isBaseNetwork = chainId === expectedChainId;
  const readEnabled = Boolean(isConnected && address && STAKING_CONTRACT_ADDRESS && isBaseNetwork);

  // Block timestamp tracking
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const [blockTs, setBlockTs] = useState<bigint | null>(null);

  useEffect(() => {
    if (!publicClient || !blockNumber) return;
    publicClient.getBlock({ blockNumber }).then((b) => {
      if (b?.timestamp) setBlockTs(BigInt(b.timestamp));
    });
  }, [publicClient, blockNumber]);

  // Canonical stake data - single source of truth.
  const { activeStakes, isLoading: isLoadingStakes, isError: stakesError, refetch } = useUserStakes();

  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isPending = isWritePending || isTxConfirming;

  // Set initial selection by stakeId when modal opens (optional UX)
  useEffect(() => {
    if (!isOpen || !initialStakeId || !activeStakes.length) return;
    const match = activeStakes.find((p) => p.stakeId === initialStakeId);
    if (match) {
      setSelectedPosition(match);
    }
  }, [isOpen, initialStakeId, activeStakes]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPosition(null);
    }
  }, [isOpen]);

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess && txHash) {
      refetch();
      // Broadcast a global staking update so other views (Profile, Chest, Stake) can refetch on-chain staking state.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("farfish:staking-updated", {
            detail: { type: "unstake", txHash },
          }),
        );
      }
      onSuccess?.();
      onClose();
    }
  }, [isTxSuccess, txHash, refetch, onSuccess, onClose]);

  // Unstake button eligibility: Enable ONLY IF contract allows
  // unstaked === false AND unlockTimestamp > 0 AND unlockTimestamp <= block.timestamp
  const canUnstake = selectedPosition
    ? selectedPosition.unstaked === false &&
      selectedPosition.unlockTimestamp > BigInt(0) &&
      blockTs !== null &&
      selectedPosition.unlockTimestamp <= blockTs
    : false;

  const isButtonEnabled = canUnstake && !isPending;

  const handleUnstake = () => {
    if (!isButtonEnabled || !address || !STAKING_CONTRACT_ADDRESS || !selectedPosition) return;

    if (!isConnected || !isBaseNetwork) return;

    writeContract({
      address: STAKING_CONTRACT_ADDRESS as `0x${string}`,
      abi: stakeAbi as any,
      functionName: "unstake",
      args: [selectedPosition.stakeId],
      account: address as `0x${string}`,
      chain: base,
    } as any);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="app-panel w-full max-w-md bg-ink shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Release NFT</h2>
          <button
            onClick={onClose}
            className="app-control text-white/70 hover:text-white transition"
            aria-label="Close modal"
          >
            <AppIcon icon={X} size="md" weight="bold" />
          </button>
        </div>

        {/* Static description text */}
        <p className="mb-4 text-sm text-white/80">
          Once the lock period ends, your NFT can be released. Rewards are recorded in the table below.
        </p>

        {/* Stake list */}
        {!isConnected ? (
          <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm text-white/70">Connect your wallet to see locked NFTs.</p>
          </div>
        ) : isLoadingStakes ? (
          <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm text-white/70">Loading positions…</p>
          </div>
        ) : stakesError && activeStakes.length === 0 ? (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-200">Could not load positions. Try again.</p>
          </div>
        ) : !stakesError && !isLoadingStakes && activeStakes.length === 0 ? (
          <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-sm text-white/70">No locked positions found.</p>
          </div>
        ) : (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            {activeStakes
              .filter((s) => s.error !== true)
              .map((position) => {
                const isSelected = selectedPosition?.stakeId === position.stakeId;

                return (
                  <button
                    key={position.stakeId.toString()}
                    type="button"
                    aria-label={`Select stake ${position.stakeId.toString()}`}
                    onClick={() => {
                      setSelectedPosition(position);
                    }}
                    disabled={isPending}
                    className={`h-auto w-full border rounded-xl px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "border-white/60 bg-white/15 text-white shadow-lg"
                        : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-sm font-semibold block">
                      Stake #{position.stakeId.toString()}
                    </span>
                    {isSelected && (
                      <span className="text-xs text-mint block mt-0.5">✓ Selected</span>
                    )}
                  </button>
                );
              })}
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
            onClick={handleUnstake}
            disabled={!isButtonEnabled}
            className={`app-button flex-1 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isButtonEnabled
                ? "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {isPending ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Releasing…
              </div>
            ) : (
              "Release"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

