// ── GM Contract Resolver ──────────────────────────────────────────────────────
// Single function that returns a valid GM contract address.
// Resolution order:
//   1. NEXT_PUBLIC_GM_CONTRACT_ADDRESS env var
//   2. localStorage (from a previous in-app deploy)
//   3. null — caller must prompt user to deploy

import { getGMAddress } from "./contractRegistry";

export function resolveGMAddress(): string | null {
  return getGMAddress(); // checks env → localStorage
}

export function hasGMContract(): boolean {
  return resolveGMAddress() !== null;
}
