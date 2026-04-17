import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load .env.local (Next.js convention) then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";

if (!PRIVATE_KEY && process.env.NODE_ENV !== "test") {
  console.warn(
    "[hardhat] WARNING: DEPLOYER_PRIVATE_KEY not set in .env.local — deployment will fail"
  );
}

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
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: "auto",
    },
    // Ethereum Sepolia (for reference / testing)
    sepolia: {
      url: "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Path config — keeps artifacts out of Next.js src
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
