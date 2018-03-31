<template>
  <v-app :class="{embed: isEmbeded}">
    <v-toolbar app absolute v-if="!isEmbeded">
      <v-btn :to="{name: 'front-page'}" exact icon>
        <v-icon>apps</v-icon>
      </v-btn>
      <v-toolbar-title>PeerDoc</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn :to="{name: 'documents'}" flat><translate>documents</translate></v-btn>
        <v-menu v-if="$currentUser" offset-y bottom left origin="top right">
          <v-btn slot="activator" flat>{{$currentUser.username}}
            <v-avatar size="36px" class="app-layout__avatar"><img :src="$currentUser.avatarUrl()" alt=""></v-avatar>
          </v-btn>
          <v-list>
            <v-list-tile @click="onSignOut">
              <v-list-tile-title v-translate>sign-out</v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-btn v-else-if="!passwordlessAuthDisabled" :to="{name: 'user-signin'}" flat><translate>sign-in</translate></v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <v-content>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-content>
    <v-snackbar :timeout="snackbarTime" :color="snackbarColor" v-model="snackbarShow">
      {{snackbarMessage}}
      <v-btn flat dark @click.native="onSnackbarClose"><translate>close</translate></v-btn>
    </v-snackbar>
  </v-app>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import {isEmbedded} from '../embed';
  import {Snackbar} from '../snackbar';

  const component = {
    data() {
      return {
        snackbarShow: false,
        snackbarMessage: null,
        snackbarColor: null,
        isEmbeded: isEmbedded(),
        passwordlessAuthDisabled: Meteor.settings.public.passwordlessAuthDisabled,
      };
    },

    created() {
      this.snackbarTime = 6000;
      this.snackbarTimeout = null;
      this.snackbarComputation = null;
      this.showNextSnackbar();
    },

    methods: {
      onSignOut() {
        Meteor.logout((error) => {
          if (error) {
            const translated = this.$gettext("signed-out-error");
            Snackbar.enqueue(this.$gettextInterpolate(translated, {error}), 'error');
          }
          else {
            Snackbar.enqueue(this.$gettext("signed-out-success"), 'success');
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
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .app-layout__avatar {
    margin-left: 8px;
  }

  // We disable min-height otherwise iframe does not shrink when embedded.
  .embed .application--wrap {
    min-height: 0;
  }
</style>
