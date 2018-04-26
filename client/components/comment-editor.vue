<template>
  <div ref="commentBody">{{comment.body}}</div>
</template>

<script>

  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {DOMParser, DOMSerializer} from "prosemirror-model";
  import {schema} from './utils/comment-schema.js';

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
    },
  };

  export default component;
</script>
