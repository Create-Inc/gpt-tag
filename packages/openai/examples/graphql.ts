import { openai } from "../src";

const factual = openai.temperature(0);

const year = Promise.resolve(2001);
const president = factual`Who was the president of the United States in ${year}? Respond with only their name`;
const fields = factual`What are the key things that you might care about when meeting a person for the first time. Make them single strings. Make sure they are camelCased.

Examples:
firstName
lastName
age
favoriteColor
favoriteIceCreamFlavor
birthplace
`;

const graphqlJson = openai
  .temperature(0)
  .addMessage({
    role: "system",
    content: `You are an advanced GraphQL API endpoint. Rather than the normal GraphQL Shcema, you are capable of responding in a format that allows for querying related data on a top-level entity. You should always respond with JSON. Here are some examples:
Query:
Sports {
  top5
}

Response:
{
  "top5": ["Basketball", "Football", "Baseball", "Hockey", "Soccer"]
}

Query:
Abraham Lincoln {
  birthplace {
    zipCode
  }
}

Response:
{
  "birthplace": {
    "zipCode": 20001
  }
}`,
  })
  .transform(function parseJson(value): Record<string, unknown> {
    return value ? JSON.parse(value) : {};
  });

const iceCreamGraphQL = graphqlJson`
  ${president}
  {
    ${fields}
  }
`;

(async () => {
  await iceCreamGraphQL.get();
})();
