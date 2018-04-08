<template>
  <v-container fluid class="sidebar__users">
    <v-card>
      <v-toolbar dense card>
        <v-chip v-if="!documentPublished" label color="yellow" text-color="white" class="doc_status__label"><translate>document-draft</translate></v-chip>
        <v-chip v-else label color="green" text-color="white" class="doc_status__label"><translate>document-published</translate></v-chip>
        <v-btn v-if="!documentPublished && $currentUserId" color="success" :to="{name: 'publishDocument', params: {documentId}}"><translate>document-publish</translate></v-btn>
      </v-toolbar>
    </v-card>
    <v-layout row wrap ref="commentsList">
      <v-flex @click.stop="comment.showAddCommentForm = !comment.showAddCommentForm" xs12 v-for="comment of documentComments" :key="comment._id" :style="{marginTop: `${comment.marginTop}px`}">
        <v-card hover :class="['sidebar__comment', {'elevation-10': comment.focus}]" :style="{'padding-top': `${commentCardPaddingTop}px`, 'padding-bottom': `${commentCardPaddingBottom}px`}" ref="comments">
          <v-container style="padding: 0px;">
            <comment :comment="comment"/>
            <v-container style="padding-top: 5px; padding-bottom: 5px" v-show="comment.hasManyReplies && !comment.showAllReplies">
              <v-divider/>
              <v-layout row>
                <v-flex text-xs-center>
                  <v-btn flat small @click.stop="showReplies(comment)"><translate>view-all-replies</translate></v-btn>
                </v-flex>
              </v-layout>
              <v-divider/>
            </v-container>
            <v-layout row v-for="(reply, index) of comment.replies" :key="reply._id">
              <comment style="padding-top:5px" v-show="comment.showAllReplies || (!comment.showAllReplies && index==comment.replies.length-1)" :comment="reply"/>
            </v-layout>
          </v-container>
          <v-container style="padding: 0px;">
            <v-layout row>
              <v-flex xs10 offset-xs1>
                <transition>
                  <div v-show="comment.showAddCommentForm">
                    <v-form @submit.prevent="onReply">
                      <v-text-field
                        @click.stop
                        autofocus
                        multi-line
                        rows="1"
                        v-model="comment.reply"
                        auto-grow
                        :placeholder="commentHint"
                        required
                        hide-details
                        style="padding-top: 0px; padding-bottom: 5px;"
                      />
                    </v-form>
                    <v-card-actions v-show="comment.reply != undefined && comment.reply.length > 0" style="padding-top: 5px; padding-bottom: 0px">
                      <v-btn small color="secondary" flat @click.stop="comment.showAddCommentForm = false"><translate>cancel</translate></v-btn>
                      <v-btn small color="primary" flat @click.stop="onReply(comment)"><translate>insert</translate></v-btn>
                    </v-card-actions>
                  </div>
                </transition>
              </v-flex>
            </v-layout>
          </v-container>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>

  import {_} from 'meteor/underscore';

  import {Comment} from '/lib/documents/comment';

  function getOffset(el) {
    const e = el.getBoundingClientRect();
    return {
      left: e.left + window.scrollX,
      top: e.top + window.scrollY,
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
        commentsHandle: null,
        documentComments: [],
        commentCardPaddingTop: 10,
        commentCardPaddingBottom: 10,
        commentHint: this.$gettext("comment-hint"),
      };
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
          this.showComments(comments);
        }
      });

      window.addEventListener('resize', this.handleWindowResize);
    },

    beforeDestroy() {
      window.removeEventListener('resize', this.handleWindowResize);
    },

    methods: {

      showReplies(comment) {
        comment.showAllReplies = true; // eslint-disable-line no-param-reassign
        this.layoutCommentsAfterRender();
      },

      collapseComments() {
        this.documentComments = this.documentComments.map((c) => {
          return Object.assign({}, c, {
            showAllReplies: false,
          });
        });
        this.layoutCommentsAfterRender();
      },

      onReply(comment) {
        Comment.create({
          highlightKey: comment.highlightKey,
          body: comment.reply,
          documentId: this.documentId,
          replyTo: comment._id,
        });
        comment.showAddCommentForm = false; // eslint-disable-line no-param-reassign
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

        const groupedReplies = _.groupBy(replies, (reply) => {
          return reply.highlightKey;
        });

        currentComments = currentComments.filter((comment) => {
          return comment.replyTo === null;
        }).map((comment) => {
          let commentReplies = groupedReplies[comment.highlightKey];
          if (commentReplies) {
            commentReplies = commentReplies.sort((a, b) => {
              if (a.createdAt > b.createdAt) {
                return 1;
              }
              else if (a.createdAt < b.createdAt) {
                return -1;
              }
              else {
                return 0;
              }
            }).map((reply) => {
              return Object.assign({}, reply, {
                showDetails: false,
              });
            });
          }
          else {
            commentReplies = [];
          }
          return Object.assign({}, comment, {
            replies: commentReplies,
          });
        });

        const commentMarksEls = document.querySelectorAll(`span[data-highlight-keys]`);
        this.documentComments = currentComments.map((c, i) => {
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, c.highlightKey);
          if (!el) {
            return null;
          }
          return Object.assign({}, c, {
            highlightTop: getOffset(el).top,
            showDetails: false,
            showAddCommentForm: false,
            showAllReplies: c.replies.length <= 1,
            hasManyReplies: c.replies.length > 1,
            isReply: c.replyTo === null,
            focus: false,
          });
        }).filter((c) => {
          return c;
        }).sort((a, b) => {
          // We sort these values in order to place the comments correctly.
          // For example, you could have a newer comment positioned on top
          // of an older one, so we have to sort the positions accordinglys
          // before Vue tries to render them.
          if (a.highlightTop > b.highlightTop) {
            return 1;
          }
          else if (a.highlightTop < b.highlightTop) {
            return -1;
          }
          else if (a.createdAt > b.createdAt) {
            return 1;
          }
          else if (a.createdAt < b.createdAt) {
            return -1;
          }
          else {
            return 0;
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

        this.layoutCommentsAfterRender();
      },

      layoutCommentsAfterRender() {
        this.$nextTick().then(() => {
          // After the cards have been rendered we can start measuring the
          // distance between each cards with the next, and adjust the margins
          // accordingly.
          this.layoutComments();
        });
      },

      layoutComments() {
        if (!this.$refs.comments) {
          return;
        }
        const commentMarksEls = document.querySelectorAll(`span[data-highlight-keys]`);
        const highlightTops = this.documentComments.map((c, i) => {
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, c.highlightKey);
          if (!el) {
            return null;
          }
          return getOffset(el).top;
        });

        const heights = this.$refs.comments.map((ref) => {
          // Comment and replies container height (without comment input container) + comment card padding.
          return ref.$el.firstChild.offsetHeight + this.commentCardPaddingTop + this.commentCardPaddingBottom;
        });

        for (let i = 0; i < this.documentComments.length; i += 1) {
          const c = this.documentComments[i];
          const height = heights[i];
          let bottom = 0;
          let {marginTop} = c;
          if (i === 0) {
            const el2 = this.$refs.commentsList;
            const el2Y = getOffset(el2).top;
            const elY = highlightTops[0];
            marginTop = elY - el2Y > 0 ? elY - el2Y : 0;
            // const {top} = getOffset(this.$refs.comments[i].$el);
            bottom = el2Y + marginTop + height;
          }
          else {
            const previousBottom = this.documentComments[i - 1].bottom;
            marginTop = highlightTops[i] - previousBottom > 0 ? highlightTops[i] - previousBottom : 5;
            bottom = previousBottom + marginTop + height;
          }
          this.documentComments.splice(i, 1, Object.assign({}, c, {bottom, marginTop}));
        }
      },

      focusComment(highlightKey) {
        this.documentComments = this.documentComments.map((x) => {
          return Object.assign({}, x, {focus: x.highlightKey === highlightKey});
        });
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .sidebar__users {
    padding-top: 0;
    padding-right: 0;
  }

  .doc_status__label {
    text-transform: uppercase;
    font-weight: bold;
  }

  .sidebar__comment {
    cursor: pointer;
  }
</style>
