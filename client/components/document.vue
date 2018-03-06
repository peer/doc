<template>
  <v-layout v-if="document" row>
    <v-flex xs8>
      <v-card>
        <v-card-text>
          <!-- TODO: Display editor only if you have permissions. -->
          <editor :content-key="document.contentKey" />
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
            <v-tabs grow light>
              <v-tabs-bar class="grey lighten-4">
                <v-tabs-item ripple href="#comments" class="primary--text"><translate>comments</translate></v-tabs-item>
                <v-tabs-item ripple href="#chat" class="primary--text"><v-badge><span slot="badge">4</span><translate>chat</translate></v-badge></v-tabs-item>
                <v-tabs-item ripple href="#history" class="primary--text"><translate>history</translate></v-tabs-item>
                <v-tabs-slider color="primary" />
              </v-tabs-bar>
              <v-tabs-items>
                <v-tabs-content id="comments">
                  <v-card>
                    <v-card-text>
                      Comment 1.
                    </v-card-text>
                  </v-card>
                  <v-card>
                    <v-card-text>
                      Comment 2.
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

  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
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
