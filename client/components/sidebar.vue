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
        <v-tabs grow light show-arrows color="grey lighten-4">
          <v-tabs-slider color="primary" />
          <v-tab ripple href="#comments" class="primary--text">Comments</v-tab>
          <v-tab ripple href="#chat" class="primary--text"><v-badge><span slot="badge">4</span>Chat</v-badge></v-tab>
          <v-tab ripple href="#history" class="primary--text">History</v-tab>
          <v-tabs-items>
            <v-tab-item id="comments">
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
            </v-tab-item>
          </v-tabs-items>
        </v-tabs>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
  import {_} from 'meteor/underscore';

  import {Cursor} from '/lib/cursor';

  // @vue/component
  const component = {
    props: {
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
        cursors: [],
      };
    },
    created() {
      this.$autorun((computation) => {
        this.cursorsHandle = this.$subscribe('Cursor.feed', {contentKey: this.contentKey});
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
    },
    methods: {
      onAvatarClicked(cursor) {
        this.$emit('click', cursor);
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
