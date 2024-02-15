import { z } from "zod";
import { openai } from "../";

const base = openai.debug(true);

const factual = base.temperature(0);
const author = Promise.resolve("Stephen King");

const getenum = <
  EnumValues extends readonly [string, ...string[]] = readonly [
    string,
    ...string[]
  ]
>(
  e: EnumValues
) =>
  base
    .temperature(0)
    .addMessage({
      content: `You are an advanced enum logic AI. You should respond with one of the following: ${e
        .map((v) => `"${v}"`)
        .join(
          ","
        )}. You should never respond with any additional reasoning or logic and you must choose between one of the options.`,
      role: "system",
    })
    .transform((s) => {
      const result = z.enum(e).parse(s);
      return result;
    });

const politicalSpectrum = getenum(["liberal", "conservative"] as const);

const poem = base
  .temperature(1)
  .addMessage({
    content: `You are ${author}. You should respond with a sonnet.`,
    role: "system",
  })
  .stream(true);
const opinion1 = politicalSpectrum`The political opinion of ${author} is mostly unknown for present time. Which best represents his politics?`;

const poemType = opinion1; //opinion1.is("liberal", "haiku", "sonnet");

const liberalPresident = factual`Who was the most recent liberal president of the United States? Respond with only their name`;
// const conversativePresident = factual`Who was the most recent conservative president of the United States? Respond with only their name`;
const president = liberalPresident;
// opinion1.is(
//   "liberal",
//   liberalPresident,
//   conversativePresident
// )
const p = poem`Write a ${poemType} about ${president}.`;
(async () => {
  await p.get();
})();
