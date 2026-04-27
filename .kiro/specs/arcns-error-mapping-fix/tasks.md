# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - not_found renders wrong message
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface a counterexample demonstrating the wrong message is rendered for `not_found`
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — `state="not_found"` with any `enteredName` value
  - Create `flowpay/__tests__/ArcNSResolutionStatus.test.tsx`
  - Use `@testing-library/react` to render `<ArcNSResolutionStatus state="not_found" resolvedAddress={null} enteredName="alice.arc" />`
  - Use `fc.constantFrom("alice.arc", "bob.circle")` to generate representative ArcNS names and assert for each
  - Assert rendered text equals `"This ArcNS name does not currently resolve to a wallet address."`
  - Assert rendered text does NOT contain `"Name service unavailable"`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — counterexample: rendered text is `"Name not found — no address record set"` instead of the required message (confirms bug location is `errorMessages.not_found` in `ArcNSResolutionStatus.tsx`)
  - Document the counterexample found
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - all other states render unchanged messages
  - **IMPORTANT**: Follow observation-first methodology — observe actual rendered output on UNFIXED code first
  - Observe on UNFIXED code:
    - `state="adapter_unavailable"` → renders "Name service unavailable — try again or use a 0x address"
    - `state="unsupported_tld"` → renders "Unsupported name — use .arc or .circle"
    - `state="invalid"` → renders "Invalid ArcNS name"
    - `state="resolved"` with a valid address → renders the address with ✓ icon, no error message
    - `state="resolving"` → renders "Resolving…" with spinner
    - `state="idle"` → renders null (nothing)
  - Write property-based test using `fc.constantFrom("adapter_unavailable", "unsupported_tld", "invalid")` — for each non-`not_found` error state, assert the rendered message is non-empty and does NOT equal `"This ArcNS name does not currently resolve to a wallet address."`
  - Write individual unit assertions for `resolved`, `resolving`, and `idle` states
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix the not_found message in ArcNSResolutionStatus

  - [x] 3.1 Implement the fix
    - In `components/ArcNSResolutionStatus.tsx`, locate the `errorMessages` object (line 43)
    - Change the `not_found` value from `"Name not found — no address record set"` to `"This ArcNS name does not currently resolve to a wallet address."`
    - No other files require modification — resolver, hook, and routing logic are all correct
    - _Bug_Condition: isBugCondition(input) where input.state = "not_found"_
    - _Expected_Behavior: rendered text = "This ArcNS name does not currently resolve to a wallet address." AND rendered text ≠ "Name service unavailable — try again or use a 0x address"_
    - _Preservation: all states where state ≠ "not_found" must render exactly the same output as before the fix_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - not_found renders correct message
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the `errorMessages.not_found` string is correct
    - Run the bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - all other states render unchanged messages
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run all preservation property tests from step 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions in adapter_unavailable, unsupported_tld, invalid, resolved, resolving, and idle states)
    - Confirm the `adapter_unavailable` message is still distinct from the new `not_found` message

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `cd flowpay && npx vitest run`
  - Ensure all tests pass, ask the user if questions arise
