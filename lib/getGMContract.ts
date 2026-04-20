// GM contract resolver — checks env → localStorage
import { getGMCoreAddress, getGMNFTAddress } from "./contractRegistry";

export function resolveGMAddress(): string | null {
  return getGMCoreAddress();
}

export function hasGMContract(): boolean {
  return !!getGMCoreAddress();
}

export function hasGMNFT(): boolean {
  return !!getGMNFTAddress();
}

export function hasBothContracts(): boolean {
  return !!getGMCoreAddress() && !!getGMNFTAddress();
}
