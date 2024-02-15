import { openai } from "..";

const factual = openai.temperature(0);

const pres = factual`Who was president this year?`;

const c = factual.asFn(
  (self, { theme, asdf }) =>
    self.system`this is a system messages ${asdf}``The following is a conversation with an AI assistant. ${theme} The assistant is helpful, creative, clever, and very friendly.`
);

c({ theme: pres }).get();
