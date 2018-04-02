<template>
  <v-card>
    <div class="editor__toolbar">
      <v-toolbar
        card
        id="tools"
      >
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

        <v-btn id="h1" flat>
          h1
        </v-btn>

        <v-btn id="h2" flat>
          h2
        </v-btn>

        <v-btn id="h3" flat>
          h3
        </v-btn>

        <div class="toolbar-gap" />

        <v-btn id="link" flat @click.stop="openLinkDialog">
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
      <v-divider />
    </div>

    <v-card-text id="editor" ref="editor" class="editor" />

    <v-menu
      offset-x
      :close-on-content-click="false"
      :nudge-width="200"
      nudge-right="10"
      nudge-top="-20"
      v-model="commentDialog"
      ref="addCommentButton"
      class="btn-comment"
    >
      <v-btn
        color="white"
        small
        bottom
        right
        fab
        slot="activator"
      >
        <v-icon>comment</v-icon>
      </v-btn>
      <v-card>
        <v-card-text style="padding-bottom:0px">
          <v-form @submit.prevent="insertComment">
            <v-text-field
              style="padding-top:0px"
              autofocus
              multi-line
              rows="2"
              v-model="comment"
              placeholder="Comment..."
              required
            />
          </v-form>
        </v-card-text>
        <v-card-actions style="padding-top:0px">
          <v-btn color="secondary" flat @click="cancelComment">Cancel</v-btn>
          <v-btn color="primary" flat @click="insertComment">Insert</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <v-dialog hide-overlay v-model="linkDialog" max-width="500px">
      <v-card>
        <v-card-text>
          <v-form v-model="validLink" @submit.prevent="insertLink">
            <v-text-field
              autofocus
              placeholder="http://"
              v-model="link"
              :hint="linkHint"
              :hide-details="link === ''"
              single-line
              required
              prepend-icon="link"
              :rules="[linkValidationRule]"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn color="secondary" flat @click="cancelLink"><translate>cancel</translate></v-btn>
          <v-btn color="error" flat @click="removeLink" v-if="Boolean(selectedExistingLinks.length)"><translate>remove</translate></v-btn>
          <v-btn color="primary" flat @click="insertLink" :disabled="!validLink"><translate>insert</translate></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script>
  import {Random} from 'meteor/random';
  import {Tracker} from 'meteor/tracker';
  import {_} from 'meteor/underscore';

  import {wrapInList, sinkListItem, liftListItem, splitListItem} from "prosemirror-schema-list";
  import {EditorState, TextSelection} from 'prosemirror-state';
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

  import {schema} from '/lib/schema.js';
  import {Comment} from '/lib/documents/comment';
  import {Content} from '/lib/documents/content';
  import {Cursor} from '/lib/documents/cursor';

  import {menuPlugin, heading, toggleBlockquote, toggleLink} from './utils/menu.js';
  import PlaceholderPlugin from './utils/placeholder.js';
  import {cursorsPlugin} from './utils/cursors-plugin';
  import {commentPlugin} from './utils/comment-plugin';
  import addCommentPlugin, {addHighlight, removeHighlight, updateChunks} from './utils/add-comment-plugin';

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
      readOnly: {
        type: Boolean,
        default: false,
      },
      clientId: {
        type: String,
        required: true,
      },
      focusedCursor: {
        type: Object,
        required: false,
        default: null,
      },
    },

    data() {
      return {
        subscriptionHandle: null,
        commentsHandle: null,
        addingStepsInProgress: false,
        addingCommentsInProgress: false,
        fixToolbarToTop: false,
        originalToolbarYPos: -1,
        cursorsHandle: null,
        dipatch: null,
        state: null,
        link: '',
        linkDialog: false,
        linkHint: this.$gettext("link-hint"),
        commentDialog: false,
        comment: '',
        selectedExistingLinks: [],
        selectedExistingHighlights: [],
        validLink: false,
        linkValidationRule: (value) => {
          const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i;
          return urlRegex.test(value) || this.$gettext("invalid-url");
        },
      };
    },

    watch: {
      focusedCursor(newCursor, oldCursor) {
        // If we receive a new focused cursor we scroll the editor to its position.
        if (newCursor) {
          const {tr} = this.state;
          tr.setSelection(TextSelection.create(tr.doc, newCursor.head));
          tr.scrollIntoView();
          this.dispatch(tr);
        }
      },
    },

    created() {
      this.$autorun((computation) => {
        this.subscriptionHandle = this.$subscribe('Content.list', {contentKey: this.contentKey});
      });

      this.$autorun((computation) => {
        this.commentsHandle = this.$subscribe('Comment.list', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        this.cursorsHandle = this.$subscribe('Cursor.list', {contentKey: this.contentKey});
      });
    },

    mounted() {
      const menu = menuPlugin([
        {command: toggleMark(schema.marks.strong), dom: document.getElementById("bold"), mark: schema.marks.strong},
        {command: toggleMark(schema.marks.em), dom: document.getElementById("italic"), mark: schema.marks.em},
        {command: undo, dom: document.getElementById("undo")},
        {command: redo, dom: document.getElementById("redo")},
        heading(1, schema),
        heading(2, schema),
        heading(3, schema),
        {command: toggleMark(schema.marks.strikethrough), dom: document.getElementById("strikethrough"), mark: schema.marks.strikethrough},
        {command: toggleBlockquote(), dom: document.getElementById("blockquote"), node: schema.nodes.blockquote},
        {
          command: toggleLink(schema, false),
          dom: document.getElementById("link"),
          mark: schema.marks.link,
          attr: {link: true},
        },
        {command: wrapInList(schema.nodes.bullet_list), dom: document.getElementById("bullet"), node: schema.nodes.bullet_list},
        {command: wrapInList(schema.nodes.ordered_list), dom: document.getElementById("order"), node: schema.nodes.ordered_list},
      ], this);

      const state = EditorState.create({
        schema,
        plugins: [
          keymap({
            Enter: splitListItem(schema.nodes.list_item),
            Tab: sinkListItem(schema.nodes.list_item),
            'Shift-Tab': liftListItem(schema.nodes.list_item),
            'Mod-z': undo,
            'Shift-Mod-z': redo,
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history(),
          commentPlugin(this),
          menu,
          addCommentPlugin(this),
          PlaceholderPlugin,
          collab.collab({
            clientID: this.clientId,
          }),
          cursorsPlugin,
        ],
      });

      const updateUserPosition = (selection, contentKey, clientId) => {
        // update user current position
        const {head, ranges} = selection;
        const rangesArray = ranges.map((r) => {
          return {beginning: r.$from.pos, end: r.$to.pos};
        });
        Cursor.update({
          contentKey,
          clientId,
          head,
          ranges: rangesArray,
        });
      };

      const throttledUpdateUserPosition = _.throttle(updateUserPosition, 500);

      const view = new EditorView({mount: this.$refs.editor}, {
        state,
        dispatchTransaction: (transaction) => {
          const newState = view.state.apply(transaction);
          view.updateState(newState);
          this.state = newState;
          const sendable = collab.sendableSteps(newState);
          const {clientId} = this;
          if (sendable) {
            const commentMarks = _.filter(transaction.steps, (s) => {
              return s.mark && s.mark.type.name === "comment";
            });
            if (commentMarks) {
              commentMarks.forEach((c) => {
                const highlightKey = c.mark.attrs["highlight-keys"];
                Comment.setInitialVersion({
                  highlightKey,
                  version: sendable.version,
                });
              });
            }
            this.addingStepsInProgress = true;
            Content.addSteps({
              contentKey: this.contentKey,
              currentVersion: sendable.version,
              steps: sendable.steps,
              clientId,
            }, (error, stepsAdded) => {
              this.addingStepsInProgress = false;
              // TODO: Error handling.
            });
            this.$emit("contentChanged");
          }
          throttledUpdateUserPosition(newState.selection, this.contentKey, this.clientId);
        },
        editable: () => {
          return !!(!this.readOnly && this.$currentUserId);
        },
      });
      this.state = view.state;
      this.dispatch = view.dispatch;

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

      this.$autorun((computation) => {
        let positions = Cursor.documents.find(_.extend(this.cursorsHandle.scopeQuery(), {
          clientId: {
            $ne: this.clientId,
          },
        })).map((c) => {
          return {
            head: c.head,
            ranges: c.ranges,
            color: c.color,
            username: c.author ? c.author.username : null,
            avatar: c.author ? c.author.avatarUrl() : null,
          };
        });

        const {tr} = view.state;
        positions = positions || [];
        tr.setMeta(cursorsPlugin, positions);
        view.dispatch(tr);
      });
    },

    beforeDestroy() {
      Cursor.remove({contentKey: this.contentKey, clientId: this.clientId});
    },

    methods: {
      onScroll(e) {
        // emit scroll event to notify parent component
        this.$emit("scroll");
      },

      insertLink() {
        let {link} = this;
        if (this.selectedExistingLinks) {
          // ProseMirror requires for the previous mark to be removed
          // before adding a new mark
          this.clearLink();
          this.selectedExistingLinks = [];
        }
        if (link !== '' && this.linkValidationRule(link) === true) {
          link = link.match(/^[a-zA-Z]+:\/\//) ? link : `http://${link}`;
          toggleLink(schema, true, link)(this.state, this.dispatch);
          this.linkDialog = false;
          this.link = '';
        }
      },

      insertComment() {
        const {comment} = this;
        const {selection} = this.state;
        if (selection.empty) {
          return;
        }

        const key = Random.id();
        this.commentDialog = false;
        this.comment = '';
        Comment.create({
          highlightKey: key,
          body: comment,
          documentId: this.documentId,
        });

        let newChunks = [{
          from: selection.from,
          to: selection.to,
          empty: true,
        }];

        if (this.selectedExistingHighlights) {
          // Change existing highlight marks to add the new highlight-key after their current highlight-keys.
          this.selectedExistingHighlights.forEach((highlightMark) => {
            const {start, size, marks} = highlightMark;
            const end = start + size;
            const chunkToSplit = newChunks.find((chunk) => {
              return chunk.from <= start && chunk.to >= end;
            });
            if (chunkToSplit) {
              // update collection to reflect new segments of the selection with previous highlight marks
              newChunks = updateChunks(newChunks, chunkToSplit, {from: start, to: end});
            }

            const currentKey = marks[0].attrs["highlight-keys"];
            removeHighlight(schema, this.state, start, end, this.dispatch);
            addHighlight(`${currentKey},${key}`, schema, this.state, start, end, this.dispatch);
          });
        }
        newChunks.filter((chunk) => {
          return chunk.empty; // only add a new highlight mark to segments with no previous highlight marks
        }).forEach((chunk) => {
          addHighlight(key, schema, this.state, chunk.from, chunk.to, this.dispatch);
        });
      },

      removeLink() {
        this.clearLink();
        this.linkDialog = false;
        this.link = '';
        // prevent bug where the whole paragraph is selected after removing
        // links from a certain selected area of a paragraph
        const {tr} = this.state;
        tr.setSelection(TextSelection.create(this.state.doc, 0));
        this.dispatch(tr);
        window.getSelection().empty();
      },

      clearLink() {
        const {tr} = this.state;
        const {from: currentFrom, to: currentTo} = this.state.selection;
        this.selectedExistingLinks.forEach(({position}) => {
          const {from: fromPos, to: toPos} = position;
          // only remove full link if the user did not make a selection
          // and just left the cursor over a single character of the link
          // otherwise, just remove selected portion
          if (this.state.selection.$cursor) {
            tr.removeMark(fromPos, toPos);
          }
          else {
            tr.removeMark(currentFrom, currentTo);
          }
        });
        let selection = TextSelection.create(this.state.doc, currentFrom, currentTo);
        if (
          this.state.selection.$cursor &&
          this.selectedExistingLinks.length > 0) {
          const {position} = this.selectedExistingLinks[0];
          const {from: fromPos, to: toPos} = position;
          selection = TextSelection.create(this.state.doc, fromPos, toPos);
        }
        tr.setSelection(selection);
        this.dispatch(tr);
      },

      cancelLink() {
        this.linkDialog = false;
        this.link = '';
      },

      cancelComment() {
        this.commentDialog = false;
        this.comment = '';
      },

      openLinkDialog() {
        if (this.selectedExistingLinks.length &&
        this.selectedExistingLinks.length === 1) {
          // preload link value if a single existing link is selected
          this.link = this.selectedExistingLinks[0].href;
        }
        this.linkDialog = true;
      },

      openCommentDialog() {
        this.commentDialog = true;
      },

      filterComments(keys) {
        if (!this.state) {
          return;
        }
        // Set final version for any orphan Comment that could stay in db.
        Comment.filterOrphan({
          documentId: this.documentId,
          highlightKeys: keys,
          version: collab.getVersion(this.state),
        });
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .editor {
    outline: none;

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

    a {
      cursor: text !important;
    }
  }

  .editor__toolbar {
    position: sticky;
    top: 0;
    z-index: 10;

    .btn--flat {
      height: 36px;
      width: 36px;
      justify-content: center;
      min-width: 0;
      opacity: 0.4;
    }

    .btn--flat.btn--active {
      opacity: 1;
    }
  }

  .toolbar-gap {
    margin: 6px 12px;
  }

  .btn-comment {
    left: 100%;
    z-index: 25;
    margin-top: 33px;
  }

  .fade {
   opacity: 1;
   transition: opacity 2s ease-in-out;
  }

  .highlight {
    background: #ffe168;
    border-bottom: 1px solid #f22;
    margin-bottom: -1px;
  }

  .user-selection {
    background: #fdd;
  }

  .caret-container {
    display: inline-block;
    position: absolute;
    cursor: text;
    opacity: 1;
    user-select: none;
  }

  .caret-head {
    display: flex;
    background-color: rgb(255, 0, 122);
    opacity: 1;
    width: 6px;
    height: 6px;
    font-size: 0;
  }

  .caret-body {
    border-color: rgb(255, 0, 122);
    opacity: 1;
    height: 17.6px;
    width: 0px;
    border-left: 2px solid;
    border-left-color: rgb(255, 0, 122);
    font-size: 0;
    padding: 5px;
  }

  .caret-body:hover + .caret-name {
    visibility: visible;
    opacity: 1;
    transition: opacity 250ms linear;
  }

  .caret-name {
    background-color: rgb(255, 0, 122);
    padding: 2px;
    white-space: nowrap;
    font-size: 10px;
    position: absolute;
    top: -22px;
    user-select: none;
    visibility: hidden;
    display: flex;
    opacity: 0;
    transition: visibility 0s 750ms, opacity 750ms linear;
    align-items: center;
  }

  .caret-img {
    border-radius: 50%;
    user-select: none;
  }

  .caret-username {
    margin-left: 5px;
    user-select: none;
  }

  .editor .empty-node::before {
    float: left;
    color: #aaa;
    pointer-events: none;
    height: 0;
  }

  .editor .empty-node:hover::before {
    color: #777;
  }

  .editor h1.empty-node::before {
    content: 'Choose a title';
  }

  .editor p.empty-node:first-of-type::before {
    content: 'Edit content';
  }
</style>
