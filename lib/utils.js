export function method(validatedMethod) {
  function f(...args) {
    return validatedMethod(validatedMethod, ...args);
  }

  f.validatedMethod = validatedMethod;

  return f;
}
