<template>
  <not-found v-if="passwordlessAuthDisabled" />
  <access-denied v-else-if="$currentUserId" />
  <v-layout
    v-else
    row
  >
    <v-flex
      xs12
      sm8
      offset-sm2
      md4
      offset-md4
      xl2
      offset-xl5
    >
      <v-form
        v-model="valid"
        @submit.prevent="onSubmit"
      >
        <v-card>
          <v-card-text>
            <!-- TODO: This should open with "slideDown" effect, where it pushes the content down gradually, as it grows vertically. -->
            <v-alert
              v-model="errorShow"
              color="error"
              dismissible
              transition="scale-transition"
              class="mb-3"
            >{{errorMessage}}</v-alert>
            <v-text-field
              :readonly="formSubmissionInProgress"
              :label="usernameLabel"
              v-model="username"
              :rules="usernameRules"
              required
            />
          </v-card-text>
          <v-card-actions>
            <p-button
              :loading="formSubmissionInProgress"
              :disabled="!valid || formSubmissionInProgress"
              type="submit"
              block
              color="primary"
            >
              <translate>sign-in</translate>
            </p-button>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-flex>
  </v-layout>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {User} from '/lib/documents/user';

  import {Snackbar} from '../snackbar';

  function checkUsername(username) {
    if (!username) {
      return this.$gettext("username-is-required");
    }
    if (username.length < 4) {
      return this.$gettext("username-too-short");
    }
    if (!User.VALID_USERNAME.test(username)) {
      return this.$gettext("username-invalid");
    }
    return true;
  }

  // @vue/component
  const component = {
    data() {
      return {
        valid: false,
        username: '',
        usernameRules: [checkUsername.bind(this)],
        formSubmissionInProgress: false,
        errorShow: false,
        errorMessage: null,
        usernameLabel: this.$gettext("username"),
        passwordlessAuthDisabled: Meteor.settings.public.passwordlessAuthDisabled,
      };
    },

    methods: {
      onSubmit() {
        this.errorShow = false;
        this.formSubmissionInProgress = true;

        User.passwordlessSignIn({username: this.username}, (error, user) => {
          this.formSubmissionInProgress = false;

          if (error) {
            this.errorMessage = `${error}`;
            this.errorShow = true;
          }
          else {
            Snackbar.enqueue(this.$gettext("signed-in-success"), 'success');
            // TODO: Redirect to the previous page and not just to the front page.
            //       See: https://github.com/vuejs/vue-router/issues/883
            this.$router.push({name: 'front-page'});
          }
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/user/signin',
        name: 'user-signin',
      },
    ]);
  });

  export default component;
</script>
