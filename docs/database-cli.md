# Database CLI

Boronix database commands wrap Drizzle Kit. Boronix does not implement migration logic.

```bash
boronix db generate
boronix db migrate
boronix db push
boronix db seed
```

Command mapping:

```txt
boronix db generate -> drizzle-kit generate
boronix db migrate  -> drizzle-kit migrate
boronix db push     -> drizzle-kit push
boronix db seed     -> bun app/db/seed.ts
```

Common user errors:

```txt
KQ_DB_CONFIG_NOT_FOUND
KQ_DB_KIT_NOT_FOUND
KQ_DB_SEED_NOT_FOUND
KQ_DB_COMMAND_FAILED
```

`db push` is useful for local/dev. Prefer `db generate` and `db migrate` when you want migration files checked into version control.
