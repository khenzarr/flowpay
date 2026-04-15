# FlowPay

**The onchain payment layer for the multi-chain world.**

Send USDC. Deploy contracts. Route across chains. All from one interface — powered by Arc Testnet.

> _"Users shouldn't think in chains. They should think in outcomes."_

---

## 🔥 Why This Exists

Cross-chain UX is broken.

Bridges are black boxes. Wallets don't explain what's happening. Developers waste weeks wiring together infra that should be invisible.

**FlowPay is the answer to a simple question:**
What if sending USDC across chains felt like sending an email?

Current solutions fail because they:
- Abstract too much (users lose trust)
- Abstract too little (users get lost)
- Treat bridging as the product instead of the outcome

FlowPay takes a different approach: **Arc as the execution layer, user as the router.**

> _"You don't need to bridge. You need to route."_

---

## 🚀 What You Can Do

**Send**
- Transfer USDC natively on Arc Testnet (real onchain tx)
- Direct same-chain sends on Sepolia, Holesky, Linea, MegaETH, Monad

**Route**
- Cross-chain transfers: Arc → Sepolia, Sepolia → Arc, any → any
- Manual 2-step routing — you control when each step executes
- Wallet mismatch detection with explicit switch prompts (no silent auto-switching)

**Deploy on Arc**
- Launch an ERC-20 token in one click (name, symbol, initial supply)
- Deploy an NFT collection (ERC-721) with public mint
- All contracts deployed directly on Arc Testnet

**Understand**
- Real-time fee breakdown (0.5% shown before you sign)
- Route preview: `Arc → Bridge → Sepolia`
- Step-by-step status for every transaction

---

## 🧠 How It Works

### Arc as Execution Layer

Arc Testnet is not just another EVM chain.

**USDC is the native gas token on Arc.** No ETH. No wrapping. You pay fees in the same asset you're moving. This collapses the UX complexity of every other chain.

FlowPay treats Arc as the primary settlement layer — the place where value originates before routing outward.

> _"Arc is not a chain. It's an execution layer."_

### Cross-Chain: The 2-Step System

Most cross-chain tools hide the complexity. FlowPay exposes it — cleanly.

**Step 1 — Source Transaction (real, onchain)**
- Wallet must be on source chain
- USDC is sent to recipient on source chain
- Transaction hash returned immediately
- You see it on the explorer before anything else happens

**Step 2 — Destination Credit (user-confirmed)**
- UI pauses and waits for you
- You switch your wallet to the destination chain manually
- You click "Complete Transfer"
- System credits recipient: tries transfer → mint → deploy+mint → simulated fallback

No hidden automation. No silent chain switches. Every step is explicit.

### Routing Logic

```
IF sourceChain === destChain  →  direct send()
IF sourceChain !== destChain  →  executeSourceTx() + executeDestCredit()
```

The router is a pure function. It describes what will happen. It never executes anything on its own.

---

## 🧩 Product Philosophy

**User-controlled routing.**
The system never switches your wallet without permission. If your wallet is on the wrong chain, you get a warning and a button — not a silent redirect.

**No hidden automation.**
Every transaction step is visible before it executes. The fee is shown. The route is shown. The chain is shown.

**Transparency over abstraction.**
We don't hide the 2-step nature of cross-chain transfers. We make it a feature. Users who understand what's happening trust the product more.

**Builder + user tool in one.**
FlowPay is not just a payment UI. The Deploy tab lets you launch tokens and NFTs on Arc in seconds. Same interface, same wallet, same chain.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Wallet | wagmi v2 + viem |
| Blockchain | ethers.js v6 |
| Styling | TailwindCSS v4 |
| Compiler | solc 0.8.34 (runtime, via npm) |
| Primary Chain | Arc Testnet (chainId: 5042002) |
| Other Chains | Sepolia, Holesky, Linea Sepolia, MegaETH, Monad |

---

## 📸 Demo

> Screenshots and video walkthrough coming soon.
> Live demo: deploy locally in 2 minutes (see below).

**Key screens:**
- Send tab: FROM/TO chain selector with swap button, fee breakdown, route preview
- Cross-chain: 2-step flow with step-1 confirmation panel
- Deploy tab: ERC-20 token creator, NFT deployer — both on Arc

---

## ⚙️ Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- Arc Testnet added to MetaMask ([docs](https://docs.arc.network/arc/references/connect-to-arc))

### Install

```bash
git clone https://github.com/khenzarr/flowpay.git
cd flowpay
npm install
```

### Environment Setup

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Your wallet address to receive the 0.5% fee
NEXT_PUBLIC_FEE_RECIPIENT=0xYourWalletAddress

# Optional: Arc Kit Key (for swap features)
NEXT_PUBLIC_KIT_KEY=your_kit_key_here
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Regenerate Contract Bytecodes (optional)

If you modify the Solidity contracts in `scripts/compileContracts.js`:

```bash
node scripts/compileContracts.js
```

This recompiles and writes fresh bytecodes to `lib/bytecodes.json`.

---

## 🔥 Deploy on Arc

The **Deploy** tab is a one-click contract launcher for Arc Testnet.

### Create an ERC-20 Token

1. Switch wallet to Arc Testnet
2. Go to **Deploy → Create ERC-20 Token**
3. Enter name, symbol, initial supply
4. Click **Deploy Token on Arc**
5. Contract deploys with `gasLimit: 3_000_000` (bypasses Arc RPC estimateGas quirks)
6. Initial supply auto-minted to your wallet

### Deploy an NFT Collection

1. Go to **Deploy → Deploy NFT Collection**
2. Enter collection name and symbol
3. Click **Deploy NFT on Arc**
4. After deploy: click **Mint NFT to My Wallet**
5. Token ID returned from on-chain Transfer event

### Why Arc for Deployment?

- USDC is the gas token — no ETH needed
- Fast finality
- EVM-compatible — your contracts work as-is
- Explorer: [testnet.arcscan.app](https://testnet.arcscan.app)

---

## 🧪 Example Flows

### Arc → Arc (Direct Send)

```
1. Connect wallet on Arc Testnet
2. Select: FROM Arc / TO Arc
3. Enter recipient + amount
4. Click "Send USDC → Arc"
5. Native USDC value transfer executes
6. Tx hash + explorer link returned
```

### Arc → Sepolia (Cross-Chain)

```
Step 1 (wallet on Arc):
  → Send USDC to recipient on Arc
  → Tx confirmed, hash saved

[UI pauses — you switch wallet to Sepolia]

Step 2 (wallet on Sepolia):
  → Click "Complete Transfer"
  → System checks for USDC on Sepolia
  → If exists: transfer
  → If not: deploy mock ERC-20 + mint
  → Recipient credited on Sepolia
```

### Sepolia → Arc

```
Step 1 (wallet on Sepolia):
  → ERC-20 transfer of USDC on Sepolia
  → Uses Circle testnet USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

Step 2 (wallet on Arc):
  → Native USDC value transfer to recipient
```

---

## 🧠 Key Insights

**1. Native gas tokens change everything.**
When USDC is the gas token, the mental model collapses from "I need ETH to move USDC" to "I just move USDC." Arc gets this right. FlowPay is built around it.

**2. Explicit > automatic in cross-chain UX.**
Every cross-chain tool that auto-switches chains loses user trust the moment something goes wrong. The 2-step model makes the seam visible — and that's a feature, not a bug.

**3. The deploy experience is the onboarding.**
The fastest way to make a developer trust a chain is to let them deploy something on it in 60 seconds. The Deploy tab exists for this reason.

---

## 🤝 Contributing

FlowPay is open source and actively developed.

If you're building on Arc, experimenting with cross-chain UX, or just want to ship something real — this is a good place to start.

**Good first issues:**
- Add support for additional testnets
- Improve the destination credit fallback logic
- Add transaction history panel
- Write tests for `flowRouter.ts` and `txEngine.ts`

**To contribute:**

```bash
git clone https://github.com/khenzarr/flowpay.git
cd flowpay
npm install
npm run dev
```

Open a PR. Keep it focused. Explain the why.

---

## 📣 Build With It

⭐ **Star the repo** if you find it useful — it helps others discover it.

🐦 **Share on X** — tag [@khenzarr](https://x.com/khenzarr) if you build something with it.

🔧 **Fork it** — use FlowPay as a starting point for your own Arc-based app.

---

> _"The best cross-chain UX is the one where users forget they're crossing chains."_

**[github.com/khenzarr/flowpay](https://github.com/khenzarr/flowpay)**
