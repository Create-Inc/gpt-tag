export interface Var<T extends string = string> {
  _isGptVariable: true;
  name: T;
}

export const variable = <T extends string>(name: T): Var<T> => {
  return {
    _isGptVariable: true,
    name,
  };
};
