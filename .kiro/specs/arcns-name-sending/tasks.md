# Implementation Plan: ArcNS Name Sending

## Overview

Implement ArcNS human-readable name resolution in FlowPay's send form. The work proceeds in five incremental steps: (1) install test tooling, (2) build the pure resolver module, (3) build the React hook, (4) build the status display component, and (5) integrate everything into `SendForm.tsx` including the Arc → Arc same-chain route fix.

## Tasks

- [x] 1. Install test dependencies and configure vitest
  - Add `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom`, and `@fast-check/vitest` to `devDependencies` in `package.json`
  - Add a `vitest.config.ts` (or `vitest.config.mjs`) at the `flowpay/` root that sets `environment: 'jsdom'` and includes a `setupFiles` entry for `@testing-library/jest-dom`
  - Add a `"test"` script to `package.json`: `"vitest --run"`
  - _Requirements: 7.1–7.7_

- [x] 2. Implement `lib/arcnsResolver.ts`
  - [x] 2.1 Create `flowpay/lib/arcnsResolver.ts` with exported types and functions
    - Export `ResolutionState` union type and `ArcNSResolutionResult` interface as specified in the design
    - Export `SUPPORTED_TLDS: string[]` constant (`['.arc', '.circle']`)
    - Implement `isArcNSName(input: string): boolean` — returns `true` iff input ends with a supported TLD and has a non-empty label before the dot
    - Implement `resolveArcNSName(name: string, signal?: AbortSignal): Promise<ArcNSResolutionResult>`:
      - Validate TLD first; return `{ state: 'unsupported_tld' }` without fetching if not supported
      - Merge caller `signal` with `AbortSignal.timeout(10_000)` via `AbortSignal.any([...])`
      - Call `GET https://arcns-app.vercel.app/api/v1/resolve/name/{name}`
      - Map adapter `status` field to `ResolutionState`; guard that `address` matches `/^0x[a-fA-F0-9]{40}$/` when `status === 'resolved'` — treat invalid address as `not_found`
      - Catch `AbortError` silently (return `{ state: 'adapter_unavailable' }` only for timeout; re-throw for caller cancellation so the hook can discard it)
      - Catch network errors and HTTP 5xx → `{ state: 'adapter_unavailable' }`
      - Never throw — always return a typed result
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 1.3, 1.4, 2.1–2.6, 2.11_

  - [x]* 2.2 Write property test — Property 1: ArcNS name classification is mutually exclusive with valid 0x addresses
    - **Property 1: For any string that is a valid `0x` address (exactly `0x` + 40 hex chars), `isArcNSName()` returns `false`; for any string ending in `.arc` or `.circle` with a non-empty label, `isArcNSName()` returns `true`**
    - Use `fc.hexaString({ minLength: 40, maxLength: 40 })` for 0x address generation
    - Use `fc.string({ minLength: 1 })` + `.arc` / `.circle` suffix for ArcNS name generation
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x]* 2.3 Write property test — Property 2: Unsupported TLD never triggers a fetch
    - **Property 2: For any name string whose TLD is not in `SUPPORTED_TLDS`, `resolveArcNSName` returns `{ state: 'unsupported_tld' }` and does NOT call `fetch`**
    - Stub `fetch` with `vi.stubGlobal`; assert it is never called
    - Generate names with `fc.string({ minLength: 1 })` + random non-`.arc`/`.circle` suffix
    - **Validates: Requirements 1.4, 6.3**

  - [x]* 2.4 Write property test — Property 3: Resolved address is always a valid 0x address
    - **Property 3: For any ArcNS name for which `resolveArcNSName` returns `{ state: 'resolved' }`, the `address` field matches `/^0x[a-fA-F0-9]{40}$/`**
    - Mock adapter to return `{ status: 'resolved', address: '0x' + fc.hexaString({ minLength: 40, maxLength: 40 }) }`
    - **Validates: Requirements 2.2, 7.6**

  - [x]* 2.5 Write property test — Property 7: Resolver is idempotent for the same input and adapter response
    - **Property 7: For any ArcNS name and any fixed mock adapter response, calling `resolveArcNSName` multiple times with the same arguments always returns a result with the same `state` and `address`**
    - **Validates: Requirements 6.4**

  - [x]* 2.6 Write example tests for `resolveArcNSName`
    - Test: adapter returns `{ status: 'resolved', address: '0xabc...123' }` → result is `{ state: 'resolved', address: '0xabc...123' }` (Req 7.1)
    - Test: adapter returns `{ status: 'not_found' }` → result is `{ state: 'not_found' }` (Req 7.2)
    - Test: input is `name.eth` → result is `{ state: 'unsupported_tld' }`, `fetch` not called (Req 7.3)
    - Test: `fetch` throws `TypeError: Failed to fetch` → result is `{ state: 'adapter_unavailable' }` (Req 7.4)
    - Test: adapter returns `{ status: 'invalid' }` → result is `{ state: 'invalid' }` (Req 7.5)
    - _Requirements: 7.1–7.5_

- [x] 3. Checkpoint — Ensure all resolver tests pass
  - Run `npm test` (vitest --run) and confirm all tasks from step 2 pass. Ask the user if any questions arise.

- [x] 4. Implement `hooks/useArcNSResolution.ts`
  - [x] 4.1 Create `flowpay/hooks/useArcNSResolution.ts`
    - Import `ARC_CHAIN_ID` from `@/lib/chains` and `isArcNSName`, `resolveArcNSName` from `@/lib/arcnsResolver`
    - Export `useArcNSResolution(name: string, destChainId: number): { state: ResolutionState; resolvedAddress: string | null }`
    - Return `{ state: 'idle', resolvedAddress: null }` immediately when `destChainId !== ARC_CHAIN_ID`
    - On `name` change: synchronously reset state to `idle` and `resolvedAddress` to `null`, then schedule a 400 ms debounced call to `resolveArcNSName`
    - On `destChainId` change away from `ARC_CHAIN_ID`: synchronously reset to `idle`
    - Cancel in-flight requests via `AbortController` when name changes before the response arrives; discard results from aborted requests silently
    - Do not call `resolveArcNSName` if `!isArcNSName(name)`
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 5.4, 5.5, 6.1_

  - [x]* 4.2 Write example tests for `useArcNSResolution`
    - Test: `destChainId !== ARC_CHAIN_ID` → always returns `{ state: 'idle', resolvedAddress: null }` (Req 5.4)
    - Test: debounce — rapid typing fires `resolveArcNSName` only once after 400 ms (fake timers via `vi.useFakeTimers`)
    - Test: AbortController — in-flight request is aborted when name changes before response arrives
    - Test (stale result invalidation): after a successful resolution, changing the name resets state to `idle` and `resolvedAddress` to `null` immediately — Req 7.7
    - _Requirements: 2.7, 2.8, 2.9, 5.4, 7.7_

  - [x]* 4.3 Write property test — Property 5: Input change always resets resolution state to idle
    - **Property 5: For any resolved ArcNS name, changing the `recipient` input to any different value immediately sets `arcnsState` to `idle` and `resolvedAddress` to `null` — before any debounce fires**
    - Use `renderHook` + `act` from `@testing-library/react`
    - **Validates: Requirements 2.9, 4.5**

  - [x]* 4.4 Write property test — Property 6: Non-Arc destination always yields idle resolution state
    - **Property 6: For any `destChainId` that is not `ARC_CHAIN_ID`, `useArcNSResolution` returns `{ state: 'idle', resolvedAddress: null }` regardless of the `name` input**
    - Generate `destChainId` with `fc.integer().filter(id => id !== ARC_CHAIN_ID)`
    - **Validates: Requirements 5.4, 2.10**

- [x] 5. Implement `components/ArcNSResolutionStatus.tsx`
  - [x] 5.1 Create `flowpay/components/ArcNSResolutionStatus.tsx`
    - Accept props `{ state: ResolutionState; resolvedAddress: string | null; enteredName: string }`
    - Return `null` when `state === 'idle'`
    - Render a spinner row when `state === 'resolving'`
    - Render the full `resolvedAddress` beneath the field when `state === 'resolved'`
    - Render `"Name not found — no address record set"` when `state === 'not_found'`
    - Render `"Unsupported name — use .arc or .circle"` when `state === 'unsupported_tld'`
    - Render `"Invalid ArcNS name"` when `state === 'invalid'`
    - Render `"Name service unavailable — try again or use a 0x address"` when `state === 'adapter_unavailable'`
    - _Requirements: 3.1–3.7_

  - [ ]* 5.2 Write property test — Property 8: Error message rendered matches resolution state
    - **Property 8: For any `state` in `{ not_found, unsupported_tld, invalid, adapter_unavailable }`, `ArcNSResolutionStatus` renders the exact prescribed message string for that state**
    - Use `fc.constantFrom('not_found', 'unsupported_tld', 'invalid', 'adapter_unavailable')` as generator
    - **Validates: Requirements 3.4, 3.5, 3.6, 3.7**

  - [ ]* 5.3 Write example tests for `ArcNSResolutionStatus`
    - Test: renders `null` for `state === 'idle'`
    - Test: renders spinner element for `state === 'resolving'`
    - Test: renders resolved address string for `state === 'resolved'`
    - _Requirements: 3.1, 3.2_

- [x] 6. Integrate ArcNS resolution into `components/SendForm.tsx`
  - [x] 6.1 Add `useArcNSResolution` hook and derive `effectiveRecipient`
    - Import `useArcNSResolution` from `@/hooks/useArcNSResolution`, `isArcNSName` from `@/lib/arcnsResolver`, and `ArcNSResolutionStatus` from `./ArcNSResolutionStatus`
    - Call `const { state: arcnsState, resolvedAddress } = useArcNSResolution(recipient, destChainId)` inside `SendForm`
    - Derive `effectiveRecipient`: if `isArcNSName(recipient) && arcnsState === 'resolved' && resolvedAddress` then `resolvedAddress`, else `recipient`
    - Update `isValidAddress` to test `effectiveRecipient` instead of `recipient`
    - Update `canSubmitStep1` to add `!(isArcNSName(recipient) && arcnsState !== 'resolved')` guard
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 1.2, 1.6_

  - [x] 6.2 Replace `recipient` with `effectiveRecipient` in all `executeSend` / `executeSourceTx` call sites
    - Direct same-chain send: pass `effectiveRecipient` to `executeSend`
    - Cross-chain step 1: pass `effectiveRecipient` to `executeSourceTx` and store it in `pendingXChain.recipient`
    - Fee transfer call is unaffected (uses `FEE_RECIPIENT`)
    - _Requirements: 4.1, 4.2, 5.3_

  - [x] 6.3 Update recipient input placeholder and render `ArcNSResolutionStatus`
    - Change placeholder from `"0x..."` to `"0x... or name.arc"`
    - Remove the existing `"Invalid address"` inline error when `isArcNSName(recipient)` is true (the status component handles messaging)
    - Render `<ArcNSResolutionStatus state={arcnsState} resolvedAddress={resolvedAddress} enteredName={recipient} />` beneath the recipient input when `isArcNSName(recipient)`
    - _Requirements: 3.1–3.7, 4.5_

  - [x] 6.4 Show ArcNS name + resolved address in confirmation areas
    - In the send button label area (step 1): when `isArcNSName(recipient) && arcnsState === 'resolved'`, show both the entered name and the resolved address
    - In the cross-chain step 2 panel: when `pendingXChain` was initiated with an ArcNS name, display both the entered name and the resolved address so the user can verify before confirming
    - _Requirements: 3.3, 4.6_

  - [x] 6.5 Fix Arc → Arc same-chain route: relax destination selector filter
    - Change the destination `<select>` filter from `CHAIN_LIST.filter((c) => c.id !== sourceChainId)` to `CHAIN_LIST` (all chains allowed as destination)
    - Update `handleDestChange` to skip the swap-chains fallback when both source and destination are Arc Testnet (i.e., `id === sourceChainId && id === ARC_CHAIN_ID` should not trigger a chain swap)
    - Update `handleSourceChange` similarly so selecting Arc as source when Arc is already the destination does not force a swap
    - _Requirements: 5.1, 5.2_

  - [x]* 6.6 Write property test — Property 4: `effectiveRecipient` is always a valid 0x address at send time
    - **Property 4: For any combination of `recipient` input and `arcnsState`, if `canSubmitStep1` is `true`, then `effectiveRecipient` matches `/^0x[a-fA-F0-9]{40}$/`**
    - Test the derivation logic as a pure function extracted from `SendForm` (no need to render the full component)
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 6.7 Write example tests for `SendForm` integration
    - Test: recipient input placeholder shows `"0x... or name.arc"`
    - Test: entering a valid `0x` address with `arcnsState === 'idle'` leaves `effectiveRecipient` unchanged (non-regression)
    - _Requirements: 1.6, 4.2_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Run `npm test` (vitest --run) and confirm the full suite passes. Ask the user if any questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `@fast-check/vitest`; tag each with `// Feature: arcns-name-sending, Property N: <property_text>`
- All existing `0x` address send paths are preserved via the `effectiveRecipient` derivation — `isArcNSName` returning `false` passes `recipient` through unchanged
- The Arc → Arc route already works in `flowRouter.ts` (`sameChain` branch); only the UI destination filter and swap logic need updating
