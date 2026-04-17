// ── In-browser GM contract deployment ────────────────────────────────────────
// Deploys GM.sol directly from the browser using MetaMask signer.
// Used when no contract address is configured.
// Stores the deployed address in localStorage via contractRegistry.

import { BrowserProvider, ContractFactory } from "ethers";
import { ARC_CHAIN_ID } from "./chains";
import { assertChain } from "./network";
import { saveGMAddress } from "./contractRegistry";
import gmArtifact from "./gmBytecode.json";

export interface DeployGMResult {
  address: string;
  txHash: string;
  explorerUrl: string;
}

export async function deployGMContract(): Promise<DeployGMResult> {
  if (typeof window === "undefined") throw new Error("Not in browser");

  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");

  // Must be on Arc to deploy
  await assertChain(ARC_CHAIN_ID);

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();

  console.log("[deployGM] Deploying GM contract on Arc Testnet…");

  const factory = new ContractFactory(
    gmArtifact.abi,
    gmArtifact.bytecode,
    signer
  );

  const contract = await factory.deploy({ gasLimit: 3_000_000 });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash ?? "";

  console.log("[deployGM] Deployed at:", address);

  // Persist to localStorage so the app survives page reloads
  saveGMAddress(address);

  return {
    address,
    txHash,
    explorerUrl: `https://testnet.arcscan.app/address/${address}`,
  };
}
