"use client";

import useAutoBindReferral from "../hooks/useAutoBindReferral";

/**
 * Component to handle auto-binding referrals from URL params
 * Call useAutoBindReferral hook
 */
export default function AutoBindReferral() {
  useAutoBindReferral();
  return null;
}
