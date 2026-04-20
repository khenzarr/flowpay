"use strict";
/**
 * Node.js version check for Hardhat compatibility.
 *
 * Hardhat officially supports Node 18-22.
 * Node 20 LTS is the recommended version.
 *
 * On unsupported versions: prints a warning but does NOT block execution,
 * because Hardhat 2.x often works on newer Node versions despite the warning.
 */

const [major] = process.versions.node.split(".").map(Number);

if (major < 18) {
  console.error(`\n✗ Node.js ${process.versions.node} is too old.`);
  console.error("  Minimum required: Node 18.");
  console.error("  Recommended: Node 20 LTS — https://nodejs.org\n");
  process.exit(1);
}

if (major > 22) {
  console.warn(`\n⚠  Node.js ${process.versions.node} is newer than Hardhat's tested range (18-22).`);
  console.warn("   Deployment may still work. If it fails, switch to Node 20:");
  console.warn("     nvm install 20 && nvm use 20\n");
  // Warn only — do NOT exit. Hardhat 2.x runs on Node 25 with warnings.
} else {
  console.log(`✔  Node.js ${process.versions.node} — compatible with Hardhat.\n`);
}
