import { openai } from "../src";
import { Project, ScriptTarget } from "ts-morph";

import search from "libnpmsearch";
import { JsxEmit } from "typescript";

const prompt = `Add a contact form to integrate with google sheets `;

const factual = openai.temperature(0).model("gpt-4-0125-preview").debug(false);

const integrationDetection = factual
  .addMessage({
    role: "system",
    content:
      "You are an expert system designed to detect integrations with third party services. In a given messsage, you must return a comma separated list of all the integrations that are mentioned.",
  })
  .transform((results) => {
    return Promise.all(
      (results?.split(",") ?? []).map(async (result) => {
        const packageName = (
          await search(result, {
            sortBy: "popularity",
          })
        )[0].name;
        console.log("packageName:", packageName);
        return packageName;
      })
    );
  });

const hookup = factual
  .addMessage({
    role: "system",
    content:
      "Given this JSX and this library and the user prompt, rewrite the react component to integrate this library with the code. Make sure you only return the code and nothing else. No explanations.",
  })
  .transform((res) => {
    return res?.replace(/```jsx/g, "").replace(/```/g, "");
  });
const jsx = `<div></div>`;

const errorCorrection = factual
  .addMessage({
    role: "system",
    content: `You are an expert system designed to correct errors in code. In a given message, you must return the corrected code and nothing else.`,
  })
  .transform(async (resultsArg): Promise<string> => {
    if (!resultsArg) {
      return "";
    }
    const results = resultsArg.replace(/```jsx/g, "").replace(/```/g, "");
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        jsx: JsxEmit.React,
        allowJs: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
    project.createSourceFile("integrations.ts", results);
    const errors = project.getPreEmitDiagnostics();
    if (errors.length) {
      return errorCorrection`Orignal code:${results}\nErrors:${project.formatDiagnosticsWithColorAndContext(
        [errors[0]]
      )}`.get();
    }
    return results;
  });

const apiKeyRequirements = factual.addMessage({
  role: "system",
  content:
    "you read code and find any instances of api keys or other things the user needs to input in order for the code to work",
});

(async () => {
  const integrations = integrationDetection`${prompt}`;
  let finalCode =
    await hookup`User prompt: ${prompt}\nJSX:${jsx}\nLibrary:${integrations}`.get();
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: JsxEmit.React,
      allowJs: true,
      target: ScriptTarget.ES2022,
    },
    skipAddingFilesFromTsConfig: true,
  });
  if (!finalCode) {
    return;
  }
  project.createSourceFile("integrations.ts", finalCode);
  const errors = project.getPreEmitDiagnostics();
  if (errors.length) {
    finalCode =
      await errorCorrection`Orignal code:${finalCode}\nErrors:${project.formatDiagnosticsWithColorAndContext(
        [errors[0]]
      )}`.get();
  }

  console.log("finalCode:", finalCode);
})();
