"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import StakeModal from "../components/StakeModal";
import UnstakeModal from "../components/UnstakeModal";
import StakeTable from "../components/StakeTable";

import {
  useAccount,
  useChainId,
  usePublicClient,
  useBlockNumber,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import { base } from "viem/chains";
import useUserStakes from "../hooks/useUserStakes";
import { STAKING_CONTRACT_ADDRESS } from "../constants";
import stakeAbi from "../abi/stake.json";

const BASE_CHAIN_ID = 8453;

const getExpectedChainId = () =>
  process.env.NEXT_PUBLIC_CHAIN_ID
    ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
    : BASE_CHAIN_ID;

export default function StakingPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const expectedChainId = getExpectedChainId();
  const readEnabled =
    Boolean(isConnected && address && STAKING_CONTRACT_ADDRESS) &&
    chainId === expectedChainId;

  /* ---------------- block timestamp ---------------- */
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const [blockTs, setBlockTs] = useState<bigint | null>(null);

  useEffect(() => {
    if (!publicClient || !blockNumber) return;
    publicClient.getBlock({ blockNumber }).then((b) => {
      if (b?.timestamp) setBlockTs(BigInt(b.timestamp));
    });
  }, [publicClient, blockNumber]);

  /* ---------------- staking data ---------------- */
  const { stakes, isLoading, isError, refetch } = useUserStakes();

  /* ---------------- modals ---------------- */
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);

  /* ---------------- claim tx ---------------- */
  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  const handleClaim = (stakeId: bigint) => {
    if (!readEnabled || !address) return;
    writeContract({
      address: STAKING_CONTRACT_ADDRESS as `0x${string}`,
      abi: stakeAbi,
      functionName: "claim",
      args: [stakeId],
      account: address as `0x${string}`, // wagmi v2 required
      chain: base,
    });
  };


  /* ---------------- render ---------------- */
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Stake" />

      <div className="mt-4 space-y-4 flex-1 flex flex-col">
        {/* Actions */}
        <section className="app-panel">
          <h2 className="text-xl font-bold mb-4">Stake Your NFTs</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsStakeModalOpen(true)}
              className="bg-gradient-to-r from-teal to-mint text-ink font-bold py-3 rounded-lg border border-teal"
            >
              Stake NFT
            </button>
            <button
              onClick={() => setIsUnstakeModalOpen(true)}
              className="bg-white/10 text-white font-bold py-3 rounded-lg border border-white/20"
            >
              Unstake NFT
            </button>
          </div>
        </section>

        <StakeTable />

        {/* My Stakes */}
        <section className="app-panel">
          <h3 className="font-semibold text-lg mb-4">Staked NFTs</h3>

          {/* Static informational text */}
          <p className="mb-4 text-sm text-white/80">
            Once the claim period is over, you can click Claim to collect your staking rewards.
          </p>

          {!readEnabled && <p>Connect wallet.</p>}
          {isLoading && <p>Loading…</p>}
          {isError && <p className="text-red-400">Failed to load stakes.</p>}

          {readEnabled && !isLoading && stakes.length === 0 && (
            <p>No staked NFTs.</p>
          )}

          {readEnabled &&
            !isLoading &&
            stakes
              .filter((s) => s.error !== true)
              .map((s) => {
                // Claim button eligibility: ENABLED only if contract allows claiming
                // unlockTimestamp > 0 AND unlockTimestamp <= block.timestamp AND claimed === false AND unstaked === false
                const canClaim =
                  s.unlockTimestamp > BigInt(0) &&
                  blockTs !== null &&
                  s.unlockTimestamp <= blockTs &&
                  s.claimed === false &&
                  s.unstaked === false;

                const isButtonEnabled = canClaim && !isPending && !confirming;

                return (
                  <div
                    key={s.stakeId.toString()}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 mb-3"
                  >
                    <p className="font-semibold">Stake #{s.stakeId.toString()}</p>
                    <button
                      disabled={!isButtonEnabled}
                      onClick={() => handleClaim(s.stakeId)}
                      className={`px-4 py-2 rounded-lg ${
                        isButtonEnabled
                          ? "bg-teal text-ink"
                          : "bg-white/10 text-white/40"
                      }`}
                    >
                      Claim
                    </button>
                  </div>
                );
              })}

          {writeError && (
            <p className="text-red-400 text-sm mt-2">
              {writeError.message}
            </p>
          )}
        </section>
      </div>

      <StakeModal
        isOpen={isStakeModalOpen}
        onClose={() => setIsStakeModalOpen(false)}
        onSuccess={refetch}
      />
      <UnstakeModal
        isOpen={isUnstakeModalOpen}
        onClose={() => setIsUnstakeModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
