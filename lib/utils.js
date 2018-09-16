import {Accounts} from 'meteor/accounts-base';
import {Meteor} from 'meteor/meteor';
import {Promise} from 'meteor/promise';
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

function _apply(methodName, args, {wait, onResultReceived, noRetry}, callback) {
  if (onResultReceived) {
    Meteor.apply(methodName, args, {wait, noRetry, onResultReceived: callback});
  }
  else {
    Meteor.apply(methodName, args, {wait, noRetry}, callback);
  }
}

// All options are boolean.
export function callAsync(methodName, args, {wait, onResultReceived, noRetry} = {}) {
  // If callback is provided, call method in a regular way.
  if (_.isFunction(args[args.length - 1])) {
    const callback = args[args.length - 1];
    _apply(methodName, args.slice(0, -1), {wait, onResultReceived, noRetry}, callback);
    return null;
  }
  // Otherwise we return a promise.
  else {
    return new Promise((resolve, reject) => {
      const callback = (error, result) => {
        if (error) {
          reject(error);
        }
        else {
          resolve(result);
        }
      };
      _apply(methodName, args, {wait, onResultReceived, noRetry}, callback);
    });
  }
}

export function callLoginMethodAsync(methodName, args, callback) {
  if (callback) {
    Accounts.callLoginMethod({
      methodName,
      methodArguments: args,
      userCallback(error, loginDetails) {
        if (error) {
          callback(error);
        }
        else {
          callback(null);
        }
      },
    });
    return null;
  }
  else {
    return new Promise((resolve, reject) => {
      Accounts.callLoginMethod({
        methodName,
        methodArguments: args,
        userCallback(error, loginDetails) {
          if (error) {
            reject(error);
          }
          else {
            resolve(null);
          }
        },
      });
    });
  }
}
