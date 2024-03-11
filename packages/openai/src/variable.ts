import { Var } from "./types.js";

export const variable = <T extends string>(name: T): Var<T> => {
  return {
    _isGptVariable: true,
    name,
  };
};
