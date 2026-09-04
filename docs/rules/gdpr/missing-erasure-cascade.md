# `gdpr/missing-erasure-cascade`

Requires supported database relations to specify `onDelete: "CASCADE"`, helping related personal data follow a deletion request under GDPR Article 17.

## Bad example

```ts
@ManyToOne(() => User)
user!: User;
```

## Good example

```ts
@ManyToOne(() => User, { onDelete: "CASCADE" })
user!: User;
```

## Known limitations

- It recognizes only `ManyToOne`, `OneToOne`, and `BelongsTo` decorators.
- The cascade value must be a literal string equal to `CASCADE`, ignoring case.
- It does not inspect database migrations, application-level deletion services, or inverse relationships.
