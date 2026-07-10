import { eq } from "drizzle-orm"
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
