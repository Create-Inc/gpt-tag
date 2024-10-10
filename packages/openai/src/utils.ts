import util from "node:util";
import {
  GPTOptions,
  GPTString,
  GetOptions,
  Message,
  MessageInput,
  ParseFunction,
  TagValue,
  Var,
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

const isGPTString = <Options extends GPTOptions>(
  value: any,
): value is GPTString<Options> => {
  return typeof value === "function" && "_isGptString" in value;
};
const isGPTVariable = (value: any): value is { _isGptVariable: true } => {
  return "_isGptVariable" in value;
};

export const getValueFromTagChild = async <Options extends GPTOptions>(
  child: TagValue | Var,
  input?: GetOptions<Options>,
): Promise<string> => {
  if (util.types.isPromise(child)) {
    return getValueFromTagChild(await child, input);
  }
  if (typeof child === "object" && child) {
    if (isGPTVariable(child)) {
      const { name } = child;
      if (!input || !(name in input.variables)) {
        throw new Error(`"${name}" variable was not specified`);
      }
      const value = await getValueFromTagChild(
        // @ts-expect-error
        input.variables[name] as TagValue,
        input,
      );
      return value;
    }
    return `${child}`;
  } else if (typeof child === "function") {
    if (isGPTString<Options>(child)) {
      return `${(await child.stream(false).get(input as GetOptions<Options>))}`;
    }
    return `${await getValueFromTagChild(child())}`;
  } else {
    return `${await Promise.resolve(child)}`;
  }
};

export const getOpenAIMessageParamFromMessage = async <
  Options extends GPTOptions,
>(
  message: Message,
  input?: GetOptions<Options>,
): Promise<ChatCompletionMessageParam> => {
  if ("children" in message) {
    const processedChildren = await Promise.all(
      message.children.map((item) => getValueFromTagChild(item, input)),
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
