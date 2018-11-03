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
