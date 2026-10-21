# `gdpr/overly-broad-select`

Requires common repository query methods to provide an options object with an explicit `select` property, reducing accidental retrieval of unnecessary columns under GDPR Article 5(1)(c).

## Bad example

```ts
return userRepository.find({ where: { active: true } });
```

## Good example

```ts
return userRepository.find({
  where: { active: true },
  select: ["id", "email"],
});
```

## Known limitations

- It checks method names `find`, `findOne`, `findAndCount`, and `findAll`, and only on receivers whose name looks like a data-access object (`repo`, `repository`, `model`, `service`, `dao`, `manager`, `store`, `collection`, `entity`, `prisma`, `db`). `items.find(...)` on a plain array is not flagged, but a data-access object with an unconventional name is missed.
- It accepts any `select` property, including a dynamically computed or overly broad value.
- It may flag APIs where selecting all fields is intentional or where selection is applied elsewhere.
