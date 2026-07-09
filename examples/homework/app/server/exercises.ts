export const exercises = [
  {
    id: "1",
    title: "Read the prompt",
    description: "Identify required fields and route behavior."
  },
  {
    id: "2",
    title: "Submit the answer",
    description: "Use local actions and fail state to improve the form."
  }
]

export function findExercise(id: string) {
  return exercises.find((exercise) => exercise.id === id)
}
