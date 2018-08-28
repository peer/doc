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

export function stepsAreOnlyHighlights(steps) {
  const highlightSteps = steps.filter((step) => {
    return (step.jsonID === 'addMark' || step.jsonID === 'removeMark') && step.mark && step.mark.type.name === 'highlight';
  });
  return highlightSteps.length === steps.length;
}
