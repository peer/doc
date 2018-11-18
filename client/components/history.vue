<template>
  <div>
    <div class="editor__toolbar">
      <v-toolbar
        card
        dense
      />
      <v-divider />
    </div>

    <v-card-text
      ref="editor"
      class="editor"
    />

    <v-alert
      :value="emptyHistory"
      type="warning"
    >
      <translate>history-empty</translate>
    </v-alert>
  </div>
</template>

<script>
  import {Tracker} from 'meteor/tracker';
  import {_} from 'meteor/underscore';

  import assert from 'assert';
  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {Step} from 'prosemirror-transform';
  import {ChangeSet} from 'prosemirror-changeset';

  import {Content} from '/lib/documents/content';
  import {Document} from '/lib/documents/document';
  import {schema} from '/lib/full-schema';

  import {diffPlugin} from './utils/diff-plugin';

  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
      contentKey: {
        type: String,
        required: true,
      },
      startVersion: {
        type: Number,
        default: null,
        validator: (value) => {
          return value === null || value >= 0;
        },
      },
      endVersion: {
        type: Number,
        default: null,
        validator: (value) => {
          return value === null || value >= 0;
        },
      },
    },

    data() {
      return {
        contentsHandle: null,
        currentVersion: 0,
        currentStartVersion: null,
        currentEndVersion: null,
        currentChangeSet: null,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      emptyHistory() {
        if (this.currentChangeSet === null) {
          // This should be true, but just want to make sure we have all data first.
          return this.$subscriptionsReady();
        }
        else {
          return this.currentChangeSet.inserted.length === 0 && this.currentChangeSet.deleted.length === 0;
        }
      },
    },

    created() {
      this.$autorun((computation) => {
        if (this.document) {
          this.contentsHandle = this.$subscribe('Content.list', {contentKey: this.document.contentKey, withMetadata: true});
        }
      });
    },

    mounted() {
      this.$editorView = new EditorView({mount: this.$refs.editor}, {
        state: this.createInitialState(),
        editable: () => {
          return false;
        },
      });

      this.$autorun((computation) => {
        if (!this.contentsHandle) {
          return;
        }

        if (this.startVersion === null) {
          return;
        }

        if (this.endVersion === null) {
          return;
        }

        const contentQuery = _.extend(this.contentsHandle.scopeQuery(), {
          version: {
            $lte: this.startVersion,
          },
        });

        // To register dependency on versions available from the server.
        const versions = _.pluck(Content.documents.find(contentQuery, {fields: {version: 1}}).fetch(), 'version');

        // We want all versions to be available without any version missing, before we start applying them.
        if (_.min(versions) !== 0) {
          return;
        }

        if (_.max(versions) !== this.startVersion) {
          return;
        }

        if (versions.length !== this.startVersion + 1) {
          return;
        }

        // If "startVersion" is older than "currentStartVersion", we have to reset editor's state.
        // When "endVersion" is different from "currentEndVersion" we could maybe recreate just
        // the changeset, but it easier to just reset editor's state.
        if ((this.currentStartVersion !== null && this.startVersion < this.currentStartVersion) || (this.currentEndVersion !== null && this.endVersion !== this.currentEndVersion)) {
          this.$editorView.updateState(this.createInitialState());
          this.currentVersion = 0;
          this.currentStartVersion = this.startVersion;
          this.currentEndVersion = this.endVersion;
          this.currentChangeSet = null;
        }

        Tracker.nonreactive(() => {
          let currentVersion = this.currentVersion;
          const transaction = this.$editorView.state.tr;

          Content.documents.find({
            $and: [
              contentQuery,
              {
                version: {
                  $gt: this.currentVersion,
                },
              },
            ],
          }, {
            sort: {
              version: 1,
            },
            transform: null,
          }).forEach((content) => {
            transaction.step(Step.fromJSON(schema, content.step));
            currentVersion += 1;
          });

          assert.strictEqual(this.startVersion, currentVersion);

          if (currentVersion !== this.currentVersion) {
            // "startVersion" and "endVersion" represent an inclusive interval, so we have to
            // subtract 1 from "endVersion" to include also the change at "endVersion" itself.
            const transactionEndIndex = transaction.docs.length - (this.startVersion - (this.endVersion - 1));
            let changeset = this.currentChangeSet;
            if (changeset === null) {
              assert(transactionEndIndex >= 0, `${transactionEndIndex}`);
              if (transactionEndIndex < transaction.docs.length) {
                changeset = ChangeSet.create(transaction.docs[transactionEndIndex]);
              }
              else {
                // If "startVersion === endVersion" then "transactionEndIndex === transaction.docs.length"
                // and there are no changes anyway, so we just use the last document.
                changeset = ChangeSet.create(transaction.doc);
              }
            }

            // If "startVersion === endVersion" then "transactionEndIndex === transaction.steps.length"
            // and there are no changes anyway, so there are no steps we can add to the changeset.
            if (transactionEndIndex < transaction.steps.length) {
              if (transactionEndIndex >= 0) {
                changeset = changeset.addSteps(transaction.doc, transaction.mapping.maps.slice(transactionEndIndex));
              }
              else {
                changeset = changeset.addSteps(transaction.doc, transaction.mapping.maps);
              }
            }

            transaction.setMeta(diffPlugin, changeset);

            this.$editorView.dispatch(transaction);
            this.currentVersion = currentVersion;
            this.currentStartVersion = this.startVersion;
            this.currentEndVersion = this.endVersion;
            this.currentChangeSet = changeset;
          }
        });
      });
    },

    beforeDestroy() {
      this.$editorView.destroy();
    },

    methods: {
      createInitialState() {
        return EditorState.create({
          schema,
          plugins: [
            diffPlugin,
          ],
        });
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .editor {
    .inserted {
      // Equal to "green darken-2".
      color: #388e3c;
      font-weight: bold;
    }

    .deleted {
      // Equal to "red darken-2".
      color: #d32f2f;
      font-weight: bold;
    }
  }
</style>
