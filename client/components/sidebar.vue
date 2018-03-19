<template>
  <v-container fluid class="app-layout__users">
    <v-layout row wrap justify-start align-content-start>
      <v-flex class="app-layout__user" v-for="cursor of cursors" :key="cursor._id">
        <v-btn flat icon :style="{borderColor: cursor.color}" @click="onAvatarClicked(cursor)">
          <v-avatar size="36px"><img :src="cursor.author.avatar" :alt="cursor.author.username" :title="cursor.author.username"></v-avatar>
        </v-btn>
      </v-flex>
    </v-layout>
    <v-layout row class="mt-3">
      <v-flex>
        <v-tabs grow light show-arrows color="grey lighten-4" id="tab-sidebar">
          <v-tabs-slider color="primary" />
          <v-tab ripple href="#comments" class="primary--text"><translate>comments</translate></v-tab>
          <v-tab ripple href="#chat" class="primary--text"><v-badge><span slot="badge">4</span><translate>chat</translate></v-badge></v-tab>
          <v-tab ripple href="#history" class="primary--text"><translate>history</translate></v-tab>
          <v-tabs-items>
            <v-tab-item id="comments">
              <v-card v-for="comment of documentComments" :key="comment._id" :style="{marginTop: `${comment.marginTop}px`}" ref="commentsRef">
                <v-card-text>
                  {{comment.body}}
                </v-card-text>
              </v-card>
            </v-tab-item>
          </v-tabs-items>
        </v-tabs>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
  import {_} from 'meteor/underscore';

  import {Comment} from '/lib/comment';
  import {Cursor} from '/lib/cursor';

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
      const leys = commentMarkEl.attributes["data-highlight-keys"].value.split(",");
      if (leys.find((commentId) => {
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
        cursorsHandle: null,
        cursors: [],
        documentComments: [],
      };
    },

    created() {
      this.$autorun((computation) => {
        this.commentsHandle = this.$subscribe('Comment.list', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        this.cursorsHandle = this.$subscribe('Cursor.list', {contentKey: this.contentKey});
      });
    },

    mounted() {
      this.$autorun((computation) => {
        this.cursors = Cursor.documents.find(_.extend(this.cursorsHandle.scopeQuery(), {
          clientId: {
            $ne: this.clientId,
          },
        })).fetch();
      });

      this.$autorun((computation) => {
        const comments = Comment.documents.find(this.commentsHandle.scopeQuery()).fetch();
        if (comments.length) {
          this.showComments(comments);
        }
      });

      window.addEventListener('resize', this.handleWindowResize);
    },

    methods: {
      onAvatarClicked(cursor) {
        this.$emit('click', cursor);
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
        const currentComments = comments
        .filter((c) => {
          return !c.versionTo;
        });

        if (!currentComments.length) {
          this.documentComments = currentComments;
          return;
        }

        const commentMarksEls = document.querySelectorAll(`span[data-highlight-keys]`);
        this.documentComments = currentComments.map((c, i) => {
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = getElementByHighlightKey(commentMarksEls, c.highlightKey);
          if (!el) {
            return null;
          }
          return Object.assign({}, c, {highlightTop: getOffset(el).top});
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

        this.$nextTick().then(() => {
          // After the cards have been rendered we can start measuring the
          // distance between each cards with the next, and adjust the margins
          // accordingly.
          this.layoutComments();
        });
      },

      layoutComments() {
        if (!this.$refs.commentsRef) {
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

        const heights = this.$refs.commentsRef.map((ref) => {
          return ref.$el.offsetHeight;
        });

        for (let i = 0; i < this.documentComments.length; i += 1) {
          const c = this.documentComments[i];
          const height = heights[i];
          let bottom = 0;
          let {marginTop} = c;
          if (i === 0) {
            const el2 = document.querySelector("#tab-sidebar .tabs__container");
            const el2Y = getOffset(el2).top + el2.offsetHeight;
            const elY = highlightTops[0];
            marginTop = elY - el2Y > 0 ? elY - el2Y : 0;
            // const {top} = getOffset(this.$refs.commentsRef[i].$el);
            bottom = el2Y + marginTop + height;
          }
          else {
            const previousBottom = this.documentComments[i - 1].bottom;
            marginTop = highlightTops[i] - previousBottom > 0 ? highlightTops[i] - previousBottom : 0;
            bottom = previousBottom + marginTop + height;
          }
          this.documentComments.splice(i, 1, Object.assign({}, c, {bottom, marginTop}));
        }
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .app-layout__user {
    flex: 0 0 auto;

    button {
      margin: 2px;
      border-radius: 50%;
      height: 42px;
      width: 42px;
      border-width: 2px;
      border-style: solid;
      padding: 1px;

      .btn__content {
        height: 100%;
      }
    }
  }

  .app-layout__users {
    padding-top: 0;
    padding-right: 0;
  }
</style>