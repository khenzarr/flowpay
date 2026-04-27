# Requirements Document

## Introduction

This feature adds ArcNS name-based sending to FlowPay's send flow. Currently, the recipient field only accepts raw `0x` wallet addresses. After this change, users will also be able to type an ArcNS name (e.g. `alice.arc` or `alice.circle`) in the recipient field. FlowPay will resolve the name to a `0x` address via the live ArcNS public adapter, show the resolved address clearly before the user confirms, and then execute the send using that resolved address. The Arc Testnet → Arc Testnet same-chain route is the supported path for this feature.

No changes are made to the ArcNS project. ArcNS is treated as a read-only external HTTP integration surface.

---

## Glossary

- **ArcNS_Adapter**: The external HTTP service at `https://arcns-app.vercel.app/api/v1` that resolves ArcNS names to wallet addresses.
- **ArcNS_Name**: A human-readable name ending in a supported TLD (`.arc` or `.circle`) that maps to a wallet address via the ArcNS_Adapter.
- **Recipient_Field**: The text input in the FlowPay send form where the user enters a destination — either a raw `0x` address or an ArcNS_Name.
- **Resolved_Address**: The `0x` wallet address returned by the ArcNS_Adapter for a given ArcNS_Name.
- **Resolution_State**: The current status of an ArcNS name lookup — one of: `idle`, `resolving`, `resolved`, `not_found`, `invalid`, `unsupported_tld`, `adapter_unavailable`.
- **Send_Flow**: The FlowPay UI and logic path that collects recipient, amount, and route, then executes a USDC transfer.
- **Arc_Testnet**: The Arc test network (chain ID 5042002) where USDC is the native gas token.
- **Supported_TLD**: A top-level domain recognised by the ArcNS_Adapter — currently `.arc` and `.circle`.

---

## Requirements

### Requirement 1: Recipient Field Accepts ArcNS Names

**User Story:** As a FlowPay user, I want to type an ArcNS name in the recipient field, so that I do not need to copy-paste a raw wallet address.

#### Acceptance Criteria

1. THE Recipient_Field SHALL accept input matching the pattern `<label>.<tld>` in addition to `0x` addresses.
2. WHEN the Recipient_Field contains a raw `0x` address of exactly 40 hex characters, THE Send_Flow SHALL treat it as a direct address without triggering ArcNS resolution.
3. WHEN the Recipient_Field contains a string ending in `.arc` or `.circle`, THE Send_Flow SHALL classify it as an ArcNS_Name and initiate resolution.
4. WHEN the Recipient_Field contains a string ending in a TLD that is not `.arc` or `.circle`, THE Send_Flow SHALL set Resolution_State to `unsupported_tld` and SHALL NOT initiate a resolution request.
5. WHEN the Recipient_Field is empty, THE Send_Flow SHALL set Resolution_State to `idle` and SHALL NOT initiate a resolution request.
6. WHEN the Recipient_Field contains a raw `0x` address, THE Send_Flow SHALL preserve all existing direct-address send behaviour without modification (non-regression constraint).

---

### Requirement 2: ArcNS Name Resolution

**User Story:** As a FlowPay user, I want FlowPay to automatically look up the wallet address for an ArcNS name I enter, so that I can send USDC without knowing the recipient's raw address.

#### Acceptance Criteria

1. WHEN an ArcNS_Name is entered in the Recipient_Field, THE Send_Flow SHALL set Resolution_State to `resolving` and SHALL call `GET https://arcns-app.vercel.app/api/v1/resolve/name/{name}`.
2. WHEN the ArcNS_Adapter returns a successful response containing a valid `0x` address, THE Send_Flow SHALL set Resolution_State to `resolved` and SHALL store the Resolved_Address.
3. WHEN the ArcNS_Adapter returns a `not_found` status or an empty address record, THE Send_Flow SHALL set Resolution_State to `not_found`.
4. WHEN the ArcNS_Adapter returns an `invalid` input status, THE Send_Flow SHALL set Resolution_State to `invalid`.
5. WHEN the ArcNS_Adapter returns an `unsupported_tld` status, THE Send_Flow SHALL set Resolution_State to `unsupported_tld`.
6. IF the ArcNS_Adapter request fails due to a network error or returns an HTTP 5xx status, THEN THE Send_Flow SHALL set Resolution_State to `adapter_unavailable`.
7. WHEN the user modifies the Recipient_Field while Resolution_State is `resolving`, THE Send_Flow SHALL cancel the in-flight resolution request and SHALL restart resolution with the updated input.
8. THE Send_Flow SHALL debounce ArcNS_Adapter calls by at least 400 ms after the user stops typing before issuing a request.
9. WHEN the Recipient_Field value changes after Resolution_State is `resolved`, THE Send_Flow SHALL immediately clear the Resolved_Address and SHALL set Resolution_State to `idle`.
10. WHEN the selected route or destination network changes after Resolution_State is `resolved`, THE Send_Flow SHALL immediately clear the Resolved_Address and SHALL set Resolution_State to `idle`.
11. IF the ArcNS_Adapter does not return a response within 10 seconds, THEN THE Send_Flow SHALL set Resolution_State to `adapter_unavailable` and SHALL keep the send button disabled until the user retries or enters a raw `0x` address.

---

### Requirement 3: Resolved Address Display

**User Story:** As a FlowPay user, I want to see the wallet address that an ArcNS name resolved to before I confirm a send, so that I can verify I am sending to the correct destination.

#### Acceptance Criteria

1. WHILE Resolution_State is `resolving`, THE Send_Flow SHALL display a visible loading indicator adjacent to the Recipient_Field.
2. WHEN Resolution_State transitions to `resolved`, THE Send_Flow SHALL display the full Resolved_Address beneath the Recipient_Field.
3. WHEN Resolution_State transitions to `resolved`, THE Send_Flow SHALL display both the original ArcNS_Name entered by the user and the Resolved_Address in the confirmation area so the user can verify both values before confirming.
4. WHEN Resolution_State is `not_found`, THE Send_Flow SHALL display the message "Name not found — no address record set" beneath the Recipient_Field.
5. WHEN Resolution_State is `unsupported_tld`, THE Send_Flow SHALL display the message "Unsupported name — use .arc or .circle" beneath the Recipient_Field.
6. WHEN Resolution_State is `invalid`, THE Send_Flow SHALL display the message "Invalid ArcNS name" beneath the Recipient_Field.
7. WHEN Resolution_State is `adapter_unavailable`, THE Send_Flow SHALL display the message "Name service unavailable — try again or use a 0x address" beneath the Recipient_Field.

---

### Requirement 4: Send Confirmation Uses Resolved Address

**User Story:** As a FlowPay user, I want the send transaction to use the resolved wallet address, so that USDC reaches the correct on-chain destination.

#### Acceptance Criteria

1. WHEN the user initiates a send and Resolution_State is `resolved`, THE Send_Flow SHALL use the Resolved_Address as the on-chain recipient for the USDC transfer.
2. WHEN the user initiates a send and the Recipient_Field contains a raw `0x` address, THE Send_Flow SHALL use that address directly as the on-chain recipient without triggering ArcNS resolution (non-regression constraint).
3. IF the user initiates a send and Resolution_State is not `resolved` and the Recipient_Field does not contain a valid `0x` address, THEN THE Send_Flow SHALL keep the send button disabled and SHALL NOT submit a transaction.
4. IF the user initiates a send and Resolution_State is `adapter_unavailable`, THEN THE Send_Flow SHALL keep the send button disabled and SHALL NOT submit a transaction.
5. THE Send_Flow SHALL NOT modify the Recipient_Field display value after resolution — the ArcNS_Name entered by the user SHALL remain visible in the field.
6. WHEN the user reaches the send confirmation step and Resolution_State is `resolved`, THE Send_Flow SHALL display both the ArcNS_Name entered by the user and the Resolved_Address so the user can verify the destination before confirming.

---

### Requirement 5: Arc Testnet → Arc Testnet Route Support

**User Story:** As a FlowPay user, I want to send USDC from Arc Testnet to Arc Testnet using an ArcNS name, so that I can use the same-chain route with name-based addressing.

#### Acceptance Criteria

1. WHEN source chain is Arc_Testnet and destination chain is Arc_Testnet, THE Send_Flow SHALL classify the route as a direct same-chain send.
2. WHEN source chain is Arc_Testnet and destination chain is Arc_Testnet and Resolution_State is `resolved`, THE Send_Flow SHALL enable the send button.
3. WHEN a direct Arc_Testnet → Arc_Testnet send is executed with a Resolved_Address, THE Send_Flow SHALL call `executeSend` with the Resolved_Address as the recipient.
4. WHEN the destination chain is not Arc_Testnet, THE Send_Flow SHALL NOT trigger ArcNS resolution and SHALL set Resolution_State to `idle`.
5. WHEN the destination chain changes to a chain that is not Arc_Testnet and Resolution_State is `resolved`, THE Send_Flow SHALL immediately clear the Resolved_Address and SHALL set Resolution_State to `idle`.

---

### Requirement 6: ArcNS Resolver Module

**User Story:** As a FlowPay developer, I want ArcNS resolution logic isolated in a dedicated module, so that it can be tested independently and does not couple resolution concerns to the send form UI.

#### Acceptance Criteria

1. THE ArcNS_Adapter integration SHALL be implemented in a dedicated module (`lib/arcnsResolver.ts`) that exports a `resolveArcNSName` function.
2. THE `resolveArcNSName` function SHALL accept a name string and SHALL return a structured result containing the Resolution_State and, when resolved, the Resolved_Address.
3. THE `resolveArcNSName` function SHALL validate that the input ends in a Supported_TLD before issuing an HTTP request.
4. FOR ALL valid ArcNS_Name inputs, calling `resolveArcNSName` with the same name SHALL return a result with a consistent Resolution_State given the same adapter response (idempotence property).
5. THE `resolveArcNSName` function SHALL parse the ArcNS_Adapter JSON response and SHALL return a typed result — it SHALL NOT expose raw HTTP response objects to callers.
6. THE `resolveArcNSName` function SHALL accept an `AbortSignal` parameter to support request cancellation.

---

### Requirement 7: Resolution Tests

**User Story:** As a FlowPay developer, I want focused tests for ArcNS resolution behaviour, so that regressions in name lookup are caught before they reach users.

#### Acceptance Criteria

1. THE test suite SHALL include a test that verifies `resolveArcNSName` returns `resolved` and a valid `0x` address when the adapter returns a successful response.
2. THE test suite SHALL include a test that verifies `resolveArcNSName` returns `not_found` when the adapter returns a `not_found` status.
3. THE test suite SHALL include a test that verifies `resolveArcNSName` returns `unsupported_tld` without making an HTTP request when the input TLD is not `.arc` or `.circle`.
4. THE test suite SHALL include a test that verifies `resolveArcNSName` returns `adapter_unavailable` when the HTTP request throws a network error.
5. THE test suite SHALL include a test that verifies `resolveArcNSName` returns `invalid` when the adapter returns an invalid input status.
6. THE test suite SHALL include a round-trip property: FOR ALL ArcNS_Name strings that the resolver classifies as `resolved`, the Resolved_Address SHALL be a valid `0x` address of exactly 40 hex characters.
7. THE test suite SHALL include a test that verifies the Resolution_State is set to `idle` and the Resolved_Address is cleared when the Recipient_Field value changes after a successful resolution (stale result invalidation).
