# `gdpr/data-retention-missing`

Checks TypeORM-style `@Entity()` classes and Sequelize-style classes extending `Model` for a recognizable retention or expiration strategy.

## Bad example

```ts
@Entity()
export class UserProfile {
  @Column()
  email!: string;
}
```

## Good example

```ts
@Entity()
export class SessionLog {
  @Column()
  expiresAt!: Date;
}
```

An accepted class-level decorator is another option:

```ts
@Entity()
@RetentionPolicy({ days: 30 })
export class AuditLog {}
```

## Known limitations

- Entity detection is limited to `@Entity()` and a direct superclass named `Model`.
- Recognized field-name fragments are `expiresAt`, `deletedAt`, `retentionDate`, `ttl`, and `validUntil` (case and underscore insensitive).
- The rule does not verify that a retention field is populated, enforced, or connected to a deletion job.
