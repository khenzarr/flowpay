# ArcNS Error Mapping Fix — Bugfix Design

## Overview

The ArcNS adapter correctly returns `{"status":"not_found"}` when a name has no forward address record. `lib/arcnsResolver.ts` correctly maps that response to `Resolution_State = not_found`. The bug is entirely in the UI layer: `components/ArcNSResolutionStatus.tsx` renders the wrong message string for the `not_found` state — it shows the `adapter_unavailable` message instead of a message specific to the name not resolving.

The fix is a single string change in `ArcNSResolutionStatus.tsx`. No resolver logic, no hook logic, no routing, and no architecture changes are required.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — `Resolution_State === "not_found"` reaching the UI render path in `ArcNSResolutionStatus`.
- **Property (P)**: The desired behavior — when `state === "not_found"`, the component SHALL render exactly `"This ArcNS name does not currently resolve to a wallet address."`.
- **Preservation**: All other state-to-message mappings in `ArcNSResolutionStatus` that must remain unchanged by the fix.
- **`errorMessages`**: The `Partial<Record<ResolutionState, string>>` lookup object inside `ArcNSResolutionStatus` that maps each terminal `ResolutionState` to its user-facing string.
- **`Resolution_State`**: The typed union `"idle" | "resolving" | "resolved" | "not_found" | "invalid" | "unsupported_tld" | "adapter_unavailable"` exported from `lib/arcnsResolver.ts`.

---

## Bug Details

### Bug Condition

The bug manifests when `resolveArcNSName` returns `{ state: "not_found" }` (adapter responded with `{"status":"not_found"}`), the hook propagates `state = "not_found"` to `SendForm`, and `SendForm` passes it to `ArcNSResolutionStatus`. Inside the component, the `errorMessages` map contains the wrong string for the `not_found` key.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { state: ResolutionState }
  OUTPUT: boolean

  RETURN input.state = "not_found"
END FUNCTION
```

### Examples

- User types `alice.arc`; adapter returns `{"status":"not_found","hint":"Name has no address record set."}` → component renders "Name service unavailable — try again or use a 0x address" (**bug**: should be "This ArcNS name does not currently resolve to a wallet address.")
- User types `bob.circle`; adapter returns `{"status":"not_found"}` → same wrong message shown (**bug**)
- User types `alice.arc`; adapter is unreachable (network error) → component renders "Name service unavailable — try again or use a 0x address" (**correct**, unchanged)
- User types `alice.eth`; TLD not supported → component renders "Unsupported name — use .arc or .circle" (**correct**, unchanged)

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `adapter_unavailable` state → "Name service unavailable — try again or use a 0x address" must remain exactly as-is
- `unsupported_tld` state → "Unsupported name — use .arc or .circle" must remain exactly as-is
- `invalid` state → "Invalid ArcNS name" must remain exactly as-is
- `resolved` state → resolved address display with ✓ icon must remain exactly as-is
- `resolving` state → spinner with "Resolving…" must remain exactly as-is
- `idle` state → renders `null` must remain exactly as-is
- Send button gating in `SendForm` is unaffected (already blocks on all non-`resolved` states)
- All `0x` address send paths are unaffected (ArcNS resolution is not triggered for raw addresses)

**Scope:**
All inputs where `isBugCondition` returns `false` — i.e., every `ResolutionState` other than `not_found` — must produce exactly the same rendered output before and after the fix.

---

## Hypothesized Root Cause

There is one cause and it is confirmed by reading the source:

**Incorrect message string in `errorMessages` map** (`components/ArcNSResolutionStatus.tsx`, line 43):

```typescript
// Current (buggy)
not_found: "Name not found — no address record set",

// Required (correct)
not_found: "This ArcNS name does not currently resolve to a wallet address.",
```

The original `arcns-name-sending` feature spec (Requirements 3.4) specified `"Name not found — no address record set"` as the `not_found` message. The bugfix requirements document supersedes that with the more precise message `"This ArcNS name does not currently resolve to a wallet address."`. The resolver and hook layers are correct — the state is mapped accurately; only the display string is wrong.

---

## Correctness Properties

Property 1: Bug Condition — not_found renders its own message

_For any_ render of `ArcNSResolutionStatus` where `state === "not_found"` (isBugCondition returns true), the component SHALL render exactly the text `"This ArcNS name does not currently resolve to a wallet address."` and SHALL NOT render `"Name service unavailable — try again or use a 0x address"`.

**Validates: Requirements 2.1**

Property 2: Preservation — all other states render unchanged messages

_For any_ render of `ArcNSResolutionStatus` where `state !== "not_found"` (isBugCondition returns false), the component SHALL produce exactly the same rendered output as before the fix, preserving all existing state-to-message mappings.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

**File**: `components/ArcNSResolutionStatus.tsx`

**Location**: `errorMessages` object, `not_found` key (line 43)

**Specific Change**:

```typescript
// Before
const errorMessages: Partial<Record<ResolutionState, string>> = {
  not_found: "Name not found — no address record set",
  unsupported_tld: "Unsupported name — use .arc or .circle",
  invalid: "Invalid ArcNS name",
  adapter_unavailable: "Name service unavailable — try again or use a 0x address",
};

// After
const errorMessages: Partial<Record<ResolutionState, string>> = {
  not_found: "This ArcNS name does not currently resolve to a wallet address.",
  unsupported_tld: "Unsupported name — use .arc or .circle",
  invalid: "Invalid ArcNS name",
  adapter_unavailable: "Name service unavailable — try again or use a 0x address",
};
```

No other files require modification. The complete state-to-message mapping after the fix:

| `ResolutionState`     | Message rendered                                                        | Send button |
|-----------------------|-------------------------------------------------------------------------|-------------|
| `idle`                | *(nothing)*                                                             | disabled    |
| `resolving`           | Spinner + "Resolving…"                                                  | disabled    |
| `resolved`            | ✓ + resolved address                                                    | enabled     |
| `not_found`           | ⚠ "This ArcNS name does not currently resolve to a wallet address."    | disabled    |
| `adapter_unavailable` | ⚠ "Name service unavailable — try again or use a 0x address"           | disabled    |
| `unsupported_tld`     | ⚠ "Unsupported name — use .arc or .circle"                             | disabled    |
| `invalid`             | ⚠ "Invalid ArcNS name"                                                 | disabled    |

---

## Testing Strategy

### Validation Approach

Two-phase: first run exploratory tests against the unfixed code to confirm the bug manifests as described, then apply the fix and verify both fix-checking and preservation-checking pass.

### Exploratory Bug Condition Checking

**Goal**: Surface a counterexample that demonstrates the wrong message is rendered for `not_found` on the unfixed code. Confirm the root cause is the `errorMessages` string, not the resolver or hook.

**Test Plan**: Render `ArcNSResolutionStatus` with `state="not_found"` and assert the rendered text. On unfixed code this assertion will fail, confirming the bug location.

**Test Cases**:
1. **not_found message test**: Render `<ArcNSResolutionStatus state="not_found" resolvedAddress={null} enteredName="alice.arc" />` and assert text content equals `"This ArcNS name does not currently resolve to a wallet address."` — will fail on unfixed code
2. **not_found ≠ unavailable test**: Assert rendered text does NOT contain `"Name service unavailable"` when `state="not_found"` — will fail on unfixed code

**Expected Counterexamples**:
- Rendered text is `"Name not found — no address record set"` instead of the required message
- Root cause confirmed: wrong string in `errorMessages.not_found`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed component renders the correct message.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := render(ArcNSResolutionStatus_fixed, { state: "not_found", ... })
  ASSERT textContent(result) = "This ArcNS name does not currently resolve to a wallet address."
  ASSERT textContent(result) ≠ "Name service unavailable — try again or use a 0x address"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed component produces the same rendered output as the original.

**Pseudocode:**
```
FOR ALL state WHERE state ≠ "not_found" DO
  ASSERT render(ArcNSResolutionStatus_original, { state, ... })
       = render(ArcNSResolutionStatus_fixed, { state, ... })
END FOR
```

**Testing Approach**: Property-based testing is well-suited here because the full set of `ResolutionState` values is a small finite domain — a PBT generator over the enum values cleanly covers all preservation cases without manual enumeration.

**Test Cases**:
1. **adapter_unavailable preservation**: `state="adapter_unavailable"` → still renders "Name service unavailable — try again or use a 0x address"
2. **unsupported_tld preservation**: `state="unsupported_tld"` → still renders "Unsupported name — use .arc or .circle"
3. **invalid preservation**: `state="invalid"` → still renders "Invalid ArcNS name"
4. **resolved preservation**: `state="resolved"` with a valid address → still renders the address with ✓ icon
5. **resolving preservation**: `state="resolving"` → still renders spinner + "Resolving…"
6. **idle preservation**: `state="idle"` → still renders null

### Unit Tests

- Render `ArcNSResolutionStatus` with `state="not_found"` → assert exact message text (fix check)
- Render with `state="adapter_unavailable"` → assert "Name service unavailable" message unchanged
- Render with `state="unsupported_tld"` → assert "Unsupported name" message unchanged
- Render with `state="invalid"` → assert "Invalid ArcNS name" unchanged
- Render with `state="resolved"` and a valid address → assert address displayed, no error message
- Render with `state="idle"` → assert null / nothing rendered

### Property-Based Tests

- Generate from `fc.constantFrom("adapter_unavailable", "unsupported_tld", "invalid")` and assert each non-`not_found` error state renders a non-empty message that does NOT equal the new `not_found` message (mutual exclusivity of messages)
- Generate from `fc.constantFrom(...ALL_STATES)` filtered to exclude `not_found` and assert rendered output matches the pre-fix snapshot (preservation across all non-buggy states)

### Integration Tests

- Full hook-to-component path: mock `fetch` to return `{"status":"not_found"}`, render `SendForm` with an ArcNS name as recipient, advance timers past debounce, assert the `not_found` message appears and the send button is disabled
- Confirm `adapter_unavailable` path still shows its own distinct message when `fetch` throws a network error
