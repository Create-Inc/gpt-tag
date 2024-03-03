import type { Config } from "jest";

const config: Config = {
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ["./src/**/*.ts", "./test/**/*.ts"],
  displayName: "GPT Tag - OpenAI",
  extensionsToTreatAsEsm: [".ts"],
  id: "gpt-string-tag-openai",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  prettierPath: null,
  transform: {
    "^.+\\.(t|j)s?$": [
      "@swc/jest",
      {
        module: {
          type: "es6",
        },
      },
    ],
  },
};

export default config;
