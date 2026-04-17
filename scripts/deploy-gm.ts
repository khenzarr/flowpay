/**
 * GM Contract Deployment Script
 * Target: Arc Testnet (chainId 5042002)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-gm.ts --network arcTestnet
 *
 * Prerequisites:
 *   1. Add DEPLOYER_PRIVATE_KEY to .env.local
 *   2. Ensure wallet has Arc testnet USDC for gas
 *      (Arc uses USDC as native gas token)
 *   3. Get testnet USDC from: https://faucet.circle.com
 */

import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("─────────────────────────────────────────");
  console.log("GM Contract Deployment");
  console.log("─────────────────────────────────────────");
  console.log("Network:  ", network.name);
  console.log("ChainId:  ", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatUnits(balance, 6), "USDC (Arc native)");
  console.log("─────────────────────────────────────────");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 USDC balance. Get Arc testnet USDC from https://faucet.circle.com"
    );
  }

  console.log("\nDeploying GM contract...");
  const GMFactory = await ethers.getContractFactory("GM");
  const gm = await GMFactory.deploy();
  await gm.waitForDeployment();

  const address = await gm.getAddress();
  const deployTx = gm.deploymentTransaction();

  console.log("\n✓ GM deployed successfully");
  console.log("─────────────────────────────────────────");
  console.log("Contract address:", address);
  console.log("Deploy tx hash:  ", deployTx?.hash ?? "N/A");
  console.log("Explorer:        ", `https://testnet.arcscan.app/address/${address}`);
  console.log("─────────────────────────────────────────");

  // Verify deployment by calling cooldownRemaining
  const remaining = await (gm as any).cooldownRemaining(deployer.address);
  console.log("Cooldown check:  ", remaining.toString(), "seconds (should be 0)");

  console.log(
    "\n📋 NEXT STEP: Update lib/constants.ts with the contract address above"
  );
  console.log(`   GM_CONTRACT_ADDRESS = "${address}"`);
}

main().catch((err) => {
  console.error("\n✗ Deployment failed:", err.message ?? err);
  process.exitCode = 1;
});
