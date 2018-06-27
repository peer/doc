export function method(validatedMethod) {
  function f(...args) {
    return validatedMethod.call(...args);
  }

  f.validatedMethod = validatedMethod;

  return f;
}

export function extractTitle(doc) {
  return doc.content.firstChild.textContent;
}
