# `gdpr/unencrypted-pii-column`

Flags high-risk field names in TypeORM entities and Sequelize models when no accepted encryption decorator or column transformer is present.

## Bad example

```ts
@Entity()
export class User {
  @Column()
  bank_account!: string;
}
```

## Good example

```ts
@Entity()
export class User {
  @Column({ transformer: new EncryptionTransformer() })
  bvn!: string;
}
```

An `@Encrypt()` or `@EncryptedColumn()` decorator is also accepted.

## Known limitations

- Exact normalized field names are `bankaccount`, `creditcard`, `passportnumber`, `bvn`, and `nin`.
- Entity detection is limited to `@Entity()` and a direct superclass named `Model`.
- It recognizes the presence of a transformer, not whether that transformer encrypts correctly or protects values throughout their lifecycle.
