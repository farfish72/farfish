const trimTrailingSlash = (url: string) => url.replace(/\/$/, "");

const missingPublicEnv = () => {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL");
  if (!process.env.NEXT_PUBLIC_CHAIN_ID) missing.push("NEXT_PUBLIC_CHAIN_ID");
  return missing;
};

const missingServerEnv = () => {
  const missing: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
  missing.push(...missingPublicEnv());
  return missing;
};

const getParsedChainId = () => {
  const chainIdRaw = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (!chainIdRaw) {
    throw new Error("NEXT_PUBLIC_CHAIN_ID is required");
  }
  const parsed = Number(chainIdRaw);
  if (!Number.isFinite(parsed)) {
    throw new Error("NEXT_PUBLIC_CHAIN_ID must be a number");
  }
  return parsed;
};

export const ensurePublicReferralEnv = () => {
  const missing = missingPublicEnv();
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

export const ensureReferralEnv = () => {
  const missing = missingServerEnv();
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

// Server-side env access with runtime validation. Call inside API handlers only.
export const getServerReferralEnv = () => {
  ensureReferralEnv();
  return {
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL as string,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN as string,
  };
};

// Client-side safe accessors that never throw at module import.
export const getSafePublicReferralEnv = () => {
  try {
    const missing = missingPublicEnv();
    if (missing.length) {
      return {
        appUrl: "",
        chainId: 0,
        missing,
      };
    }

    return {
      appUrl: trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL as string),
      chainId: getParsedChainId(),
      missing: [] as string[],
    };
  } catch {
    return {
      appUrl: "",
      chainId: 0,
      missing: ["UNKNOWN"],
    };
  }
};
