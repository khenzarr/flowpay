"use client";

import { useState } from "react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { SendForm } from "@/components/SendForm";
import { DeployTab } from "@/components/DeployTab";
import { GMStreak } from "@/components/GMStreak";

type Tab = "send" | "deploy";

export default function Home() {
  const [tab, setTab] = useState<Tab>("send");

  return (
    <main className="min-h-screen bg-[#080810] text-white flex flex-col">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white">FlowPay</span>
            <span className="ml-2 text-[10px] font-medium text-violet-400 bg-violet-400/10 border border-violet-400/20 rounded-full px-2 py-0.5">
              Arc Testnet
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GMStreak />
          <ConnectWallet />
        </div>
      </header>

      {/* Main */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[460px] space-y-5">
          {/* Hero */}
          <div className="text-center space-y-1.5">
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              {tab === "send" ? "Send USDC across chains" : "Deploy on Arc"}
            </h1>
            <p className="text-white/35 text-sm">
              {tab === "send"
                ? "Real Arc transactions · Cross-chain credit"
                : "Deploy tokens & NFTs · USDC pays gas"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/[0.07] rounded-xl">
            <button
              onClick={() => setTab("send")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "send"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
            <button
              onClick={() => setTab("deploy")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "deploy"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-900/30"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Deploy on Arc
            </button>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl shadow-2xl shadow-black/40 p-5">
            {tab === "send" ? <SendForm /> : <DeployTab />}
          </div>

          <p className="text-center text-xs text-white/20">
            {tab === "send"
              ? "0.5% fee · Testnet only · Source tx is real on Arc"
              : "Contracts deploy on Arc Testnet · USDC is native gas"}
          </p>
        </div>
      </div>
    </main>
  );
}
