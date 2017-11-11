<template>
  <div class="editor"></div>
</template>

<script>
  import {schema} from 'prosemirror-schema-basic';
  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';
  import {baseKeymap} from 'prosemirror-commands';
  import {dropCursor} from 'prosemirror-dropcursor';
  import {gapCursor} from 'prosemirror-gapcursor';

  const component = {
    props: {
      contentKey: {
        type: String,
        required: true
      }
    },

    mounted() {
      const state = EditorState.create({
        schema,
        plugins: [
          keymap({
            'Mod-z': undo,
            'Mod-y': redo
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history()
        ]
      });
      const view = new EditorView({mount: this.$el}, {
        state
      });
    }
  };

  export default component;
</script>

<style lang="stylus">
  .editor > p:last-child
    margin-bottom 0
</style>