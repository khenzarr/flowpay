# Bugfix Requirements Document

## Introduction

FlowPay's ArcNS name resolution sends a malformed HTTP request to the ArcNS adapter. Instead of placing only the ArcNS name (e.g. `ttttttt.arc`) in the path segment, FlowPay embeds the entire pre-constructed URL as the path parameter, producing a double-encoded URL that the adapter cannot parse. The adapter works correctly when called directly; the defect is entirely in FlowPay's request construction.

Observed bad request:
```
GET https://arcns-app.vercel.app/api/v1/resolve/name/https%3A%2F%2Farcns-app.vercel.app%2Fapi%2Fv1%2Fresolve%2Fname%2Fttttttt.arc
```

Expected correct request:
```
GET https://arcns-app.vercel.app/api/v1/resolve/name/ttttttt.arc
```

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `resolveArcNSName` is called with an ArcNS name (e.g. `ttttttt.arc`) THEN the system constructs a fetch URL where the path segment contains the full pre-constructed URL (`https://arcns-app.vercel.app/api/v1/resolve/name/ttttttt.arc`) percent-encoded, rather than just the name

1.2 WHEN the malformed URL is sent to the ArcNS adapter THEN the system receives an unexpected response (404 or error) because the adapter cannot match the double-encoded path to a known name

### Expected Behavior (Correct)

2.1 WHEN `resolveArcNSName` is called with an ArcNS name (e.g. `ttttttt.arc`) THEN the system SHALL construct the fetch URL as `https://arcns-app.vercel.app/api/v1/resolve/name/ttttttt.arc` — with only the bare ArcNS name in the path segment

2.2 WHEN the correctly formed URL is sent to the ArcNS adapter THEN the system SHALL receive the adapter's resolution response and map it to the appropriate `ResolutionState`

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `resolveArcNSName` is called with a name whose TLD is not `.arc` or `.circle` THEN the system SHALL CONTINUE TO return `{ state: "unsupported_tld" }` without calling `fetch`

3.2 WHEN `resolveArcNSName` is called with a valid ArcNS name and the adapter returns `{ status: "resolved", address: "0x..." }` THEN the system SHALL CONTINUE TO return `{ state: "resolved", address: "0x..." }`

3.3 WHEN `resolveArcNSName` is called with a valid ArcNS name and the adapter returns `{ status: "not_found" }` THEN the system SHALL CONTINUE TO return `{ state: "not_found" }`

3.4 WHEN `resolveArcNSName` is called with a valid ArcNS name and the network request fails THEN the system SHALL CONTINUE TO return `{ state: "adapter_unavailable" }`

3.5 WHEN `useArcNSResolution` is called with a raw `0x` address as `name` THEN the system SHALL CONTINUE TO return `{ state: "idle", resolvedAddress: null }` without calling `fetch`

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type string (the name argument passed to resolveArcNSName)
  OUTPUT: boolean

  // Bug fires when the name passed to resolveArcNSName is a full URL
  // rather than a bare ArcNS name like "ttttttt.arc"
  RETURN X starts with "https://" OR X starts with "http://"
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  // After the fix, resolveArcNSName should never receive a full URL as name.
  // The URL construction must happen inside resolveArcNSName only,
  // using only the bare name in the path segment.
  url ← constructedFetchUrl(X)
  ASSERT url = ARCNS_ADAPTER_BASE + "/resolve/name/" + encodeURIComponent(X)
  ASSERT pathSegment(url) = encodeURIComponent(X)  // not double-encoded
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT resolveArcNSName_fixed(X) = resolveArcNSName_original(X)
END FOR
```
