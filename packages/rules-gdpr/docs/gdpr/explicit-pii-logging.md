# `gdpr/explicit-pii-logging`

Flags likely personal or sensitive data passed directly to recognized logging calls, supporting GDPR Article 32 security controls.

## Bad example

```ts
console.log("Incoming request:", req.body);
logger.info(user);
```

## Good example

```ts
logger.info("User created successfully");
console.log("Operation ID:", operationId);
```

## Known limitations

- Recognized logger objects include `console`, `logger`, `winston`, `pino`, and object names containing `logger`.
- It checks a fixed identifier list (`payload`, `user`, `customer`, `password`, `creditcard`, `req`, and `request`) and the properties `body`, `payload`, and `user`.
- It cannot determine whether a variable was sanitized before logging and may miss custom logger APIs or aliases.
