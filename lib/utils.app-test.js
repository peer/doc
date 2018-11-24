// These utils are available only during testing.

import {callAsync} from './utils';

export function commentFind(...args) {
  return callAsync('_test.commentFind', args);
}

export function contentFind(...args) {
  return callAsync('_test.contentFind', args);
}

export function documentFind(...args) {
  return callAsync('_test.documentFind', args);
}

export function userFind(...args) {
  return callAsync('_test.userFind', args);
}

export function commentUpdate(...args) {
  return callAsync('_test.commentUpdate', args);
}

export function contentUpdate(...args) {
  return callAsync('_test.contentUpdate', args);
}

export function documentUpdate(...args) {
  return callAsync('_test.documentUpdate', args);
}

export function userUpdate(...args) {
  return callAsync('_test.userUpdate', args);
}

export function waitForDatabase(...args) {
  return callAsync('_test.waitForDatabase', args);
}

export function configureSettings(...args) {
  return callAsync('_test.configureSettings', args);
}
