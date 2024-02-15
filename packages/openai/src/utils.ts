import util from "node:util";
import {
  GPTOptions,
  Message,
  MessageInput,
  ParseFunction,
  TagValue,
} from "./types.js";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";

export function zip<T>(...arrays: T[][]): T[][] {
  // Find the length of the longest array
  const maxLength = Math.max(...arrays.map((arr) => arr.length));

  // Create a new array to hold the zipped values
  const zipped: T[][] = [];

  // Loop through each index up to the smallest array length
  for (let i = 0; i < maxLength; i++) {
    // At each index, grab the ith element from each array and make a new array from those
    const zippedElement: T[] = arrays.map((arr) => arr[i]!);
    zipped.push(zippedElement);
  }

  return zipped;
}

export const getValueFromTagChild = async (
  child: TagValue
): Promise<string> => {
  try {
    if (util.types.isPromise(child)) {
      return getValueFromTagChild(await child);
    }
    // @TODO: when the child is an object, we should probably stringify it
    if (typeof child === "object" && child) {
      return `${child}`;
    } else if (typeof child === "function") {
      if ("_isGptString" in child) {
        return `${await child.get()}`;
      }
      return `${await getValueFromTagChild(child())}`;
    } else {
      return `${await Promise.resolve(child)}`;
    }
  } catch (e) {
    return `${e}`;
  }
};

export const getOpenAIMessageParamFromMessage = async (
  message: Message
): Promise<ChatCompletionMessageParam> => {
  if ("children" in message) {
    const processedChildren = await Promise.all(
      message.children.map((item) => getValueFromTagChild(item))
    );

    const content = zip(message.strings, processedChildren).flat().join("");
    const { children, strings, ...rest } = message;
    // @ts-expect-error
    return {
      ...rest,
      content,
    };
  }
  return message;
};

export const processCallstack = async ({
  callStack,
  value,
}: {
  callStack: { method: string; args: any[] }[];
  value: string | null;
}) => {
  return callStack.reduce(async (p, call) => {
    const prev = await p;
    if (typeof prev !== "string") {
      return prev;
    }
    // @ts-expect-error
    return prev[call.method](...call.args);
  }, Promise.resolve(value));
};

export const processArrayCallstack = async ({
  call,
  values,
  parse,
}: {
  call?: { method: string; args: any[] };
  callStack: { method: string; args: any[] }[];
  values: (string | null)[];
  parse?: ParseFunction;
}) => {
  if (!call?.method) {
    return values.map((value) => (parse ? parse(value) : value));
  }
  throw new Error(`Cannot call "${call?.method}" on GPTStringArray`);
};

export const getMessageFromInput = <Options extends GPTOptions>(
  message: MessageInput<Options>
): Message => {
  if (typeof message === "string") {
    return {
      role: "user" as const,
      strings: [message],
      children: [],
    };
  }
  if ("_isGptString" in message) {
    return {
      role: "user" as const,
      strings: [],
      children: [message],
    };
  }
  if (
    typeof message.content === "function" &&
    "_isGptString" in message.content
  ) {
    const { content, ...rest } = message;
    return {
      ...rest,
      strings: [],
      children: [message.content],
    };
  }
  if (typeof message.content === "string") {
    return {
      ...message,
      strings: [message.content],
      children: [],
    };
  }
  if (Array.isArray(message.content)) {
    return message as Message;
  }
  const { content, ...rest } = message;
  return {
    children: [],
    strings: [],
    ...rest,
  };
};
