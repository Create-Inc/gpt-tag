import { describe, expect, it, jest } from "@jest/globals";
import { openai } from "../tag.js";
import { getTestStreamFromResponse } from "../../test/get-test-stream.js";
import { processStream } from "../../test/process-stream.js";
import { EvaluationFunction } from "../types.js";
import {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions.mjs";
import { Stream } from "openai/streaming.mjs";
import { variable } from "../variable.js";

jest.unstable_mockModule("openai", () => {
  const OpenAI = jest.fn().mockReturnValue({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  });
  return {
    OpenAI,
  };
});

function openAICompletionFactory({ content }: { content: string }) {
  return {
    id: "fake-id",
    created: 1633288680,
    model: "fake_model",
    object: "chat.completion" as const,
    choices: [
      {
        message: { content, role: "assistant" as const },
        index: 0,
        logprobs: null,
        finish_reason: "stop" as const,
      },
    ],
  };
}

/**
 * Echos the input as output
 */
function getMockAsEchoForChat({
  messages,
  stream,
}: {
  messages: ChatCompletionMessageParam[];
  stream: boolean;
}) {
  const input = messages
    .map(({ content, role }) => {
      return `role: ${role}
content: ${content}`;
    })
    .join("\n\n");
  if (stream) {
    return getTestStreamFromResponse(input, {
      delayMs: 2,
    }) as unknown as Stream<ChatCompletionChunk>;
  }
  return openAICompletionFactory({ content: input });
}

const mockOpenAI = jest.mocked(
  new (await import("openai")).OpenAI({ apiKey: "test" }),
);

describe("smoke tests", () => {
  it("simple messages are added via template tag", async () => {
    expect(openai`hi`.getMessages()).toMatchInlineSnapshot(`
      [
        {
          "children": [],
          "role": "user",
          "strings": [
            "hi",
          ],
        },
      ]
    `);
  });

  it("simple messages are added via function", async () => {
    expect(openai.addMessage({ content: "hello", role: "user" }).getMessages())
      .toMatchInlineSnapshot(`
      [
        {
          "children": [],
          "content": "hello",
          "role": "user",
          "strings": [
            "hello",
          ],
        },
      ]
    `);
  });

  it("should get contents from mock OpenAI", async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue(
      openAICompletionFactory({ content: "Hello, how are you?" }),
    );
    const base = openai.instance(mockOpenAI);
    const result = await base`hi`.get();
    expect(result).toMatchInlineSnapshot(`"Hello, how are you?"`);
  });

  it("should get contents from streaming OpenAI", async () => {
    const stream = getTestStreamFromResponse("Hello, how are you?", {
      delayMs: 2,
    });

    mockOpenAI.chat.completions.create.mockResolvedValue(
      stream as unknown as Stream<ChatCompletionChunk>,
    );

    const base = openai.instance(mockOpenAI).stream(true);
    const result = await base`hi`.get();
    const response = await processStream(result);
    expect(response).toMatchInlineSnapshot(`"Hello, how are you?"`);
  });

  it("should evaluate on a streaming response", async () => {
    const evaluation: jest.Mocked<EvaluationFunction> = jest.fn();

    const stream = getTestStreamFromResponse("Hello, how are you?", {
      delayMs: 2,
    });

    mockOpenAI.chat.completions.create.mockResolvedValue(
      stream as unknown as Stream<ChatCompletionChunk>,
    );

    const base = openai
      .instance(mockOpenAI)
      .stream(true)
      .addEvaluation(evaluation);
    const result = await base`hi`.get();
    const response = await processStream(result);
    expect(response).toMatchInlineSnapshot(`"Hello, how are you?"`);
    await new Promise(process.nextTick);
    expect(evaluation).toHaveBeenCalledTimes(1);
  });
  it("should require variables when specified", async () => {
    mockOpenAI.chat.completions.create.mockImplementation(
      // @ts-expect-error
      getMockAsEchoForChat,
    );

    const base = openai.instance(mockOpenAI).stream(true);
    const language = "spanish";
    const message = base.user`explain ${variable("topic")} like i'm ${variable("age")} in ${language}`;
    expect(
      await processStream(
        await message.get({
          variables: {
            topic: "computer sceince",
            age: 5,
          },
        }),
      ),
    ).toMatchInlineSnapshot(`
"role: user
content: explain computer sceince like i'm 5 in spanish"
`);
  });
  it("should throw errors when variables are not specified", async () => {
    mockOpenAI.chat.completions.create.mockImplementation(
      // @ts-expect-error
      getMockAsEchoForChat,
    );

    const base = openai.instance(mockOpenAI).stream(true);
    const language = "spanish";
    const message = base.user`explain ${variable("topic")} like i'm ${variable("age")} in ${language}`;
    await expect(
  message.get({
    // @ts-expect-error
    variables: {


      // missing variables
    } })).rejects.toMatchInlineSnapshot(`[Error: "topic" variable was not specified]`);
  });
});
