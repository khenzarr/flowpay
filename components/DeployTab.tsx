"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { deployERC20Token, deployERC721NFT, mintTokens, mintNFT, switchChain } from "@/lib/txEngine";
import { ARC_CHAIN_ID } from "@/lib/chains";
import { StatusPanel, TxStatus } from "./StatusPanel";

// ── Shared card wrapper ───────────────────────────────────────────────────────
function DeployCard({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0 text-base">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/35 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Input helper ──────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-lg px-3 py-2 text-sm text-white placeholder-white/15 outline-none transition-all"
      />
    </div>
  );
}

// ── Result box ────────────────────────────────────────────────────────────────
function ResultBox({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2 space-y-0.5">
      <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-emerald-400 hover:text-emerald-300 break-all underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-xs font-mono text-emerald-400 break-all">{value}</p>
      )}
    </div>
  );
}

// ── Arc guard ─────────────────────────────────────────────────────────────────
function ArcGuard({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const [switching, setSwitching] = useState(false);

  if (!isConnected) {
    return (
      <p className="text-center text-sm text-white/30 py-4">
        Connect your wallet to deploy on Arc
      </p>
    );
  }

  if (chainId !== ARC_CHAIN_ID) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center space-y-3">
        <p className="text-sm text-amber-300">Switch to Arc Testnet to deploy</p>
        <button
          onClick={async () => {
            setSwitching(true);
            try {
              await switchChain(ARC_CHAIN_ID);
            } finally {
              setSwitching(false);
            }
          }}
          disabled={switching}
          className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {switching ? "Switching…" : "⚡ Switch to Arc Testnet"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// ── ERC-20 Deploy section ─────────────────────────────────────────────────────
function TokenDeploy() {
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [mintAmount, setMintAmount] = useState("1000000");
  const [status, setStatus] = useState<TxStatus>({ type: "idle" });
  const [deployed, setDeployed] = useState<{ address: string; txHash: string } | null>(null);

  async function handleDeploy() {
    if (!name || !symbol) return;
    setStatus({ type: "loading", message: "Deploying ERC-20 token on Arc…" });
    try {
      const result = await deployERC20Token(name, symbol);
      setDeployed(result);

      // Auto-mint to deployer
      if (address && mintAmount) {
        setStatus({ type: "loading", message: `Minting ${mintAmount} ${symbol} to your wallet…` });
        await mintTokens(result.address, address, mintAmount, 6);
      }

      setStatus({
        type: "success",
        steps: [
          { name: "Deploy ERC-20", state: "success", txHash: result.txHash, explorerUrl: result.explorerUrl },
          { name: `Mint ${mintAmount} ${symbol}`, state: "success" },
        ],
      });
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message ?? "Deploy failed" });
    }
  }

  return (
    <DeployCard
      title="Create ERC-20 Token"
      icon="🪙"
      description="Deploy a mintable ERC-20 token on Arc Testnet in one click"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Token Name" value={name} onChange={setName} placeholder="My Token" />
          <Field label="Symbol" value={symbol} onChange={setSymbol} placeholder="MTK" />
        </div>
        <Field
          label="Initial Mint Amount"
          value={mintAmount}
          onChange={setMintAmount}
          placeholder="1000000"
          type="number"
        />

        <button
          onClick={handleDeploy}
          disabled={!name || !symbol || status.type === "loading"}
          className="w-full bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-all"
        >
          {status.type === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deploying…
            </span>
          ) : (
            "Deploy Token on Arc"
          )}
        </button>

        {deployed && (
          <ResultBox
            label="Contract Address"
            value={deployed.address}
            href={`https://testnet.arcscan.app/address/${deployed.address}`}
          />
        )}

        <StatusPanel status={status} onReset={() => { setStatus({ type: "idle" }); setDeployed(null); }} />
      </div>
    </DeployCard>
  );
}

// ── ERC-721 Deploy section ────────────────────────────────────────────────────
function NftDeploy() {
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState<TxStatus>({ type: "idle" });
  const [deployed, setDeployed] = useState<{ address: string } | null>(null);
  const [mintedId, setMintedId] = useState<string | null>(null);

  async function handleDeploy() {
    if (!name || !symbol) return;
    setStatus({ type: "loading", message: "Deploying ERC-721 NFT on Arc…" });
    try {
      const result = await deployERC721NFT(name, symbol);
      setDeployed(result);
      setStatus({
        type: "success",
        steps: [
          { name: "Deploy ERC-721", state: "success", txHash: result.txHash, explorerUrl: result.explorerUrl },
        ],
      });
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message ?? "Deploy failed" });
    }
  }

  async function handleMint() {
    if (!deployed || !address) return;
    setStatus({ type: "loading", message: "Minting NFT to your wallet…" });
    try {
      const { txHash, tokenId } = await mintNFT(deployed.address, address);
      setMintedId(tokenId);
      setStatus({
        type: "success",
        steps: [
          { name: `Mint NFT #${tokenId}`, state: "success", txHash, explorerUrl: `https://testnet.arcscan.app/tx/${txHash}` },
        ],
      });
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message ?? "Mint failed" });
    }
  }

  return (
    <DeployCard
      title="Deploy NFT Collection"
      icon="🖼️"
      description="Deploy an ERC-721 NFT contract on Arc Testnet"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Collection Name" value={name} onChange={setName} placeholder="My NFT" />
          <Field label="Symbol" value={symbol} onChange={setSymbol} placeholder="MNFT" />
        </div>

        <button
          onClick={handleDeploy}
          disabled={!name || !symbol || status.type === "loading"}
          className="w-full bg-blue-600/70 hover:bg-blue-600/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-all"
        >
          {status.type === "loading" && !deployed ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Deploying…
            </span>
          ) : (
            "Deploy NFT on Arc"
          )}
        </button>

        {deployed && (
          <div className="space-y-2">
            <ResultBox
              label="NFT Contract"
              value={deployed.address}
              href={`https://testnet.arcscan.app/address/${deployed.address}`}
            />
            <button
              onClick={handleMint}
              disabled={status.type === "loading"}
              className="w-full bg-emerald-600/60 hover:bg-emerald-600/80 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-all"
            >
              {status.type === "loading" ? "Minting…" : "Mint NFT to My Wallet"}
            </button>
            {mintedId && (
              <ResultBox label="Minted Token ID" value={`#${mintedId}`} />
            )}
          </div>
        )}

        <StatusPanel status={status} onReset={() => { setStatus({ type: "idle" }); }} />
      </div>
    </DeployCard>
  );
}

// ── Main DeployTab ────────────────────────────────────────────────────────────
export function DeployTab() {
  return (
    <div className="space-y-4">
      {/* Arc badge */}
      <div className="flex items-center gap-2 text-xs text-violet-300/70">
        <span className="text-violet-400">⚡</span>
        <span>All contracts deploy on Arc Testnet · USDC pays gas</span>
      </div>

      <ArcGuard>
        <div className="space-y-4">
          <TokenDeploy />
          <NftDeploy />
        </div>
      </ArcGuard>
    </div>
  );
}
