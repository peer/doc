## Development

The application uses [Meteor](https://www.meteor.com/) web framework. Install it:

```bash
$ curl https://install.meteor.com/ | sh
```

Clone the repository **recursively**:

```bash
$ git clone --recursive https://gitlab.com/peer/doc.git
```

Install dependencies:

```bash
$ meteor npm install
```

Add and configure settings:

```bash
$ cp settings.example.json settings.json
```

Run it:

```bash
$ meteor --settings settings.json
```

And open [http://localhost:3000/](http://localhost:3000/).

## Technologies used

* [Meteor](https://www.meteor.com/)
* JavaScript
* [SCSS](http://sass-lang.com/)
* [Vue](https://vuejs.org/) + [Vuetify](https://vuetifyjs.com/)
* [ProseMirror](http://prosemirror.net/)

## Code style

See [code style guide](./CODE_STYLE.md) for more information.

To run a linting tool to check the code style, run:

```bash
$ meteor npm run lint
```

## Translations

The translations are handled by the [vue-gettext](https://github.com/Polyconseil/vue-gettext) package.

To generate translations:

1. Run `meteor npm run extract-strings` to extract user-visible strings.
2. Go to `translations/locale` and find the `.po` file associated with the language you want to translate.
3. Update the `.po` file with translations for extracted strings.
4. Generate an updated translations JSON file by running `meteor npm run translations`.

## Testing

### Unit tests

```
$ meteor npm run test-watch
```

This will watch for any code changes and rerun unit tests. Test results for both server-side
and client-side are provided in the terminal.

If you want to run unit tests only once, run:

```
$ meteor npm run test
```

If you prefer to see client-side test results in a browser, run:

```
$ meteor npm run test-watch-browser
```

And open [http://localhost:3100/](http://localhost:3100/) (note a different port).

### Acceptance tests

Run in one terminal:

```
$ meteor npm run test-app
```

This will run the full app in test mode on [http://localhost:3000/](http://localhost:3000/),
but you do not have to open it. Run in another terminal:

```
$ meteor npm run cypress
```

This will open [Cypress runner](http://cypress.io/) which we use for acceptance tests.
You can select tests to run or run all of them and you will see how they are run in
testing browser, and be able to inspect results. It will watch for any changes and
rerun tests, too.

If you want to run acceptance tests only once, and see results in the terminal, run:

```
$ meteor npm run cypress-run
```

During CI testing acceptance tests are run as well. Results are recorded and available
in [Cypress Dashboard](https://dashboard.cypress.io/projects/v5cnsk).
Moreover, results are also submitted for visual diffing and are available
in [Percy](https://percy.io/72b06e35/PeerDoc).

You can find links to a particular Cypress recording and Percy build for a CI run in
[GitLab CI's run output](https://gitlab.com/peer/doc/-/pipelines).
