import { desc } from "drizzle-orm"
import { page } from "boronix"
import { db } from "../../db/client"
import { notes } from "../../db/schema"

export default page(async () => {
  const items = await db.select().from(notes).orderBy(desc(notes.id))

  return { title: "Notes", notes: items }
})
