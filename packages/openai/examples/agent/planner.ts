import { openai } from "../../src";
import { z } from "zod";
import { getZodAutoFixerForSchema } from "./json-fixer";

const schema = z.object({ tasks: z.array(z.string()) }).default({ tasks: [] });

const autofix = getZodAutoFixerForSchema(schema);

export const planner = openai
  .addMessage({
    content:
      'You should always respond with JSON, and only JSON with the following schema: { "tasks": ["task1", "task2", "task3"] }. Do not annotate with code tags. Do not add any preamble or explanation. If you are done, respond with an empty array e.g. { "tasks": [] }',
    role: "system",
  })
  .addMessage({
    role: "system",
    content:
      "You are a planner. Given a task, come up with a list of tasks that are required to fully complete the task. Do not repeat tasks.",
  })
  .id("planner")
  .transform(async (value) => {
    if (!value) {
      return [];
    }
    try {
      const { tasks } = await schema.parseAsync(JSON.parse(value));
      return tasks;
    } catch {
      const fixedTasks = await autofix(value);
      return fixedTasks.tasks;
    }
  });
