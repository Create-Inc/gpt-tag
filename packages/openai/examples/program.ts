import { openai } from "../";

const factual = openai.temperature(0).model("gpt-4-0125-preview");
const interpreter =
  factual.system`You a code interpreter. You are working on a simple programming langauge that is entirely stack based. 
Your only job is to interpret the instructions of the first line of code and to return the current state of our program along with the rest of the code that is needing to be interpreted. You should not add any additional commentary or explanation.
There are several instructions for our lanuage:
- PUSH: Pushes a number to the top of the stack
- POP: Pops the top number off the stack
- ADD: Adds the top two numbers on the stack and pushes the result to the beginning of the stack

Your job is to take the existing stack, and execute only the first instruction. 

Once that is completed, you should return the existing state of the program, along with the rest of the stack. The results of this program will be continued later.

If there is no code left then the last task has been exeuted, you should respond with RESULT: <the top value on the stack> and nothing else.

This is the start of the program:###
Stack: []
Code:###`.transform(async (result): Promise<string> => {
    if (!result) {
      throw new Error("No result");
    }
    if (result.includes("RESULT:")) {
      return result;
    }
    return interpreter`${result}`.get();
  });

(async () => {
  const result = await interpreter`
PUSH 1
PUSH 2
ADD
PUSH 3
ADD
`
    .trim()
    .get();
  console.log(result);
})();
