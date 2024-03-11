import type { Options } from "tsup";

export const tsup: Options = {
  clean: true,
  entry: ["./src/index.ts"],
  dts: {
    entry: ["./src/index.ts", "./src/types.ts"],
  },
  format: ["cjs", "esm"],
  sourcemap: false,
  splitting: false,
};
