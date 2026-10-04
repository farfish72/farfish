"use client";

import { createContext, useContext } from "react";
import type { Address } from "viem";
import type { UserStake } from "../hooks/useUserStakes";

export type AppStateValue = {
  address?: Address;
  isConnected: boolean;
  chainId?: number;
  isBaseNetwork: boolean;
  stakes: UserStake[];
  activeStakes: UserStake[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

export const AppStateContext = createContext<AppStateValue | null>(null);

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}