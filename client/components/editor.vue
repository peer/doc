<template>
  <div>
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
          >
            <v-icon>undo</v-icon>
          </v-btn>
          <v-btn
            ref="buttonRedo"
            :disabled="!canUserUpdateDocument || disabledButtons.redo"
            :title="redoHint"
            flat
          >
            <v-icon>redo</v-icon>
          </v-btn>
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
          >
            <v-icon>format_bold</v-icon>
          </v-btn>
          <v-btn
            ref="buttonEm"
            :disabled="!canUserUpdateDocument || disabledButtons.em"
            :title="emHint"
            flat
            @input="onButtonChange('formatting')"
          >
            <v-icon>format_italic</v-icon>
          </v-btn>
          <v-btn
            ref="buttonStrikethrough"
            :disabled="!canUserUpdateDocument || disabledButtons.strikethrough"
            :title="strikethroughHint"
            flat
            @input="onButtonChange('formatting')"
          >
            <v-icon>strikethrough_s</v-icon>
          </v-btn>
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
          >
            <v-icon>insert_link</v-icon>
          </v-btn>
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
          >
            <translate>h1</translate>
          </v-btn>
          <v-btn
            ref="buttonH2"
            :disabled="!canUserUpdateDocument || disabledButtons.h2"
            :title="h2Hint"
            flat
            @input="onButtonChange('heading')"
          >
            <translate>h2</translate>
          </v-btn>
          <v-btn
            ref="buttonH3"
            :disabled="!canUserUpdateDocument || disabledButtons.h3"
            :title="h3Hint"
            flat
            @input="onButtonChange('heading')"
          >
            <translate>h3</translate>
          </v-btn>
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
          >
            <v-icon>format_quote</v-icon>
          </v-btn>
          <v-btn
            ref="buttonBulletedList"
            :disabled="!canUserUpdateDocument || disabledButtons.bulletedList"
            :title="bulletedListHint"
            flat
            @input="onButtonChange('block')"
          >
            <v-icon>format_list_bulleted</v-icon>
          </v-btn>
          <v-btn
            ref="buttonNumberedList"
            :disabled="!canUserUpdateDocument || disabledButtons.numberedList"
            :title="numberedListHint"
            flat
            @input="onButtonChange('block')"
          >
            <v-icon>format_list_numbered</v-icon>
          </v-btn>
        </v-btn-toggle>

        <v-spacer />

        <div
          v-if="canUserUpdateDocument && document.hasContentModifyLock"
          v-translate
          class="editor__saving text--secondary"
        >
          editor-locked
        </div>
        <div
          v-else-if="canUserUpdateDocument && unconfirmedCount"
          v-translate
          class="editor__saving text--secondary"
        >
          editor-saving
        </div>
        <div
          v-else-if="canUserUpdateDocument"
          v-translate
          class="editor__saving text--secondary"
        >
          editor-saved
        </div>

        <div class="editor__users">
          <v-btn
            v-for="cursor of cursors"
            :key="cursor._id"
            :style="{borderColor: cursor.color}"
            flat
            icon
            @click="onAvatarClicked(cursor)"
          >
            <v-avatar size="36px">
              <img
                :src="cursor.author.avatarUrl()"
                :alt="cursor.author.username"
                :title="cursor.author.username"
              >
            </v-avatar>
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
  </div>
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

  import {Content} from '/lib/documents/content';
  import {Comment} from '/lib/documents/comment';
  import {Cursor} from '/lib/documents/cursor';
  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';
  import {schema} from '/lib/full-schema';
  import {stepsAreOnlyHighlights} from '/lib/utils';

  import {menuPlugin, isMarkActive, hasMark, toggleHeading, isHeadingActive, toggleBlockquote, isBlockquoteActive, toggleList, isListActive} from './utils/menu.js';
  import {placeholderPlugin} from './utils/placeholder.js';
  import {cursorsPlugin} from './utils/cursors-plugin';
  import {commentPlugin} from './utils/comment-plugin';
  import {titleSizePlugin} from './utils/title-size-plugin.js';
  import addCommentPlugin, {addHighlight, removeHighlight} from './utils/add-comment-plugin';
  import {toggleLink, clearLink} from './utils/link.js';

  const mac = typeof navigator !== 'undefined' ? /Mac/.test(navigator.platform) : false;

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
        contentsHandle: null,
        commentsHandle: null,
        addingStepsInProgress: false,
        contentModificationInProgress: false,
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
        return !!(this.$currentUserId && this.document && this.document.canUser([Document.PERMISSIONS.VIEW, Document.PERMISSIONS.UPDATE, Document.PERMISSIONS.COMMENT_CREATE]));
      },

      canUserUpdateDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.UPDATE));
      },

      canUserCreateComments() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.COMMENT_CREATE) && User.hasClassPermission(Comment.PERMISSIONS.CREATE));
      },
    },

    watch: {
      document(newValue, oldValue) {
        if (newValue.hasContentModifyLock) {
          this.contentModificationInProgress = true;
        }
        else {
          if (newValue.rebasedAtVersion !== oldValue.rebasedAtVersion) {
            this.resetEditor();
          }
          this.contentModificationInProgress = false;
        }
      },
    },

    created() {
      this.$autorun((computation) => {
        this.contentsHandle = this.$subscribe('Content.list', {contentKey: this.contentKey, withClientId: true});
      });

      this.$autorun((computation) => {
        this.commentsHandle = this.$subscribe('Comment.list', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        this.cursorsHandle = this.$subscribe('Cursor.list', {contentKey: this.contentKey});
      });
    },

    mounted() {
      this.$highlightIdsToCommentIds = new Map();

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
            const onlyHighlights = stepsAreOnlyHighlights(sendable.steps);

            // TODO: What to do if there are unconfirmed non-highlight steps but document was just published?
            if (this.canUserUpdateDocument || (this.canUserCreateComments && onlyHighlights)) {
              this.addingStepsInProgress = true;
              Content.addSteps({
                contentKey: this.contentKey,
                currentVersion: sendable.version,
                steps: sendable.steps.map((step) => {
                  return step.toJSON();
                }),
                clientId: this.clientId,
              }, (error, response) => {
                // TODO: Schedule to try again if "response" is 0 and there are unconfirmed steps locally.
                //       Currently we try again only if we receive new steps from the server, but there might
                //       be other reasons why server could not add steps so we should have some mechanism to
                //       schedule for client to just try again.
                if (error) {
                  // TODO: Error handling.
                }
                this.addingStepsInProgress = false;
              });
            }
          }

          // Evaluate if the cursor is over a highlighted text and if the
          // related comment should be focused on the sidebar.
          if (newState.selection.$cursor) {
            const cursorPos = newState.doc.resolve(newState.selection.$cursor.pos);
            const afterPosMarks = cursorPos.nodeAfter ? cursorPos.nodeAfter.marks : [];
            if (afterPosMarks) {
              const highlightkeys = afterPosMarks.filter((x) => {
                return x.attrs['highlight-key'];
              }).map((x) => {
                return {key: x.attrs['highlight-key'], pos: this.getHighlightPos(x.attrs['highlight-key'])};
              });
              const current = highlightkeys ? _.max(highlightkeys, (x) => {
                return x.pos;
              }) : null;
              if (this.currentHighlightKey !== current.key) {
                this.currentHighlightKey = current.key;
                this.currentHighlightKeyChanged = true;
                this.$emit('highlight-selected', current.key);
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
        attributes: {
          // This makes focus/selection be kept when editor is temporary locked and made read-only
          // and then restored. Without this the focus is lost when editor becomes editable again.
          // See: https://discuss.prosemirror.net/t/losing-focus-when-switching-to-read-only-mode/1624
          tabindex: 0,
        },
      });

      this.$autorun((computation) => {
        if (!this.contentsHandle) {
          return;
        }

        if (this.addingStepsInProgress) {
          return;
        }

        if (this.contentModificationInProgress) {
          return;
        }

        // To register dependency on the latest version available from the server.
        const versions = _.pluck(Content.documents.find(this.contentsHandle.scopeQuery(), {fields: {version: 1}}).fetch(), 'version');

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
          const newContents = Content.documents.find(_.extend(this.contentsHandle.scopeQuery(), {
            version: {
              $gt: collab.getVersion(this.$editorView.state),
            },
          }), {
            sort: {
              version: 1,
            },
            transform: null,
          }).map((x) => {
            return {...x, step: Step.fromJSON(schema, x.step)};
          });

          if (newContents.length) {
            // Update collab and current editor's content.
            this.$editorView.dispatch(collab.receiveTransaction(
              this.$editorView.state,
              _.pluck(newContents, 'step'),
              _.pluck(newContents, 'clientId'),
              {
                mapSelectionBackward: true,
              },
            ));

            newContents.filter((x) => {
              return x.clientId === this.clientId;
            }).forEach((x) => {
              // Emit corresponding events when highlights are added.
              if (x.step.mark && x.step.mark.type.name === 'highlight') {
                if (x.step.jsonID === 'removeMark') {
                  this.$emit('highlight-deleted', {id: this.$highlightIdsToCommentIds.get(x.step.mark.attrs['highlight-key']), version: x.version});
                }
                else if (x.step.jsonID === 'addMark') {
                  this.$emit('highlight-added', x.step.mark.attrs['highlight-key']);
                  this.updateCursor();
                }
              }
            });

            // Notify to other components that there is new content.
            this.$emit('content-changed');
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
            avatarUrl: c.author ? c.author.avatarUrl() : null,
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
      resetEditor() {
        // TODO: Should we try to map some old state to new state?
        //       Editor selection/cursor position is currently lost. How does this relate to existing
        //       cursors of other editors being shown by the cursors plugin? Any unconfirmed steps in
        //       collab plugin are currently lost. Undo/redo history is lost. What if a comment/highlight
        //       has just been made and is waiting for "highlight-added" event? Is there any other
        //       state on the Vue instance which should be reset? Because it depends on the editor's
        //       state? Ideally, state would flow only one way: from database to Vue instance to
        //       editor state, so this would not be the case.
        const newState = EditorState.create({
          schema: this.$editorView.state.schema,
          plugins: this.$editorView.state.plugins,
        });
        this.$editorView.updateState(newState);
      },

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
        const highlightPos = this.getHighlightPos(highlightKey) || tr.selection.from;
        // Cursor position update.
        tr.setSelection(TextSelection.create(tr.doc, highlightPos));
        tr.scrollIntoView();
        this.$editorView.focus();
        this.$editorView.dispatch(tr);
      },

      // Highlighted selection position search.
      getHighlightPos(highlightKey) {
        let highlightPos;
        let keepSearching = true;
        if (highlightKey) {
          this.$editorView.state.doc.descendants((node, pos) => {
            if (keepSearching) {
              node.marks.forEach((x) => {
                if (x.attrs['highlight-key'] === highlightKey) {
                  highlightPos = pos;
                  keepSearching = false;
                }
              });
            }
            return keepSearching;
          });
        }
        return highlightPos;
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
        const {selection} = this.$editorView.state;
        const {tr} = this.$editorView.state;
        addHighlight(highlightKey, schema, tr, selection.from, selection.to);
        this.$editorView.dispatch(tr);
      },

      deleteCommentHighlight(commentDescriptor, deleteHighlight) {
        if (deleteHighlight) {
          const {doc, tr} = this.$editorView.state;
          const markPositions = [];
          this.$editorView.state.doc.descendants((node, pos) => {
            node.marks.forEach((x) => {
              if (x.attrs['highlight-key'] === commentDescriptor.comment.highlightKey) {
                markPositions.push(pos);
                markPositions.push(pos + node.nodeSize);
              }
            });
          });

          if (markPositions.length) {
            removeHighlight(
              schema,
              tr,
              doc,
              _.min(markPositions),
              _.max(markPositions),
              commentDescriptor.comment.highlightKey,
            );
          }
          this.$highlightIdsToCommentIds.set(commentDescriptor.comment.highlightKey, commentDescriptor.comment._id);
          this.$editorView.dispatch(tr);
        }
        else {
          this.$emit('highlight-deleted', {id: commentDescriptor.comment._id, version: collab.getVersion(this.$editorView.state)});
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

    .v-btn-toggle {
      margin: 0 4px;
    }

    .v-toolbar__content {
      overflow: hidden;
      transition: none;
      padding: 0;
    }

    .v-toolbar__content > *:not(.v-btn):not(.v-menu):first-child:not(:only-child) {
      margin-left: 8px;
    }

    .v-toolbar__content > *:not(.v-btn):not(.v-menu):last-child:not(:only-child) {
      margin-right: 8px;
    }
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
    width: 0;
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
      // Same as "opacity" for ".v-btn-toggle .v-btn".
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

    button.v-btn--icon {
      margin: 2px;
      border-radius: 50%;
      height: 42px;
      width: 42px;
      border-width: 2px;
      border-style: solid;
      padding: 1px;
      flex: 0 0 auto;

      .v-btn__content {
        height: 100%;
      }
    }
  }
</style>
