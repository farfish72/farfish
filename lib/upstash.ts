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

// In-memory fallback store for when Upstash Redis is not configured
const memStore = new Map<string, string>();
const memSets = new Map<string, Set<string>>();

export const getKey = async <T = string>(key: string): Promise<T | null> => {
  const config = getUpstashConfig();
  if (!config) {
    const val = memStore.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  try {
    const result = await upstashRequest<T | null>(`get/${encodeURIComponent(key)}`);
    return (result as T | null) ?? null;
  } catch {
    return null;
  }
};

export const setKey = async (key: string, value: string | Record<string, unknown>) => {
  const stored = typeof value === "string" ? value : JSON.stringify(value);
  const config = getUpstashConfig();
  if (!config) {
    memStore.set(key, stored);
    return 1;
  }

  try {
    return await upstashRequest<number>(`set/${encodeURIComponent(key)}/${encodeURIComponent(stored)}`, {
      method: "POST",
    });
  } catch {
    memStore.set(key, stored);
    return 0;
  }
};

export const incrKey = async (key: string) => {
  const config = getUpstashConfig();
  if (!config) {
    const curr = parseInt(memStore.get(key) || "0", 10) || 0;
    const next = curr + 1;
    memStore.set(key, next.toString());
    return next;
  }

  try {
    return await upstashRequest<number>(`incr/${encodeURIComponent(key)}`, { method: "POST" });
  } catch {
    return 0;
  }
};

export const sadd = async (set: string, value: string) => {
  const config = getUpstashConfig();
  if (!config) {
    if (!memSets.has(set)) memSets.set(set, new Set());
    memSets.get(set)!.add(value);
    return 1;
  }

  try {
    return await upstashRequest<number>(`sadd/${encodeURIComponent(set)}/${encodeURIComponent(value)}`, {
      method: "POST",
    });
  } catch {
    return 0;
  }
};

export const smembers = async (set: string) => {
  const config = getUpstashConfig();
  if (!config) {
    return memSets.has(set) ? Array.from(memSets.get(set)!) : [];
  }

  try {
    const result = await upstashRequest<string[] | null>(`smembers/${encodeURIComponent(set)}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};

export const keys = async (pattern: string) => {
  const config = getUpstashConfig();
  if (!config) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return Array.from(memStore.keys()).filter((k) => regex.test(k));
  }

  try {
    const result = await upstashRequest<string[] | null>(`keys/${encodeURIComponent(pattern)}`);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
};