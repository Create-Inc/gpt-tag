import { openai } from "../src/index.js";
const tag = openai.temperature(0);
const question =
  "What caused the chicken to cross the road? Explain it like I'm a PhD with as much detail as possible";
const stoppingResult = await tag.stop(".")`${question}`.get();
console.log("stoppingResult:", stoppingResult);
const result = await tag`${question}`.get();
console.log("result:", result);
