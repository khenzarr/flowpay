# Bugfix Requirements Document

## Introduction

When the ArcNS adapter returns `{"status":"not_found","hint":"Name has no address record set."}`, FlowPay incorrectly displays "Name service unavailable — try again or use a 0x address" — the message reserved for true adapter/network failures. This collapses two distinct outcomes (adapter unreachable vs. name has no forward address record) into a single misleading error, causing users to believe the name service is down when in fact the service is reachable and the entered name simply has no wallet address registered.

The fix must distinguish all five ArcNS adapter response categories and map each to its own precise user-facing message, while keeping the send flow blocked for all non-success outcomes and preserving all existing `0x`-address behaviour.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the ArcNS adapter returns `{"status":"not_found"}` or `{"status":"not_found","hint":"..."}` THEN the system displays "Name service unavailable — try again or use a 0x address" (the adapter-unavailable message) instead of a message specific to the name not resolving

1.2 WHEN the ArcNS adapter returns `{"status":"not_found"}` THEN the system maps the response to `Resolution_State = not_found` in the resolver layer but the UI message shown to the user is indistinguishable from a true service outage

### Expected Behavior (Correct)

2.1 WHEN the ArcNS adapter returns `{"status":"not_found"}` or `{"status":"not_found","hint":"Name has no address record set."}` THEN the system SHALL display "This ArcNS name does not currently resolve to a wallet address." and SHALL keep the send button disabled

2.2 WHEN the ArcNS adapter is unreachable, returns an HTTP 5xx, or times out THEN the system SHALL display "Name service unavailable — try again or use a 0x address" and SHALL keep the send button disabled

2.3 WHEN the ArcNS adapter returns `{"status":"unsupported_tld"}` or the entered TLD is not `.arc` / `.circle` THEN the system SHALL display "Unsupported name — use .arc or .circle" and SHALL keep the send button disabled

2.4 WHEN the ArcNS adapter returns `{"status":"invalid"}` or the entered name has no valid label THEN the system SHALL display "Invalid ArcNS name" and SHALL keep the send button disabled

2.5 WHEN the ArcNS adapter returns `{"status":"resolved","address":"0x..."}` with a valid 40-hex-char address THEN the system SHALL display the resolved address and SHALL enable the send button

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the recipient field contains a valid `0x` address THEN the system SHALL CONTINUE TO treat it as a direct address, skip ArcNS resolution entirely, and enable the send button when all other conditions are met

3.2 WHEN the ArcNS adapter returns `{"status":"resolved","address":"0x..."}` THEN the system SHALL CONTINUE TO display the resolved address beneath the recipient field and use it as the on-chain recipient

3.3 WHEN the ArcNS adapter returns `{"status":"unsupported_tld"}` THEN the system SHALL CONTINUE TO display "Unsupported name — use .arc or .circle"

3.4 WHEN the ArcNS adapter returns `{"status":"invalid"}` THEN the system SHALL CONTINUE TO display "Invalid ArcNS name"

3.5 WHEN the ArcNS adapter is unreachable or returns HTTP 5xx THEN the system SHALL CONTINUE TO display "Name service unavailable — try again or use a 0x address"

3.6 WHEN the recipient field is empty THEN the system SHALL CONTINUE TO set Resolution_State to `idle` and SHALL NOT initiate a resolution request

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ArcNSAdapterResponse
  OUTPUT: boolean

  // Returns true when the adapter signals "name exists but has no address record"
  // — the case that was previously collapsed into adapter_unavailable messaging
  RETURN X.status = "not_found"
END FUNCTION
```

```pascal
// Property: Fix Checking — not_found must show its own message, not the unavailable message
FOR ALL X WHERE isBugCondition(X) DO
  message ← renderedMessage(ArcNSResolutionStatus, state = "not_found")
  ASSERT message = "This ArcNS name does not currently resolve to a wallet address."
  ASSERT message ≠ "Name service unavailable — try again or use a 0x address"
  ASSERT sendButtonDisabled = true
END FOR
```

```pascal
// Property: Preservation Checking — all other states render unchanged messages
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT renderedMessage(ArcNSResolutionStatus, state = F(X).state)
       = renderedMessage(ArcNSResolutionStatus, state = F'(X).state)
END FOR
```
