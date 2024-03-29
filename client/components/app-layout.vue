<template>
  <v-app :class="{embed: isEmbedded}">
    <v-toolbar
      v-if="!isEmbedded"
      app
      absolute
      extension-height="49px"
    >
      <v-btn
        :to="{name: 'front-page'}"
        exact
        icon
      >
        <v-icon>apps</v-icon>
      </v-btn>
      <v-toolbar-title>PeerDoc</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn
          :to="{name: 'documents'}"
          flat
        >
          <translate>documents</translate>
        </v-btn>
        <v-menu
          v-if="$currentUser"
          offset-y
          bottom
          left
          origin="top right"
        >
          <v-btn
            slot="activator"
            flat
          >
            {{$currentUser.username}}
            <v-avatar
              size="36px"
              class="app-layout__avatar"
            >
              <img
                :src="$currentUser.avatarUrl()"
                alt=""
              >
            </v-avatar>
          </v-btn>
          <v-list>
            <v-list-tile @click="onSignOut">
              <v-list-tile-title v-translate>
                sign-out
              </v-list-tile-title>
            </v-list-tile>
          </v-list>
        </v-menu>
        <v-btn
          v-else-if="!passwordlessAuthDisabled"
          :to="{name: 'user-signin'}"
          flat
        >
          <translate>sign-in</translate>
        </v-btn>
      </v-toolbar-items>
      <template
        v-if="isToolbarPortalActive"
        slot="extension"
      >
        <portal-target
          name="toolbar"
          slim
        />
      </template>
    </v-toolbar>
    <v-content>
      <v-container
        fluid
        fill-height
      >
        <!--
          We use route path as a key to force "router-view" component to be recreated
          every time the path changes, instead of props just be updated (which would
          happen otherwise for example if user navigated from "/document/1" to
          "/document/2"). This means that components do not have to expect props
          coming from the route path to ever reactively change.
        -->
        <router-view :key="$route.path" />
      </v-container>
    </v-content>
    <v-snackbar
      v-model="snackbarIsShown"
      :timeout="snackbarTime"
    >
      {{snackbarMessage}}
      <v-btn
        :color="snackbarColor"
        flat
        @click.native="onSnackbarClose"
      >
        <translate>close</translate>
      </v-btn>
    </v-snackbar>
  </v-app>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import {Wormhole} from 'portal-vue';

  import {isEmbedded} from '../embed';
  import {Snackbar} from '../snackbar';

  const component = {
    data() {
      return {
        snackbarIsShown: false,
        snackbarMessage: null,
        snackbarColor: null,
        snackbarDocumentId: null,
        isEmbedded: isEmbedded(),
        passwordlessAuthDisabled: Meteor.settings.public.passwordlessAuthDisabled,
      };
    },

    computed: {
      isToolbarPortalActive() {
        return Wormhole.hasContentFor('toolbar');
      },
    },

    created() {
      this.snackbarTime = 6000;
      this.snackbarTimeout = null;
      this.snackbarComputation = null;
      this.showNextSnackbar();
    },

    watch: {
      snackbarIsShown(newValue, oldValue) {
        if (newValue === false && this.snackbarDocumentId) {
          Snackbar.documents.remove({_id: this.snackbarDocumentId});
          this.snackbarDocumentId = null;
        }
      },
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
          const snackbar = Snackbar.documents.findOne({shown: false}, {sort: {createdAt: 1}});
          if (!snackbar) return;

          // Stop current computation. We will create a new one to wait
          // when showNextSnackbar will be called again.
          computation.stop();
          Snackbar.documents.update({_id: snackbar._id}, {$set: {shown: true}});

          this.snackbarDocumentId = snackbar._id;
          this.snackbarMessage = snackbar.message;
          this.snackbarColor = snackbar.color;
          this.snackbarIsShown = true;

          this.snackbarTimeout = Meteor.setTimeout(() => {
            this.snackbarTimeout = null;

            this.showNextSnackbar();
          }, this.snackbarTime + 300);
        });
      },

      onSnackbarClose() {
        this.clearSnackbarState();

        this.snackbarIsShown = false;

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

  .v-toolbar__extension {
    padding: 0;
    border-top: 1px solid rgba(0,0,0,0.12);
  }
</style>
