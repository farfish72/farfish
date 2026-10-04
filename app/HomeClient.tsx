/**
 * DropERC1155 Mint Flow on Base (chainId 8453)
 * 
 * Mint restrictions enforced entirely by the contract.
 * Mint price and currency read directly from on-chain claim conditions.
 * Random tokenId selection weighted by remaining supply (maxTotalSupply - totalSupply).
 */
"use client";

import Image from "next/image";
import Header from "./components/Header";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConnect } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { wagmiConfig } from "./lib/wagmi";
import { NFT_CONTRACT_ADDRESS, getNameFromTokenId } from "./constants";
import nftDropAbi from "./abi/nftDrop.json";
import { base } from "viem/chains";
import { formatEther } from "viem";
import { useToast } from "./providers/ToastProvider";
import { handleWalletError, handleTransactionError, checkWalletConnection, checkNetwork } from "./utils/errorHandling";
import {
  CheckCircle,
  Clock,
  Confetti,
  Diamond,
  GameController,
  Prohibit,
  RocketLaunch,
  Trophy,
  Warning,
  Waveform,
  XCircle,
} from "@phosphor-icons/react";
import { AppIcon } from "./components/ui";

interface SupplyInfo {
  id: number;
  totalSupply: bigint;
  maxTotalSupply: bigint;
  remaining: bigint;
}

interface ClaimCondition {
  startTimestamp: bigint;
  maxClaimableSupply: bigint;
  supplyClaimed: bigint;
  quantityLimitPerWallet: bigint;
  merkleRoot: `0x${string}`;
  pricePerToken: bigint;
  currency: `0x${string}`;
  metadata: string;
}

interface TokenClaimInfo {
  tokenId: number;
  condition: ClaimCondition | null;
  activeConditionId: bigint | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Weighted random selection using browser crypto API.
 * Returns the selected tokenId from candidates based on remaining supply weights.
 */
function pickWeightedTokenId(candidates: SupplyInfo[]): number {
  if (candidates.length === 0) {
    throw new Error("No candidates available");
  }

  // Calculate total weight (sum of all remaining supplies)
  const totalWeight = candidates.reduce((sum, item) => sum + item.remaining, BigInt(0));

  if (totalWeight === BigInt(0)) {
    throw new Error("All tokens are sold out");
  }

  // Generate random number using crypto API
  const randomArray = new Uint32Array(1);
  crypto.getRandomValues(randomArray);
  const randomValue = randomArray[0];

  // Convert to BigInt and scale to [0, totalWeight)
  // Use modulo to map random value into the weight range
  const randomBigInt = BigInt(randomValue);
  const scaledRandom = randomBigInt % totalWeight;

  // Walk through candidates to find the selected one
  let accumulated = BigInt(0);
  for (const candidate of candidates) {
    accumulated += candidate.remaining;
    if (scaledRandom < accumulated) {
      return candidate.id;
    }
  }

  // Fallback to last candidate (should not happen)
  return candidates[candidates.length - 1].id;
}

const TOKEN_IDS = Array.from({ length: 16 }, (_, i) => i); // 0-15

export default function HomeClient() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { showError, showSuccess } = useToast();

  // State
  const [supplyInfo, setSupplyInfo] = useState<SupplyInfo[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [lastMintedTokenId, setLastMintedTokenId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [mintedTokenUri, setMintedTokenUri] = useState<string | null>(null);
  const [claimInfo, setClaimInfo] = useState<Map<number, TokenClaimInfo>>(new Map());
  const [loadingClaimConditions, setLoadingClaimConditions] = useState(false);
  const [justMinted, setJustMinted] = useState(false);

  const {
    writeContract: writeMint,
    data: mintTxHash,
    isPending: isMintPending,
    error: mintError,
  } = useWriteContract();
  const {
    isLoading: isMintConfirming,
    isSuccess: isMintConfirmed,
  } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });

  // Fetch claim conditions for a specific tokenId
  const fetchClaimCondition = useCallback(async (tokenId: number, _attempt = 0): Promise<TokenClaimInfo> => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    if (typeof window === "undefined" || !NFT_CONTRACT_ADDRESS) {
      return {
        tokenId,
        condition: null,
        activeConditionId: null,
        isLoading: false,
        error: "Contract not available",
      };
    }

    try {
      // Use the configured Base chain from wagmi to ensure we always read from the same chain
      const publicClient = getPublicClient(wagmiConfig, { chainId: base.id });
      if (!publicClient) {
        return {
          tokenId,
          condition: null,
          activeConditionId: null,
          isLoading: false,
          error: "Public client not available",
        };
      }

      // DIAGNOSTIC LOGGING: Log contract address, chainId, and tokenId
      const chainId = publicClient.chain?.id;
      console.log("🔍 [DIAGNOSTIC] getActiveClaimConditionId call:", {
        tokenId,
        contractAddress: NFT_CONTRACT_ADDRESS,
        chainId: chainId,
        expectedChainId: 8453,
        chainName: publicClient.chain?.name,
        isBaseChain: chainId === 8453,
        baseChainId: base.id,
        contractFromEnv: NFT_CONTRACT_ADDRESS,
        contractFromError: "0xA10C5a76910D3B9f22CAE78a4c718bE98715339b",
        contractMatches: NFT_CONTRACT_ADDRESS.toLowerCase() === "0xA10C5a76910D3B9f22CAE78a4c718bE98715339b".toLowerCase(),
      });

      // Get active claim condition ID
      const activeConditionId = (await (publicClient.readContract as any)({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: nftDropAbi as any,
        functionName: "getActiveClaimConditionId",
        args: [BigInt(tokenId)],
      })) as bigint;

      // DIAGNOSTIC LOGGING: Log the result
      console.log("🔍 [DIAGNOSTIC] getActiveClaimConditionId result:", {
        tokenId,
        activeConditionId: activeConditionId.toString(),
        activeConditionIdNumber: Number(activeConditionId),
        contractAddress: NFT_CONTRACT_ADDRESS,
        chainId: chainId,
        isZero: activeConditionId === BigInt(0),
      });

      // If no active condition (returns 0 or throws), return error
      if (activeConditionId === BigInt(0)) {
        console.warn(`[DIAGNOSTIC] No active claim condition for tokenId ${tokenId}`, {
          tokenId,
          activeConditionId: activeConditionId.toString(),
          contractAddress: NFT_CONTRACT_ADDRESS,
          chainId: chainId,
          expectedChainId: 8453,
          chainMismatch: chainId !== 8453,
          contractMismatch: NFT_CONTRACT_ADDRESS !== "0xA10C5a76910D3B9f22CAE78a4c718bE98715339b",
        });
        return {
          tokenId,
          condition: null,
          activeConditionId: null,
          isLoading: false,
          error: "No active claim condition",
        };
      }

      // Get claim condition details
      console.log("🔍 [DIAGNOSTIC] Calling getClaimConditionById:", {
        tokenId,
        activeConditionId: activeConditionId.toString(),
        contractAddress: NFT_CONTRACT_ADDRESS,
        chainId: chainId,
      });

      const condition = (await (publicClient.readContract as any)({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: nftDropAbi as any,
        functionName: "getClaimConditionById",
        args: [BigInt(tokenId), activeConditionId],
      })) as ClaimCondition;

      // Log claim condition for debugging
      if (condition) {
        console.log(`[DIAGNOSTIC] Claim condition for tokenId ${tokenId}:`, {
          activeConditionId: activeConditionId.toString(),
          pricePerToken: condition.pricePerToken.toString(),
          currency: condition.currency,
          startTimestamp: condition.startTimestamp.toString(),
          maxClaimableSupply: condition.maxClaimableSupply.toString(),
          supplyClaimed: condition.supplyClaimed.toString(),
          quantityLimitPerWallet: condition.quantityLimitPerWallet.toString(),
          contractAddress: NFT_CONTRACT_ADDRESS,
          chainId: chainId,
        });
      }

      return {
        tokenId,
        condition,
        activeConditionId,
        isLoading: false,
        error: null,
      };
    } catch (error) {
      const publicClient = getPublicClient(wagmiConfig, { chainId: base.id });
      const chainId = publicClient?.chain?.id;

      // Robustly extract message from viem errors (ContractFunctionRevertedError, etc.)
      // which may not be plain Error instances
      const err = error as Record<string, unknown> | null;
      const errorName   = (err && typeof err["name"]         === "string" ? err["name"]         : "") as string;
      const errorMessage =
        err && typeof err["shortMessage"] === "string" ? err["shortMessage"] :
        err && typeof err["message"]      === "string" ? err["message"]      :
        "Unknown error";
      const errorDetails = (err && typeof err["details"]     === "string" ? err["details"]     : "") as string;
      const errorData    = (err && typeof err["data"]        === "string" ? err["data"]        : "") as string;

      // Walk the cause chain and collect all text
      const collectCauseText = (cause: unknown): string => {
        if (!cause || typeof cause !== "object") return "";
        const c = cause as Record<string, unknown>;
        const own = ["name", "message", "shortMessage", "details", "data"]
          .map((k) => (typeof c[k] === "string" ? c[k] : ""))
          .join(" ");
        return `${own} ${collectCauseText(c["cause"])}`.trim();
      };
      const causeText = collectCauseText(err?.["cause"]);

      // Serialize the full error for logging (handles non-enumerable viem props)
      const rawErrorStr = (() => {
        try { return JSON.stringify(error, Object.getOwnPropertyNames(error as object)); }
        catch { return String(error); }
      })();

      // Detect "no active claim condition" across viem error shapes
      const NO_CONDITION_SIGNALS = ["DropNoActiveCondition", "0xf40f1cc0"];
      const allText = [errorName, errorMessage, errorDetails, errorData, causeText, rawErrorStr].join(" ");
      const isNoActiveCondition = NO_CONDITION_SIGNALS.some((s) => allText.includes(s));

      if (isNoActiveCondition) {
        console.warn(`No active claim condition for tokenId ${tokenId}.`);
        return {
          tokenId,
          condition: null,
          activeConditionId: null,
          isLoading: false,
          error: "No active claim condition on-chain",
        };
      }

      // Retry on rate-limit errors with exponential backoff
      const isRateLimit = allText.includes("over rate limit") || allText.includes("429");
      if (isRateLimit && _attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, _attempt);
        console.warn(`Rate limited for tokenId ${tokenId}, retrying in ${delay}ms (attempt ${_attempt + 1}/${MAX_RETRIES})...`);
        await new Promise((res) => setTimeout(res, delay));
        return fetchClaimCondition(tokenId, _attempt + 1);
      }

      console.error(`Failed to fetch claim condition for tokenId ${tokenId}:`, {
        errorName,
        errorMessage,
        errorDetails,
        errorData,
        causeText,
        rawError: rawErrorStr,
        tokenId,
        contractAddress: NFT_CONTRACT_ADDRESS,
        chainId,
        expectedChainId: 8453,
        chainMismatch: chainId !== 8453,
      });
      return {
        tokenId,
        condition: null,
        activeConditionId: null,
        isLoading: false,
        error: errorMessage,
      };
    }
  }, []);

  // Fetch claim conditions for all tokenIds — batched to avoid RPC rate limits
  const fetchAllClaimConditions = useCallback(async () => {
    if (typeof window === "undefined" || !NFT_CONTRACT_ADDRESS) return;

    setLoadingClaimConditions(true);
    try {
      const BATCH_SIZE = 4;
      const newMap = new Map<number, TokenClaimInfo>();

      for (let i = 0; i < TOKEN_IDS.length; i += BATCH_SIZE) {
        const batch = TOKEN_IDS.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((id) => fetchClaimCondition(id)));
        results.forEach((info) => newMap.set(info.tokenId, info));
        // Small delay between batches so the free RPC doesn't rate-limit us
        if (i + BATCH_SIZE < TOKEN_IDS.length) {
          await new Promise((res) => setTimeout(res, 300));
        }
      }

      setClaimInfo(newMap);
    } catch (error) {
      console.error("Failed to fetch claim conditions:", error);
    } finally {
      setLoadingClaimConditions(false);
    }
  }, [fetchClaimCondition]);

  // Fetch supply info for all tokenIds (0-15) — batched to avoid RPC rate limits
  const fetchSupplyInfo = useCallback(async () => {
    if (typeof window === "undefined" || !NFT_CONTRACT_ADDRESS) return;

    setLoadingSupplies(true);
    setErrorMessage(null);

    try {
      const publicClient = getPublicClient(wagmiConfig, { chainId: base.id });
      if (!publicClient) {
        setErrorMessage("Public client not available");
        return;
      }

      const BATCH_SIZE = 4;
      const supplies: SupplyInfo[] = [];

      for (let i = 0; i < TOKEN_IDS.length; i += BATCH_SIZE) {
        const batch = TOKEN_IDS.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            const [totalSupply, maxTotalSupply] = await Promise.all([
              (publicClient.readContract as any)({
                address: NFT_CONTRACT_ADDRESS as `0x${string}`,
                abi: nftDropAbi as any,
                functionName: "totalSupply",
                args: [BigInt(id)],
              }) as Promise<bigint>,
              (publicClient.readContract as any)({
                address: NFT_CONTRACT_ADDRESS as `0x${string}`,
                abi: nftDropAbi as any,
                functionName: "maxTotalSupply",
                args: [BigInt(id)],
              }) as Promise<bigint>,
            ]);

            const remaining = maxTotalSupply > totalSupply ? maxTotalSupply - totalSupply : BigInt(0);
            return { id, totalSupply, maxTotalSupply, remaining } as SupplyInfo;
          })
        );
        supplies.push(...batchResults);
        // Delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < TOKEN_IDS.length) {
          await new Promise((res) => setTimeout(res, 500));
        }
      }

      setSupplyInfo(supplies);
    } catch (error) {
      console.error("Failed to fetch supply info:", error);
      setErrorMessage("Failed to load supply data");
    } finally {
      setLoadingSupplies(false);
    }
  }, []);


  // Fetch supply info and claim conditions on mount and when contract address changes
  // Fetch supply info first, then claim conditions sequentially to avoid
  // overwhelming the RPC endpoint with concurrent requests on mount.
  useEffect(() => {
    if (typeof window !== "undefined") {
      fetchSupplyInfo().then(() => fetchAllClaimConditions());
    }
  }, [fetchSupplyInfo, fetchAllClaimConditions]);

  // Reset justMinted when wallet connects or address changes
  useEffect(() => {
    if (typeof window !== "undefined" && isConnected && address) {
      setJustMinted(false); // Reset justMinted when wallet changes
    } else {
      setLastMintedTokenId(null);
      setMintedTokenUri(null);
      setJustMinted(false);
    }
  }, [isConnected, address]);

  // Handle mint success
  useEffect(() => {
    if (isMintConfirmed && mintTxHash) {
      fetchSupplyInfo();
      fetchAllClaimConditions();
      setIsMinting(false);
      setJustMinted(true);
      showSuccess("NFT minted successfully!");
    }
  }, [isMintConfirmed, mintTxHash, fetchSupplyInfo, fetchAllClaimConditions, showSuccess]);

  // Handle mint errors
  useEffect(() => {
    if (mintError) {
      setIsMinting(false);
      const appError = handleWalletError(mintError);
      showError(appError.message);
    }
  }, [mintError, showError]);

  const handleConnect = useCallback(() => {
    const connector = connectors[0];
    if (!connector) return;
    connect({ connector });
  }, [connect, connectors]);

  const handleMint = useCallback(async () => {
    // Clear previous errors
    setErrorMessage(null);

    // Pre-flight checks
    const walletError = checkWalletConnection(address, isConnected);
    if (walletError) {
      showError(walletError.message);
      return;
    }

    const networkError = checkNetwork(chainId);
    if (networkError) {
      showError(networkError.message);
      return;
    }

    if (!NFT_CONTRACT_ADDRESS) {
      showError("Contract not configured. Mint is disabled.");
      return;
    }

    // Build candidates with remaining supply > 0 and valid claim conditions
    const candidates = supplyInfo.filter((info) => {
      if (info.remaining <= BigInt(0)) return false;
      const claim = claimInfo.get(info.id);
      if (!claim || !claim.condition) return false;
      
      // Check if mint has started
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (claim.condition.startTimestamp > now) return false;
      
      // Check if there's remaining supply in claim condition
      if (claim.condition.supplyClaimed >= claim.condition.maxClaimableSupply) return false;
      
      return true;
    });

    if (candidates.length === 0) {
      showError("No tokens available for minting at this time.");
      return;
    }

    try {
      // Select random tokenId weighted by remaining supply
      const tokenId = pickWeightedTokenId(candidates);
      const claim = claimInfo.get(tokenId);

      if (!claim || !claim.condition) {
        showError("Mint conditions not available. Please try again.");
        return;
      }

      const { pricePerToken, currency, quantityLimitPerWallet } = claim.condition;
      const quantity = BigInt(1);

      // Verify mint has started
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (claim.condition.startTimestamp > now) {
        showError("Mint has not started yet. Please wait.");
        return;
      }

      // Verify claim condition has remaining supply
      if (claim.condition.supplyClaimed >= claim.condition.maxClaimableSupply) {
        showError("This token type is sold out. Please try again.");
        return;
      }

      // Calculate total value needed (pricePerToken * quantity)
      const totalValue = pricePerToken * quantity;

      // Native ETH currency address (Thirdweb-style - required for this contract)
      const NATIVE_CURRENCY = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as `0x${string}`;
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
      
      // Check if currency is native ETH
      const isNativeCurrency = 
        currency.toLowerCase() === NATIVE_CURRENCY.toLowerCase() ||
        currency.toLowerCase() === ZERO_ADDRESS.toLowerCase();

      const normalizedCurrency = isNativeCurrency ? NATIVE_CURRENCY : currency;

      // Prepare allowlist proof
      const allowlistProof = {
        proof: [] as `0x${string}`[],
        quantityLimitPerWallet,
        pricePerToken,
        currency: normalizedCurrency,
      };

      setIsMinting(true);

      // Call claim function
      await writeMint({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: nftDropAbi as any,
        functionName: "claim",
        args: [
          address as `0x${string}`,
          BigInt(tokenId),
          quantity,
          normalizedCurrency,
          pricePerToken,
          allowlistProof,
          "0x" as `0x${string}`,
        ],
        value: isNativeCurrency ? totalValue : BigInt(0),
      } as any);

    } catch (error) {
      console.error("Mint error:", error);
      setIsMinting(false);
      
      const appError = handleTransactionError(error);
      showError(appError.message);
    }
  }, [address, isConnected, chainId, supplyInfo, claimInfo, writeMint, showError]);

  // Calculate total minted and remaining across all tokenIds
  const totalMinted = useMemo(() => {
    return supplyInfo.reduce((sum, info) => sum + Number(info.totalSupply), 0);
  }, [supplyInfo]);

  const totalMaxSupply = useMemo(() => {
    return supplyInfo.reduce((sum, info) => sum + Number(info.maxTotalSupply), 0);
  }, [supplyInfo]);

  const totalRemaining = useMemo(() => {
    return Math.max(0, totalMaxSupply - totalMinted);
  }, [totalMinted, totalMaxSupply]);

  const mintedProgress = useMemo(() => {
    if (totalMaxSupply === 0) return 0;
    return Math.min(100, Math.max(0, (totalMinted / totalMaxSupply) * 100));
  }, [totalMinted, totalMaxSupply]);

  // Get representative price from claim conditions (use first available token's price)
  // Only returns price if:
  // 1. Claim condition exists and is valid
  // 2. Token has remaining supply
  // 3. Mint has started (startTimestamp <= now)
  // 4. Claim condition has remaining supply (supplyClaimed < maxClaimableSupply)
  const representativePrice = useMemo(() => {
    for (const info of supplyInfo) {
      const claim = claimInfo.get(info.id);
      if (claim?.condition && !claim.error) {
        // Check if token has remaining supply
        if (info.remaining <= BigInt(0)) continue;

        // Check if mint has started
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (claim.condition.startTimestamp > now) continue;

        // Check if claim condition has remaining supply
        if (claim.condition.supplyClaimed >= claim.condition.maxClaimableSupply) continue;

        // Return full condition (includes price and currency)
        return claim.condition;
      }
    }
    return null;
  }, [supplyInfo, claimInfo]);

  const priceDisplay = useMemo(() => {
    if (!representativePrice) return null;

    try {
      const { pricePerToken, currency } = representativePrice;
      const ethLikeAddresses = [
        "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "0x0000000000000000000000000000000000000000",
      ];
      const isEth =
        ethLikeAddresses.includes(currency.toLowerCase());

      const symbol = isEth ? "ETH" : "TOKEN";
      const formattedPrice = formatEther(pricePerToken);

      return { formattedPrice, symbol };
    } catch {
      return null;
    }
  }, [representativePrice]);

  // Button states and labels
  const primaryButtonLabel = useMemo(() => {
    if (justMinted || isMintConfirmed) return "Minted";
    return "Mint Premium Pass";
  }, [isMintConfirmed, justMinted]);

  const primaryButtonClasses = useMemo(() => {
    if (!NFT_CONTRACT_ADDRESS) {
      return "w-full py-4 text-lg font-semibold rounded-xl bg-white/10 text-white/50 cursor-not-allowed";
    }
    if (!address || !isConnected) {
      return "w-full py-4 text-lg font-semibold rounded-xl bg-white/15 text-white hover:bg-white/25 transition";
    }
    if (justMinted || isMintConfirmed) {
      return "w-full py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white";
    }
    return "w-full py-4 text-lg font-semibold rounded-xl bg-gradient-to-r from-teal to-mint text-ink transition disabled:opacity-60";
  }, [address, isConnected, justMinted, isMintConfirmed]);

  const primaryButtonDisabled =
    isConnecting ||
    isMinting ||
    isMintPending ||
    isMintConfirming ||
    !NFT_CONTRACT_ADDRESS ||
    loadingSupplies ||
    loadingClaimConditions ||
    representativePrice === null;

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const GALLERY_IMAGES = useMemo(
    () => ["/fish1.jpg", "/fish2.jpg", "/fish3.jpg", "/fish4.jpg"],
    [],
  );

  const lastMintedDisplay = useMemo(() => {
    if (lastMintedTokenId === null) return null;
    const name = getNameFromTokenId(lastMintedTokenId);
    return name ?? "Minted FarFISH";
  }, [lastMintedTokenId]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Header title="Home" />

      <div className="flex-1 flex flex-col space-y-6 pt-4">
        {/* Hero Section with animated cards */}
        <div className="relative">
          <div className="exchange-panel p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-text">
                  Pick Your Pass
                </h2>
                <p className="text-muted text-xs">Two tiers, one clear choice</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Basic Tier */}
              <div className="rounded-lg border border-surface bg-ink p-4 transition-colors hover:border-muted">
                <div className="text-center">
                  <h3 className="font-bold text-white mb-2">Basic</h3>
                  <div className="space-y-1 text-xs text-muted">
                    <p>• Daily chest access</p>
                    <p>• Streak tracking</p>
                    <p>• Leaderboard entry</p>
                  </div>
                </div>
              </div>

              {/* Premium Tier */}
              <div className="relative rounded-lg border border-accent bg-ink p-4 transition-colors hover:bg-surface-raised">
                <div className="absolute -top-2 -right-2 bg-accent px-2 py-1 text-[10px] font-bold text-ink">
                  FEATURED
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-accent mb-2">Premium</h3>
                  <div className="space-y-1 text-xs text-text">
                    <p>• 2× chest yield</p>
                    <p>• Priority ranking</p>
                    <p>• Snapshot advantage</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-muted">
                Consistent activity compounds over time.
              </p>
            </div>
          </div>
        </div>

        {/* NFT Minting Section */}
        <div className="exchange-panel p-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-text">
                Get Your NFT
              </h2>
              <p className="text-muted text-xs">
                {totalMaxSupply ? `${totalMaxSupply.toLocaleString()} total · 4 rarities` : "Fetching supply…"}
              </p>
            </div>
          </div>

          {!NFT_CONTRACT_ADDRESS && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <AppIcon icon={Warning} size="lg" weight="fill" />
                <div>
                  <p className="font-semibold text-red-300">Contract Not Configured</p>
                  <p className="text-xs text-red-400">Minting unavailable</p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="rounded-lg border border-surface bg-ink p-3 text-center">
              <div className="text-2xl font-bold text-positive">
                {loadingSupplies ? "..." : totalMinted.toLocaleString()}
              </div>
              <div className="exchange-label">Minted</div>
            </div>
            <div className="rounded-lg border border-surface bg-ink p-3 text-center">
              <div className="text-2xl font-bold text-accent">
                {loadingSupplies ? "..." : `${mintedProgress.toFixed(1)}%`}
              </div>
              <div className="exchange-label">Progress</div>
            </div>
            <div className="rounded-lg border border-surface bg-ink p-3 text-center">
              <div className="text-2xl font-bold text-text">
                {loadingSupplies ? "..." : totalRemaining.toLocaleString()}
              </div>
              <div className="exchange-label">Left</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="exchange-label">Supply minted</span>
              <span className="exchange-label">{mintedProgress.toFixed(1)}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface"
              role="progressbar"
              aria-label="Mint progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={mintedProgress}
              aria-valuetext={`${mintedProgress.toFixed(1)} percent minted`}
            >
              <div
                className="h-full bg-accent transition-all duration-1000 ease-out"
                style={{ width: `${mintedProgress}%` }}
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleMint}
              disabled={primaryButtonDisabled}
              className={primaryButtonClasses}
            >
              {isMinting || isMintPending || isMintConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  {isMinting ? "Preparing..." : isMintPending ? "Confirming..." : "Processing..."}
                </div>
              ) : (
                primaryButtonLabel
              )}
            </button>

              {lastMintedDisplay && (
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-400/30">
                  <div className="flex items-center gap-3">
                    <AppIcon icon={Confetti} size="md" weight="fill" />
                    <div>
                      <p className="font-semibold text-green-300">It's yours!</p>
                      <p className="text-xs text-green-400">
                        {lastMintedDisplay}
                        {mintedTokenUri && (
                          <a href="/profile" className="ml-2 underline hover:text-green-300">
                            View NFT
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {priceDisplay && (
              <div className="text-center">
                <p className="text-sm text-white/70">
                  Price: <span className="font-bold text-cyan-400">{priceDisplay.formattedPrice} {priceDisplay.symbol}</span> + gas
                </p>
              </div>
            )}
          </div>

          {toast && (
            <div className={`
              mt-4 p-4 rounded-2xl border backdrop-blur-sm
              ${toast.type === "success" 
                ? "bg-green-500/10 border-green-400/30 text-green-300" 
                : "bg-red-500/10 border-red-400/30 text-red-300"
              }
            `}>
              <div className="flex items-center gap-3">
                {toast.type === "success" ? <AppIcon icon={CheckCircle} size="md" weight="fill" /> : <AppIcon icon={XCircle} size="md" weight="fill" />}
                <p className="font-medium">{toast.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Why Mint Section */}
        <div className="app-panel shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg flex-shrink-0">
              <AppIcon icon={Diamond} size="md" weight="fill" className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Why FarFISH?
              </h3>
              <p className="text-white/60 text-sm">The compounding edge</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { icon: GameController, title: "Future Games", desc: "Early access to play-to-earn" },
              { icon: RocketLaunch, title: "Compounding Rewards", desc: "Every action builds on the last" },
              { icon: Waveform, title: "Built on Base", desc: "Fast, cheap, on-chain" },
              { icon: Clock, title: "Daily Edge", desc: "Small habits, outsized returns" },
              { icon: Trophy, title: "Early Access", desc: "First in line, every launch" }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
                <div className="w-9 h-9 rounded-lg bg-white/15 border border-white/30 flex items-center justify-center flex-shrink-0">
                  <AppIcon icon={item.icon} size="sm" weight="bold" className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm leading-tight">{item.title}</p>
                  <p className="text-xs text-white/55 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collection Preview */}
        <div className="app-panel shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg">
              <AppIcon icon={Diamond} size="lg" weight="fill" className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Collection Preview
              </h3>
              <p className="text-white/70 text-sm">Four rarities. One collection.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* BlueFin */}
            <div className="group relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl overflow-hidden border border-blue-400/30 hover:border-blue-400/60 transition-all duration-300 hover:scale-105" style={{ aspectRatio: '1 / 1' }}>
              <Image
                src="/bluefin.jpg"
                alt="BlueFin"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-xl">BlueFin</p>
              </div>
            </div>

            {/* GoldRay */}
            <div className="group relative bg-gradient-to-br from-yellow-500/20 to-amber-500/20 rounded-2xl overflow-hidden border border-yellow-400/30 hover:border-yellow-400/60 transition-all duration-300 hover:scale-105" style={{ aspectRatio: '1 / 1' }}>
              <Image
                src="/goldray.jpg"
                alt="GoldRay"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-xl">GoldRay</p>
              </div>
            </div>

            {/* RedSpike */}
            <div className="group relative bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-2xl overflow-hidden border border-red-400/30 hover:border-red-400/60 transition-all duration-300 hover:scale-105" style={{ aspectRatio: '1 / 1' }}>
              <Image
                src="/redspike.jpg"
                alt="RedSpike"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-xl">RedSpike</p>
              </div>
            </div>

            {/* ShadowGill */}
            <div className="group relative bg-gradient-to-br from-purple-500/20 to-black/40 rounded-2xl overflow-hidden border border-purple-400/30 hover:border-purple-400/60 transition-all duration-300 hover:scale-105" style={{ aspectRatio: '1 / 1' }}>
              <Image
                src="/shadowgill.jpg"
                alt="ShadowGill"
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <p className="text-white font-bold text-xl">ShadowGill</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
