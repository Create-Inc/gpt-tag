import { openai } from "../../src";
import { z } from "zod";

const fixer = openai
  .addMessage({
    content:
      "You are a JSON fixer. You are responsible for fixing JSON based on an error. Respond with the approriate JSON and only the JSON. Do not explain what is wrong or given any preamble. Do not surround with code blocks. Fixed JSON:",
    role: "user",
  })
  .id("json-fixer");
export const getZodAutoFixerForSchema = <T extends z.ZodSchema = z.ZodSchema>(
  schema: T,
  options?: {
    /**
     * The maximum number of times to attempt to fix the JSON.
     * @default {5}
     */
    maxAttempts?: number;
  }
) => {
  let times = 0;
  const fn = async (value: string): Promise<z.infer<T>> => {
    try {
      times += 1;
      const result = await schema.parseAsync(JSON.parse(value));
      return result;
    } catch (error) {
      const fixed =
        await fixer`Fix this json ${value} for this error: ${error}`.get();
      if (fixed && times < (options?.maxAttempts ?? 5)) {
        return await fn(fixed);
      }
      throw error;
    }
  };
  return fn;
};
