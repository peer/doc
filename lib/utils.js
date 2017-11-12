export function method(validatedMethod) {
  function f(...args) {
    return validatedMethod.call.apply(validatedMethod, args);
  }

  f.validatedMethod = validatedMethod;

  return f;
}
