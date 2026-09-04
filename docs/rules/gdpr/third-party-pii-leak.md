# `gdpr/third-party-pii-leak`

Flags likely raw personal data passed to recognized outbound HTTP clients, supporting vendor and international-transfer review under GDPR Articles 28 and 44.

## Bad example

```ts
await axios.post("https://vendor.example/sync", req.body);
await fetch("https://vendor.example/webhook", payload);
```

## Good example

```ts
await axios.post("https://vendor.example/metrics", {
  status: "active",
});
await fetch("https://vendor.example/token", sanitizedToken);
```

## Known limitations

- Recognized clients are `axios`, `fetch`, `http`, `got`, `superagent`, and `request`.
- It checks a fixed list of identifiers and selected member properties, not the contents or destination of a payload.
- It cannot prove that a payload is sanitized or that a vendor has an appropriate data-processing agreement.
