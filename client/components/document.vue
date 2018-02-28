<template>
  <v-layout v-if="document" row>
    <v-flex xs8>
      <v-card>
        <v-card-text>
          <!-- TODO: Display editor only if you have permissions. -->
          <editor :content-key="document.contentKey" @commentsFetched="showComments" @contentChanged="layoutComments" />
        </v-card-text>
      </v-card>
    </v-flex>
    <v-flex xs4>
      <v-container fluid class="app-layout__users">
        <v-layout row wrap justify-start align-content-start>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #9fa8da;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/women/71.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #90caf9;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/women/72.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #b39ddb;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/men/73.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #80cbc4;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/women/74.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #e6ee9c;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/men/75.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #ffcc80;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/men/77.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
          <v-flex class="app-layout__user">
            <v-btn flat icon style="border-color: #ffab91;">
              <v-avatar size="36px"><img src="https://randomuser.me/api/portraits/men/78.jpg" alt=""></v-avatar>
            </v-btn>
          </v-flex>
        </v-layout>
        <v-layout row class="mt-3">
          <v-flex>
            <v-tabs grow light id="tab-sidebar">
              <v-tabs-bar class="grey lighten-4">
                <v-tabs-item ripple href="#comments" class="primary--text">Comments</v-tabs-item>
                <v-tabs-item ripple href="#chat" class="primary--text"><v-badge><span slot="badge">4</span>Chat</v-badge></v-tabs-item>
                <v-tabs-item ripple href="#history" class="primary--text">History</v-tabs-item>
                <v-tabs-slider color="primary" />
              </v-tabs-bar>
              <v-tabs-items>
                <v-tabs-content id="comments">
                  <v-card v-for="comment of documentComments" :key="comment._id" :style="{marginTop: `${comment.marginTop}px`}" ref="commentsRef">
                    <v-card-text>
                      {{comment.text}}
                    </v-card-text>
                  </v-card>
                </v-tabs-content>
              </v-tabs-items>
            </v-tabs>
          </v-flex>
        </v-layout>
      </v-container>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/document';

  function getOffset(el) {
    const e = el.getBoundingClientRect();
    return {
      left: e.left + window.scrollX,
      top: e.top + window.scrollY,
    };
  }
  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
    },
    data() {
      return {
        documentComments: [],
      };
    },
    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },
    mounted() {
      window.addEventListener('resize', this.handleWindowResize);
    },
    methods: {
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

        this.documentComments = currentComments.map((c, i) => {
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = document.querySelector(`span[data-highlight-ids='${c.highlightId}']`);
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
          // acoordingly.
          this.layoutComments();
        });
      },
      layoutComments() {
        if (!this.$refs.commentsRef) {
          return;
        }
        const highlightTops = this.documentComments.map((c, i) => {
          // `highlightTop` will indicate the Y position of each text segment inside
          // the editor that contains each comment.
          const el = document.querySelector(`span[data-highlight-ids='${c.highlightId}']`);
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

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/:documentId',
        name: 'document',
        props: true,
      },
    ]);
  });

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
    }
  }

  .app-layout__users {
    padding-top: 0;
    padding-right: 0;
  }
</style>
