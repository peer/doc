import queryString from 'query-string';

const _isEmbedded = !!queryString.parse(window.location.search).embed;

// This is a static property of an app at load time and we do not change it once the app is loaded,
// but for future compatibility we are exposing it as a function.
export function isEmbedded() {
  return _isEmbedded;
}

if (isEmbedded()) {
  // Send to parent window our height.
  // TODO
}
