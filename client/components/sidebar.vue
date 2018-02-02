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
        <v-tabs grow light>
          <v-tabs-bar class="grey lighten-4">
            <v-tabs-item ripple href="#comments" class="primary--text">Comments</v-tabs-item>
            <v-tabs-item ripple href="#chat" class="primary--text"><v-badge><span slot="badge">4</span>Chat</v-badge></v-tabs-item>
            <v-tabs-item ripple href="#history" class="primary--text">History</v-tabs-item>
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
