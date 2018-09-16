import {check as meteorCheck} from 'meteor/check';
import {Log} from 'meteor/logging';

import util from 'util';

export function check(value, pattern) {
  try {
    meteorCheck(value, pattern);
  }
  catch (error) {
    Log.error(`Error in check: ${error}`);
    Log.error(`Value used in check: ${util.inspect(value, {depth: null, breakLength: Infinity})}`);
    throw error;
  }
}
