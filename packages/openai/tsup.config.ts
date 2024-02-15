import type { Options } from "tsup";

export const tsup: Options = {
  clean: true,
  entry: ["./src/tag.ts"],
  dts: {
    entry: ["./src/tag.ts", "./src/types.ts"],
  },
  format: ["cjs", "esm"],
  sourcemap: false,
  splitting: false,
};
