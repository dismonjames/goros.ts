import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL ?? "./local.db"
const sqlite = new Database(databaseUrl)

export const db = drizzle(sqlite, { schema })
