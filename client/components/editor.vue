<template>
  <div>
    <div id="tools" style="margin-bottom:25px">
      <v-toolbar
        card color="gray"
        prominent
        :fixed="fixToolbarToTop"
        v-scroll="onScroll"
        ref="editorToolbar">
        <v-btn id="bold" icon>
          <v-icon>format_bold</v-icon>
        </v-btn>

        <v-btn id="italic" icon>
          <v-icon>format_italic</v-icon>
        </v-btn>

        <v-btn id="strikeout" icon>
          <v-icon>format_strikethrough</v-icon>
        </v-btn>

        <v-btn id="paragraph" icon>
          p
        </v-btn>

        <v-btn id="blockquote" icon>
          <v-icon>format_quote</v-icon>
        </v-btn>

        <v-btn id="bullet" icon>
          <v-icon>format_list_bulleted</v-icon>
        </v-btn>

        <v-btn id="order" icon>
          <v-icon>format_list_numbered</v-icon>
        </v-btn>

        <v-btn id="sink" flat>
          sink
        </v-btn>

        <v-btn id="split" flat>
          split
        </v-btn>

        <v-btn id="lift" flat>
          lift
        </v-btn>

        <v-btn id="link" icon>
          <v-icon>insert_link</v-icon>
        </v-btn>

        <v-btn id="h1" icon>
          h1
        </v-btn>

        <v-btn id="h2" icon>
          h2
        </v-btn>

        <v-btn id="h3" icon>
          h3
        </v-btn>

        <v-btn id="undo" icon>
          <v-icon>undo</v-icon>
        </v-btn>

        <v-btn id="redo" icon>
          <v-icon>redo</v-icon>
        </v-btn>

      </v-toolbar>
      <!-- <v-divider></v-divider> -->
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
  import {wrapIn, toggleMark, setBlockType, baseKeymap} from "prosemirror-commands";

  // TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
  //       See: https://github.com/meteor/meteor-feature-requests/issues/218
  import 'prosemirror-view/style/prosemirror.css';
  import 'prosemirror-gapcursor/style/gapcursor.css';

  import {peerDocSchema} from '/lib/schema.js';
  import {Content} from '/lib/content';
  import {menuPlugin, heading, toggleLink} from './utils/menu.js';


// little helper function for measuring Y offset of element on viewport
// See https://plainjs.com/javascript/styles/get-the-position-of-an-element-relative-to-the-document-24/
function offsetY(el) {
	    var rect = el.getBoundingClientRect(),
	    scrollTop = window.pageYOffset || document.documentElement.scrollTop;
	    return rect.top + scrollTop;
	}

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
        originalToolbarYPos: -1
      };
    },

    created() {
      this.$autorun((computation) => {
        this.subscriptionHandle = this.$subscribe('Content.feed', {contentKey: this.contentKey});
      });
    },

    mounted() {
      const menu = menuPlugin([
        {command: toggleMark(peerDocSchema.marks.strong), dom: document.getElementById("bold")},
        {command: toggleMark(peerDocSchema.marks.em), dom: document.getElementById("italic")},
        {command: undo, dom: document.getElementById("undo")},
        {command: redo, dom: document.getElementById("redo")},
        heading(1, peerDocSchema),
        heading(2, peerDocSchema),
        heading(3, peerDocSchema),
        {command: toggleMark(peerDocSchema.marks.strikeout), dom: document.getElementById("strikeout")},
        {command: setBlockType(peerDocSchema.nodes.paragraph), dom: document.getElementById("paragraph")},
        {command: wrapIn(peerDocSchema.nodes.blockquote), dom: document.getElementById("blockquote")},
        {command: toggleLink(peerDocSchema), dom: document.getElementById("link")},
        {command: wrapInList(peerDocSchema.nodes.bullet_list), dom: document.getElementById("bullet")},
        {command: wrapInList(peerDocSchema.nodes.ordered_list), dom: document.getElementById("order")},
        {command: liftListItem(peerDocSchema.nodes.list_item), dom: document.getElementById("lift")},
        {command: sinkListItem(peerDocSchema.nodes.list_item), dom: document.getElementById("sink")},
        {command: splitListItem(peerDocSchema.nodes.list_item), dom: document.getElementById("split")},
      ]);

      const state = EditorState.create({
        schema: peerDocSchema,
        plugins: [
          keymap({
            'Mod-z': undo,
            'Mod-y': redo, // TODO: shift+mod+z
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
    methods: {
        onScroll(e) {
          if(!this.$refs || !this.$refs.editorToolbar || !this.$refs.editorToolbar.$el) {
            return;
          } 
          if(!this.fixToolbarToTop && this.originalToolbarYPos < 0) {
            this.originalToolbarYPos = offsetY(this.$refs.editorToolbar.$el);
          }
          const windowOffset = window.pageYOffset;
          this.fixToolbarToTpop = windowOffset >= this.originalToolbarYPos;
        }
      }
  };

  export default component;
</script>

<style lang="scss">
  .editor > p:last-child {
    margin-bottom: 0;
  }
  strikeout { text-decoration:line-through; }
  .ProseMirror blockquote {
    padding-left: 1em;
    border-left: 3px solid #eee;
    margin-left: 0; margin-right: 0;
  }
  .ProseMirror ul, ol {
    padding-left: 1em;
    border-left: 3px;
    margin-left: 0; margin-right: 0;
  }
</style>
