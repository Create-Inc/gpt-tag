import { openai } from "../../src";
import { planner } from "./planner";

const summarizer = openai.addMessage({
  role: "system",
  content:
    "You are a summarizer part of a larger system. Given an original goal, and a set of things that are done, rewrite a new goal that represents what is left to be done to accomplish the original goal.",
});
const agent = async (input: string) => {
  const completedTasks: string[] = [];
  const getTasks = async () => {
    const completed = completedTasks.length
      ? `\nPreviously completed tasks:\n${completedTasks
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

    const updatedInput = summarizer`Original goal:\n${input} ${completed}New goal:`;
    return await planner`You are a planner. Given a goal come up with a list of tasks that are required to fully complete the task. Do not repeat tasks.Goal:\n${updatedInput}\n${completed}\nTasks:`.get();
  };

  let tasks = await getTasks();
  while (tasks?.length > 0 && completedTasks.length <= 10) {
    const task = tasks.shift();
    if (task) {
      completedTasks.push(task);
    }
    tasks = await getTasks();
  }
};

(async () => {
  await agent('Build a link-in-bio page for "John Doe"');
})();
