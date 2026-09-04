# `gdpr/pii-unhashed-storage`

Flags exact high-risk field names that lack one of the rule's accepted hashing, exclusion, encryption, or transformation decorators.

## Bad example

```ts
export class User {
  password!: string;
}
```

## Good example

```ts
export class User {
  @Hash()
  password!: string;
}
```

## Known limitations

- Exact field names are limited to `password`, `ssn`, `pin`, and `social_security`.
- Accepted decorators are `Hash`, `Exclude`, `Encrypt`, and `Transform`, with or without parentheses.
- The rule does not verify that a decorator actually hashes data, and it does not require the field to belong to an entity class.
