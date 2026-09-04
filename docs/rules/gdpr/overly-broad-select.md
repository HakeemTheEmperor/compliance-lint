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

- It checks method property names only: `find`, `findOne`, `findAndCount`, and `findAll`.
- It accepts any `select` property, including a dynamically computed or overly broad value.
- It may flag APIs where selecting all fields is intentional or where selection is applied elsewhere.
