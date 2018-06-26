/* eslint-disable global-require */
/* globals __meteor_runtime_config__ */

try {
  // We try to import the file. It should be generated during the build process,
  // exporting the version of the app (like git commit hash).
  // If it is an empty string, set it to null.
  // eslint-disable-next-line import/no-unresolved
  __meteor_runtime_config__.VERSION = require('./imports/gitversion.js') || null;
}
catch (error) {
  // We are ignoring the error.
  __meteor_runtime_config__.VERSION = null;
}
