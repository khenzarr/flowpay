/**
 * FlowPay Daily Engine — One-Command Deployment
 *
 * Usage:
 *   npm run deploy:arc
 *   — or —
 *   npx hardhat run scripts/deploy-gm-engine.ts --network arcTestnet
 *
 * Automatically:
 *   1. Validates DEPLOYER_PRIVATE_KEY
 *   2. Deploys GMCore on Arc Testnet
 *   3. Deploys GMNFT (linked to GMCore)
 *   4. Writes addresses into .env.local — no manual copy-paste
 *
 * Security:
 *   - NEVER reads, writes, or logs DEPLOYER_PRIVATE_KEY
 *   - Only NEXT_PUBLIC_* addresses are written to .env.local
 */

import { ethers, network } from "hardhat";
import path from "path";
import { createRequire } from "module";

// Use createRequire so we can require() a CJS module from a TS file
// that Hardhat compiles — avoids __dirname / import.meta issues
const require_ = createRequire(import.meta.url ?? __filename);
const { updateEnv } = require_(path.join(process.cwd(), "scripts", "updateEnv.js"));

const ENV_LOCAL = path.join(process.cwd(), ".env.local");

async function main() {
  // ── Validate key ──────────────────────────────────────────────────────────
  if (!process.env.DEPLOYER_PRIVATE_KEY?.trim()) {
    console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ✗  DEPLOYER_PRIVATE_KEY is not set                          ║
╚══════════════════════════════════════════════════════════════╝

  1. Open .env.local
  2. Add:  DEPLOYER_PRIVATE_KEY=<your_private_key>
  3. Re-run:  npm run deploy:arc
`);
    process.exit(1);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);
  const chainInfo  = await ethers.provider.getNetwork();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         FlowPay Daily Engine — Deployment                ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Network  : ${network.name} (chainId ${chainInfo.chainId})`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatUnits(balance, 6)} USDC`);
  console.log("──────────────────────────────────────────────────────────\n");

  if (balance === 0n) {
    console.error("✗ Deployer has 0 USDC. Get testnet USDC: https://faucet.circle.com");
    process.exit(1);
  }

  // ── Deploy GMCore ─────────────────────────────────────────────────────────
  process.stdout.write("  [1/2] Deploying GMCore…  ");
  const GMCore        = await ethers.getContractFactory("GMCore");
  const gmCore        = await GMCore.deploy();
  await gmCore.waitForDeployment();
  const gmCoreAddress = await gmCore.getAddress();
  const gmCoreTx      = gmCore.deploymentTransaction()?.hash ?? "";
  console.log("✔");
  console.log(`         Address : ${gmCoreAddress}`);
  console.log(`         TX      : ${gmCoreTx}`);
  console.log(`         Explorer: https://testnet.arcscan.app/tx/${gmCoreTx}\n`);

  // ── Deploy GMNFT ──────────────────────────────────────────────────────────
  process.stdout.write("  [2/2] Deploying GMNFT…   ");
  const GMNFT        = await ethers.getContractFactory("GMNFT");
  const gmNft        = await GMNFT.deploy(gmCoreAddress);
  await gmNft.waitForDeployment();
  const gmNftAddress = await gmNft.getAddress();
  const gmNftTx      = gmNft.deploymentTransaction()?.hash ?? "";
  console.log("✔");
  console.log(`         Address : ${gmNftAddress}`);
  console.log(`         TX      : ${gmNftTx}`);
  console.log(`         Explorer: https://testnet.arcscan.app/tx/${gmNftTx}\n`);

  // ── Write addresses to .env.local ─────────────────────────────────────────
  process.stdout.write("  [✎] Writing addresses to .env.local…  ");
  try {
    const { written, appended } = updateEnv(ENV_LOCAL, {
      NEXT_PUBLIC_GM_CORE_ADDRESS: gmCoreAddress,
      NEXT_PUBLIC_GM_NFT_ADDRESS:  gmNftAddress,
    });
    console.log("✔");
    if (written.length)  console.log(`         Updated : ${written.join(", ")}`);
    if (appended.length) console.log(`         Added   : ${appended.join(", ")}`);
  } catch (e: any) {
    console.log("⚠ (write failed — update manually)");
    console.error("  Error:", e.message);
    console.log(`\n  NEXT_PUBLIC_GM_CORE_ADDRESS=${gmCoreAddress}`);
    console.log(`  NEXT_PUBLIC_GM_NFT_ADDRESS=${gmNftAddress}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  ✔  Deployment complete — .env.local updated             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  GMCore : ${gmCoreAddress}`);
  console.log(`  GMNFT  : ${gmNftAddress}`);
  console.log(`\n  Explorer:`);
  console.log(`    https://testnet.arcscan.app/address/${gmCoreAddress}`);
  console.log(`    https://testnet.arcscan.app/address/${gmNftAddress}`);
  console.log(`\n⚠️  You may now remove DEPLOYER_PRIVATE_KEY from .env.local\n`);
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err?.message ?? err);
  process.exitCode = 1;
});
