import { AsyncIterableOpenAIStreamReturnTypes } from "../src/types.js";

export const processStream = async (
  result: AsyncIterableOpenAIStreamReturnTypes
) => {
  let fullResponse = "";
  for await (const chunk of result) {
    if (
      "choices" in chunk &&
      chunk.choices &&
      chunk.choices[0] &&
      "delta" in chunk.choices[0]
    ) {
      fullResponse += chunk.choices[0].delta.content;
    }
  }
  return fullResponse;
};
