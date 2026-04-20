import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// ── Load env ──────────────────────────────────────────────────────────────────
// Use process.cwd() — always resolves to project root regardless of module mode.
// NEVER log or print the private key.

const cwd          = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");
const envPath      = path.join(cwd, ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn("[hardhat] No .env.local found. Run: node scripts/setupEnv.js");
}

// ── Private key — read once, never logged ─────────────────────────────────────
const rawKey    = process.env.DEPLOYER_PRIVATE_KEY?.trim() ?? "";
const PRIVATE_KEY = rawKey.startsWith("0x") ? rawKey : rawKey ? `0x${rawKey}` : "";

if (rawKey && !/^(0x)?[0-9a-fA-F]{64}$/.test(rawKey)) {
  console.error("[hardhat] ERROR: DEPLOYER_PRIVATE_KEY has invalid format (expected 64 hex chars).");
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    arcTestnet: {
      url:      "https://rpc.testnet.arc.network",
      chainId:  5042002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    sepolia: {
      url:      "https://rpc.sepolia.org",
      chainId:  11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
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
