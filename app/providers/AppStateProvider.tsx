"use client";

import type { PropsWithChildren } from "react";
import { useAccount, useChainId } from "wagmi";
import { base } from "viem/chains";
import { AppStateContext } from "../state/AppStateContext";
import { useUserStakesSource } from "../hooks/useUserStakes";

export default function AppStateProvider({ children }: PropsWithChildren) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const stakes = useUserStakesSource();

  return (
    <AppStateContext.Provider
      value={{
        address,
        isConnected,
        chainId,
        isBaseNetwork: chainId === base.id,
        ...stakes,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}