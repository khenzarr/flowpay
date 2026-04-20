import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// ── Load env ──────────────────────────────────────────────────────────────────
// Load .env.local first (Next.js convention), then .env as fallback.
// NEVER log or print the private key.

const envLocalPath = path.resolve(__dirname, ".env.local");
const envPath      = path.resolve(__dirname, ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(
    "[hardhat] No .env.local found. Run: node scripts/setupEnv.js"
  );
}

// ── Private key — read once, never logged ─────────────────────────────────────
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY?.trim() ?? "";

// Validate format if provided (64 hex chars, optional 0x prefix)
if (PRIVATE_KEY && !/^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error(
    "[hardhat] ERROR: DEPLOYER_PRIVATE_KEY has invalid format. " +
    "Expected 64 hex characters."
  );
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Arc Testnet
    // Source: https://docs.arc.network/arc/references/connect-to-arc
    arcTestnet: {
      url: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
      gasPrice: "auto",
    },
    // Ethereum Sepolia
    sepolia: {
      url: "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY.replace(/^0x/, "")}`] : [],
    },
  },
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
