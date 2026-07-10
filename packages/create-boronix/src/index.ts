#!/usr/bin/env bun
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const validDbOptions = ["none", "sqlite", "postgres"] as const
type DbOption = typeof validDbOptions[number]

async function run() {
  console.log("\x1b[38;5;208m◆\x1b[0m \x1b[1mcreate-boronix\x1b[0m\n")

  let projectName = ""
  let template = "basic"
  let runtime = "bun"
  let db: DbOption | undefined = undefined
  let install = false
  let git = false

  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) continue
    if (arg === "--template") {
      const val = args[i + 1]
      if (val) {
        template = val
        i++
      }
    } else if (arg === "--runtime") {
      const val = args[i + 1]
      if (val) {
        runtime = val
        i++
      }
    } else if (arg === "--db") {
      const val = args[i + 1]
      if (val) {
        if (!isDbOption(val)) {
          console.error(`KQ_CREATE_INVALID_DB\nUnsupported database option "${val}".\nExpected: none, sqlite, postgres.`)
          process.exit(1)
        }
        db = val
        i++
      }
    } else if (arg === "--no-install") {
      install = false
    } else if (arg === "--install") {
      install = true
    } else if (arg === "--no-git") {
      git = false
    } else if (arg === "--git") {
      git = true
    } else if (!arg.startsWith("-")) {
      projectName = arg
    }
  }

  const isInteractive = !projectName && process.stdout.isTTY

  if (isInteractive) {
    const rl = readline.createInterface({ input, output })
    try {
      // 1. Project name
      const nameAns = await rl.question("Project name: (my-boronix-app): ")
      projectName = nameAns.trim() || "my-boronix-app"

      // Check if target directory already exists
      const checkPath = path.resolve(projectName)
      if (existsSync(checkPath)) {
        console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Target directory already exists: ${projectName}`)
        process.exit(1)
      }

      // 2. Template
      const templateAns = await rl.question("Template: basic / homework (basic): ")
      const tClean = templateAns.trim().toLowerCase()
      template = tClean === "homework" ? "homework" : "basic"

      // 3. Runtime
      const runtimeAns = await rl.question("Runtime: bun / node (bun): ")
      const rClean = runtimeAns.trim().toLowerCase()
      runtime = rClean === "node" ? "node" : "bun"

      // 4. Database
      const dbAns = await rl.question("Add database? none / sqlite / postgres (none): ")
      const dbClean = dbAns.trim().toLowerCase()
      db = isDbOption(dbClean) ? dbClean : "none"

      // 5. Install dependencies
      const installAns = await rl.question("Install dependencies: yes/no (no): ")
      const iClean = installAns.trim().toLowerCase()
      install = iClean === "y" || iClean === "yes"

      // 6. Initialize git
      const gitAns = await rl.question("Initialize git: yes/no (no): ")
      const gClean = gitAns.trim().toLowerCase()
      git = gClean === "y" || gClean === "yes"
    } finally {
      rl.close()
    }
  } else {
    // Non-interactive mode
    if (!projectName) {
      console.error("\x1b[31m✖\x1b[0m \x1b[1mUsage:\x1b[0m create-boronix <app-name> [options]")
      process.exit(1)
    }

    const checkPath = path.resolve(projectName)
    if (existsSync(checkPath)) {
      console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Target directory already exists: ${projectName}`)
      process.exit(1)
    }
  }
  db = db ?? "none"

  if (db === "sqlite" && runtime === "node") {
    console.error(`KQ_CREATE_DB_RUNTIME_UNSUPPORTED\n--db sqlite requires runtime "bun" because the SQLite template uses bun:sqlite.\nUse --runtime bun or choose --db postgres for Node.`)
    process.exit(1)
  }

  // Print summary card
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mproject\x1b[0m   \x1b[1m${projectName}\x1b[0m`)
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mtemplate\x1b[0m  \x1b[1m${template}\x1b[0m`)
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mruntime\x1b[0m   \x1b[1m${runtime}\x1b[0m\n`)
  console.log(`  \x1b[32m✔\x1b[0m \x1b[90mdatabase\x1b[0m  \x1b[1m${db}\x1b[0m\n`)

  const targetDir = path.resolve(projectName)
  const templateDir = path.join(packageRoot, "src", "templates", template)

  if (!existsSync(templateDir)) {
    console.error(`\x1b[31m✖\x1b[0m \x1b[1mError:\x1b[0m Template '${template}' not found at ${templateDir}`)
    process.exit(1)
  }

  // Copy template files
  mkdirSync(targetDir, { recursive: true })
  cpSync(templateDir, targetDir, { recursive: true })

  // Adjust package.json
  const pkgPath = path.join(targetDir, "package.json")
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    pkg.name = path.basename(projectName)
    
    // Ensure scripts match exact requirement
    pkg.scripts = {
      "dev": "boronix dev",
      "build": "boronix build",
      "start": "boronix start",
      "doctor": "boronix doctor",
      "doctor:production": "boronix doctor --production",
      "typegen": "boronix typegen"
    }

    if (db !== "none") {
      pkg.scripts["db:generate"] = "boronix db generate"
      pkg.scripts["db:migrate"] = "boronix db migrate"
      pkg.scripts["db:push"] = "boronix db push"
      pkg.scripts["db:seed"] = "boronix db seed"
    }

    // Set boronix version to ^0.6.0
    if (pkg.dependencies) {
      if (pkg.dependencies.boronix) delete pkg.dependencies.boronix
      if (pkg.dependencies["@boronix-ts/boronix"]) delete pkg.dependencies["@boronix-ts/boronix"]
      pkg.dependencies["boronix"] = "^0.6.0"
      if (db === "sqlite") {
        pkg.dependencies["drizzle-orm"] = "latest"
        pkg.dependencies["@libsql/client"] = "latest"
      } else if (db === "postgres") {
        pkg.dependencies["drizzle-orm"] = "latest"
        pkg.dependencies["postgres"] = "latest"
      }
    }
    if (db === "sqlite") {
      pkg.devDependencies = {
        ...(pkg.devDependencies ?? {}),
        "drizzle-kit": "latest",
        "@types/bun": "latest"
      }
    } else if (db === "postgres") {
      pkg.devDependencies = {
        ...(pkg.devDependencies ?? {}),
        "drizzle-kit": "latest"
      }
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8")
  }

  if (db !== "none") {
    writeDatabaseFiles(targetDir, db)
  }

  // Adjust config runtime
  const configPath = path.join(targetDir, "boronix.config.ts")
  if (existsSync(configPath)) {
    let configContent = readFileSync(configPath, "utf8")
    configContent = configContent.replace(/runtime:\s*["'](?:bun|node|deno)["']/, `runtime: "${runtime}"`)
    writeFileSync(configPath, configContent, "utf8")
  }

  console.log(`\x1b[32m✔\x1b[0m created project`)

  // Git init
  if (git) {
    try {
      execSync("git init", { cwd: targetDir, stdio: "ignore" })
      console.log(`\x1b[32m✔\x1b[0m initialized git repository`)
    } catch {}
  }

  // Install dependencies
  let installFailed = false
  if (install) {
    try {
      const pm = runtime === "bun" ? "bun" : "npm"
      execSync(`${pm} install`, { cwd: targetDir, stdio: "ignore" })
    } catch (err) {
      installFailed = true
    }
  }

  console.log("")

  if (installFailed) {
    console.log(`\x1b[33m⚠\x1b[0m dependency install failed\n`)
    console.log(`Hint:`)
    console.log(`  Run \`bun install\` manually.\n`)
  }

  console.log("\x1b[1mNext steps\x1b[0m")
  console.log(`  \x1b[38;5;208m➜\x1b[0m cd ${projectName}`)
  if (!install || installFailed) {
    const pm = runtime === "bun" ? "bun" : "npm"
    console.log(`  \x1b[38;5;208m➜\x1b[0m ${pm} install`)
  }
  const pmRun = runtime === "bun" ? "bun" : "npm"
  if (db !== "none") {
    console.log(`  \x1b[38;5;208m➜\x1b[0m ${pmRun} run db:push`)
    console.log(`  \x1b[38;5;208m➜\x1b[0m ${pmRun} run db:seed`)
  }
  console.log(`  \x1b[38;5;208m➜\x1b[0m ${pmRun} run dev\n`)
  console.log("\x1b[1mThen open\x1b[0m")
  console.log(`  \x1b[38;5;208m➜\x1b[0m http://localhost:3000`)
}

function isDbOption(value: string): value is DbOption {
  return validDbOptions.includes(value as DbOption)
}

function writeDatabaseFiles(targetDir: string, db: DbOption): void {
  mkdirSync(path.join(targetDir, "app", "db"), { recursive: true })
  mkdirSync(path.join(targetDir, "app", "routes", "notes"), { recursive: true })

  if (db === "sqlite") {
    writeFileSync(path.join(targetDir, ".env.example"), "DATABASE_URL=./local.db\n", "utf8")
    writeFileSync(path.join(targetDir, "app/db/schema.ts"), `import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull()
})
`, "utf8")
    writeFileSync(path.join(targetDir, "app/db/client.ts"), `import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL ?? "./local.db"
const sqlite = new Database(databaseUrl)

export const db = drizzle(sqlite, { schema })
`, "utf8")
    writeFileSync(path.join(targetDir, "app/db/seed.ts"), `import { db } from "./client"
import { notes } from "./schema"

await db.insert(notes).values([
  {
    title: "First note",
    body: "Created by Boronix.",
    createdAt: new Date()
  }
])
`, "utf8")
    writeFileSync(path.join(targetDir, "drizzle.config.ts"), `import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./local.db"
  }
})
`, "utf8")
  } else if (db === "postgres") {
    writeFileSync(path.join(targetDir, ".env.example"), "DATABASE_URL=postgres://user:password@localhost:5432/boronix\n", "utf8")
    writeFileSync(path.join(targetDir, "app/db/schema.ts"), `import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow()
})
`, "utf8")
    writeFileSync(path.join(targetDir, "app/db/client.ts"), `import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Postgres.")
}

const client = postgres(databaseUrl)

export const db = drizzle(client, { schema })
`, "utf8")
    writeFileSync(path.join(targetDir, "app/db/seed.ts"), `import { db } from "./client"
import { notes } from "./schema"

await db.insert(notes).values([
  {
    title: "First note",
    body: "Created by Boronix."
  }
])
`, "utf8")
    writeFileSync(path.join(targetDir, "drizzle.config.ts"), `import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
})
`, "utf8")
  }

  writeFileSync(path.join(targetDir, "app/routes/notes/page.ts"), `import { desc } from "drizzle-orm"
import { page } from "boronix"
import { db } from "../../db/client"
import { notes } from "../../db/schema"

export default page(async () => {
  const items = await db.select().from(notes).orderBy(desc(notes.id))

  return { notes: items }
})
`, "utf8")
  writeFileSync(path.join(targetDir, "app/routes/notes/actions.ts"), `import { eq } from "drizzle-orm"
import { action, fail, redirect } from "boronix"
import { db } from "../../db/client"
import { notes } from "../../db/schema"

export const create = action(async ({ form }) => {
  const title = form.string("title").trim()
  const body = form.string("body").trim()

  if (!title) {
    return fail({
      message: "Title is required",
      fields: { title, body }
    }, { status: 400 })
  }

  await db.insert(notes).values({
    title,
    body,
    createdAt: new Date()
  })

  return redirect("/notes")
})

export const remove = action(async ({ form }) => {
  const id = Number(form.string("id"))

  if (!Number.isInteger(id)) {
    return fail({
      message: "Invalid note id"
    }, { status: 400 })
  }

  await db.delete(notes).where(eq(notes.id, id))

  return redirect("/notes")
})
`, "utf8")
  writeFileSync(path.join(targetDir, "app/routes/notes/page.html"), `<h1>Notes</h1>

{{#if message}}
  <p>{{ message }}</p>
{{/if}}

<form method="post" action="?/create">
  <label>
    Title
    <input name="title" value="{{ fields.title }}">
  </label>

  <label>
    Body
    <textarea name="body">{{ fields.body }}</textarea>
  </label>

  <button type="submit">Create note</button>
</form>

<ul>
  {{#each notes}}
    <li>
      <strong>{{ title }}</strong>
      <p>{{ body }}</p>

      <form method="post" action="?/remove">
        <input type="hidden" name="id" value="{{ id }}">
        <button type="submit">Delete</button>
      </form>
    </li>
  {{/each}}
</ul>
`, "utf8")
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
