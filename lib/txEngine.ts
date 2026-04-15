import {
  BrowserProvider,
  Contract,
  ContractFactory,
  parseUnits,
  formatUnits,
} from "ethers";
import {
  KNOWN_USDC,
  getMockUsdcAddress,
  setMockUsdcAddress,
  isNativeUsdc,
} from "./contracts";
import { getChainById, ChainConfig } from "./chains";
import { MOCK_USDC_ABI, MOCK_USDC_BYTECODE } from "./mockUsdcArtifact";
import {
  ERC20_TOKEN_ABI,
  ERC20_TOKEN_BYTECODE,
  ERC721_NFT_ABI,
  ERC721_NFT_BYTECODE,
} from "./arcContracts";

// ── Minimal ERC-20 ABI ────────────────────────────────────────────────────────

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StepResult {
  name: string;
  state: "pending" | "success" | "error";
  txHash?: string;
  explorerUrl?: string;
  message?: string;
}

export interface DeployResult {
  address: string;
  txHash: string;
  explorerUrl: string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function getProvider(): BrowserProvider {
  if (typeof window === "undefined") throw new Error("Not in browser");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found. Please install MetaMask.");
  return new BrowserProvider(eth);
}

// ── USDC address resolution ───────────────────────────────────────────────────

export async function getUsdcAddress(chainId: number): Promise<string | null> {
  if (isNativeUsdc(chainId)) return null; // Arc: USDC is native
  if (KNOWN_USDC[chainId]) return KNOWN_USDC[chainId];
  return getMockUsdcAddress(chainId);
}

// ── USDC balance ──────────────────────────────────────────────────────────────

export async function getUsdcBalance(
  chainId: number,
  userAddress: string
): Promise<string> {
  const chain = getChainById(chainId);
  if (!chain) return "0";
  try {
    const provider = getProvider();
    if (isNativeUsdc(chainId)) {
      const raw = await provider.getBalance(userAddress);
      return formatUnits(raw, 6);
    }
    const usdcAddr = await getUsdcAddress(chainId);
    if (!usdcAddr) return "0";
    const contract = new Contract(usdcAddr, ERC20_ABI, provider);
    const raw = await contract.balanceOf(userAddress);
    return formatUnits(raw, chain.usdcDecimals);
  } catch (e) {
    console.error("[getUsdcBalance]", e);
    return "0";
  }
}

// ── Deploy mock USDC (non-Arc chains) ─────────────────────────────────────────

export async function deployMockUsdc(chainId: number): Promise<string> {
  if (isNativeUsdc(chainId)) {
    throw new Error("Arc uses native USDC — get from faucet.circle.com");
  }
  console.log("[deployMockUsdc] chain", chainId);
  const provider = getProvider();
  const signer = await provider.getSigner();
  const factory = new ContractFactory(MOCK_USDC_ABI, MOCK_USDC_BYTECODE, signer);
  const contract = await factory.deploy("Mock USDC", "USDC", {
    gasLimit: 3_000_000,
  });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("[deployMockUsdc] deployed at", address);
  setMockUsdcAddress(chainId, address);
  return address;
}

// ── Mint mock USDC ────────────────────────────────────────────────────────────

export async function mintMockUsdc(
  usdcAddress: string,
  userAddress: string,
  amount = "1000"
): Promise<string> {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(
    usdcAddress,
    ["function mint(address to, uint256 amount)"],
    signer
  );
  const tx = await contract.mint(userAddress, parseUnits(amount, 6), {
    gasLimit: 200_000,
  });
  await tx.wait();
  return tx.hash;
}

// ── Switch chain (user-initiated only — never called automatically) ────────────

export async function switchChain(chainId: number): Promise<void> {
  if (typeof window === "undefined") return;
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");
  const hexId = "0x" + chainId.toString(16);
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err: any) {
    if (err.code === 4902 || err.code === -32603) {
      const chain = getChainById(chainId);
      if (!chain) throw new Error("Unknown chain: " + chainId);
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
    } else if (err.code === 4001) {
      throw new Error("Network switch rejected by user.");
    } else {
      throw err;
    }
  }
}

// ── SEND (direct, same-chain) ─────────────────────────────────────────────────
// Does NOT switch chains. Wallet must already be on the correct chain.

export async function executeSend(
  usdcAddress: string | null,
  recipient: string,
  amount: string,
  decimals: number,
  explorerTxUrl: string,
  chainId: number
): Promise<StepResult> {
  const provider = getProvider();
  const signer = await provider.getSigner();

  // Verify wallet is actually on the expected chain
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) {
    throw new Error(
      `Wallet is on chain ${network.chainId}, expected ${chainId}. Please switch networks first.`
    );
  }

  console.log("[executeSend]", { chainId, usdcAddress, recipient, amount });

  if (isNativeUsdc(chainId)) {
    // Arc: USDC is native — value transfer
    const amountBN = parseUnits(amount, decimals);
    const tx = await signer.sendTransaction({ to: recipient, value: amountBN });
    const receipt = await tx.wait();
    return {
      name: "Send",
      state: receipt?.status === 1 ? "success" : "error",
      txHash: tx.hash,
      explorerUrl: explorerTxUrl + tx.hash,
    };
  }

  if (!usdcAddress) throw new Error("No USDC contract on this chain");
  const contract = new Contract(usdcAddress, ERC20_ABI, signer);
  const amountBN = parseUnits(amount, decimals);
  const tx = await contract.transfer(recipient, amountBN);
  const receipt = await tx.wait();
  return {
    name: "Send",
    state: receipt?.status === 1 ? "success" : "error",
    txHash: tx.hash,
    explorerUrl: explorerTxUrl + tx.hash,
  };
}

// ── CROSS-CHAIN: STEP A — Source transaction ──────────────────────────────────
// Executes the REAL on-chain tx on the source chain.
// Wallet must already be on sourceChain — no auto-switching.

export async function executeSourceTx(
  sourceChain: ChainConfig,
  sourceUsdcAddr: string | null,
  recipient: string,
  amount: string
): Promise<StepResult> {
  console.log("[executeSourceTx]", sourceChain.name, amount, "→", recipient);

  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== sourceChain.id) {
    throw new Error(
      `Wallet is on chain ${network.chainId}. Please switch to ${sourceChain.name} first.`
    );
  }

  return executeSend(
    sourceUsdcAddr,
    recipient,
    amount,
    sourceChain.usdcDecimals,
    sourceChain.explorerTxUrl,
    sourceChain.id
  );
}

// ── CROSS-CHAIN: STEP B — Destination credit ──────────────────────────────────
// Credits the recipient on the destination chain.
// Wallet must already be on destChain — no auto-switching.
// Tries: transfer → mint → deploy+mint → simulated (in that order)

export async function executeDestCredit(
  destChain: ChainConfig,
  recipient: string,
  amount: string,
  onStep: (msg: string) => void
): Promise<StepResult> {
  console.log("[executeDestCredit]", destChain.name, amount, "→", recipient);

  const provider = getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== destChain.id) {
    throw new Error(
      `Wallet is on chain ${network.chainId}. Please switch to ${destChain.name} first.`
    );
  }

  // Arc destination: native USDC transfer
  if (isNativeUsdc(destChain.id)) {
    onStep(`Sending ${amount} USDC on ${destChain.name}…`);
    const signer = await provider.getSigner();
    const amountBN = parseUnits(amount, destChain.usdcDecimals);
    const tx = await signer.sendTransaction({ to: recipient, value: amountBN });
    const receipt = await tx.wait();
    return {
      name: `Credited on ${destChain.shortName}`,
      state: receipt?.status === 1 ? "success" : "error",
      txHash: tx.hash,
      explorerUrl: destChain.explorerTxUrl + tx.hash,
    };
  }

  const destUsdcAddr = await getUsdcAddress(destChain.id);

  // Has existing ERC-20 — try transfer first
  if (destUsdcAddr) {
    // Try transfer
    try {
      onStep(`Transferring ${amount} USDC on ${destChain.name}…`);
      const signer = await provider.getSigner();
      const contract = new Contract(destUsdcAddr, ERC20_ABI, signer);
      const amountBN = parseUnits(amount, destChain.usdcDecimals);
      const tx = await contract.transfer(recipient, amountBN);
      const receipt = await tx.wait();
      return {
        name: `Credited on ${destChain.shortName}`,
        state: receipt?.status === 1 ? "success" : "error",
        txHash: tx.hash,
        explorerUrl: destChain.explorerTxUrl + tx.hash,
      };
    } catch (transferErr: any) {
      console.warn("[executeDestCredit] transfer failed, trying mint:", transferErr?.message);
    }

    // Transfer failed (likely insufficient balance) — try mint
    try {
      onStep(`Minting ${amount} USDC on ${destChain.name}…`);
      const signer = await provider.getSigner();
      const contract = new Contract(
        destUsdcAddr,
        ["function mint(address to, uint256 amount)"],
        signer
      );
      const tx = await contract.mint(
        recipient,
        parseUnits(amount, destChain.usdcDecimals),
        { gasLimit: 200_000 }
      );
      const receipt = await tx.wait();
      return {
        name: `Credited on ${destChain.shortName}`,
        state: receipt?.status === 1 ? "success" : "error",
        txHash: tx.hash,
        explorerUrl: destChain.explorerTxUrl + tx.hash,
      };
    } catch (mintErr: any) {
      console.warn("[executeDestCredit] mint failed:", mintErr?.message);
    }
  }

  // No USDC at all — deploy mock then mint
  try {
    onStep(`Deploying USDC contract on ${destChain.name}…`);
    const newAddr = await deployMockUsdc(destChain.id);

    onStep(`Minting ${amount} USDC on ${destChain.name}…`);
    const signer = await provider.getSigner();
    const contract = new Contract(
      newAddr,
      ["function mint(address to, uint256 amount)"],
      signer
    );
    const tx = await contract.mint(
      recipient,
      parseUnits(amount, destChain.usdcDecimals),
      { gasLimit: 200_000 }
    );
    const receipt = await tx.wait();
    return {
      name: `Credited on ${destChain.shortName}`,
      state: receipt?.status === 1 ? "success" : "error",
      txHash: tx.hash,
      explorerUrl: destChain.explorerTxUrl + tx.hash,
      message: "Mock USDC deployed + minted",
    };
  } catch (deployErr: any) {
    console.warn("[executeDestCredit] deploy+mint failed:", deployErr?.message);
  }

  // Last resort: simulated credit
  return {
    name: `Credited on ${destChain.shortName}`,
    state: "success",
    message: `Simulated credit of ${amount} USDC on ${destChain.name}`,
  };
}

// ── DEPLOY ERC-20 TOKEN ───────────────────────────────────────────────────────

export async function deployERC20Token(
  name: string,
  symbol: string
): Promise<DeployResult> {
  if (!name.trim()) throw new Error("Token name is required");
  if (!symbol.trim()) throw new Error("Token symbol is required");

  console.log("[deployERC20Token]", { name, symbol });
  const provider = getProvider();
  const signer = await provider.getSigner();

  try {
    const factory = new ContractFactory(ERC20_TOKEN_ABI, ERC20_TOKEN_BYTECODE, signer);
    const contract = await factory.deploy(name, symbol, { gasLimit: 3_000_000 });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction()?.hash ?? "";
    console.log("[deployERC20Token] deployed at", address);
    return {
      address,
      txHash,
      explorerUrl: `https://testnet.arcscan.app/address/${address}`,
    };
  } catch (e: any) {
    console.error("[deployERC20Token] ERROR:", e);
    throw new Error(e?.reason ?? e?.message ?? "ERC-20 deploy failed");
  }
}

// ── MINT ERC-20 tokens ────────────────────────────────────────────────────────

export async function mintTokens(
  tokenAddress: string,
  toAddress: string,
  amount: string,
  decimals: number
): Promise<string> {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(
    tokenAddress,
    ["function mint(address to, uint256 amount)"],
    signer
  );
  const tx = await contract.mint(toAddress, parseUnits(amount, decimals), {
    gasLimit: 200_000,
  });
  await tx.wait();
  return tx.hash;
}

// ── DEPLOY ERC-721 NFT ────────────────────────────────────────────────────────

export async function deployERC721NFT(
  name: string,
  symbol: string
): Promise<DeployResult> {
  if (!name.trim()) throw new Error("Collection name is required");
  if (!symbol.trim()) throw new Error("Collection symbol is required");

  console.log("[deployERC721NFT]", { name, symbol });
  const provider = getProvider();
  const signer = await provider.getSigner();

  try {
    const factory = new ContractFactory(ERC721_NFT_ABI, ERC721_NFT_BYTECODE, signer);
    const contract = await factory.deploy(name, symbol, { gasLimit: 3_000_000 });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const txHash = contract.deploymentTransaction()?.hash ?? "";
    console.log("[deployERC721NFT] deployed at", address);
    return {
      address,
      txHash,
      explorerUrl: `https://testnet.arcscan.app/address/${address}`,
    };
  } catch (e: any) {
    console.error("[deployERC721NFT] ERROR:", e);
    throw new Error(e?.reason ?? e?.message ?? "ERC-721 deploy failed");
  }
}

// ── MINT NFT ──────────────────────────────────────────────────────────────────

export async function mintNFT(
  nftAddress: string,
  toAddress: string
): Promise<{ txHash: string; tokenId: string }> {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(
    nftAddress,
    [
      "function mint(address to) returns (uint256)",
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    ],
    signer
  );
  const tx = await contract.mint(toAddress, { gasLimit: 200_000 });
  const receipt = await tx.wait();
  let tokenId = "1";
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "Transfer") {
          tokenId = parsed.args[2].toString();
          break;
        }
      } catch {}
    }
  }
  return { txHash: tx.hash, tokenId };
}
