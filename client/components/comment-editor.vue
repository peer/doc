<template>
  <div>
    <div
      ref="editor"
      class="comment-editor"
    />
    <link-dialog
      ref="linkDialog"
      @link-inserted="onLinkInserted"
      @link-removed="onLinkRemoved"
    />
  </div>
</template>

<script>
  import assert from 'assert';
  import {Node} from 'prosemirror-model';
  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {baseKeymap, toggleMark} from "prosemirror-commands";
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';

  import {schema} from '/lib/simple-schema.js';
  import {placeholderPlugin} from './utils/placeholder.js';
  import {toggleLink, clearLink} from './utils/link.js';

  // @vue/component
  const component = {
    model: {
      prop: 'body',
      event: 'update:body',
    },

    props: {
      readOnly: {
        type: Boolean,
        required: true,
      },
      body: {
        type: Object,
        default: null,
      },
      isReply: {
        type: Boolean,
        default: false,
      },
    },

    data() {
      return {
        isEmpty: true,
        bodyState: this.body,
      };
    },

    watch: {
      body(newBody, oldBody) {
        if (newBody === this.bodyState) {
          return;
        }

        this.bodyState = newBody;
        // This destroys history and undo, but we want this.
        this.$editorView.updateState(this.newEditorState());
        this.stateUpdated();
      },

      isEmpty(newIsEmpty, oldIsEmpty) {
        assert(newIsEmpty !== oldIsEmpty);
        this.$emit('body-empty', newIsEmpty);
      },
    },

    mounted() {
      this.$editorView = new EditorView({mount: this.$refs.editor}, {
        state: this.newEditorState(),
        editable: () => {
          return !this.readOnly;
        },
        dispatchTransaction: (transaction) => {
          const newState = this.$editorView.state.apply(transaction);
          this.$editorView.updateState(newState);
          this.stateUpdated();

          this.bodyState = Object.freeze(this.$editorView.state.doc.toJSON());
          this.$emit('update:body', this.bodyState);
        },
      });
    },

    methods: {
      newEditorState() {
        const state = EditorState.create({
          schema,
          // Initial content, if any.
          doc: this.bodyState && Node.fromJSON(schema, this.bodyState),
          plugins: [
            keymap({
              'Mod-z': undo,
              'Mod-y': redo,
              'Mod-b': toggleMark(schema.marks.strong),
              'Mod-i': toggleMark(schema.marks.em),
              'Mod-u': toggleMark(schema.marks.strikethrough),
              'Mod-k': toggleLink(this.$refs.linkDialog),
            }),
            keymap(baseKeymap),
            history(),
            placeholderPlugin(this, this.isReply ? this.$gettext("comment-reply-hint") : this.$gettext("comment-hint")),
          ],
        });

        return state;
      },

      stateUpdated() {
        // Empty content has size 4 with current schema.
        this.isEmpty = this.$editorView.state.doc.nodeSize === 4;
      },

      onLinkInserted(link) {
        clearLink(this.$editorView);
        toggleMark(this.$editorView.state.schema.marks.link, {href: link})(this.$editorView.state, this.$editorView.dispatch);
      },

      onLinkRemoved() {
        clearLink(this.$editorView);
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .comment-editor {
    .empty-node::before {
      float: left;
      color: #aaa;
      pointer-events: none;
      height: 0;
    }

    .empty-node:hover::before {
      color: #777;
    }

    h1.empty-node::before {
      content: attr(data-text);
    }

    p.empty-node:first-of-type::before {
      content: attr(data-text);
    }
  }
</style>
