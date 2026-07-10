# Tutorial: CRUD With Drizzle

Create an app with SQLite:

```bash
npx create-boronix my-notes --template basic --runtime bun --db sqlite
cd my-notes
bun install
bun run db:push
bun run db:seed
bun run dev
```

Open `http://localhost:3000/notes`.

The scaffolded app includes:

```txt
app/db/schema.ts      Drizzle notes table
app/db/client.ts      Drizzle client
app/db/seed.ts        Seed data
app/routes/notes      HTML page, loader, create/delete actions
drizzle.config.ts     Drizzle Kit config
```

The loader reads notes:

```ts
const items = await db.select().from(notes).orderBy(desc(notes.id))
```

The actions insert and delete rows with Drizzle. Boronix only handles routing, actions, rendering, and CLI wrapping.
