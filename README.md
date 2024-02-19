# gpt-tag

`gpt-tag` is a library for building applications that rely on LLMs. It's designed to be easily composable within your existing application.

Use one of the specific LLM based packages to get started, such as [`@gpt-tag/openai`](./packages/openai/README.md)

## Installation

Install `@gpt-tag/openai` and make sure you have installed `openai` as well.

```bash
npm install @gpt-tag/openai openai
```

or

```bash
yarn add @gpt-tag/openai openai
```

## Basic Usage

`gpt-tag` libraries use a fluent interface to help provide maximum composability. Simply import `openai` from `@gpt-tag/openai` to start composing.

```typescript
import { openai } from "@gpt-tag/openai";

const factual = openai.temperature(0);

const president = factual`Who was president of the United States in 1997`;

const result = await president.get();
// Bill Clinton
```

## Composition Usage

You can embed the result of one tag inside of another tag to create powerful compositions, and no LLM requests will be
made until you attempt to call `.get()` on a tag. At that time, it will resolve the necessary calls sequentially to
provide a final answer.

```typescript
import { openai } from "@gpt-tag/openai";

const factual = openai.temperature(0);
const opinion = openai.temperature(1);

const president = factual`Who was president of the United States in 1997? Respond with only their name`;
const height = factual`What is ${president}'s height? Respond with only the height. Format: D'D"`;
const iceCream = opinion`Which flavor of ice cream would be preferred by ${president}? Choose only one. Guess if you don't know. Format: <flavor>`;

const [heightAnswer, iceCreamAnswer] = await Promise.all([
  height.get(),
  iceCream.get(),
]);
// [ 6'2" , mango ]
```

See [examples](./packages/openai) for more samples of how you can compose tags together.

## Methods

Most methods return GPTTag itself for fluently chaining.

### Get

Return a promise that will resolve any llm calls used to compose this tag

```
await openai.get()
```

### Temperature

Use temperature to control randomness

```
openai.temperature(0.5)
```

### Model

Override the model used

```
openai.model('gpt-4')
```

### Stream

Use a streaming response

```
openai.stream(true);
```

### Transform

Transform the results of a call before returning them

```
openai.transform((result) => result.trim());
```
