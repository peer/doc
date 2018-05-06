module.exports = (ctx) => {
  if (ctx.meteor) {
    const config = {
      plugins: {
        // We care about linting issues in files made by developers, so this is first.
        'stylelint': {},
        // To import CSS files from NPM packages.
        'postcss-easy-import': {},
      },
    };

    if (ctx.env === 'production') {
      // "autoprefixer" is reported to be slow,
      // so we use it only in production.
      config.plugins.autoprefixer = {
        browsers: [
          'last 2 versions',
        ],
      };
    }

    // Reporter is last.
    config.plugins['postcss-reporter'] = {
      'clearReportedMessages': true,
    };

    return config;
  }
  // In our case, this is done when processing <style> tags inside Vue components.
  else {
    return {
      /*
      TODO: Disabled for now.
            See: https://github.com/meteor-vue/vue-meteor/pull/317
      plugins: {
        // We just do linting here and leave the rest to default plugins.
        'stylelint': {},
        'postcss-reporter': {
          'clearReportedMessages': true,
        },
      ],
      */
    };
  }
};
