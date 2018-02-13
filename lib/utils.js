export function method(validatedMethod) {
  function f(...args) {
    return validatedMethod.call(...args);
  }

  f.validatedMethod = validatedMethod;

  return f;
}
