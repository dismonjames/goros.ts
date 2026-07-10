import { db } from "./client"
import { notes } from "./schema"

await db.insert(notes).values([
  {
    title: "First note",
    body: "Created by Boronix.",
    createdAt: new Date()
  }
])
