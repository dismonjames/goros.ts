import { api, json } from "kumquat"
import { exercises } from "../../server/exercises"

export const GET = api(async () => {
  return json({ exercises })
})
