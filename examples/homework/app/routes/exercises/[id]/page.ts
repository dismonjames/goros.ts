import { notFound, page } from "kumquat"
import { findExercise } from "../../../server/exercises"

export default page(async ({ params }) => {
  const exercise = findExercise(params.id ?? "")

  if (!exercise) {
    return notFound({ message: "Exercise not found" })
  }

  return {
    title: exercise.title,
    description: exercise.description
  }
})
