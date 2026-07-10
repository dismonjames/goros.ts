# Postgres Database

Postgres is the Boronix template for production-style deploys, Supabase, Neon, and local Postgres.

Postgres works with Bun or Node runtime.

```bash
npx create-boronix my-app --runtime node --db postgres
cd my-app
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Generated dependencies:

```json
{
  "dependencies": {
    "boronix": "^0.6.1",
    "drizzle-orm": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest"
  }
}
```

`.env.example`:

```env
DATABASE_URL=postgres://user:password@localhost:5432/boronix
```

Boronix does not connect to Postgres during scaffolding. Set `DATABASE_URL`, then use Drizzle Kit through `boronix db`.
