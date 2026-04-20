/**
 * updateEnv(filePath, updates)
 *
 * Safely updates key=value pairs in an env file.
 *
 * Rules:
 *   - If key exists → replace its value in-place
 *   - If key doesn't exist → append at end
 *   - Lines that are comments or blank are preserved exactly
 *   - DEPLOYER_PRIVATE_KEY is NEVER touched, even if passed in updates
 *   - No other secret keys are ever written
 *
 * Usage (from deploy script):
 *   const { updateEnv } = require("./updateEnv");
 *   updateEnv(".env.local", {
 *     NEXT_PUBLIC_GM_CORE_ADDRESS: "0x...",
 *     NEXT_PUBLIC_GM_NFT_ADDRESS:  "0x...",
 *   });
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Keys that must NEVER be written by automation
const PROTECTED_KEYS = new Set([
  "DEPLOYER_PRIVATE_KEY",
  "PRIVATE_KEY",
  "SECRET",
  "MNEMONIC",
  "SEED",
]);

/**
 * @param {string} filePath  - absolute or relative path to the env file
 * @param {Record<string, string>} updates - key/value pairs to set
 * @returns {{ written: string[], appended: string[] }}
 */
function updateEnv(filePath, updates) {
  const absPath = path.resolve(process.cwd(), filePath);

  // Safety: refuse to write any protected key
  for (const key of Object.keys(updates)) {
    if (PROTECTED_KEYS.has(key)) {
      throw new Error(
        `[updateEnv] Refusing to write protected key: ${key}. ` +
        "Secrets must be set manually."
      );
    }
    // Also block anything that looks like a private key by value
    const val = updates[key];
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(val)) {
      throw new Error(
        `[updateEnv] Refusing to write value for "${key}" — ` +
        "it looks like a private key (64 hex chars)."
      );
    }
  }

  // Read existing file (or start empty)
  let existing = "";
  if (fs.existsSync(absPath)) {
    existing = fs.readFileSync(absPath, "utf8");
  }

  const lines = existing.split("\n");
  const written  = [];
  const toAppend = { ...updates };

  // Pass 1: replace existing keys in-place
  const updated = lines.map((line) => {
    // Skip comments and blank lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) return line;

    const key = line.slice(0, eqIdx).trim();
    if (key in toAppend) {
      const newLine = `${key}=${toAppend[key]}`;
      written.push(key);
      delete toAppend[key];
      return newLine;
    }
    return line;
  });

  // Pass 2: append keys that didn't exist
  const appended = [];
  const newKeys  = Object.keys(toAppend);
  if (newKeys.length > 0) {
    // Ensure file ends with newline before appending
    if (updated.length > 0 && updated[updated.length - 1] !== "") {
      updated.push("");
    }
    for (const key of newKeys) {
      updated.push(`${key}=${toAppend[key]}`);
      appended.push(key);
    }
  }

  fs.writeFileSync(absPath, updated.join("\n"), "utf8");
  return { written, appended };
}

module.exports = { updateEnv, PROTECTED_KEYS };
