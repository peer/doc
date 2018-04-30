<template>
  <div ref="commentBody" class="comment-editor"/>
</template>

<script>

  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {DOMParser, DOMSerializer} from "prosemirror-model";
  import {baseKeymap, toggleMark} from "prosemirror-commands";
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';
  import {schema} from './utils/comment-schema.js';
  import {placeholderPlugin} from './utils/placeholder.js';

  // @vue/component
  const component = {
    props: {
      comment: {
        type: Object,
        required: true,
      },
      readOnly: {
        type: Boolean,
        required: true,
      },
    },

    data() {
      return {
        isEmpty: true,
      };
    },

    mounted() {
      if (this.readOnly) {
        this.createReadOnlyEditor();
      }
      else {
        this.createEditor();
      }
    },
    methods: {
      createEditor() {
        const state = EditorState.create({
          schema,
          plugins: [
            keymap({
              'Mod-z': undo,
              'Shift-Mod-z': redo,
              'Mod-b': toggleMark(schema.marks.strong),
              'Mod-i': toggleMark(schema.marks.em),
              'Mod-u': toggleMark(schema.marks.strikethrough),
            }),
            keymap(baseKeymap),
            history(),
            placeholderPlugin(this, "", this.comment.dummy ? this.$gettext("comment-hint") : this.$gettext("comment-reply-hint")),
          ],
        });
        this.$editorView = new EditorView({mount: this.$refs.commentBody}, {
          state,
          dispatchTransaction: (transaction) => {
            const newState = this.$editorView.state.apply(transaction);
            this.$editorView.updateState(newState);
            this.$editorView.state = newState;

            const fragment = DOMSerializer.fromSchema(schema).serializeFragment(newState.doc.content);
            const tmp = document.createElement("div");
            tmp.appendChild(fragment);
            this.comment.input = tmp.innerHTML;
            this.checkContent();
          },
          editable: () => {
            return true;
          },
        });
      },
      createReadOnlyEditor() {
        // Prosemirror editor is prepared to show the comment body.
        // A dummy html node is created to parse the comment body.
        const domNode = document.createElement("div");
        domNode.innerHTML = this.comment.body;
        this.isEmpty = this.comment.body === '<p></p>';
        const state = EditorState.create({
          schema,
          doc: DOMParser.fromSchema(schema).parse(domNode),
        });
        this.$editorView = new EditorView({mount: this.$refs.commentBody}, {
          state,
          editable: () => {
            return false;
          },
        });
      },

      checkContent() {
        const wasEmpty = this.isEmpty;
        this.isEmpty = this.comment.input === '<p></p>';
        if (this.isEmpty !== wasEmpty) {
          if (this.isEmpty) {
            this.$emit("empty");
          }
          else {
            this.$emit("contentDetected");
          }
        }
      },

      clearEditor() {
        const {tr} = this.$editorView.state;
        tr.delete(0, tr.doc.content.size);
        this.$editorView.dispatch(tr);
      },

    },
  };

  export default component;
</script>
<style>
  .comment-editor .empty-node::before {
    float: left;
    color: #aaa;
    pointer-events: none;
    height: 0;
  }

  .comment-editor .empty-node:hover::before {
    color: #777;
  }

  .comment-editor h1.empty-node::before {
    content: attr(data-text);
  }

  .comment-editor p.empty-node:first-of-type::before {
    content: attr(data-text);
  }
</style>
