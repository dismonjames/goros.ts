# SQLite Database

SQLite is the preferred Boronix database template for local/dev.

```bash
npx create-boronix my-app --db sqlite
cd my-app
npm install
npm run db:push
npm run db:seed
npm run dev
```

Generated dependencies:

```json
{
  "dependencies": {
    "boronix": "^0.4.0",
    "drizzle-orm": "latest"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "@types/bun": "latest"
  }
}
```

`.env.example`:

```env
DATABASE_URL=./local.db
```

Boronix creates a `notes` table schema and a `/notes` CRUD route. The DB client uses `bun:sqlite` through `drizzle-orm/bun-sqlite`.
