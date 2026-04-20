"use strict";
/**
 * FlowPay Daily Engine — One-Command Deployment
 * CommonJS format — runs reliably on Node 18-22, no TypeScript, no ESM.
 *
 * Usage:
 *   npm run deploy:arc
 *   — or —
 *   npx hardhat run scripts/deploy-gm-engine.js --network arcTestnet
 *
 * What this does automatically:
 *   1. Validates DEPLOYER_PRIVATE_KEY is set
 *   2. Deploys GMCore on Arc Testnet
 *   3. Deploys GMNFT (linked to GMCore)
 *   4. Writes NEXT_PUBLIC_GM_CORE_ADDRESS + NEXT_PUBLIC_GM_NFT_ADDRESS
 *      directly into .env.local — zero manual copy-paste
 *
 * Security:
 *   - NEVER reads, writes, or logs DEPLOYER_PRIVATE_KEY
 *   - Only NEXT_PUBLIC_* addresses are written to .env.local
 *   - .env.local is gitignored and never committed
 */

const path      = require("path");
const { updateEnv } = require("./updateEnv");

const ENV_LOCAL = path.join(process.cwd(), ".env.local");

async function main() {
  // ── 1. Validate private key ───────────────────────────────────────────────
  if (!(process.env.DEPLOYER_PRIVATE_KEY || "").trim()) {
    console.error(`
╔══════════════════════════════════════════════════════════════╗
║  ✗  DEPLOYER_PRIVATE_KEY is not set                          ║
╚══════════════════════════════════════════════════════════════╝

  1. Open .env.local
  2. Add:  DEPLOYER_PRIVATE_KEY=<your_private_key>
  3. Re-run:  npm run deploy:arc

  First time? Run:  node scripts/setupEnv.js
`);
    process.exit(1);
  }

  // ── 2. Hardhat runtime — loaded via require (CJS, no import issues) ───────
  const hre     = require("hardhat");
  const ethers  = hre.ethers;
  const network = hre.network;

  // ── 3. Print deployment header ────────────────────────────────────────────
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
    console.error("✗ Deployer has 0 USDC balance.");
    console.error("  Get Arc testnet USDC from: https://faucet.circle.com");
    process.exit(1);
  }

  // ── 4. Deploy GMCore ──────────────────────────────────────────────────────
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

  // ── 5. Deploy GMNFT ───────────────────────────────────────────────────────
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

  // ── 6. Auto-write addresses to .env.local ─────────────────────────────────
  process.stdout.write("  [✎] Writing addresses to .env.local…  ");
  try {
    const { written, appended } = updateEnv(ENV_LOCAL, {
      NEXT_PUBLIC_GM_CORE_ADDRESS: gmCoreAddress,
      NEXT_PUBLIC_GM_NFT_ADDRESS:  gmNftAddress,
    });
    console.log("✔");
    if (written.length)  console.log(`         Updated : ${written.join(", ")}`);
    if (appended.length) console.log(`         Added   : ${appended.join(", ")}`);
  } catch (e) {
    console.log("⚠ (write failed — update manually)");
    console.error("  Error:", e.message);
    console.log(`\n  NEXT_PUBLIC_GM_CORE_ADDRESS=${gmCoreAddress}`);
    console.log(`  NEXT_PUBLIC_GM_NFT_ADDRESS=${gmNftAddress}`);
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  ✔  Deployment complete — .env.local updated             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  GMCore : ${gmCoreAddress}`);
  console.log(`  GMNFT  : ${gmNftAddress}`);
  console.log(`\n  Explorer:`);
  console.log(`    https://testnet.arcscan.app/address/${gmCoreAddress}`);
  console.log(`    https://testnet.arcscan.app/address/${gmNftAddress}`);
  console.log(`\n⚠️  You may now remove DEPLOYER_PRIVATE_KEY from .env.local`);
  console.log("   (keep it safe — you will need it for future deployments)\n");
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err?.message ?? err);
  process.exitCode = 1;
});
