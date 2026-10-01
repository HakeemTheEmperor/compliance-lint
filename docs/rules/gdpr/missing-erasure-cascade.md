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
- `onDelete` must be `CASCADE` or `SET NULL` as a string literal, a plain template literal, or an enum-style member such as `OnDeleteType.CASCADE`. Values held in variables are not resolved.
- It does not inspect database migrations, application-level deletion services, or inverse relationships.
