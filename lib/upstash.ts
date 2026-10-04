import { getServerReferralEnv } from "../app/config/referral";

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

const getUpstashConfig = () => {
  try {
    const { upstashUrl, upstashToken } = getServerReferralEnv();
    const baseUrl = upstashUrl.endsWith("/") ? upstashUrl.slice(0, -1) : upstashUrl;
    return { baseUrl, upstashToken };
  } catch {
    return null;
  }
};

const buildUrl = (baseUrl: string, path: string) => `${baseUrl}/${path}`;

const upstashRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const config = getUpstashConfig();
  if (!config) {
    throw new Error("Upstash configuration is missing");
  }

  const res = await fetch(buildUrl(config.baseUrl, path), {
    method: init?.method ?? "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.upstashToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash request failed (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as UpstashResponse<T>;
  if (data.error) {
    throw new Error(data.error);
  }

  return data.result as T;
};

export const getKey = async <T = string>(key: string): Promise<T | null> => {
  try {
    const result = await upstashRequest<T | null>(`get/${encodeURIComponent(key)}`);
    return (result as T | null) ?? null;
  } catch {
    return null;
  }
};

export const setKey = async (key: string, value: string | Record<string, unknown>) => {
  const stored = typeof value === "string" ? value : JSON.stringify(value);
  try {
    return await upstashRequest<number>(`set/${encodeURIComponent(key)}/${encodeURIComponent(stored)}`, {
      method: "POST",
    });
  } catch {
    // Swallow errors so callers can choose how to handle missing KV
    return 0;
  }
};

export const incrKey = async (key: string) => {
  try {
    return await upstashRequest<number>(`incr/${encodeURIComponent(key)}`, { method: "POST" });
  } catch {
    return 0;
  }
};

export const sadd = async (set: string, value: string) => {
  try {
    return await upstashRequest<number>(`sadd/${encodeURIComponent(set)}/${encodeURIComponent(value)}`, {
      method: "POST",
    });
  } catch {
    return 0;
  }
};

export const smembers = async (set: string) => {
  try {
    const result = await upstashRequest<string[] | null>(`smembers/${encodeURIComponent(set)}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

export const keys = async (pattern: string) => {
  try {
    const result = await upstashRequest<string[] | null>(`keys/${encodeURIComponent(pattern)}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};