## Development

The application uses [Meteor](https://www.meteor.com/) web framework. Install it:

```bash
$ curl https://install.meteor.com/ | sh
```

Clone the repository:

```bash
$ git clone --recursive https://github.com/peer/doc.git
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
$ meteor npm start 
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
