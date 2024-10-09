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
    return {
      withResponse:() => ({
        data: getTestStreamFromResponse(`\n  \n${input.replace(/^/gm, "  # ")}\n`) as unknown as Stream<ChatCompletionChunk>

      })
    }
  }
  return {
    withResponse: () => ({
      data: openAICompletionFactory({
        content: `\n  \n${input.replace(/^/gm, "  # ")}\n`,
      })
    })
  }
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
    mockOpenAI.chat.completions.create.mockReturnValue(
      {
        //@ts-expect-error
        withResponse: jest.fn().mockResolvedValue({ data: openAICompletionFactory({ content: "Hello, how are you?" })})
      }
    );
    const base = openai.instance(mockOpenAI);
    const { data: result } = await base`hi`.get();
    expect(result).toMatchInlineSnapshot(`"Hello, how are you?"`);
  });

  it("should get contents from streaming OpenAI", async () => {
    const stream = getTestStreamFromResponse("Hello, how are you?", {
      delayMs: 2,
    });

    mockOpenAI.chat.completions.create.mockReturnValue(
      {
        //@ts-expect-error
        withResponse: jest.fn().mockResolvedValue({ data: stream})
      }
    );

    const base = openai.instance(mockOpenAI).stream(true);
    const { data: result } = await base`hi`.get();
    const response = await processStream(result);
    expect(response).toMatchInlineSnapshot(`"Hello, how are you?"`);
  });

  it("should evaluate on a streaming response", async () => {
    const evaluation: jest.Mocked<EvaluationFunction> = jest.fn();

    const stream = getTestStreamFromResponse("Hello, how are you?", {
      delayMs: 2,
    });

    mockOpenAI.chat.completions.create.mockReturnValue(
      {
        //@ts-expect-error
        withResponse: jest.fn().mockResolvedValue({ data: stream})
      }
    );

    const base = openai
      .instance(mockOpenAI)
      .stream(true)
      .addEvaluation(evaluation);
    const {data: result } = await base`hi`.get();
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
    const message = base.system`You only speak in ${variable("language")}`
      .user`explain ${variable("topic")} like i'm ${variable("age")} in ${variable("language")} in the tone of ${variable("tone")} with a length of ${variable("length")}`;
    const topicFn = jest.fn(() => "computer sceince");
    const lengthFn = Promise.resolve(`500 words`);
    expect(
      await processStream(
        (await message.get({
          variables: {
            language,
            topic: topicFn,
            age: 5,
            length: lengthFn,
            // NOTE: age is used in this nested _variable_, and it still
            // resolves properly, though if you reference a variable that is
            // not defined, it will throw an error
            tone: base.user`Which tone should I use when talking to a ${variable("age")} year old? Respond with only a single word`,
          },
        })).data,
      ),
    ).toMatchInlineSnapshot(`
"
  
  # role: system
  # content: You only speak in spanish
  # 
  # role: user
  # content: explain computer sceince like i'm 5 in spanish in the tone of 
  #   
  #   # role: user
  #   # content: Which tone should I use when talking to a 5 year old? Respond with only a single word
  #  with a length of 500 words
"
`);
    expect(topicFn).toHaveBeenCalledTimes(1);
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
        },
      }),
    ).rejects.toMatchInlineSnapshot(
      `[Error: "topic" variable was not specified]`,
    );
  });
});
