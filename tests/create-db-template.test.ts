import { expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const scriptPath = path.resolve("packages/create-boronix/src/index.ts")

function scaffold(name: string, db: string, runtime = "bun") {
  const tempDir = path.join(os.tmpdir(), `boronix-db-template-${name}-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")
  const result = Bun.spawnSync({
    cmd: ["bun", scriptPath, appPath, "--template", "basic", "--runtime", runtime, "--db", db, "--no-install", "--no-git"],
    stderr: "pipe",
    stdout: "pipe"
  })
  return { tempDir, appPath, result }
}

test("create-boronix --db none does not create app/db", () => {
  const { tempDir, appPath, result } = scaffold("none", "none")

  try {
    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(appPath, "app/db"))).toBe(false)
    expect(existsSync(path.join(appPath, "drizzle.config.ts"))).toBe(false)
    const pkg = JSON.parse(readFileSync(path.join(appPath, "package.json"), "utf8"))
    expect(pkg.scripts["db:push"]).toBeUndefined()
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("create-boronix --db sqlite creates Drizzle SQLite files and scripts", () => {
  const { tempDir, appPath, result } = scaffold("sqlite", "sqlite")

  try {
    expect(result.exitCode).toBe(0)
    expect(existsSync(path.join(appPath, "app/db/schema.ts"))).toBe(true)
    expect(existsSync(path.join(appPath, "app/db/client.ts"))).toBe(true)
    expect(existsSync(path.join(appPath, "app/db/seed.ts"))).toBe(true)
    expect(existsSync(path.join(appPath, "drizzle.config.ts"))).toBe(true)
    expect(readFileSync(path.join(appPath, ".env.example"), "utf8")).toContain("DATABASE_URL=./local.db")

    const pkg = JSON.parse(readFileSync(path.join(appPath, "package.json"), "utf8"))
    expect(pkg.dependencies.boronix).toBe("^0.6.0")
    expect(pkg.dependencies["drizzle-orm"]).toBe("latest")
    expect(pkg.devDependencies["drizzle-kit"]).toBe("latest")
    expect(pkg.devDependencies["@types/bun"]).toBe("latest")
    expect(pkg.scripts["db:push"]).toBe("boronix db push")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("create-boronix --db postgres creates Drizzle Postgres files and scripts", () => {
  const { tempDir, appPath, result } = scaffold("postgres", "postgres", "node")

  try {
    expect(result.exitCode).toBe(0)
    expect(readFileSync(path.join(appPath, "app/db/schema.ts"), "utf8")).toContain("pgTable")
    expect(readFileSync(path.join(appPath, "app/db/client.ts"), "utf8")).toContain("postgres")
    expect(readFileSync(path.join(appPath, "drizzle.config.ts"), "utf8")).toContain('dialect: "postgresql"')
    expect(readFileSync(path.join(appPath, ".env.example"), "utf8")).toContain("postgres://user:password@localhost:5432/boronix")

    const pkg = JSON.parse(readFileSync(path.join(appPath, "package.json"), "utf8"))
    expect(pkg.dependencies["drizzle-orm"]).toBe("latest")
    expect(pkg.dependencies.postgres).toBe("latest")
    expect(pkg.devDependencies["drizzle-kit"]).toBe("latest")
    expect(pkg.scripts["db:seed"]).toBe("boronix db seed")
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("create-boronix rejects invalid --db", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-template-invalid-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", scriptPath, appPath, "--db", "mysql", "--no-install", "--no-git"],
      stderr: "pipe",
      stdout: "pipe"
    })
    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode).toBe(1)
    expect(stderr).toContain("KQ_CREATE_INVALID_DB")
    expect(stderr).toContain('Unsupported database option "mysql".')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test("create-boronix rejects sqlite with node runtime", () => {
  const tempDir = path.join(os.tmpdir(), `boronix-db-template-sqlite-node-${Date.now()}`)
  const appPath = path.join(tempDir, "my-app")

  try {
    const result = Bun.spawnSync({
      cmd: ["bun", scriptPath, appPath, "--template", "basic", "--runtime", "node", "--db", "sqlite", "--no-install", "--no-git"],
      stderr: "pipe",
      stdout: "pipe"
    })
    const stderr = new TextDecoder().decode(result.stderr)
    expect(result.exitCode).toBe(1)
    expect(stderr).toContain("KQ_CREATE_DB_RUNTIME_UNSUPPORTED")
    expect(stderr).toContain('--db sqlite requires runtime "bun"')
    expect(existsSync(appPath)).toBe(false)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
