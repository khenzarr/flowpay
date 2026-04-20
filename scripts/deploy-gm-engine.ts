/**
 * FlowPay Daily Engine — Deployment Script
 * Deploys GMCore + GMNFT to Arc Testnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-gm-engine.ts --network arcTestnet
 *
 * Prerequisites:
 *   1. DEPLOYER_PRIVATE_KEY in .env.local
 *   2. Arc testnet USDC for gas (faucet.circle.com)
 */

import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════════════");
  console.log("  FlowPay Daily Engine — Deployment");
  console.log("═══════════════════════════════════════════");
  console.log("Network:  ", network.name);
  console.log("ChainId:  ", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatUnits(balance, 6), "USDC");
  console.log("═══════════════════════════════════════════\n");

  if (balance === 0n) {
    throw new Error("Deployer has 0 USDC. Get Arc testnet USDC from https://faucet.circle.com");
  }

  // ── 1. Deploy GMCore ──────────────────────────────────────────────────────
  console.log("1/2  Deploying GMCore…");
  const GMCore = await ethers.getContractFactory("GMCore");
  const gmCore = await GMCore.deploy();
  await gmCore.waitForDeployment();
  const gmCoreAddress = await gmCore.getAddress();
  console.log("     ✓ GMCore:", gmCoreAddress);
  console.log("     TX:", gmCore.deploymentTransaction()?.hash);

  // ── 2. Deploy GMNFT (with GMCore address) ─────────────────────────────────
  console.log("\n2/2  Deploying GMNFT…");
  const GMNFT = await ethers.getContractFactory("GMNFT");
  const gmNft = await GMNFT.deploy(gmCoreAddress);
  await gmNft.waitForDeployment();
  const gmNftAddress = await gmNft.getAddress();
  console.log("     ✓ GMNFT:", gmNftAddress);
  console.log("     TX:", gmNft.deploymentTransaction()?.hash);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════");
  console.log("GMCore:", gmCoreAddress);
  console.log("GMNFT: ", gmNftAddress);
  console.log("\nExplorer:");
  console.log("  GMCore:", `https://testnet.arcscan.app/address/${gmCoreAddress}`);
  console.log("  GMNFT: ", `https://testnet.arcscan.app/address/${gmNftAddress}`);
  console.log("\n📋 Add to .env.local:");
  console.log(`  NEXT_PUBLIC_GM_CORE_ADDRESS=${gmCoreAddress}`);
  console.log(`  NEXT_PUBLIC_GM_NFT_ADDRESS=${gmNftAddress}`);
  console.log("═══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err.message ?? err);
  process.exitCode = 1;
});
