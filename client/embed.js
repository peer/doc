import {_} from 'meteor/underscore';

import queryString from 'query-string';

const _isEmbedded = !!queryString.parse(window.location.search).embed;

// This is a static property of an app at load time and we do not change it once the app is loaded,
// but for future compatibility we are exposing it as a function.
export function isEmbedded() {
  return _isEmbedded;
}

let width = null;
let height = null;

function sendSize() {
  // Optimization. If nothing changed, do not send anything.
  if (width === document.body.scrollWidth && height === document.body.scrollHeight) {
    return;
  }

  width = document.body.scrollWidth;
  height = document.body.scrollHeight;

  window.parent.postMessage({
    size: {
      width,
      height,
    },
  }, '*');
}

const sendSizeThrottled = _.throttle(sendSize, 20);

const eventNames = [
  'animationstart', 'webkitAnimationStart', 'animationiteration', 'webkitAnimationIteration', 'animationend', 'webkitAnimationEnd',
  'input', 'mouseup', 'mousedown',
  'orientationchange',
  'afterprint', 'beforeprint',
  'readystatechange',
  'touchstart', 'touchend', 'touchcancel',
  'transitionstart', 'webkitTransitionStart', 'MSTransitionStart', 'oTransitionStart', 'otransitionstart',
  'transitioniteration', 'webkitTransitionIteration', 'MSTransitionIteration', 'oTransitionIteration', 'otransitioniteration',
  'transitionend', 'webkitTransitionEnd', 'MSTransitionEnd', 'oTransitionEnd', 'otransitionend',
];

function addEventListeners() {
  for (const eventName of eventNames) {
    window.addEventListener(eventName, sendSizeThrottled, false);
  }
}

function setupMutationObserver() {
  function imageLoadListener(event) {
    removeImageLoadListeners(event.target); // eslint-disable-line no-use-before-define

    sendSizeThrottled();
  }

  function addImageLoadListeners(mutation) {
    function addImageLoadListener(element) {
      if (element.complete === false) {
        element.addEventListener('load', imageLoadListener, false);
        element.addEventListener('error', imageLoadListener, false);
      }
    }

    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
      addImageLoadListener(mutation.target);
    }
    else if (mutation.type === 'childList') {
      Array.prototype.forEach.call(
        mutation.target.querySelectorAll('img'),
        addImageLoadListener,
      );
    }
  }

  function removeImageLoadListeners(element) {
    element.removeEventListener('load', imageLoadListener, false);
    element.removeEventListener('error', imageLoadListener, false);
  }

  function mutationObserved(mutations) {
    sendSizeThrottled();

    // Handle async image loading in WebKit.
    mutations.forEach(addImageLoadListeners);
  }

  const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  const target = document.querySelector('body');
  const options = {
    attributes: true,
    attributeOldValue: false,
    characterData: true,
    characterDataOldValue: false,
    childList: true,
    subtree: true,
  };

  const observer = new MutationObserver(mutationObserved);
  observer.observe(target, options);
}

if (isEmbedded() && window.parent) {
  // Send to parent window our height.

  addEventListeners();
  setupMutationObserver();
}
