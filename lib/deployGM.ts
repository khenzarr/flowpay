// Legacy single-contract deploy — kept for backward compat.
// New code should use deployGMEngine() from deployGMEngine.ts.
export { deployGMEngine as deployGMContract } from "./deployGMEngine";
export type { DeployEngineResult as DeployGMResult } from "./deployGMEngine";
