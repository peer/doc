<template>
  <v-card>
    <div class="editor__toolbar">
      <v-toolbar
        card
        dense
      >
        <v-btn-toggle>
          <v-btn
            ref="buttonUndo"
            :disabled="!canUserUpdateDocument || disabledButtons.undo"
            :title="undoHint"
            flat
          ><v-icon>undo</v-icon></v-btn>
          <v-btn
            ref="buttonRedo"
            :disabled="!canUserUpdateDocument || disabledButtons.redo"
            :title="redoHint"
            flat
          ><v-icon>redo</v-icon></v-btn>
        </v-btn-toggle>

        <v-btn-toggle
          ref="formatting"
          :class="{'btn-toggle--selected': formattingIsActive}"
        >
          <v-btn
            ref="buttonStrong"
            :disabled="!canUserUpdateDocument || disabledButtons.strong"
            :title="strongHint"
            flat
            @input="onButtonChange('formatting')"
          ><v-icon>format_bold</v-icon></v-btn>
          <v-btn
            ref="buttonEm"
            :disabled="!canUserUpdateDocument || disabledButtons.em"
            :title="emHint"
            flat
            @input="onButtonChange('formatting')"
          ><v-icon>format_italic</v-icon></v-btn>
          <v-btn
            ref="buttonStrikethrough"
            :disabled="!canUserUpdateDocument || disabledButtons.strikethrough"
            :title="strikethroughHint"
            flat
            @input="onButtonChange('formatting')"
          ><v-icon>strikethrough_s</v-icon></v-btn>
        </v-btn-toggle>

        <v-btn-toggle
          ref="link"
          :class="{'btn-toggle--selected': linkIsActive}"
        >
          <v-btn
            ref="buttonLink"
            :disabled="!canUserUpdateDocument || disabledButtons.link"
            :title="linkHint"
            flat
            @input="onButtonChange('link')"
          ><v-icon>insert_link</v-icon></v-btn>
        </v-btn-toggle>

        <v-btn-toggle
          ref="heading"
          :class="{'btn-toggle--selected': headingIsActive}"
        >
          <v-btn
            ref="buttonH1"
            :disabled="!canUserUpdateDocument || disabledButtons.h1"
            :title="h1Hint"
            flat
            @input="onButtonChange('heading')"
          ><translate>h1</translate></v-btn>
          <v-btn
            ref="buttonH2"
            :disabled="!canUserUpdateDocument || disabledButtons.h2"
            :title="h2Hint"
            flat
            @input="onButtonChange('heading')"
          ><translate>h2</translate></v-btn>
          <v-btn
            ref="buttonH3"
            :disabled="!canUserUpdateDocument || disabledButtons.h3"
            :title="h3Hint"
            flat
            @input="onButtonChange('heading')"
          ><translate>h3</translate></v-btn>
        </v-btn-toggle>

        <v-btn-toggle
          ref="block"
          :class="{'btn-toggle--selected': blockIsActive}"
        >
          <v-btn
            ref="buttonQuote"
            :disabled="!canUserUpdateDocument || disabledButtons.quote"
            :title="quoteHint"
            flat
            @input="onButtonChange('block')"
          ><v-icon>format_quote</v-icon></v-btn>
          <v-btn
            ref="buttonBulletedList"
            :disabled="!canUserUpdateDocument || disabledButtons.bulletedList"
            :title="bulletedListHint"
            flat
            @input="onButtonChange('block')"
          ><v-icon>format_list_bulleted</v-icon></v-btn>
          <v-btn
            ref="buttonNumberedList"
            :disabled="!canUserUpdateDocument || disabledButtons.numberedList"
            :title="numberedListHint"
            flat
            @input="onButtonChange('block')"
          ><v-icon>format_list_numbered</v-icon></v-btn>
        </v-btn-toggle>

        <v-spacer />

        <div
          v-translate
          v-if="canUserUpdateDocument && unconfirmedCount"
          class="editor__saving text--secondary"
        >editor-saving</div>
        <div
          v-translate
          v-else-if="canUserUpdateDocument"
          class="editor__saving text--secondary"
        >editor-saved</div>

        <div class="editor__users">
          <v-btn
            v-for="cursor of cursors"
            :key="cursor._id"
            :style="{borderColor: cursor.color}"
            flat
            icon
            @click="onAvatarClicked(cursor)"
          >
            <v-avatar size="36px"><img
              :src="cursor.author.avatarUrl()"
              :alt="cursor.author.username"
              :title="cursor.author.username"
            ></v-avatar>
          </v-btn>
        </div>
      </v-toolbar>
      <v-divider />
    </div>

    <v-card-text
      ref="editor"
      class="editor"
    />

    <link-dialog
      ref="linkDialog"
      @link-inserted="onLinkInserted"
      @link-removed="onLinkRemoved"
    />
  </v-card>
</template>

<script>
  import {Tracker} from 'meteor/tracker';
  import {_} from 'meteor/underscore';

  import {sinkListItem, liftListItem, splitListItem} from 'prosemirror-schema-list';
  import {EditorState, TextSelection} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';
  import {dropCursor} from 'prosemirror-dropcursor';
  import {gapCursor} from 'prosemirror-gapcursor';
  import collab from 'prosemirror-collab';
  import {Step} from 'prosemirror-transform';
  import {toggleMark, baseKeymap} from 'prosemirror-commands';

  import {schema} from '/lib/full-schema.js';
  import {Comment} from '/lib/documents/comment';
  import {Content} from '/lib/documents/content';
  import {Cursor} from '/lib/documents/cursor';
  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

  import {menuPlugin, isMarkActive, hasMark, toggleHeading, isHeadingActive, toggleBlockquote, isBlockquoteActive, toggleList, isListActive} from './utils/menu.js';
  import {placeholderPlugin} from './utils/placeholder.js';
  import {cursorsPlugin} from './utils/cursors-plugin';
  import {commentPlugin} from './utils/comment-plugin';
  import {titleSizePlugin} from './utils/title-size-plugin.js';
  import addCommentPlugin, {addHighlight, removeHighlight} from './utils/add-comment-plugin';
  import {toggleLink, clearLink} from './utils/link.js';
  import {Snackbar} from '../snackbar';

  const mac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;
  const retries = [];

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
    },

    data() {
      return {
        subscriptionHandle: null,
        commentsHandle: null,
        addingStepsInProgress: false,
        cursorsHandle: null,
        selectedExistingHighlights: [],
        disabledButtons: {},
        formattingIsActive: null,
        linkIsActive: null,
        headingIsActive: null,
        blockIsActive: null,
        cursors: [],
        currentHighlightKey: null,
        currentHighlightKeyChanged: false,
        lastSentVersion: null,
        unconfirmedCount: 0,
        pendingSetVersionDocuments: [],
        undoHint: this._addShortcut(this.$gettext("toolbar-undo"), 'z'),
        redoHint: this._addShortcut(this.$gettext("toolbar-redo"), 'y'),
        strongHint: this._addShortcut(this.$gettext("toolbar-bold"), 'b'),
        emHint: this._addShortcut(this.$gettext("toolbar-italic"), 'i'),
        strikethroughHint: this._addShortcut(this.$gettext("toolbar-strikethrough"), 'u'),
        linkHint: this._addShortcut(this.$gettext("toolbar-link"), 'k'),
        h1Hint: this.$gettext("toolbar-h1"),
        h2Hint: this.$gettext("toolbar-h2"),
        h3Hint: this.$gettext("toolbar-h3"),
        quoteHint: this.$gettext("toolbar-quote"),
        bulletedListHint: this.$gettext("toolbar-bulleted-list"),
        numberedListHint: this.$gettext("toolbar-numbered-list"),
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      canUserUpdateCursor() {
        // We require user reference.
        return !!(this.$currentUserId && this.document && this.document.canUser(Document.PERMISSIONS.SEE));
      },

      canUserUpdateDocument() {
        // We require user reference.
        return !!(this.$currentUserId && this.document && this.document.canUser(Document.PERMISSIONS.UPDATE));
      },

      canUserCreateComments() {
        // We require user reference.
        return !!(this.$currentUserId && User.hasPermission(Comment.PERMISSIONS.CREATE) && this.document && this.document.canUser(Document.PERMISSIONS.COMMENT_CREATE));
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
      const menuItems = [
        // "node" is used to attach a click event handler and set "isActive" if a button is active.
        // "isActive" is used to check if button is active. "name" is used to know which value in
        // "disabledButtons" to control.
        {command: undo, node: this.$refs.buttonUndo, name: 'undo'},
        {command: redo, node: this.$refs.buttonRedo, name: 'redo'},
        {command: toggleMark(schema.marks.strong), node: this.$refs.buttonStrong, isActive: isMarkActive(schema.marks.strong), name: 'strong'},
        {command: toggleMark(schema.marks.em), node: this.$refs.buttonEm, isActive: isMarkActive(schema.marks.em), name: 'em'},
        {command: toggleMark(schema.marks.strikethrough), node: this.$refs.buttonStrikethrough, isActive: isMarkActive(schema.marks.strikethrough), name: 'strikethrough'},
        {command: toggleLink(this.$refs.linkDialog), node: this.$refs.buttonLink, isActive: this._isLinkActive.bind(this), name: 'link'},
        {command: toggleHeading(1), node: this.$refs.buttonH1, isActive: isHeadingActive(1), name: 'h1'},
        {command: toggleHeading(2), node: this.$refs.buttonH2, isActive: isHeadingActive(2), name: 'h2'},
        {command: toggleHeading(3), node: this.$refs.buttonH3, isActive: isHeadingActive(3), name: 'h3'},
        {command: toggleBlockquote(), node: this.$refs.buttonQuote, isActive: isBlockquoteActive(), name: 'quote'},
        {command: toggleList(schema.nodes.bullet_list), node: this.$refs.buttonBulletedList, isActive: isListActive(schema.nodes.bullet_list), name: 'bulletedList'},
        {command: toggleList(schema.nodes.ordered_list), node: this.$refs.buttonNumberedList, isActive: isListActive(schema.nodes.ordered_list), name: 'numberedList'},
      ];

      const state = EditorState.create({
        schema,
        plugins: [
          keymap({
            Enter: splitListItem(schema.nodes.list_item),
            Tab: sinkListItem(schema.nodes.list_item),
            'Shift-Tab': liftListItem(schema.nodes.list_item),
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-b': toggleMark(schema.marks.strong),
            'Mod-i': toggleMark(schema.marks.em),
            'Mod-u': toggleMark(schema.marks.strikethrough),
            'Mod-k': toggleLink(this.$refs.linkDialog),
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history(),
          commentPlugin(this),
          titleSizePlugin(100, this.$gettext("title-length")),
          menuPlugin(menuItems, this, this.disabledButtons),
          addCommentPlugin(this),
          placeholderPlugin(this),
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

      this.$editorView = new EditorView({mount: this.$refs.editor}, {
        state,
        dispatchTransaction: (transaction) => {
          const newState = this.$editorView.state.apply(transaction);
          this.$editorView.updateState(newState);

          this.unconfirmedCount = this.$editorView.state.collab$.unconfirmed.length;

          const sendable = collab.sendableSteps(newState);
          if (sendable) {
            const containsHighlightStep = sendable.steps.find((x) => {
              return x.stepType === 'removeHighlight' || x.stepType === 'addHighlight';
            });
            if (this.canUserUpdateDocument || (this.canUserCreateComments && (containsHighlightStep))) {
              // Steps are added to the content and the "content-changed" event is emitted
              // only if the content version really changed. This prevents layoutComments
              // from running unnecessarily on the sidebar component.
              if (this.lastSentVersion !== sendable.version) {
                this.lastSentVersion = sendable.version;
                this.addingStepsInProgress = true;
                Content.addSteps({
                  contentKey: this.contentKey,
                  currentVersion: sendable.version,
                  steps: sendable.steps.map((step) => {
                    return step.toJSON();
                  }),
                  clientId: this.clientId,
                }, (error, stepsAdded) => {
                  this.addingStepsInProgress = false;
                  if (error) {
                    // TODO: Error handling.
                    Snackbar.enqueue(this.$gettext("document-update-error"), 'error');
                  }
                  else if (stepsAdded.action) {
                    if (stepsAdded.action.type === 'add') {
                      if (stepsAdded.stepsAdded > 0) {
                        this.$emit('highlight-added', stepsAdded.action.highlightKey);
                        this.updateCursor();
                      }
                      else {
                        retries.push(stepsAdded.action);
                      }
                    }
                    else if (stepsAdded.action.type === 'remove') {
                      if (stepsAdded.stepsAdded > 0) {
                        this.$emit('highlight-deleted', {id: stepsAdded.action.id, version: collab.getVersion(this.$editorView.state)});
                      }
                      else {
                        retries.push(stepsAdded.action);
                      }
                    }
                  }
                });
                this.$emit('content-changed');
              }
            }
          }

          // Evaluate if the cursor is over a highlighted text and if the
          // related comment should be focused on the sidebar.
          if (newState.selection.$cursor) {
            const cursorPos = newState.doc.resolve(newState.selection.$cursor.pos);
            const afterPosMarks = cursorPos.nodeAfter ? cursorPos.nodeAfter.marks : [];
            if (afterPosMarks) {
              const highlightkeys = afterPosMarks.find((x) => {
                return x.attrs['highlight-keys'];
              });
              const current = highlightkeys ? highlightkeys.attrs['highlight-keys'] : null;
              if (this.currentHighlightKey !== current) {
                this.currentHighlightKey = current;
                this.currentHighlightKeyChanged = true;
                this.$emit('highlight-selected', current);
              }
            }
          }

          if (this.canUserUpdateCursor) {
            throttledUpdateUserPosition(newState.selection, this.contentKey, this.clientId);
          }
        },
        editable: () => {
          return !!(!this.readOnly && this.canUserUpdateDocument);
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
              $gt: collab.getVersion(this.$editorView.state),
            },
          }), {
            sort: {
              version: 1,
            },
          }).fetch();

          if (newContents.length) {
            this.$editorView.dispatch(collab.receiveTransaction(this.$editorView.state, _.pluck(newContents, 'step').map((step) => {
              return Step.fromJSON(schema, step);
            }), _.pluck(newContents, 'clientId')));
            if (retries.length) {
              const action = retries.shift();
              if (action.type === 'add') {
                this.addCommentHighlight(action.highlightKey);
              }
              else if (action.type === 'remove') {
                this.updateCursor(action.highlightKey);
                this.deleteCommentHighlight({_id: action.id, highlightKey: action.highlightKey}, true);
              }
            }
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

        const {tr} = this.$editorView.state;
        positions = positions || [];
        tr.setMeta(cursorsPlugin, positions);
        this.$editorView.dispatch(tr);
      });

      this.$autorun((computation) => {
        this.cursors = Cursor.documents.find(_.extend(this.cursorsHandle.scopeQuery(), {
          clientId: {
            $ne: this.clientId,
          },
        })).fetch();
      });
    },

    beforeDestroy() {
      this.$editorView.destroy();
      Cursor.remove({contentKey: this.contentKey, clientId: this.clientId});
    },

    methods: {
      _addShortcut(translated, key) {
        const shortcut = mac ? `Cmd-${key.toUpperCase()}` : `Ctrl-${key.toUpperCase()}`;
        return this.$gettextInterpolate(translated, {shortcut});
      },

      updateNewCommentForm(show, start) {
        // Emit show-new-comment-form event only if showNewCommentForm has changed or show is true (selection).
        if (this.showNewCommentForm !== show || show) {
          this.showNewCommentForm = show;
          this.$emit('show-new-comment-form', show, start, this.$editorView.state.selection);
        }
      },

      updateCursor(highlightKey) {
        const {tr} = this.$editorView.state;
        this.currentHighlightKey = highlightKey;
        this.currentHighlightKeyChanged = true;
        let highlightPos = tr.selection.from;
        let keepSearching = true;
        // Highlighted selection position search.
        if (highlightKey) {
          this.$editorView.state.doc.descendants((node, pos) => {
            if (keepSearching) {
              node.marks.forEach((x) => {
                if (x.attrs['highlight-keys'] && x.attrs['highlight-keys'].split(',').indexOf(highlightKey) >= 0) {
                  highlightPos = pos;
                  keepSearching = false;
                }
              });
            }
            return keepSearching;
          });
        }
        // Cursor position update.
        tr.setSelection(TextSelection.create(tr.doc, highlightPos));
        tr.scrollIntoView();
        this.$editorView.focus();
        this.$editorView.dispatch(tr);
      },

      onButtonChange(reference) {
        this[`${reference}IsActive`] = _.some(this.$refs[reference].buttons, (button) => {
          return button.isActive;
        });
      },

      onScroll(event) {
        // Emit scroll event to notify parent component.
        this.$emit('scroll');
      },

      onAvatarClicked(cursor) {
        const {tr} = this.$editorView.state;
        tr.setSelection(TextSelection.create(tr.doc, cursor.head));
        tr.scrollIntoView();
        this.$editorView.dispatch(tr);
      },

      onLinkInserted(link) {
        clearLink(this.$editorView);
        toggleMark(this.$editorView.state.schema.marks.link, {href: link})(this.$editorView.state, this.$editorView.dispatch);
      },

      onLinkRemoved() {
        clearLink(this.$editorView);
      },

      _isLinkActive(state) {
        return !!hasMark(state, state.schema.marks.link);
      },

      addCommentHighlight(highlightKey) {
        const action = {type: 'add', highlightKey};
        const {selection} = this.$editorView.state;
        const {tr} = this.$editorView.state;
        addHighlight(highlightKey, schema, tr, selection.from, selection.to, action);
        this.$editorView.dispatch(tr);
      },

      deleteCommentHighlight(comment, deleteHighlight) {
        if (deleteHighlight) {
          const action = {type: 'remove', highlightKey: comment.highlightKey, id: comment._id};
          const {doc, tr} = this.$editorView.state;
          this.$editorView.state.doc.descendants((node, pos) => {
            node.marks.forEach((x) => {
              if (x.attrs['highlight-keys'] && x.attrs['highlight-keys'].split(',').indexOf(comment.highlightKey) >= 0) {
                removeHighlight(
                  schema, tr, doc, pos,
                  pos + node.nodeSize,
                  action,
                );
              }
            });
          });
          this.$editorView.dispatch(tr);
        }
        else {
          this.$emit('highlight-deleted', {id: this.comment._id, version: collab.getVersion(this.$editorView.state)});
        }
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

    .btn-toggle {
      margin: 0 4px;
    }

    .toolbar__content {
      overflow: hidden;
      transition: none;
    }

    .toolbar__content > *:not(.btn):not(.menu):first-child:not(:only-child) {
      margin-left: 8px;
    }

    .toolbar__content > *:not(.btn):not(.menu):last-child:not(:only-child) {
      margin-right: 8px;
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
    background: #f9e48e;
    margin-bottom: -1px;
  }

  .highlight--selected {
    background: #f9d543;
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

  .editor {
    .empty-node::before {
      float: left;
      // Same as ".text--secondary".
      color: rgba(0, 0, 0, 0.54);
      pointer-events: none;
      height: 0;
    }

    .empty-node:hover::before {
      // Same as "opacity" for ".btn-toggle .btn".
      opacity: 0.4;
    }

    h1.empty-node::before {
      content: attr(data-text);
    }

    p.empty-node:first-of-type::before {
      content: attr(data-text);
    }
  }

  .editor__saving {
    margin-left: 4px;
  }

  .editor__users {
    display: flex;
    margin-left: 4px;

    button {
      margin: 2px;
      border-radius: 50%;
      height: 42px;
      width: 42px;
      border-width: 2px;
      border-style: solid;
      padding: 1px;
      flex: 0 0 auto;

      .btn__content {
        height: 100%;
      }
    }
  }
</style>
