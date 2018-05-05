# Code Style

## JavaScript

We use a slightly relaxed [Airbnb JavaScript code style](https://github.com/airbnb/javascript).

**Consistency is the main code style guideline** and if in doubt, try to find a similar existing code and style
your code the same.

**Be verbose**. Always fully spell out any part of the function, class, or variable name.

### Line wrapping

We **do not wrap lines** except when logically reasonable or when it greatly increases readability
(we still wrap logically and not just at the end of the line). This is why the linting line length limit
for code is at high 240 characters.

We do wrap comments at the 120 characters right margin. If the comment wraps to two lines, balance the lines
so they are both approximately the same length.

### Strings

Use `'single_quote_string` for constant strings and `"double-quote-string"` for translation keys
(which should always be in kebab-case).
If you need string interpolation (which you should use always when you are constructing a string,
never string concatenation), then use `` `backtick_quote_${string}` ``.

This means all object property names should use single quotes, except when you are interpolating them.

### Unused function arguments encouraged

In JavaScript it is not required to define all arguments if you do not use them in the body of a function,
even if caller is passing them. We encourage you to always list all arguments which you know caller is
passing to a function, even if you do not use them because maybe in the future somebody will find it useful
when doing modification to function's code. In this way it is also easier to do modifications because you
do not have to fullly know what all is being passed to a function and you can work directly with what you have
available.

### Imports

Imports should be divided into multiples sections, in order from more global to more local, separated by an empty line:
 * Meteor core packages
 * Meteor Atmosphere packages
 * NPM packages
 * local files

Inside each section, imports should be ordered alphabetically, based on module name.
All imports from the same module should be grouped together, and ordered alphabetically on symbols imported.

Example:

```javascript
import {Meteor} from 'meteor/meteor';
import {_} from 'meteor/underscore';

import {ValidatedMethod} from 'meteor/mdg:validated-method';

import {Document} from '/lib/document';
import {fetch, initialize} from './data';
```

If you are importing multiple symbols with the same name from different modules, rename more global one with a prefix
of the module:

```javascript
import {usa as countries_usa} from 'countries';

import {usa} from './overlay';
```

### Comments

If TODO comments cannot be a short one-line with grammatically correct punctuation, then split it into multiple lines in this way:

```python
# TODO: Short description of a TODO.
#       A longer description of what we could potentially do here. Maybe we
#       could do X or Y, but Y has this consequences. We should probably
#       wait for server rendering feature to be implemented.
#       See: https://github.com/example/project/issues/123
```

Try to keep the formatting of the first line exactly as shown above so that it is easier parsed by IDEs.
Including the space after `#` and space after `:`.

## SCSS

We use [Airbnb JavaScript SASS style](https://github.com/airbnb/css).

Put all SCSS code belonging to Vue components into `<style>` blocks in `.vue` files:

```vue
<style lang="scss">
  ...
</style>
```

## Vue

For Vue components we use almost all [community style rules](https://github.com/vuejs/eslint-plugin-vue#bulb-rules)
which are based on [official style guide for Vue-specific code](https://vuejs.org/v2/style-guide/).

We use one `.vue` file per Vue component and put the template, JavaScript code, and SCSS code into it according
to the following structure:

```vue
<template>
  ...
</template>

<script>
  // imports

  // @vue/component
  const component = {
    // component
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        // other parameters
      },
    ]);
  });

  export default component;
</script>

<style lang="scss">
  ...
</style>
```

File name of the file is important because it becomes component's element
name.

`@vue/component` comment is required to enable Vue component linting on the component code.

`RouterFactory` block is not necessary for non-routing components.

## Code repository

Commit often and make sure each commit is a rounded change. Do not squash commits, unless that helps making a set of commits
into a clearer change. We leave unsuccessful attempts in the repository because maybe in the future we can come back to them
and use them, maybe in a different context or way.

For most changes to the repository, we make first a feature branch from `master` branch. We make all necessary changes in
that new branch, potentially make multiple commits. We make a pull request against the `master` branch for the change
to be reviewed and merged. We should make a pull request even before all changes are finished so that others can comment
and discuss the development. We can continue adding more commits to this branch even after the pull request has been made
and GitHub will update the pull request automatically. Until a pull request is finished and is deemed ready to be merged
by its author, pull request's title should be prefixed with `WiP` keyword so that it is clear that it is not yet meant
to be merged (and thoroughly reviewed).

### Commit messages

Commit messages should be descriptive and full sentences, with grammatically correct punctuation.
If possible, they should reference relevant tickets (by appending something like `See #123.`) or even close them
(`Fixes #123.`). GitHub recognizes that. If longer commit message is suitable (which is always a good thing),
first one line summary should be made (50 characters is a soft limit), followed by an empty line, followed
by a multi-line message:

    Added artificially lowering of the height in IE.
    
    In IE there is a problem when rendering when user is located
    higher than 2000m. By artificially lowering the height rendering
    now works again.

    Fixes #123.
