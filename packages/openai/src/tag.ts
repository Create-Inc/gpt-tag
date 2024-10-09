import { OpenAI } from "openai";
import type {
  EvaluationFunction,
  GPTOptions,
  GPTString,
  GPTTagMetadata,
  GetOptions,
  MessageInput,
  ParseFunction,
  TagValue,
} from "./types.js";
import {
  getOpenAIMessageParamFromMessage,
  processArrayCallstack,
  processCallstack,
} from "./utils.js";
import { getMessageFromInput } from "./_unsafeUtils.js";
import { DEFAULT_MODEL } from "./constants.js";
import { ChatCompletionMessageParam } from "openai/resources/index";

let DEFAULT_OPENAI_INSTANCE: OpenAI;
const getDefaultOpenAIInstance = () => {
  if (DEFAULT_OPENAI_INSTANCE) {
    return DEFAULT_OPENAI_INSTANCE;
  }
  DEFAULT_OPENAI_INSTANCE = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  return DEFAULT_OPENAI_INSTANCE;
};

const makeGPTTag = <
  Options extends GPTOptions = {
    returns: string | null;
    stream: false;
    n: undefined;
    debug: false;
    variables: undefined;
    stop: undefined;
  },
>(
  metadata: GPTTagMetadata<Options> = {
    messages: [],
  },
): GPTString<Options> => {
  const addMessage = (message: MessageInput<Options>) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      messages: [
        ...(gpt.metadata.messages ?? []),
        getMessageFromInput(message),
      ],
    });
    return tag;
  };
  function gpt(
    strings?: TemplateStringsArray,
    ...values: TagValue[]
  ): GPTString<Options> {
    const child = makeGPTTag<Options>({
      ...gpt.metadata,
      messages: [
        ...(gpt.metadata.messages ?? []),
        {
          children: values,
          strings: [...(strings ?? [])],
          role: "user" as const,
        },
      ],
    });
    return child;
  }

  gpt._isGptString = true as const;
  gpt.strings = new Array<string>();
  gpt.children = new Array<TagValue>();
  gpt.arrCallStack = new Array<{ method: string; args: any[] }>();
  gpt.callStack = new Array<{ method: string; args: any[] }>();
  gpt.parse = metadata.parse;
  gpt.get = async function (
    this: GPTString<Options>,
    input: GetOptions<Options> | undefined,
  ) {
    if (this.cachedRun !== undefined) {
      return this.cachedRun;
    }
    this.cachedRun = new Promise(async (resolve, reject) => {
      try {
        const { n, evaluations = [], maxTokens, stop } = metadata;
        const instance = metadata.instance || getDefaultOpenAIInstance();

        const messages: ChatCompletionMessageParam[] = await Promise.all(
          metadata.messages.map(async (message) =>
            getOpenAIMessageParamFromMessage(message, input),
          ),
        );
        const args: OpenAI.ChatCompletionCreateParamsNonStreaming = {
          temperature: metadata.temperature,
          model: metadata.model ?? DEFAULT_MODEL,
          n: n ?? 1,
          messages,
          max_tokens: maxTokens,
          stop,
          response_format: metadata.responseFormat,
          stream_options: metadata.streamOptions
        };
        const stream = metadata.stream;
        if (!!stream) {
          const { data: openAIChatStream, response } = await instance.chat.completions.create({
            ...args,
            messages,
            stream: true,
          }).withResponse();
          if (evaluations.length) {
            const [originalStream, streamForEvals] = openAIChatStream.tee();
            originalStream.controller.signal.addEventListener("abort", (ev) => {
              streamForEvals.controller.abort(ev);
            });
            const { callStack, parse } = this;
            const utf8Decoder = new TextDecoder("utf-8");

            let aggregatedResponse = "";
            const transformStream = new WritableStream({
              async write(message) {
                const value = JSON.parse(utf8Decoder.decode(message)).choices[0]
                  .delta.content;
                if (value) {
                  aggregatedResponse += value;
                }
                return undefined;
              },
              async close() {
                const parsedValue = parse
                  ? await parse(aggregatedResponse)
                  : aggregatedResponse;
                const value = await processCallstack({
                  callStack,
                  // @ts-ignore
                  value: parsedValue,
                });

                Promise.allSettled(
                  evaluations.map(async (evaluation) => {
                    return Promise.resolve(
                      evaluation(value, aggregatedResponse),
                    );
                  }),
                ).catch(() => {
                  // no-op
                });
                return Promise.resolve(undefined);
              },
            });

            // @ts-ignore
            streamForEvals.toReadableStream().pipeTo(transformStream);
            return resolve({ data: originalStream, response });
          }
          return resolve({ data: openAIChatStream, response });
        }

        const choices = (
          await instance.chat.completions.create({ ...args })
        ).choices
          .slice(0, metadata.n ?? 1)
          .map(({ message }) => message.content);
        if (n === undefined) {
          const { parse } = this;
          const originalValue = choices[0] ?? null;
          const parsedValue = parse ? await parse(originalValue) : choices[0];
          const value = await processCallstack({
            callStack: this.callStack,
            // @ts-ignore
            value: parsedValue,
          });
          this.callStack = [];
          this.arrCallStack = [];
          this.parse = undefined;
          Promise.allSettled(
            evaluations.map(async (evaluation) => {
              return Promise.resolve(evaluation(value, originalValue));
            }),
          ).catch(() => {
            // no-op
          });

          // @ts-ignore
          return resolve(value);
        } else {
          const { parse } = this;
          const parsedValues = parse
            ? await Promise.all(choices.map((choice) => parse(choice)))
            : choices;
          const value = await processArrayCallstack({
            call: this.arrCallStack[0],
            callStack: this.callStack,
            // @ts-ignore
            values: parsedValues,
            parse,
          });
          const originalValue = choices[0] ?? null;
          Promise.allSettled(
            evaluations.map(async (evaluation) => {
              return Promise.resolve(evaluation(value, originalValue));
            }),
          ).catch(() => {
            // no-op
          });

          this.callStack = [];
          this.arrCallStack = [];
          this.parse = undefined;
          // @ts-ignore
          return resolve(value);
        }
      } catch (error) {
        reject(error);
      }
    });
    return this.cachedRun;
  };

  gpt.metadata = Object.assign({}, metadata || {});
  gpt.id = (id: string) => {
    const tag = makeGPTTag<Options>({ ...gpt.metadata, id });
    return tag;
  };
  gpt.temperature = (temperature: number) => {
    const tag = makeGPTTag<Options>({ ...gpt.metadata, temperature });
    return tag;
  };
  gpt.streamOptions = (streamOptions: OpenAI.Chat.ChatCompletionCreateParams['stream_options']) => {
    const tag = makeGPTTag<Options>({ ...gpt.metadata, streamOptions });
    return tag;
  };
  gpt.responseFormat = (responseFormat: OpenAI.Chat.ChatCompletionCreateParams['response_format']) => {
    const tag = makeGPTTag<Options>({ ...gpt.metadata, responseFormat });
    return tag;
  };
  gpt.model = (model: string) => {
    const tag = makeGPTTag<Options>({ ...gpt.metadata, model });
    return tag;
  };

  gpt.addMessage = addMessage;
  gpt.addMessages = (messages: MessageInput<Options>[]) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      messages: [
        ...(gpt.metadata.messages ?? []),
        ...messages.map((message) => getMessageFromInput(message)),
      ],
    });
    return tag;
  };

  gpt.n = <N extends number = number>(n: N) => {
    const tag = makeGPTTag<Omit<Options, "n"> & { n: N }>({
      ...gpt.metadata,
      n,
    });
    return tag;
  };

  gpt.transform = <UpdatedReturnValue>(
    fn: ParseFunction<Awaited<UpdatedReturnValue>>,
  ) => {
    const tag = makeGPTTag<
      Omit<Options, "returns"> & { returns: Awaited<UpdatedReturnValue> }
    >({
      ...gpt.metadata,
      parse: fn,
    });
    return tag;
  };

  gpt.stream = <S extends boolean = boolean>(stream: S) => {
    const tag = makeGPTTag<
      Omit<Options, "stream"> & {
        stream: S;
      }
    >({
      ...gpt.metadata,
      stream,
    });
    return tag;
  };

  gpt.stop = <S extends string | string[] | undefined>(stop: S) => {
    const tag = makeGPTTag<
      Omit<Options, "stop"> & {
        stop: S;
      }
    >({
      ...gpt.metadata,
      stop,
    });
    return tag;
  };

  gpt.debug = <D extends boolean = boolean>(debug: D) => {
    const tag = makeGPTTag<
      Omit<Options, "debug"> & {
        debug: D;
      }
    >({
      ...gpt.metadata,
      debug,
    });
    return tag;
  };

  gpt.addEvaluation = (evaluation: EvaluationFunction<unknown>) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      evaluations: [...(gpt.metadata.evaluations ?? []), evaluation],
    });
    return tag;
  };

  gpt.addEvaluations = (evaluations: EvaluationFunction<unknown>[]) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      evaluations: [...(gpt.metadata.evaluations ?? []), ...evaluations],
    });
    return tag;
  };
  gpt.instance = (instance: unknown) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      instance: instance as OpenAI,
    });
    return tag;
  };
  gpt.maxTokens = (maxTokens: number) => {
    const tag = makeGPTTag<Options>({
      ...gpt.metadata,
      maxTokens,
    });
    return tag;
  };

  const addMessageFromTag =
    (role: ChatCompletionMessageParam["role"]) =>
    (strings?: TemplateStringsArray, ...values: TagValue[]) => {
      const child = makeGPTTag<Options>({
        ...gpt.metadata,
        messages: [
          ...(gpt.metadata.messages ?? []),
          {
            children: values,
            strings: [...(strings ?? [])],
            role,
          },
        ],
      });
      return child;
    };

  gpt.system = addMessageFromTag("system");
  gpt.user = addMessageFromTag("user");
  gpt.assistant = addMessageFromTag("assistant");
  gpt.getMessages = () => {
    return gpt.metadata.messages ?? [];
  };

  const stringMethods = [
    "charAt",
    "concat",
    "replace",
    "slice",
    "substr",
    "substring",
    "toLowerCase",
    "toLocaleLowerCase",
    "toUpperCase",
    "toLocaleUpperCase",
    "trim",
    "substr",
    "valueOf",
  ] as const;
  const assignStringMethod = (method: (typeof stringMethods)[number]) => {
    return function (this: GPTString<Options>, ...args: any[]) {
      gpt.callStack.push({ method, args });
      return this;
    };
  };

  gpt.charAt = assignStringMethod("charAt");
  gpt.concat = assignStringMethod("concat");
  gpt.replace = assignStringMethod("replace");
  gpt.slice = assignStringMethod("slice");
  gpt.substr = assignStringMethod("substr");
  gpt.substring = assignStringMethod("substring");
  gpt.toLowerCase = assignStringMethod("toLowerCase");
  gpt.toLocaleLowerCase = assignStringMethod("toLocaleLowerCase");
  gpt.toUpperCase = assignStringMethod("toUpperCase");
  gpt.toLocaleUpperCase = assignStringMethod("toLocaleUpperCase");
  gpt.trim = assignStringMethod("trim");
  gpt.substr = assignStringMethod("substr");
  gpt.valueOf = assignStringMethod("valueOf");

  return gpt as any;
};

export const openai = makeGPTTag();
