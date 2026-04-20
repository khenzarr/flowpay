// In-browser deployment of GMCore + GMNFT on Arc Testnet
// Called when no contract addresses are configured.

import { BrowserProvider, ContractFactory } from "ethers";
import { ARC_CHAIN_ID } from "./chains";
import { assertChain } from "./network";
import { saveGMCoreAddress, saveGMNFTAddress } from "./contractRegistry";
import gmCoreArtifact from "./gmCoreBytecode.json";
import gmNftArtifact  from "./gmNftBytecode.json";

export interface DeployEngineResult {
  gmCore: { address: string; txHash: string; explorerUrl: string };
  gmNft:  { address: string; txHash: string; explorerUrl: string };
}

export async function deployGMEngine(): Promise<DeployEngineResult> {
  if (typeof window === "undefined") throw new Error("Not in browser");

  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");

  await assertChain(ARC_CHAIN_ID);

  const provider = new BrowserProvider(eth);
  const signer   = await provider.getSigner();

  // ── 1. Deploy GMCore ──────────────────────────────────────────────────────
  console.log("[deployEngine] Deploying GMCore…");
  const coreFactory = new ContractFactory(gmCoreArtifact.abi, gmCoreArtifact.bytecode, signer);
  const coreContract = await coreFactory.deploy({ gasLimit: 3_000_000 });
  await coreContract.waitForDeployment();
  const coreAddress = await coreContract.getAddress();
  const coreTxHash  = coreContract.deploymentTransaction()?.hash ?? "";
  console.log("[deployEngine] GMCore deployed:", coreAddress);
  saveGMCoreAddress(coreAddress);

  // ── 2. Deploy GMNFT (pass GMCore address) ─────────────────────────────────
  console.log("[deployEngine] Deploying GMNFT…");
  const nftFactory  = new ContractFactory(gmNftArtifact.abi, gmNftArtifact.bytecode, signer);
  const nftContract = await nftFactory.deploy(coreAddress, { gasLimit: 3_000_000 });
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  const nftTxHash  = nftContract.deploymentTransaction()?.hash ?? "";
  console.log("[deployEngine] GMNFT deployed:", nftAddress);
  saveGMNFTAddress(nftAddress);

  return {
    gmCore: {
      address:     coreAddress,
      txHash:      coreTxHash,
      explorerUrl: `https://testnet.arcscan.app/address/${coreAddress}`,
    },
    gmNft: {
      address:     nftAddress,
      txHash:      nftTxHash,
      explorerUrl: `https://testnet.arcscan.app/address/${nftAddress}`,
    },
  };
}
