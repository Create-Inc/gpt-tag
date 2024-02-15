import { openai } from "..";

const base = openai.debug(true);

const gpt4 = base.model("gpt-4-0125-preview");
const factual = base.temperature(0);
const opinion = base.temperature(1);

const president = factual`Who was the president of the United States in 1981? Respond with only their name`;
const height = base`What is ${president}'s height? Respond with only the height. Format: D'D"`;

const years = base`What years did ${president} serve? Format: YYYY-YYYY. Response:`;

// testing normal variables
const sport = "basketball";

const basketballPlayers = base`Which ${sport} players played during ${years} and are taller than ${height}?`;

const iceCream = opinion`Which flavor of ice cream would be preferred by ${president}? Choose only one. Guess if you don't know. Format: <flavor>`;

const other = base`What is the capital of kazakhstan?`;
const random10 = base
  .temperature(1)
  .n(10)
  .addMessage({
    role: "system",
    content:
      "You should respond with just the thing being requested. Do not add any preamble or explanation.",
  })
  .transform((v) => v || "banana");
const fruits = random10`You are one of 10 different AI models being requested to "Name a fruit". Name a fruit that is unlikely to be named by a peer model`;

const fakeFruitDetector = gpt4
  .addMessage({
    role: "system",
    content:
      "You are a fake fruit counter. When given a list of fake fruits, you must respond with the number of FAKE fruits in the list. If none of the fruits are, respond with 0",
  })
  .transform((v) => {
    const i = parseInt(v || "0", 10);
    if (isNaN(i)) return 0;
    return i;
  });

const fakeFruits = fakeFruitDetector`Fruits:\n${fruits}`;

(async () => {
  await fakeFruits.get();
  // await other.get();
  // await iceCream.get();
  // await basketballPlayers.get();
})();
