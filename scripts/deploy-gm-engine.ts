/**
 * FlowPay Daily Engine — Deployment Script
 * Deploys GMCore + GMNFT to Arc Testnet
 *
 * Usage:
 *   npx hardhat run scripts/deploy-gm-engine.ts --network arcTestnet
 *
 * Prerequisites:
 *   1. DEPLOYER_PRIVATE_KEY set in .env.local (never commit this)
 *   2. Arc testnet USDC for gas → https://faucet.circle.com
 *
 * Security:
 *   - This script NEVER writes the private key anywhere
 *   - It ONLY writes NEXT_PUBLIC_* addresses to stdout
 *   - Copy the output addresses manually into .env.local
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const SECURITY_REMINDER = `
⚠️  After deployment:
   1. Copy the addresses above into .env.local
   2. Remove DEPLOYER_PRIVATE_KEY from .env.local
   3. Never commit .env.local
`;

async function main() {
  // ── Safety check — fail loudly if key is missing ──────────────────────────
  if (!process.env.DEPLOYER_PRIVATE_KEY?.trim()) {
    console.error(`
✗ DEPLOYER_PRIVATE_KEY is not set.

  1. Open .env.local
  2. Add: DEPLOYER_PRIVATE_KEY=<your_private_key>
  3. Re-run this script

  To create .env.local from template:
    node scripts/setupEnv.js
`);
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════════════");
  console.log("  FlowPay Daily Engine — Deployment");
  console.log("═══════════════════════════════════════════");
  console.log("Network:  ", network.name);
  console.log("ChainId:  ", (await ethers.provider.getNetwork()).chainId.toString());
  // Show deployer address but NEVER the private key
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatUnits(balance, 6), "USDC");
  console.log("═══════════════════════════════════════════\n");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 USDC balance.\n" +
      "Get Arc testnet USDC from: https://faucet.circle.com"
    );
  }

  // ── 1. Deploy GMCore ──────────────────────────────────────────────────────
  console.log("1/2  Deploying GMCore…");
  const GMCore    = await ethers.getContractFactory("GMCore");
  const gmCore    = await GMCore.deploy();
  await gmCore.waitForDeployment();
  const gmCoreAddress = await gmCore.getAddress();
  console.log("     ✓ GMCore:", gmCoreAddress);
  console.log("     TX:      ", gmCore.deploymentTransaction()?.hash);

  // ── 2. Deploy GMNFT ───────────────────────────────────────────────────────
  console.log("\n2/2  Deploying GMNFT…");
  const GMNFT  = await ethers.getContractFactory("GMNFT");
  const gmNft  = await GMNFT.deploy(gmCoreAddress);
  await gmNft.waitForDeployment();
  const gmNftAddress = await gmNft.getAddress();
  console.log("     ✓ GMNFT:", gmNftAddress);
  console.log("     TX:     ", gmNft.deploymentTransaction()?.hash);

  // ── Output — addresses only, no secrets ───────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════");
  console.log("\nExplorer links:");
  console.log(`  GMCore: https://testnet.arcscan.app/address/${gmCoreAddress}`);
  console.log(`  GMNFT:  https://testnet.arcscan.app/address/${gmNftAddress}`);

  // Print the exact lines to paste — addresses only, never the key
  console.log("\n📋 Paste these into .env.local:");
  console.log("─────────────────────────────────────────");
  console.log(`NEXT_PUBLIC_GM_CORE_ADDRESS=${gmCoreAddress}`);
  console.log(`NEXT_PUBLIC_GM_NFT_ADDRESS=${gmNftAddress}`);
  console.log("─────────────────────────────────────────");
  console.log(SECURITY_REMINDER);
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err.message ?? err);
  process.exitCode = 1;
});
