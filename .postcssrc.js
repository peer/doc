module.exports = (ctx) => {
  if (ctx.meteor) {
    const config = {
      plugins: {
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

    return config;
  }
  // In our case, this is done when processing <style> tags inside Vue components.
  else {
    return {};
  }
};
