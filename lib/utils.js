export function extractTitle(doc) {
  return doc.content.firstChild.textContent;
}

export function stepsAreOnlyHighlights(steps) {
  const highlightSteps = steps.filter((step) => {
    return (step.jsonID === 'addMark' || step.jsonID === 'removeMark') && step.mark && step.mark.type.name === 'highlight';
  });
  return highlightSteps.length === steps.length;
}

// Returns a list of permission objects given a specific user and permissions.
export function getPermissionObjects(permissions, user, addedAt, addedBy) {
  const userPermissions = [];
  // For each permission add a userPermission object to the list.
  permissions.forEach((permission) => {
    userPermissions.push({
      user,
      addedAt,
      addedBy,
      permission,
    });
  });
  return userPermissions;
}
