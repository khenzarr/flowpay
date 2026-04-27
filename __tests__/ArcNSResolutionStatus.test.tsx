// Bugfix spec: arcns-error-mapping-fix
// Task 1: Bug condition exploration test
// Property 1: Bug Condition — not_found renders wrong message
//
// CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists.
// DO NOT attempt to fix the test or the code when it fails.
// This test encodes the expected behavior and will pass after the fix is applied.
//
// Validates: Requirements 1.1, 1.2, 2.1

import { describe, it, expect } from "vitest";
import { fc, test as fcTest } from "@fast-check/vitest";
import { render, screen } from "@testing-library/react";
import { ArcNSResolutionStatus } from "../components/ArcNSResolutionStatus";

// Property 1: Bug Condition — not_found renders its own message, not the unavailable message
//
// For any ArcNS name, when state="not_found", the component SHALL render
// "This ArcNS name does not currently resolve to a wallet address."
// and SHALL NOT render "Name service unavailable".
//
// On UNFIXED code this test FAILS with counterexample:
//   enteredName: "alice.arc" (or "bob.circle")
//   rendered text: "Name not found — no address record set"
//   expected:      "This ArcNS name does not currently resolve to a wallet address."
// This confirms the bug is in errorMessages.not_found in ArcNSResolutionStatus.tsx.
describe("Property 1: Bug Condition — not_found renders wrong message", () => {
  fcTest.prop([fc.constantFrom("alice.arc", "bob.circle")])(
    "state=not_found renders the correct not-found message, not the unavailable message",
    (enteredName) => {
      const { unmount } = render(
        <ArcNSResolutionStatus
          state="not_found"
          resolvedAddress={null}
          enteredName={enteredName}
        />
      );

      // Assert the correct message is shown
      screen.getByText(
        "This ArcNS name does not currently resolve to a wallet address."
      );

      // Assert the adapter_unavailable message is NOT shown
      const unavailableText = screen.queryByText(/Name service unavailable/);
      if (unavailableText !== null) {
        throw new Error(
          `Expected "Name service unavailable" NOT to be rendered for state=not_found, but it was found. ` +
            `enteredName="${enteredName}". This confirms the bug: errorMessages.not_found is mapped to the wrong string.`
        );
      }

      unmount();
    }
  );
});

// Bugfix spec: arcns-error-mapping-fix
// Task 2: Preservation property tests (BEFORE implementing fix)
// Property 2: Preservation — all other states render unchanged messages
//
// EXPECTED OUTCOME: All preservation tests PASS on unfixed code (confirms baseline behavior to preserve)
//
// Validates: Requirements 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5

// ── Property 2: Preservation — non-not_found error states ────────────────────

// For each non-not_found error state, the rendered message must be non-empty
// and must NOT equal the new not_found message.
describe("Property 2: Preservation — non-not_found error states render unchanged messages", () => {
  fcTest.prop([
    fc.constantFrom(
      "adapter_unavailable" as const,
      "unsupported_tld" as const,
      "invalid" as const
    ),
  ])(
    "non-not_found error states render a non-empty message that is not the not_found message",
    (state) => {
      const { container, unmount } = render(
        <ArcNSResolutionStatus
          state={state}
          resolvedAddress={null}
          enteredName="alice.arc"
        />
      );

      // The rendered message must be non-empty
      const text = container.textContent ?? "";
      expect(text.trim().length).toBeGreaterThan(0);

      // Must NOT render the not_found message
      expect(text).not.toContain(
        "This ArcNS name does not currently resolve to a wallet address."
      );

      unmount();
    }
  );

  it("adapter_unavailable renders its own message", () => {
    render(
      <ArcNSResolutionStatus
        state="adapter_unavailable"
        resolvedAddress={null}
        enteredName="alice.arc"
      />
    );
    screen.getByText(
      "Name service unavailable — try again or use a 0x address"
    );
  });

  it("unsupported_tld renders its own message", () => {
    render(
      <ArcNSResolutionStatus
        state="unsupported_tld"
        resolvedAddress={null}
        enteredName="alice.eth"
      />
    );
    screen.getByText("Unsupported name — use .arc or .circle");
  });

  it("invalid renders its own message", () => {
    render(
      <ArcNSResolutionStatus
        state="invalid"
        resolvedAddress={null}
        enteredName="bad name"
      />
    );
    screen.getByText("Invalid ArcNS name");
  });
});

// ── Unit assertions for resolved, resolving, and idle states ─────────────────

describe("Preservation — resolved, resolving, and idle states", () => {
  it("resolved with a valid address renders the address with ✓ icon and no error message", () => {
    const address = "0xabcdef1234567890abcdef1234567890abcdef12";
    render(
      <ArcNSResolutionStatus
        state="resolved"
        resolvedAddress={address}
        enteredName="alice.arc"
      />
    );

    // Address is displayed
    screen.getByText(address);

    // ✓ icon is present
    screen.getByText("✓");

    // No error message
    expect(
      screen.queryByText(
        "This ArcNS name does not currently resolve to a wallet address."
      )
    ).toBeNull();
    expect(
      screen.queryByText(/Name service unavailable/)
    ).toBeNull();
  });

  it("resolving renders 'Resolving…' with spinner", () => {
    render(
      <ArcNSResolutionStatus
        state="resolving"
        resolvedAddress={null}
        enteredName="alice.arc"
      />
    );
    screen.getByText("Resolving…");
  });

  it("idle renders null (nothing)", () => {
    const { container } = render(
      <ArcNSResolutionStatus
        state="idle"
        resolvedAddress={null}
        enteredName=""
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
