<template>
  <v-app>
    <v-toolbar app>
      <v-btn :to="{name: 'front-page'}" exact icon>
        <v-icon>apps</v-icon>
      </v-btn>
      <v-toolbar-title>PeerDoc</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-toolbar-items>
        <v-btn :to="{name: 'documents'}" flat>Documents</v-btn>
        <!--
          TODO: Menu should open aligned on the right with the button and grow to the left, if necessary.
                See: https://github.com/vuetifyjs/vuetify/issues/2383
        -->
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
    <v-snackbar :timeout="snackbarTime" :color="snackbarColor" v-model="snackbarShow">
      {{snackbarMessage}}
      <v-btn flat dark @click.native="onSnackbarClose">Close</v-btn>
    </v-snackbar>
  </v-app>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import {Snackbar} from '../snackbar';

  const component = {
    data() {
      return {
        snackbarShow: false,
        snackbarMessage: null,
        snackbarColor: null
      }
    },

    created() {
      this.snackbarTime = 6000;
      this.snackbarTimeout = null;
      this.snackbarComputation = null;
      this.showNextSnackbar();
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
            Snackbar.enqueue(`Error signing out: ${error}`, 'error');
          }
          else {
            Snackbar.enqueue("You have been signed out.", 'success');
          }
        });
      },

      clearSnackbarState() {
        if (this.snackbarTimeout) {
          Meteor.clearTimeout(this.snackbarTimeout);
          this.snackbarTimeout = null;
        }

        if (this.snackbarComputation) {
          this.snackbarComputation.stop();
          this.snackbarComputation = null;
        }
      },

      showNextSnackbar() {
        this.clearSnackbarState();

        this.snackbarComputation = this.$autorun((computation) => {
          // Wait for the next snackbar to be available.
          const snackbar = Snackbar.documents.findOne({}, {sort: {createdAt: 1}});
          if (!snackbar) return;

          // Stop current computation. We will create a new one to wait
          // when showNextSnackbar will be called again.
          computation.stop();
          Snackbar.documents.remove({_id: snackbar._id});

          this.snackbarMessage = snackbar.message;
          this.snackbarColor = snackbar.color;
          this.snackbarShow = true;

          this.snackbarTimeout = Meteor.setTimeout(() => {
            this.snackbarTimeout = null;

            this.showNextSnackbar();
          }, this.snackbarTime + 300);
        });
      },

      onSnackbarClose() {
        this.clearSnackbarState();

        this.snackbarShow = false;

        Meteor.setTimeout(() => {
          this.showNextSnackbar();
        }, 300);
      }
    }
  };

  export default component;
</script>

<style lang="stylus">
  .app-layout-avatar
    margin-left 8px
</style>