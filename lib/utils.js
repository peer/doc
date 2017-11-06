export function method(validatedMethod) {
  function f(/*...*/) {
    return validatedMethod.call.apply(validatedMethod, arguments);
  }

  f.validatedMethod = validatedMethod;

  return f;
}
