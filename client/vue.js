import {Meteor} from 'meteor/meteor';
import {Tracker} from 'meteor/tracker';

import assert from 'assert';
import moment from 'moment';
import Vue from 'vue';

function expirationMsFromDuration(duration) {
  // Default values from  moment/src/lib/duration/humanize.js.
  const thresholds = {
    s: 45, // seconds to minute
    m: 45, // minutes to hour
    h: 22, // hours to day
  };

  const seconds = Math.round(duration.as('s'));
  const minutes = Math.round(duration.as('m'));
  const hours = Math.round(duration.as('h'));

  if (seconds < thresholds.s) {
    return ((thresholds.s - seconds) * 1000) + 500;
  }
  else if (minutes < thresholds.m) {
    return ((60 - (seconds % 60)) * 1000) + 500;
  }
  else if (hours < thresholds.h) {
    return (((60 * 60) - (seconds % (60 * 60))) * 1000) + 500;
  }
  else {
    return (((24 * 60 * 60) - (seconds % (24 * 60 * 60))) * 1000) + 500;
  }
}

function invalidateAfter(expirationMs) {
  const computation = Tracker.currentComputation;

  let handle = Meteor.setTimeout(() => {
    computation.invalidate();
  }, expirationMs);

  computation.onInvalidate(() => {
    if (handle) {
      Meteor.clearTimeout(handle);
    }
    handle = null;
  });
}

// Default localized date-time format. Example formatted date-time: "Thu, Sep 4 1986 8:30 PM".
Vue.prototype.DEFAULT_DATETIME_FORMAT = 'llll';

// Default localized date format. Example formatted date: "Sep 4 1986".
Vue.prototype.DEFAULT_DATE_FORMAT = 'll';

// Default localized time format. Example formatted time: "8:30 PM".
Vue.prototype.DEFAULT_TIME_FORMAT = 'LT';

// Format (http://momentjs.com/docs/#/displaying/format/) a datetime using provided "format" string.
//
// Example:
//
//   {{createdAt | formatDate(DEFAULT_DATETIME_FORMAT)}}
//   <span class="timestamp" :title="createdAt | formatDate(DEFAULT_DATETIME_FORMAT)">
//   <span class="timestamp" :title="$formatDate(createdAt, DEFAULT_DATETIME_FORMAT)">
Vue.prototype.$formatDate = function formatDate(date, format) {
  return moment(date).format(format);
};
Vue.filter('formatDate', Vue.prototype.$formatDate);

// Reactively format a datetime into a relative from now and localized string.
// As times progresses, string is automatically updated. Strings are made using
// moment.js "fromNow" function (http://momentjs.com/docs/#/displaying/fromnow/).
//
// "withoutSuffix" controls if "ago" suffix should be omitted. Default is false.
//
// Example output: 3 months ago
//
// Example:
//
//   <span class="timestamp" :title="createdAt | formatDate(DEFAULT_DATETIME_FORMAT)">{{createdAt | fromNow}}</span>
//   <span class="timestamp" :title="createdAt | formatDate(DEFAULT_DATETIME_FORMAT)">{{$fromNow(createdAt)}}</span>
Vue.prototype.$fromNow = function fromNow(date, withoutSuffix) {
  const momentDate = moment(date);

  if (Tracker.active) {
    const absoluteDuration = moment.duration({to: momentDate, from: moment()}).abs();
    const expirationMs = expirationMsFromDuration(absoluteDuration);
    invalidateAfter(expirationMs);
  }

  return momentDate.fromNow(withoutSuffix);
};
Vue.filter('fromNow', Vue.prototype.$fromNow);

// Format a datetime into a relative from now and localized string using friendly day names.
// Strings are made using moment.js "calendar" function (http://momentjs.com/docs/#/displaying/calendar-time/).
//
// Example output: last Sunday at 2:30 AM
//
// Example:
//
//   <span :title="playStart | formatDate(DEFAULT_DATETIME_FORMAT)">{{playStart | calendarDate}}</span>
//   <span :title="playStart | formatDate(DEFAULT_DATETIME_FORMAT)">{{$calendarDate(playStart)}}</span>
Vue.prototype.$calendarDate = function calendarDate(date) {
  return moment(date).calendar(null, {
    lastDay: '[yesterday at] LT',
    sameDay: '[today at] LT',
    nextDay: '[tomorrow at] LT',
    lastWeek: '[last] dddd [at] LT',
    nextWeek: 'dddd [at] LT',
    sameElse: this.DEFAULT_DATETIME_FORMAT,
  });
};
Vue.filter('calendarDate', Vue.prototype.$calendarDate);

// Similar to moment.js "humanize" function (http://momentjs.com/docs/#/durations/humanize/) it returns
// a friendly string representing the duration.
//
// It is build from "size" number of units. For example, for "size" equals 2, the string could be
// "2 days 1 hour". For "size" equals 3, "2 days 1 hour 44 minutes". If you omit "size", full precision
// is used.
//
// If "from" or "to" are null, current time is used instead and the output is reactive.
//
// Example:
//
//   <span title="{{$formatDuration(startedAt, endedAt)}}">{{$formatDuration(startedAt, endedAt, 2)}}</span>
//
// Example:
//
//   <span title="{{$formatDuration(startedAt, null)}}">{{$formatDuration(startedAt, null, 3)}}</span>
//
// TODO: Support localization.
Vue.prototype.$formatDuration = function $formatDuration(from, to, size) {
  const reactive = !(from && to);

  if (from == null) {
    from = new Date(); // eslint-disable-line no-param-reassign
  }
  if (to == null) {
    to = new Date(); // eslint-disable-line no-param-reassign
  }

  const duration = moment.duration({from, to}).abs();

  const minutes = Math.round(duration.as('m')) % 60;
  const hours = Math.round(duration.as('h')) % 24;
  const days = Math.round(duration.as('d')) % 7;
  const weeks = Math.floor(Math.round(duration.as('d')) / 7);

  let partials = [{
    key: 'week',
    value: weeks,
  }, {
    key: 'day',
    value: days,
  }, {
    key: 'hour',
    value: hours,
  }, {
    key: 'minute',
    value: minutes,
  }];

  // Trim zero values from the left.
  while (partials.length && (partials[0].value === 0)) {
    partials.shift();
  }

  // Cut the length to provided size.
  if (size) {
    partials = partials.slice(0, size);
  }

  if (reactive && Tracker.active) {
    let expirationMs;
    const seconds = Math.round(duration.as('s'));

    if (partials.length) {
      const lastPartial = partials[partials.length - 1].key;
      if (lastPartial === 'minute') {
        expirationMs = ((60 - (seconds % 60)) * 1000) + 500;
      }
      else if (lastPartial === 'hour') {
        expirationMs = (((60 * 60) - (seconds % (60 * 60))) * 1000) + 500;
      }
      else {
        expirationMs = (((24 * 60 * 60) - (seconds % (24 * 60 * 60))) * 1000) + 500;
      }
    }
    else {
      assert(seconds < 60, seconds);
      expirationMs = ((60 - seconds) * 1000) + 500;
    }

    invalidateAfter(expirationMs);
  }

  const result = [];
  for (let {key, value} of partials) { // eslint-disable-line prefer-const
    // Maybe there are some zero values in-between, skip them.
    if (value === 0) {
      continue;
    }

    if (value !== 1) {
      key = `${key}s`;
    }

    result.push(`${value} ${key}`);
  }

  if (result.length) {
    return result.join(' ');
  }
  else {
    return "less than a minute";
  }
};
