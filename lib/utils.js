export function extractTitle(doc) {
  return doc.content.firstChild.textContent;
}

export function stepsAreOnlyHighlights(steps) {
  const highlightSteps = steps.filter((step) => {
    return (step.jsonID === 'addMark' || step.jsonID === 'removeMark') && step.mark && step.mark.type.name === 'highlight';
  });
  return highlightSteps.length === steps.length;
}
