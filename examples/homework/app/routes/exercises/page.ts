import { page } from "kumquat"
import { exercises } from "../../server/exercises"

export default page(async () => {
  return {
    title: "Exercises",
    exercises
  }
})
