<template>
  <div>
    <div id="tools" style="margin-bottom:25px">
      <v-toolbar
        :class="{'toolbar-fixed':fixToolbarToTop}"
        prominent
        card color="white"
        class="editor-toolbar"
        v-scroll="onScroll"
        :style="toolbarWidth"
        ref="editorToolbar">
        <v-btn id="undo" flat>
          <v-icon>undo</v-icon>
        </v-btn>

        <v-btn id="redo" flat>
          <v-icon>redo</v-icon>
        </v-btn>

        <div class="toolbar-gap" />

        <v-btn id="bold" flat>
          <v-icon>format_bold</v-icon>
        </v-btn>

        <v-btn id="italic" flat>
          <v-icon>format_italic</v-icon>
        </v-btn>

        <v-btn id="strikethrough" flat>
          <v-icon>strikethrough_s</v-icon>
        </v-btn>

        <div class="toolbar-gap" />

        <v-btn id="h1" icon>
          h1
        </v-btn>

        <v-btn id="h2" flat>
          h2
        </v-btn>

        <v-btn id="h3" flat>
          h3
        </v-btn>

        <div class="toolbar-gap" />

        <v-btn id="link" flat>
          <v-icon>insert_link</v-icon>
        </v-btn>

        <v-btn id="blockquote" flat>
          <v-icon>format_quote</v-icon>
        </v-btn>

        <div class="toolbar-gap" />

        <v-btn id="bullet" flat>
          <v-icon>format_list_bulleted</v-icon>
        </v-btn>

        <v-btn id="order" flat>
          <v-icon>format_list_numbered</v-icon>
        </v-btn>
      </v-toolbar>
      <v-divider
        class="editor-divider"
        :class="{'editor-divider-fixed':fixToolbarToTop}"
        :style="toolbarWidth"
        ref="editorDivider"
      />
      <div style="height: 64px;" v-if="fixToolbarToTop" />
    </div>

    <div id="editor" ref="editor" class="editor" />

  </div>
</template>

<script>
  import {Random} from 'meteor/random';
  import {Tracker} from 'meteor/tracker';
  import {_} from 'meteor/underscore';

  import {wrapInList, sinkListItem, liftListItem, splitListItem} from "prosemirror-schema-list";
  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';
  import {dropCursor} from 'prosemirror-dropcursor';
  import {gapCursor} from 'prosemirror-gapcursor';
  import collab from 'prosemirror-collab';
  import {toggleMark, baseKeymap} from "prosemirror-commands";

  // TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
  //       See: https://github.com/meteor/meteor-feature-requests/issues/218
  import 'prosemirror-view/style/prosemirror.css';
  import 'prosemirror-gapcursor/style/gapcursor.css';

  import {peerDocSchema} from '/lib/schema.js';
  import {Content} from '/lib/content';

  import {menuPlugin, heading, toggleBlockquote} from './utils/menu.js';
  import offsetY from './utils/sticky-scroll';

  // @vue/component
  const component = {
    props: {
      contentKey: {
        type: String,
        required: true,
      },
    },

    data() {
      return {
        subscriptionHandle: null,
        addingStepsInProgress: false,
        fixToolbarToTop: false,
        originalToolbarYPos: -1,
        toolbarWidth: {width: '100%'},
      };
    },

    created() {
      this.$autorun((computation) => {
        this.subscriptionHandle = this.$subscribe('Content.feed', {contentKey: this.contentKey});
      });
    },

    mounted() {
      const menu = menuPlugin([
        {command: toggleMark(peerDocSchema.marks.strong), dom: document.getElementById("bold"), mark: peerDocSchema.marks.strong},
        {command: toggleMark(peerDocSchema.marks.em), dom: document.getElementById("italic"), mark: peerDocSchema.marks.em},
        {command: undo, dom: document.getElementById("undo")},
        {command: redo, dom: document.getElementById("redo")},
        heading(1, peerDocSchema),
        heading(2, peerDocSchema),
        heading(3, peerDocSchema),
        {command: toggleMark(peerDocSchema.marks.strikethrough), dom: document.getElementById("strikethrough"), mark: peerDocSchema.marks.strikethrough},
        {command: toggleBlockquote(), dom: document.getElementById("blockquote"), node: peerDocSchema.nodes.blockquote},
        {command: wrapInList(peerDocSchema.nodes.bullet_list), dom: document.getElementById("bullet"), node: peerDocSchema.nodes.bullet_list},
        {command: wrapInList(peerDocSchema.nodes.ordered_list), dom: document.getElementById("order"), node: peerDocSchema.nodes.ordered_list},
      ]);

      const state = EditorState.create({
        schema: peerDocSchema,
        plugins: [
          keymap({
            Enter: splitListItem(peerDocSchema.nodes.list_item),
            Tab: sinkListItem(peerDocSchema.nodes.list_item),
            'Shift-Tab': liftListItem(peerDocSchema.nodes.list_item),
            'Mod-z': undo,
            'Shift-Mod-z': redo,
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history(),
          menu,
          collab.collab({
            clientID: Random.id(),
          }),
        ],
      });


      const view = new EditorView({mount: this.$refs.editor}, {
        state,
        dispatchTransaction: (transaction) => {
          const newState = view.state.apply(transaction);
          view.updateState(newState);
          const sendable = collab.sendableSteps(newState);
          if (sendable) {
            this.addingStepsInProgress = true;
            Content.addSteps({
              contentKey: this.contentKey,
              currentVersion: sendable.version,
              steps: sendable.steps,
              clientId: sendable.clientID,
            }, (error, stepsAdded) => {
              this.addingStepsInProgress = false;
              // TODO: Error handling.
            });
          }
        },
      });

      this.toolbarWidth.width = `${this.$refs.editor.offsetWidth}px`;
      window.addEventListener('resize', this.handleWindowResize);
      this.$autorun((computation) => {
        if (this.addingStepsInProgress) {
          return;
        }

        // To register dependency on the latest version available from the server.
        const versions = _.pluck(Content.documents.find(this.subscriptionHandle.scopeQuery(), {fields: {version: 1}}).fetch(), 'version');

        // We want all versions to be available without any version missing, before we start applying them.
        // TODO: We could also just apply the initial consecutive set of versions we might have.
        //       Even if later on there is one missing.
        if (_.min(versions) !== 0) {
          return;
        }
        if (versions.length !== _.max(versions) + 1) {
          return;
        }

        Tracker.nonreactive(() => {
          const newContents = Content.documents.find(_.extend(this.subscriptionHandle.scopeQuery(), {
            version: {
              $gt: collab.getVersion(view.state),
            },
          }), {
            sort: {
              version: 1,
            },
          }).fetch();

          if (newContents.length) {
            view.dispatch(collab.receiveTransaction(view.state, _.pluck(newContents, 'step'), _.pluck(newContents, 'clientId')));
          }
        });
      });
    },
    beforeDestroy() {
      window.removeEventListener('resize', this.handleWindowResize);
    },
    methods: {
      onScroll(e) {
        if (!this.$refs || !this.$refs.editorToolbar) {
          return;
        }

        if (!this.fixToolbarToTop && this.originalToolbarYPos < 0) {
          this.originalToolbarYPos = offsetY(this.$refs.editorToolbar.$el);
        }
        const shouldFixToolbar = window.pageYOffset >= this.originalToolbarYPos;

        this.fixToolbarToTop = shouldFixToolbar;
      },
      handleWindowResize(e) {
        this.toolbarWidth.width = `${this.$refs.editor.offsetWidth}px`;
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .editor {
    p {
      margin-bottom: 0;
    }

    del {
      text-decoration: line-through;
    }

    blockquote {
      padding-left: 1em;
      border-left: 3px solid #eee;
      margin-left: 0;
      margin-right: 0;
    }

    ul, ol {
      padding-left: 1em;
      border-left: 3px;
      margin-left: 0;
      margin-right: 0;
    }
  }

  .toolbar-fixed {
    z-index: 2;
    top: 0;
    position: fixed;
  }

  .editor-toolbar {
    box-shadow: 0 3px 1px -2px rgba(0,0,0,.2),0 2px 2px 0 rgba(0,0,0,.14),0 1px 5px 0 rgba(0,0,0,.12);
  }

  .editor-toolbar .btn--flat {
    height: 36px;
    width: 36px;
    justify-content: center;
    min-width: 0;
    opacity: 0.4;
  }

  .editor-toolbar .btn--flat.btn--active {
    opacity: 1;
  }

  .toolbar-gap {
    margin: 6px 12px;
  }

  .editor-divider-fixed {
    position: fixed;
    z-index: 2;
    top: 64px;
  }
</style>
