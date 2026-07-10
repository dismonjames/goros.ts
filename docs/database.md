# Database

Boronix does not ship an ORM or database engine. Boronix uses Drizzle for database DX: templates, conventions, CLI wrappers, examples, and docs.

Use SQLite for local development, prototypes, and small apps. Use Postgres for real deploy targets such as Supabase, Neon, or your own Postgres server.

```bash
npx create-boronix my-app --db sqlite
cd my-app
npm install
npm run db:push
npm run db:seed
npm run dev
```

Generated DB apps use this convention:

```txt
app/db/schema.ts
app/db/client.ts
app/db/seed.ts
drizzle.config.ts
.env.example
```

`db push` is convenient for local/dev schema sync. `db generate` plus `db migrate` is better when you want reviewed migration files and controlled deploys.

See also:

- [SQLite](./database-sqlite.md)
- [Postgres](./database-postgres.md)
- [Database CLI](./database-cli.md)
- [Database Tutorial](./tutorial-database.md)
