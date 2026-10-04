"use client";

import React from "react";
import { RARITY_DISPLAY, STAKING_REWARDS, STAKING_TOKEN_RANGES } from "../constants";

export default function StakeTable() {
  const rarities = Object.keys(STAKING_TOKEN_RANGES) as Array<keyof typeof STAKING_TOKEN_RANGES>;
  const lockDurations: Array<30 | 90 | 180 | 360> = [30, 90, 180, 360];

  return (
    <section className="app-panel overflow-x-auto">
      <h3 className="font-semibold text-lg mb-4">Staking Rewards</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/70 border-b border-white/10">
              <th className="text-left py-3 px-2">Name</th>
              <th className="text-left py-3 px-2">Rarity</th>
              <th className="text-left py-3 px-2">30d FRH</th>
              <th className="text-left py-3 px-2">90d FRH</th>
              <th className="text-left py-3 px-2">180d FRH</th>
              <th className="text-left py-3 px-2">360d FRH</th>
            </tr>
          </thead>
          <tbody>
            {rarities.map((rarity) => {
              const rewards = STAKING_REWARDS[rarity];
              const display = RARITY_DISPLAY[rarity];

              return (
                <tr key={rarity} className="border-b border-white/10 hover:bg-white/5 transition">
                  <td className="py-3 px-2 font-medium">{display.name}</td>
                  <td className="py-3 px-2 text-white/70">{display.rarityLabel}</td>
                  {lockDurations.map((duration) => (
                    <td key={duration} className="py-3 px-2">
                      {rewards[duration].toLocaleString()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
    </section>
  );
}
