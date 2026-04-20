/**
 * FlowPay — Safe Environment Setup
 *
 * Creates .env.local from .env.example if it doesn't exist.
 * NEVER writes private keys or secrets.
 *
 * Usage:
 *   node scripts/setupEnv.js
 *   (or: npx ts-node scripts/setupEnv.ts)
 */

import * as fs   from "fs";
import * as path from "path";

const ROOT      = path.resolve(__dirname, "..");
const EXAMPLE   = path.join(ROOT, ".env.example");
const ENV_LOCAL = path.join(ROOT, ".env.local");

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║              FlowPay Environment Setup                       ║
╚══════════════════════════════════════════════════════════════╝
`;

const SECURITY_WARNING = `
⚠️  SECURITY REMINDER
────────────────────────────────────────────────────────────────
  .env.local is gitignored and will NEVER be committed.
  Your DEPLOYER_PRIVATE_KEY must ONLY exist on your machine.
  Never share it, paste it in chat, or push it to any repo.
────────────────────────────────────────────────────────────────
`;

function main() {
  console.log(BANNER);

  // Verify .env.example exists
  if (!fs.existsSync(EXAMPLE)) {
    console.error("✗ .env.example not found. Cannot continue.");
    process.exit(1);
  }

  // Check if .env.local already exists
  if (fs.existsSync(ENV_LOCAL)) {
    console.log("✓ .env.local already exists — skipping creation.");
    console.log("  Edit it manually to update values.\n");
    console.log(SECURITY_WARNING);
    return;
  }

  // Copy .env.example → .env.local (values stay empty)
  const template = fs.readFileSync(EXAMPLE, "utf8");
  fs.writeFileSync(ENV_LOCAL, template, "utf8");

  console.log("✓ Created .env.local from .env.example");
  console.log("\nNext steps:");
  console.log("  1. Open .env.local");
  console.log("  2. Fill in NEXT_PUBLIC_KIT_KEY");
  console.log("  3. Fill in NEXT_PUBLIC_FEE_RECIPIENT");
  console.log("  4. When deploying contracts:");
  console.log("     → Paste DEPLOYER_PRIVATE_KEY");
  console.log("     → Run: npx hardhat run scripts/deploy-gm-engine.ts --network arcTestnet");
  console.log("     → Paste the output addresses into NEXT_PUBLIC_GM_CORE_ADDRESS etc.");
  console.log("     → Remove DEPLOYER_PRIVATE_KEY again");
  console.log(SECURITY_WARNING);
}

main();
