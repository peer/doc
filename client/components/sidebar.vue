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
              <document-status :document-id="document._id" />
              <v-btn
                v-if="!apiControlled && canUserPublishDocument"
                :to="{name: 'document-publish', params: {documentId}}"
                outline
              ><translate>document-publish</translate></v-btn>
              <v-btn
                v-if="!apiControlled && canUserForkDocument"
                :to="{name: 'document-fork', params: {documentId}}"
                outline
              ><translate>document-fork</translate></v-btn>
              <v-btn
                v-if="!apiControlled && canUserMergeDocument"
                outline
                @click="acceptMergeDocument()"
              ><translate>document-accept-merge</translate></v-btn>
              <v-btn
                v-if="!apiControlled && canUserAdministerDocument"
                :to="{name: 'document-share', params: {documentId}}"
                outline
              ><translate>share</translate></v-btn>
            </v-toolbar>
          </v-card>
        </v-flex>
      </v-layout>
      <v-layout
        v-if="commentDescriptors.length"
        ref="commentsList"
        class="sidebar__comments"
        row
        wrap
        fill-height
        align-content-start
      >
        <v-flex
          v-for="commentDescriptor of commentDescriptors"
          :key="commentDescriptor.comment._id ? commentDescriptor.comment._id : 'dummy'"
          :style="{marginTop: `${commentDescriptor.marginTop}px`}"
          xs12
          @click.stop="onViewAllReplies(commentDescriptor)"
        >
          <thread
            ref="comments"
            :comment-descriptor="commentDescriptor"
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
      @comment-delete-clicked="onDeleteClicked"
    />
  </v-container>
</template>

<script>
  import {Meteor} from 'meteor/meteor';
  import {Random} from 'meteor/random';
  import {Tracker} from 'meteor/tracker';

  import {Comment} from '/lib/documents/comment';
  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';
  import {Snackbar} from '../snackbar';

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
      const highlightKey = commentMarkEl.attributes['data-highlight-key'].value;
      if (highlightKey === key) {
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
        apiControlled: Meteor.settings.public.apiControlled,
        dialogType: 'comment',
        commentsHandle: null,
        commentDescriptors: [],
        commentCardPaddingTop: 10,
        commentCardPaddingBottom: 10,
        minCommentMargin: 5,
        currentHighlightKey: null,
        commentDescriptorToDelete: null,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      parentDocument() {
        if (this.document && this.document.forkedFrom) {
          return Document.documents.findOne({
            _id: this.document.forkedFrom._id,
          });
        }
        else {
          return null;
        }
      },

      canUserCreateComments() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.COMMENT_CREATE) && User.hasClassPermission(Comment.PERMISSIONS.CREATE));
      },

      canUserAdministerDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.ADMIN));
      },

      canUserPublishDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.PUBLISH));
      },

      canUserForkDocument() {
        const condition = !!(this.document && this.document.canUser(Document.PERMISSIONS.VIEW) && User.hasClassPermission(Document.PERMISSIONS.CREATE));
        if (Meteor.settings.public.mergingForkingOfAllDocuments) {
          return condition;
        }
        else {
          return condition && this.document.isPublished();
        }
      },

      canUserMergeDocument() {
        return !!(
          // TODO: Use "SUGGEST_MERGE" instead of "VIEW" here.
          this.document && this.document.canUser(Document.PERMISSIONS.VIEW)
          && !this.document.isMergeAccepted() && !this.document.isPublished()
          && this.parentDocument && this.parentDocument.canUser(Document.PERMISSIONS.ACCEPT_MERGE)
        );
      },
    },

    created() {
      this.$autorun((computation) => {
        this.commentsHandle = this.$subscribe('Comment.list', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        if (this.document && this.document.forkedFrom) {
          this.$subscribe('Document.one', {documentId: this.document.forkedFrom._id});
        }
      });
    },

    mounted() {
      this.$commentsToAdd = [];
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
      acceptMergeDocument() {
        // TODO: Add "in progress" guard.
        Document.acceptMerge({documentId: this.documentId}, (error) => {
          if (error) {
            Snackbar.enqueue(this.$gettext("accept-merge-error"), 'error');
            return;
          }
          this.$router.push({name: 'document', params: {documentId: this.document.forkedFrom._id}});
          Snackbar.enqueue(this.$gettext("accept-merge-success"), 'success');
        });
      },

      showNewCommentForm(show, start, selection) {
        this.commentDescriptors = this.commentDescriptors.filter((commentDescriptor) => {
          return !commentDescriptor.dummy;
        });
        if (show) {
          const dummyCommentDescriptor = {
            dummy: true,
            selection,
            highlightTop: start.top + window.scrollY,
            focus: true,
            comment: {
              createdAt: new Date(),
              replyTo: null,
            },
            showDetails: false,
            showAllReplies: false,
            hasManyReplies: false,
            isMain: false,
            replies: [],
          };
          this.commentDescriptors.push(dummyCommentDescriptor);
          this.commentDescriptors.sort((a, b) => {
            if (a.highlightTop !== b.highlightTop) {
              return a.highlightTop - b.highlightTop;
            }
            else {
              return a.comment.createdAt - b.comment.createdAt;
            }
          });
        }
        this.layoutCommentsAfterRender();
      },

      onContentChanged() {
        this.layoutComments(true);
      },

      onViewAllReplies(commentDescriptor) {
        if (this.currentHighlightKey !== commentDescriptor.comment.highlightKey) {
          this.commentDescriptors = this.commentDescriptors.map((cd) => {
            return Object.assign({}, cd, {
              focus: cd.comment._id === commentDescriptor.comment._id,
            });
          });
          this.currentHighlightKey = commentDescriptor.highlightKey;
          commentDescriptor.focus = true; // eslint-disable-line no-param-reassign
          // Notify to parent component that a comment is focused and the
          // cursor position on the editor component should be updated.
          this.$emit('comment-clicked', commentDescriptor.highlightKey);
          this.layoutCommentsAfterRender();
        }
      },

      createComment(highlightKey) {
        for (let i = this.$commentsToAdd.length - 1; i >= 0; i -= 1) {
          if (this.$commentsToAdd[i].highlightKey === highlightKey) {
            Comment.create(this.$commentsToAdd.splice(i, 1)[0]);
          }
        }
      },

      onCommentSubmitted(commentDescriptor, newCommentBody) {
        if (commentDescriptor.dummy) {
          const key = Random.id();
          this.$commentsToAdd.push({
            documentId: this.documentId,
            highlightKey: key,
            body: newCommentBody,
            contentKey: this.contentKey,
          });
          this.$emit('add-highlight', key);
          return;
        }
        else {
          Comment.create({
            documentId: this.documentId,
            highlightKey: commentDescriptor.comment.highlightKey,
            body: newCommentBody,
            replyTo: commentDescriptor.comment._id,
            contentKey: this.contentKey,
          });
        }
        commentDescriptor.focus = true; // eslint-disable-line no-param-reassign
        // Notify to parent component that a comment is focused and the
        // cursor position on the editor component should be updated.
        this.$emit('comment-clicked', commentDescriptor.comment.highlightKey);
        this.currentHighlightKey = commentDescriptor.comment.highlightKey;
      },

      handleWindowResize(event) {
        this.layoutComments();
      },

      /**
       * Method that is called when new comments are fetched, and makes DOM
       * manipulation needed to make sure comments are nicely aligned with
       * the comments text.
      */
      showComments(comments) {
        const dummyCommentDescriptors = this.commentDescriptors.filter((commentDescriptor) => {
          return commentDescriptor.dummy;
        });

        const currentComments = comments.filter((comment) => {
          return !comment.versionTo;
        });

        let currentCommmentDescriptors = currentComments.map((comment) => {
          return {
            comment,
          };
        });
        currentCommmentDescriptors = currentCommmentDescriptors.concat(dummyCommentDescriptors);

        if (!currentCommmentDescriptors.length) {
          this.commentDescriptors = currentCommmentDescriptors;
          return;
        }

        const replyDescriptors = currentCommmentDescriptors.filter((commentDescriptor) => {
          return commentDescriptor.comment.replyTo !== null;
        });

        currentCommmentDescriptors = currentCommmentDescriptors.filter((commentDescriptor) => {
          return commentDescriptor.comment.replyTo === null;
        }).map((commentDescriptor) => {
          const commentReplyDescriptors = replyDescriptors.filter((replyDescriptor) => {
            return replyDescriptor.comment.replyTo._id === commentDescriptor.comment._id;
          }).sort((a, b) => {
            return a.comment.createdAt - b.comment.createdAt;
          }).map((replyDescriptor) => {
            return Object.assign({}, replyDescriptor, {
              showDetails: false,
            });
          });

          return Object.assign({}, commentDescriptor, {
            replies: commentReplyDescriptors,
          });
        });

        const commentMarksEls = document.querySelectorAll('span[data-highlight-key]');
        const {currentHighlightKey} = this;
        this.commentDescriptors = currentCommmentDescriptors.map((commentDescriptor) => {
          if (commentDescriptor.dummy) {
            return commentDescriptor;
          }
          // "highlightTop" will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, commentDescriptor.comment.highlightKey);
          if (!el) {
            return null;
          }
          return Object.assign({}, commentDescriptor, {
            highlightTop: getOffset(el).top,
            showDetails: false,
            hasManyReplies: commentDescriptor.replies.length > 1,
            isMain: commentDescriptor.comment.replyTo === null,
            focus: currentHighlightKey === commentDescriptor.comment.highlightKey,
          });
        }).filter((commentDescriptor) => {
          return commentDescriptor;
        }).sort((a, b) => {
          // We sort these values in order to place the comments correctly.
          // For example, you could have a newer comment positioned on top
          // of an older one, so we have to sort the positions accordinglys
          // before Vue tries to render them.
          if (a.highlightTop !== b.highlightTop) {
            return a.highlightTop - b.highlightTop;
          }
          else {
            return a.comment.createdAt - b.comment.createdAt;
          }
        }).map((commentDescriptor) => {
          /*
            We add a "marginTop" property to the comment descriptors that indicates how
            much should the "marginTop" CSS value should be between two comments cards.
            Before rendering we set 0 to all the cards in other for let Vue to
            render them normally and after that (with "Vue.$nextTick") make the
            position changes accordingly (in "layoutComments").
          */
          return Object.assign({}, commentDescriptor, {marginTop: 0});
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
          const commentDescriptor = this.commentDescriptors[i];
          // If the current comment is aligned with the related highlighted text or if it's the second comment.
          if (commentDescriptor.marginTop > this.minCommentMargin || i === 1) {
            const lastCommentDescriptor = this.commentDescriptors[i - 1];
            // If after moving the comments, the current comment overlaps with other comments
            // and it isn't the second comment.
            if (commentDescriptor.marginTop - distance < this.minCommentMargin && i !== 1) {
              commentDescriptor.top -= commentDescriptor.marginTop - this.minCommentMargin;
              const newDistance = distance - commentDescriptor.marginTop;
              commentDescriptor.marginTop = this.minCommentMargin;
              // Move upwards the comments that are above the current one
              this.moveUpwards(i, newDistance);
              break;
            }
            // If the current comment isn't aligned with the related highlighted text and
            // its the second comment..
            else if (i === 1 && commentDescriptor.marginTop <= this.minCommentMargin) {
              lastCommentDescriptor.top -= distance;
              lastCommentDescriptor.marginTop -= distance;
              this.updateDownwards(from);
              break;
            }
            else {
              commentDescriptor.top -= distance;
              commentDescriptor.marginTop -= distance;
              if (i === 1 && commentDescriptor.top <= lastCommentDescriptor.top + lastCommentDescriptor.height) {
                const newDistance = (lastCommentDescriptor.top + lastCommentDescriptor.height) - commentDescriptor.top;
                lastCommentDescriptor.top -= newDistance;
                lastCommentDescriptor.marginTop -= newDistance;
                this.updateDownwards(from);
              }
              break;
            }
          }
          else {
            commentDescriptor.top -= distance;
          }
        }
      },

      // Update modified margins.
      updateDownwards(from) {
        for (let j = 1; j <= from; j += 1) {
          const marginTop = this.commentDescriptors[j - 1].marginTop + this.commentDescriptors[j - 1].height + (this.commentCardPaddingBottom / 2);
          // The comment will be on visible area.
          if (marginTop > 0) {
            this.commentDescriptors[j].top -= this.commentDescriptors[j].marginTop - this.minCommentMargin;
            this.commentDescriptors[j].marginTop = this.minCommentMargin;
          }
          // The comment will be outside visible area.
          else {
            this.commentDescriptors[j].top -= this.commentDescriptors[j].marginTop - marginTop;
            this.commentDescriptors[j].marginTop = marginTop;
          }
        }
      },

      // Moves the comments below the focused comment if necessary.
      moveDownwards(from, distance) {
        let currentDistance = distance;
        for (let i = from; i < this.commentDescriptors.length; i += 1) {
          const commentDescriptor = this.commentDescriptors[i];
          // If the current comment is aligned with the related highlighted text.
          if (commentDescriptor.marginTop > this.minCommentMargin) {
            commentDescriptor.marginTop += currentDistance;
            break;
          }
          // Else if the current comment isn't aligned with the related highlighted text
          // and after moving the comments, the comment is above the related highlighted text.
          else if (commentDescriptor.marginTop <= this.minCommentMargin && commentDescriptor.top - currentDistance < commentDescriptor.highlightTop && commentDescriptor.highlightTop !== this.commentDescriptors[from].highlightTop) {
            const newDistance = commentDescriptor.top - commentDescriptor.highlightTop;
            commentDescriptor.marginTop = commentDescriptor.highlightTop - (commentDescriptor.top - currentDistance);
            commentDescriptor.top = commentDescriptor.highlightTop;
            currentDistance = newDistance;
          }
          // Else, the marginTop is not modified.
        }
      },

      layoutComments(force) {
        const dummyCommentDescriptors = this.commentDescriptors.filter((commentDescriptor) => {
          return commentDescriptor.dummy;
        });
        // Stop if there are no comments or if there are no dummy comments and force is not true.
        if (!this.$refs.comments || (dummyCommentDescriptors.length === 0 && !this.currentHighlightKey && !force)) {
          return;
        }
        const commentMarksEls = document.querySelectorAll(`span[data-highlight-key]`);
        const highlightTops = this.commentDescriptors.map((commentDescriptor) => {
          if (commentDescriptor.dummy) {
            return commentDescriptor.highlightTop;
          }
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, commentDescriptor.comment.highlightKey);
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
        for (let i = 0; i < this.commentDescriptors.length; i += 1) {
          const commentDescriptor = this.commentDescriptors[i];
          if (commentDescriptor.comment.highlightKey === this.currentHighlightKey || commentDescriptor.dummy) {
            focusedCommentIndex = i;
          }
          const height = heights[i];
          let bottom = 0;
          let top = 0;
          let {marginTop} = commentDescriptor;
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
            const previousBottom = this.commentDescriptors[i - 1].bottom;
            marginTop = highlightTops[i] - previousBottom > 0 ? highlightTops[i] - previousBottom : this.minCommentMargin;
            bottom = previousBottom + marginTop + height;
            top = previousBottom + marginTop;
            if (commentDescriptor.dummy) {
              bottom -= 10;
            }
          }
          this.commentDescriptors.splice(i, 1, Object.assign({}, commentDescriptor, {height, bottom, marginTop, top}));
        }

        // If there is a focused comment, move the focused comment next to the
        // related highlight. Also move the other comments if necessary.
        if (focusedCommentIndex > -1) {
          const focusedCommentDescriptor = this.commentDescriptors[focusedCommentIndex];
          const distance = Math.abs(focusedCommentDescriptor.top - focusedCommentDescriptor.highlightTop);
          this.moveUpwards(focusedCommentIndex, distance);
          this.moveDownwards(focusedCommentIndex, distance);
        }
      },

      focusComment(highlightKey) {
        let lastFocusedIndex = -1;
        this.commentDescriptors = this.commentDescriptors.map((commentDescriptor, i) => {
          if (commentDescriptor.comment.highlightKey === this.currentHighlightKey) {
            lastFocusedIndex = i;
          }
          return Object.assign({}, commentDescriptor, {focus: commentDescriptor.comment.highlightKey === highlightKey});
        });

        // Defocus.
        if (!highlightKey) {
          // If there are comments below.
          if (lastFocusedIndex >= 0 && lastFocusedIndex < this.commentDescriptors.length - 1) {
            const thread = this.$refs.comments[lastFocusedIndex];
            // Adjust below comment margin.
            this.commentDescriptors[lastFocusedIndex + 1].marginTop += thread.$refs.inputContainer.offsetHeight;
          }
          // Collapse comments.
          this.commentDescriptors = this.commentDescriptors.map((commentDescriptor) => {
            return Object.assign({}, commentDescriptor, {
              replies: commentDescriptor.replies.map((replyDescriptor) => {
                return Object.assign({}, replyDescriptor, {
                  showDetails: false,
                });
              }),
              showDetails: false,
              focus: false,
            });
          }).filter((commentDescriptor) => {
            return !commentDescriptor.dummy;
          });
        }
        this.currentHighlightKey = highlightKey;
        this.layoutCommentsAfterRender();
      },

      onShowDeletionDialog(commentDescriptor) {
        this.commentDescriptorToDelete = commentDescriptor;
        this.$refs.commentDeletionDialog.show = true;
        this.dialogType = commentDescriptor.isMain ? 'thread' : 'comment';
      },

      onDeleteClicked() {
        const commentDescriptors = this.commentDescriptors.filter((commentDescriptor) => {
          return commentDescriptor.comment.highlightKey === this.commentDescriptorToDelete.comment.highlightKey;
        });
        this.$emit('delete-highlight', this.commentDescriptorToDelete, commentDescriptors.length === 1 && !this.commentDescriptorToDelete.comment.replyTo);
      },

      deleteComment(commentIdAndVersion) {
        Comment.delete({
          commentId: commentIdAndVersion.id,
          version: commentIdAndVersion.version,
        });
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

      .v-toolbar__content {
        padding: 0 8px;
      }
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
