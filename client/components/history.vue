<template>
  <v-card>
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
  </v-card>
</template>

<script>
  import {Tracker} from 'meteor/tracker';
  import {_} from 'meteor/underscore';

  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {Step} from 'prosemirror-transform';

  import {Content} from '/lib/documents/content';
  import {Document} from '/lib/documents/document';
  import {schema} from '/lib/full-schema';

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
      },
      endVersion: {
        type: Number,
        default: null,
      },
    },

    data() {
      return {
        contentsHandle: null,
        currentVersion: 0,
        currentStartVersion: null,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
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
        if (this.startVersion === null || this.currentStartVersion === null) {
          return;
        }

        // If "startVersion" is older than "currentStartVersion",
        // we have to reset editor's state.
        if (this.startVersion < this.currentStartVersion) {
          this.$editorView.updateState(this.createInitialState());
          this.currentVersion = 0;
          this.currentStartVersion = this.startVersion;
        }
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

          if (currentVersion !== this.currentVersion) {
            this.$editorView.dispatch(transaction);
            this.currentVersion = currentVersion;
            this.currentStartVersion = this.startVersion;
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
        });
      },
    },
  };

  export default component;
</script>
