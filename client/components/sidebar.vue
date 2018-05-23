<template>
  <v-container
    fluid
    fill-height
    class="sidebar"
    @mousedown.stop
  >
    <v-layout column>
      <v-layout
        row
        class="sidebar__controlbox"
      >
        <v-flex xs12>
          <v-card>
            <v-toolbar
              dense
              card
            >
              <v-chip
                v-if="documentPublished"
                label
                disabled
                color="green"
                text-color="white"
                class="sidebar__status"
              ><translate>document-published</translate></v-chip>
              <v-btn
                v-if="!documentPublished && canAdministerDocuments"
                :to="{name: 'publishDocument', params: {documentId}}"
                color="success"
              ><translate>document-publish</translate></v-btn>
            </v-toolbar>
          </v-card>
        </v-flex>
      </v-layout>
      <v-layout
        v-if="documentComments.length"
        ref="commentsList"
        class="sidebar__comments"
        row
        wrap
        fill-height
        align-content-start
      >
        <v-flex
          v-for="comment of documentComments"
          :key="comment._id ? comment._id : 'dummy'"
          :style="{marginTop: `${comment.marginTop}px`}"
          xs12
          @click.stop="onViewAllReplies(comment)"
        >
          <thread
            ref="comments"
            :comment="comment"
            :can-user-create-comments="canUserCreateComments"
            @view-all-replies="onViewAllReplies"
            @comment-submitted="onCommentSubmitted"
            @show-deletion-dialog="onShowDeletionDialog"
          />
        </v-flex>
      </v-layout>
      <v-layout
        v-else
        row
        wrap
        fill-height
        align-center
      >
        <v-flex
          class="text--secondary text-xs-center"
          xs12
        >
          <p
            v-translate
            class="mb-0"
          >no-comments</p>
          <p
            v-translate
            v-if="canUserCreateComments"
            class="mb-0 mt-3"
          >
            start-a-new-comment
          </p>
        </v-flex>
      </v-layout>
    </v-layout>
    <comment-deletion-dialog
      ref="commentDeletionDialog"
      :dialog-type="dialogType"
      @comment-delete-clicked="deleteComment"
    />
  </v-container>
</template>

<script>
  import {Random} from 'meteor/random';
  import {Tracker} from 'meteor/tracker';

  import {Comment} from '/lib/documents/comment';
  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

  function getOffset(el) {
    const e = el.getBoundingClientRect();
    return {
      left: e.left + window.scrollX,
      top: e.top + window.scrollY,
      bottom: e.bottom + window.scrollY,
    };
  }

  function getElementByHighlightKey(elements, key) {
    for (let i = 0; i < elements.length; i += 1) {
      const commentMarkEl = elements[i];
      const keys = commentMarkEl.attributes["data-highlight-keys"].value.split(",");
      if (keys.find((commentId) => {
        return commentId === key;
      })) {
        return commentMarkEl;
      }
    }
    return null;
  }

  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
      documentPublished: {
        type: Boolean,
        default: false,
      },
      contentKey: {
        type: String,
        required: true,
      },
      clientId: {
        type: String,
        required: true,
      },
    },

    data() {
      return {
        dialogType: 'comment',
        commentsHandle: null,
        documentComments: [],
        commentCardPaddingTop: 10,
        commentCardPaddingBottom: 10,
        minCommentMargin: 5,
        currentHighlightKey: null,
        commentToDelete: null,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      canUserCreateComments() {
        // We require user reference.
        return !!(this.$currentUserId && User.hasPermission(Comment.PERMISSIONS.CREATE) && this.document && this.document.canUser(Document.PERMISSIONS.COMMENT_CREATE));
      },

      canAdministerDocuments() {
        // We require user reference.
        return !!(this.$currentUserId && this.document && this.document.canUser(Document.PERMISSIONS.ADMIN));
      },
    },

    created() {
      this.$autorun((computation) => {
        this.commentsHandle = this.$subscribe('Comment.list', {documentId: this.documentId});
      });
    },

    mounted() {
      this.$autorun((computation) => {
        const comments = Comment.documents.find(this.commentsHandle.scopeQuery()).fetch();
        if (comments.length) {
          Tracker.nonreactive(() => {
            this.showComments(comments);
          });
        }
      });

      window.addEventListener('resize', this.handleWindowResize);
    },

    beforeDestroy() {
      window.removeEventListener('resize', this.handleWindowResize);
    },

    methods: {
      showNewCommentForm(show, start, selection) {
        this.documentComments = this.documentComments.filter((x) => {
          return !x.dummy;
        });
        if (show) {
          const dummyComment = {
            dummy: true,
            selection,
            highlightTop: start.top + window.scrollY,
            focus: true,
            createdAt: new Date(),
            replyTo: null,
            showDetails: false,
            showAllReplies: false,
            hasManyReplies: false,
            isMain: false,
            replies: [],
          };
          this.documentComments.push(dummyComment);
          this.documentComments.sort((a, b) => {
            if (a.highlightTop !== b.highlightTop) {
              return a.highlightTop - b.highlightTop;
            }
            else {
              return a.createdAt - b.createdAt;
            }
          });
        }
        this.layoutCommentsAfterRender();
      },

      onContentChanged() {
        this.layoutComments(true);
      },

      onViewAllReplies(comment) {
        if (this.currentHighlightKey !== comment.highlightKey) {
          this.documentComments = this.documentComments.map((c) => {
            return Object.assign({}, c, {
              focus: c._id === comment._id,
            });
          });
          this.currentHighlightKey = comment.highlightKey;
          comment.focus = true; // eslint-disable-line no-param-reassign
          // Notify to parent component that a comment is focused and the
          // cursor position on the editor component should be updated.
          this.$emit("commentClicked", comment.highlightKey);
          this.layoutCommentsAfterRender();
        }
      },

      onCommentSubmitted(comment, newCommentBody) {
        if (comment.dummy) {
          const key = Random.id();
          // Emit commentAdded event first (for adding highlight to selected text) and then persist the comment.
          // This way, the highlight marks will be rendered before the comments. It must be in this order, because
          // when a comment is rendered on sidebar it must be related to a highlighted text (which should already be
          // rendered on the editor). This fixes a bug related to new comments that are not shown in other tabs.
          // See: https://github.com/peer/doc/issues/69
          this.$emit("commentAdded", key);
          Comment.create({
            highlightKey: key,
            body: newCommentBody,
            documentId: this.documentId,
          });
          this.$emit("afterCommentAdded", key);
          return;
        }
        else {
          Comment.create({
            highlightKey: comment.highlightKey,
            body: newCommentBody,
            documentId: this.documentId,
            replyTo: comment._id,
          });
        }
        comment.focus = true; // eslint-disable-line no-param-reassign
        // Notify to parent component that a comment is focused and the
        // cursor position on the editor component should be updated.
        this.$emit("commentClicked", comment.highlightKey);
        this.currentHighlightKey = comment.highlightKey;
      },

      handleWindowResize(e) {
        this.layoutComments();
      },

      /**
       * Method that is called when new comments are fetched, and makes DOM
       * manipulation needed to make sure comments are nicely aligned with
       * the comments text.
      */
      showComments(comments) {
        let currentComments = comments
        .filter((comment) => {
          return !comment.versionTo;
        });

        if (!currentComments.length) {
          this.documentComments = currentComments;
          return;
        }

        const replies = currentComments.filter((comment) => {
          return comment.replyTo !== null;
        });

        currentComments = currentComments.filter((comment) => {
          return comment.replyTo === null;
        }).map((comment) => {
          const commentReplies = replies.filter((x) => {
            return x.replyTo._id === comment._id;
          }).sort((a, b) => {
            return a.createdAt - b.createdAt;
          }).map((reply) => {
            return Object.assign({}, reply, {
              showDetails: false,
            });
          });

          return Object.assign({}, comment, {
            replies: commentReplies,
          });
        });

        const commentMarksEls = document.querySelectorAll(`span[data-highlight-keys]`);
        const {currentHighlightKey} = this;
        this.documentComments = currentComments.map((c, i) => {
          if (c.dummy) {
            return c;
          }
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, c.highlightKey);
          if (!el) {
            return null;
          }
          return Object.assign({}, c, {
            highlightTop: getOffset(el).top,
            showDetails: false,
            hasManyReplies: c.replies.length > 1,
            isMain: c.replyTo === null,
            focus: currentHighlightKey === c.highlightKey,
          });
        }).filter((c) => {
          return c;
        }).sort((a, b) => {
          // We sort these values in order to place the comments correctly.
          // For example, you could have a newer comment positioned on top
          // of an older one, so we have to sort the positions accordinglys
          // before Vue tries to render them.
          if (a.highlightTop !== b.highlightTop) {
            return a.highlightTop - b.highlightTop;
          }
          else {
            return a.createdAt - b.createdAt;
          }
        }).map((c) => {
          /*
            We add a `marginTop` property to the comments that indicates how much
            should the `marginTop` CSS value should be between two comments cards.
            Before rendering we set 0 to all the cards in other for let Vue to
            render them normally and after that (with Vue.$nextTick()) make the
            position changes accordingly (in layoutComments()).
          */
          return Object.assign({}, c, {marginTop: 0});
        });
        this.layoutCommentsAfterRender(true);
      },

      layoutCommentsAfterRender(force) {
        this.$nextTick().then(() => {
          // After the cards have been rendered we can start measuring the
          // distance between each cards with the next, and adjust the margins
          // accordingly.
          this.layoutComments(force);
        });
      },

      // Moves the comments above the focused comment if necessary.
      moveUpwards(from, distance) {
        for (let i = from; i > 0; i -= 1) {
          const c = this.documentComments[i];
          // If the current comment is aligned with the related highlighted text or if it's the second comment.
          if (c.marginTop > this.minCommentMargin || i === 1) {
            const last = this.documentComments[i - 1];
            // If after moving the comments, the current comment overlaps with other comments
            // and it isn't the second comment.
            if (c.marginTop - distance < this.minCommentMargin && i !== 1) {
              c.top -= c.marginTop - this.minCommentMargin;
              const newDistance = distance - c.marginTop;
              c.marginTop = this.minCommentMargin;
              // Move upwards the comments that are above the current one
              this.moveUpwards(i, newDistance);
              break;
            }
            // If the current comment isn't aligned with the related highlighted text and
            // its the second comment..
            else if (i === 1 && c.marginTop <= this.minCommentMargin) {
              last.top -= distance;
              last.marginTop -= distance;
              this.updateDownwards(from);
              break;
            }
            else {
              c.top -= distance;
              c.marginTop -= distance;
              if (i === 1 && c.top <= last.top + last.height) {
                const newDistance = (last.top + last.height) - c.top;
                last.top -= newDistance;
                last.marginTop -= newDistance;
                this.updateDownwards(from);
              }
              break;
            }
          }
          else {
            c.top -= distance;
          }
        }
      },

      // Update modified margins.
      updateDownwards(from) {
        for (let j = 1; j <= from; j += 1) {
          const marginTop = this.documentComments[j - 1].marginTop + this.documentComments[j - 1].height + (this.commentCardPaddingBottom / 2);
          // The comment will be on visible area.
          if (marginTop > 0) {
            this.documentComments[j].top -= this.documentComments[j].marginTop - this.minCommentMargin;
            this.documentComments[j].marginTop = this.minCommentMargin;
          }
          // The comment will be outside visible area.
          else {
            this.documentComments[j].top -= this.documentComments[j].marginTop - marginTop;
            this.documentComments[j].marginTop = marginTop;
          }
        }
      },

      // Moves the comments below the focused comment if necessary.
      moveDownwards(from, distance) {
        let currentDistance = distance;
        for (let i = from; i < this.documentComments.length; i += 1) {
          const c = this.documentComments[i];
          // If the current comment is aligned with the related highlighted text.
          if (c.marginTop > this.minCommentMargin) {
            c.marginTop += (currentDistance);
            break;
          }
          // Else if the current comment isn't aligned with the related highlighted text
          // and after moving the comments, the comment is above the related highlighted text.
          else if (c.marginTop <= this.minCommentMargin && c.top - (currentDistance) < c.highlightTop && c.highlightTop !== this.documentComments[from].highlightTop) {
            const newDistance = c.top - c.highlightTop;
            c.marginTop = c.highlightTop - (c.top - (currentDistance));
            c.top = c.highlightTop;
            currentDistance = newDistance;
          }
          // Else, the marginTop is not modified.
        }
      },

      layoutComments(force) {
        const dummy = this.documentComments.filter((c) => {
          return c.dummy;
        });
        // Stop if there are no comments or if there are no dummy comments and force is not true.
        if (!this.$refs.comments || (dummy.length === 0 && !this.currentHighlightKey && !force)) {
          return;
        }
        const commentMarksEls = document.querySelectorAll(`span[data-highlight-keys]`);
        const highlightTops = this.documentComments.map((c, i) => {
          if (c.dummy) {
            return c.highlightTop;
          }
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, c.highlightKey);
          if (!el) {
            return null;
          }
          return getOffset(el).top;
        });

        const heights = this.$refs.comments.map((ref) => {
          // Comment thread container height.
          return ref.$el.offsetHeight;
        });

        let focusedCommentIndex = -1;
        for (let i = 0; i < this.documentComments.length; i += 1) {
          const c = this.documentComments[i];
          if (c.highlightKey === this.currentHighlightKey || c.dummy) {
            focusedCommentIndex = i;
          }
          const height = heights[i];
          let bottom = 0;
          let top = 0;
          let {marginTop} = c;
          if (i === 0) {
            const el2 = this.$refs.commentsList;
            const el2Y = getOffset(el2).top;
            const elY = highlightTops[0];
            marginTop = elY - el2Y > 0 ? elY - el2Y : 0;
            // const {top} = getOffset(this.$refs.comments[i].$el);
            bottom = el2Y + marginTop + height;
            top = el2Y + marginTop;
          }
          else {
            const previousBottom = this.documentComments[i - 1].bottom;
            marginTop = highlightTops[i] - previousBottom > 0 ? highlightTops[i] - previousBottom : this.minCommentMargin;
            bottom = previousBottom + marginTop + height;
            top = previousBottom + marginTop;
            if (c.dummy) {
              bottom -= 10;
            }
          }
          this.documentComments.splice(i, 1, Object.assign({}, c, {height, bottom, marginTop, top}));
        }

        // If there is a focused comment, move the focused comment next to the
        // related highlight. Also move the other comments if necessary.
        if (focusedCommentIndex > -1) {
          const focused = this.documentComments[focusedCommentIndex];
          const distance = Math.abs(focused.top - focused.highlightTop);
          this.moveUpwards(focusedCommentIndex, distance);
          this.moveDownwards(focusedCommentIndex, distance);
        }
      },

      focusComment(highlightKey) {
        let lastFocusedIndex = -1;
        this.documentComments = this.documentComments.map((x, i) => {
          if (x.highlightKey === this.currentHighlightKey) {
            lastFocusedIndex = i;
          }
          return Object.assign({}, x, {focus: x.highlightKey === highlightKey});
        });

        // Defocus.
        if (!highlightKey) {
          // If there are comments below.
          if (lastFocusedIndex >= 0 && lastFocusedIndex < this.documentComments.length - 1) {
            const thread = this.$refs.comments[lastFocusedIndex];
            // Adjust below comment margin.
            this.documentComments[lastFocusedIndex + 1].marginTop += thread.$refs.inputContainer.offsetHeight;
          }
          // Collapse comments.
          this.documentComments = this.documentComments.map((c) => {
            return Object.assign({}, c, {
              replies: c.replies.map((x) => {
                return Object.assign({}, x, {
                  showDetails: false,
                });
              }),
              showDetails: false,
              focus: false,
            });
          }).filter((x) => {
            return !x.dummy;
          });
        }
        this.currentHighlightKey = highlightKey;
        this.layoutCommentsAfterRender();
      },

      onShowDeletionDialog(comment) {
        this.commentToDelete = comment;
        this.$refs.commentDeletionDialog.show = true;
        this.dialogType = comment.isMain ? 'thread' : 'comment';
      },

      deleteComment() {
        const comments = this.documentComments.filter((x) => {
          return x.highlightKey === this.commentToDelete.highlightKey && x.status === Comment.STATUS.CREATED;
        });
        this.$emit("delete-comment", this.commentToDelete, comments.length === 1);
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .sidebar {
    padding-top: 0;
    padding-right: 0;
    padding-bottom: 0;

    .sidebar__controlbox {
      z-index: 1;
    }

    .sidebar__status {
      text-transform: uppercase;
      font-weight: bold;
    }

    .sidebar__comments {
      // We want comments to not force a vertical scrollbar. But setting overflow to hidden also cuts shadows.
      // So we use a trick where we use negative margin and positive padding to make space for shadows.
      overflow-y: hidden;
      margin-left: -16px;
      padding-left: 16px;
      margin-right: -16px;
      padding-right: 16px;
      margin-bottom: -16px;
      padding-bottom: 16px;
    }
  }
</style>
