// ── Deployed contract addresses ───────────────────────────────────────────────
// Update GM_CONTRACT_ADDRESS after deploying contracts/GM.sol to Arc Testnet:
//   npx hardhat run scripts/deploy-gm.ts --network arcTestnet

export const GM_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_GM_CONTRACT_ADDRESS as string) ?? "";

// Fallback: if env var not set, warn in development
if (!GM_CONTRACT_ADDRESS && typeof window !== "undefined") {
  console.warn(
    "[FlowPay] GM_CONTRACT_ADDRESS not set. " +
    "Deploy contracts/GM.sol and set NEXT_PUBLIC_GM_CONTRACT_ADDRESS in .env.local"
  );
}
