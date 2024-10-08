import { GPTOptions, Message, MessageInput } from "./types.js";

export const getMessageFromInput = <Options extends GPTOptions>(
  message: MessageInput<Options>,
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
