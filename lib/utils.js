import {_} from 'meteor/underscore';

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

export function filterPermissionObjects(userPermissions, userId) {
  return (userPermissions || []).filter((userPermission) => {
    return userPermission.user._id === userId;
  });
}

function stringCmp(string1, string2) {
  if (string1 === string2) {
    return 0;
  }
  else if (string1 < string2) {
    return -1;
  }
  else {
    return 1;
  }
}

function sortedLitePermissions(userPermissions) {
  return (userPermissions || []).map((userPermission) => {
    return {
      userId: userPermission.user._id,
      permission: userPermission.permission,
    };
  }).sort((userPermission1, userPermission2) => {
    let cmp = stringCmp(userPermission1.userId, userPermission2.userId);

    if (cmp === 0) {
      cmp = stringCmp(userPermission1.permission, userPermission2.permission);
    }

    return cmp;
  });
}

export function permissionsEqual(userPermissions1, userPermissions2) {
  return _.isEqual(sortedLitePermissions(userPermissions1), sortedLitePermissions(userPermissions2));
}

// User permissions in "userPermissions1" which are not in "userPermissions2".
export function permissionsDifference(userPermissions1, userPermissions2) {
  return (userPermissions1 || []).filter((userPermission1) => {
    return !(userPermissions2 || []).find((userPermission2) => {
      return (userPermission1.permission === userPermission2.permission) && (userPermission1.user._id === userPermission2.user._id);
    });
  });
}
