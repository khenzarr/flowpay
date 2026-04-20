"use strict";
/**
 * Checks that Node.js version is compatible with Hardhat (18–22).
 * Run before any Hardhat command.
 */

const [major] = process.versions.node.split(".").map(Number);

if (major < 18) {
  console.error(`\n✗ Node.js ${process.versions.node} is too old.`);
  console.error("  Hardhat requires Node 18–22.");
  console.error("  Install Node 20: https://nodejs.org\n");
  process.exit(1);
}

if (major > 22) {
  console.error(`\n✗ Node.js ${process.versions.node} is not supported by Hardhat.`);
  console.error("  Hardhat requires Node 18–22 (Node 20 recommended).");
  console.error("\n  Fix options:");
  console.error("    nvm use 20          (if you have nvm)");
  console.error("    nvm install 20      (to install Node 20)");
  console.error("    https://nodejs.org  (manual install)\n");
  process.exit(1);
}

console.log(`✔  Node.js ${process.versions.node} — compatible with Hardhat.\n`);
