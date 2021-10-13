# PeerDoc

## Description

PeerDoc is a collaborative real-time rich-text editor with undo/redo, cursor tracking, inline comments,
permissions/sharing control over documents, a change history. Things you would expect from a modern
collaborative editor on the web.

![editor](https://gitlab.com/peer/doc/-/jobs/1618410731/artifacts/raw/tests/cypress/screenshots/comments.js/comments%20-%20can%20create%20and%20reply%20-%20reply%20made.png?inline=false)

But the main difference is that it provides two types of collaboration:

* real-time collaboration between collaborators on the draft of the document
* fork and merge request style of collaboration with others, allowing collaboration to scale beyond a small group of collaborators

For more information about PeerDoc, what it can do and how it works, see [this blog post](https://mitar.tnode.com/post/peerdoc-scaling-real-time-text-editing/).

## Status

PeerDoc is a stable prototype. It has been already used in production. All features described above are implemented,
but some of them are implemented in its basic form. For example, authentication and registration is currently very simple.
Merge requests just show a diff but do not offer discussion. Or decision making to approve merge requests.
You cannot add attachments to documents. And so on. See [issues](https://gitlab.com/peer/doc/-/issues)
for more details.

## Installation

PeerDoc is distributed as a [Docker image](https://gitlab.com/peer/doc/container_registry). To get the latest stable version,
use `registry.gitlab.com/peer/doc/branch/main:latest`.

The Docker image is based on [`tozd/meteor`](https://gitlab.com/tozd/docker/meteor) Docker image so [see there](https://gitlab.com/tozd/docker/meteor)
more details how to run and configure the image.

## Settings

PeerDoc can be configured using `settings.json` file. See [example settings file](https://gitlab.com/peer/doc/-/blob/main/settings.example.json).

* `tokenSharedSecret`: PeerDoc can be embedded and can accept `user` query string parameter with a token about the user currently
  signed in into the parent app. That `user` token is encrypted and signed using `tokenSharedSecret`. Used also for authentication of calls to the API.
* `appCivistIntegration`: An object with `endpoint`, `email`, and `password` fields. Used when embedded inside [Appcivist](https://pb.appcivist.org/)
  to notify Appcivist when documents are updated or comments made.
* `apiControlled`: When set to `true`, then creation of documents, forking, merging, etc., can be done **only** through the API and not through the web
  interface. Useful when PeerDoc is embedded and the parent app controls the collaboration process.
* `passwordlessAuthDisabled`: By default, PeerDoc comes with simple password less authentication (anyone can just pick an username). Probably you want to
  disable that in production.
* `mergingForkingOfAllDocuments`: By default, PeerDoc allows forking only published documents (and merging back). (Published documents are those which
  you cannot edit anymore in real-time.) But you can enable that all documents (including those which are still being edited in real-time) can be forked
  and merged back to. Depends on what type of collaborative process you want.
* `defaultLanguage`: Default language of the user interface to use, if user does not have its preferred language set.
* `defaultPermissions`: Default permissions to give to new users. By default new users can create documents and view and create comments (but first
  they have to have access to a documents to comment).

## Embedding

PeerDoc can be embedded in an iframe. You should provide the following query string parameters in the URL you are embedding:

* `embed`: Set it to `true` to ask PeerDoc to not render toolbar and padding around the main area of the app (it is assumed that the parent app provides those).
* `user`: Provide a JSON-encoded, AES-128-GCM encrypted and signed, base64 encoded token with information about the user. It is not a JWT but a custom token. If user does not yet exist, it is created by PeerDoc internally.
JSON has the following fields: `avatar`, `username`, `id`, `email`, and `language`.

When being embedded (`embed` is set to `true`) PeerDoc uses `window.parent.postMessage` to send a `{size: {width, height}}` messages to the parent app
with the size of the embedded content. This allows the parent app to resize
iframe accordingly.

## API

PeerDoc can be controlled through an API. Authentication is done using the `user` query string parameter which should contain
user token as described for embedding. Available endpoints:

* POST `/document`: Creates a new document. On success returns a JSON with `{status: "success", documentId, path}`. On error returns a JSON with `{status: "error"}`.
* POST `/document/export/<document id>`: Exports a document to HTML. On success returns a JSON with `{status: "success", html}`. On error returns a JSON with `{status: "error"}`.
* POST `/document/publish/<document id>`: Publishes the document. On success returns a JSON with `{status: "success"}`. On error returns a JSON with `{status: "error"}`.
* POST `/document/share/<document id>`: Configures permissions/sharing control of the document. Accepts a JSON with `{visibility, token_users: {admin, edit}}`. `visibility` can be `true` or `false`, corresponding to public and private visibility levels. `admin` and `edit` are lists of user tokens for which corresponding permission should be set. All other permissions are removed. On success returns a JSON with `{status: "success"}`. On error returns a JSON with `{status: "error"}`.
* POST `/document/fork/<document id>`: Forks the document. On success returns a JSON with `{status: "success", documentId, path}`. On error returns a JSON with `{status: "error"}`.
* POST `/document/merge/<document id>`: Merges the document. On success returns a JSON with `{status: "success"}`. On error returns a JSON with `{status: "error"}`.

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
