/**
 * FlowPay — Safe Environment Setup
 * Plain JS — runs without ts-node, safe to call from npm scripts.
 *
 * Usage:
 *   node scripts/setupEnv.js
 *
 * Creates .env.local from .env.example if it doesn't exist.
 * NEVER writes private keys or secrets.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT      = path.resolve(__dirname, "..");
const EXAMPLE   = path.join(ROOT, ".env.example");
const ENV_LOCAL = path.join(ROOT, ".env.local");

function main() {
  if (!fs.existsSync(EXAMPLE)) {
    console.error("✗ .env.example not found.");
    process.exit(1);
  }

  if (fs.existsSync(ENV_LOCAL)) {
    // Already exists — just validate DEPLOYER_PRIVATE_KEY is set
    const content = fs.readFileSync(ENV_LOCAL, "utf8");
    const hasKey  = /^DEPLOYER_PRIVATE_KEY=.+/m.test(content);
    if (!hasKey) {
      console.log("⚠  .env.local exists but DEPLOYER_PRIVATE_KEY is empty.");
      console.log("   Open .env.local and paste your private key before deploying.\n");
    } else {
      console.log("✔  .env.local ready.\n");
    }
    return;
  }

  // Create from template
  const template = fs.readFileSync(EXAMPLE, "utf8");
  fs.writeFileSync(ENV_LOCAL, template, "utf8");

  console.log("✔  Created .env.local from .env.example");
  console.log("\n   Next steps:");
  console.log("   1. Open .env.local");
  console.log("   2. Paste your DEPLOYER_PRIVATE_KEY");
  console.log("   3. Run: npm run deploy:arc\n");
  console.log("⚠  Never commit .env.local — it is gitignored.\n");
}

main();
