<template>
  <v-app>
    <v-toolbar app>
      <v-toolbar-title>PeerDoc</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items>
        <v-btn :to="{name: 'documents'}" flat>Documents</v-btn>
        <v-menu v-if="currentUser" offset-y bottom origin="top right">
          <v-btn slot="activator" flat>{{currentUser.username}}
            <v-avatar size="36px" class="app-layout-avatar"><img :src="currentUser.avatarUrl()" alt=""></v-avatar>
          </v-btn>
          <v-list>
            <v-list-tile @click="onSignOut">
              <v-list-tile-title>Sign out</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-btn v-else :to="{name: 'user-signin'}" flat>Sign in</v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <main>
      <v-content>
        <v-container fluid>
          <router-view></router-view>
        </v-container>
      </v-content>
    </main>
    <v-footer app>
      <a href="https://github.com/peer/doc">Source code</a>
    </v-footer>
    <v-snackbar :timeout="6000" :color="messageColor" v-model="messageShow">
      {{messageText}}
      <v-btn dark flat @click.native="messageShow = false">Close</v-btn>
    </v-snackbar>
  </v-app>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  const component = {
    data() {
      return {
        messageShow: false,
        messageText: null,
        messageColor: null
      }
    },

    computed: {
      currentUser() {
        return Meteor.user({username: 1, avatar: 1});
      }
    },

    methods: {
      onSignOut() {
        Meteor.logout((error) => {
          if (error) {
            this.messageText = `Error signing out: ${error}`;
            this.messageColor = 'error';
            this.messageShow = true;
          }
          else {
            this.messageText = "You have been signed out.";
            this.messageColor = 'success';
            this.messageShow = true;
          }
        });
      }
    }
  };

  export default component;
</script>

<style lang="stylus">
  .app-layout-avatar
    margin-left 8px
</style>