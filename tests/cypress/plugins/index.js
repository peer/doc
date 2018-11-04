const process = require('process');

module.exports = (on, config) => {
  if (process.env.PERCY_TOKEN) {
    // eslint-disable-next-line no-param-reassign
    config.env.PERCY_ENABLED = true;
  }

  return config;
};
