<template>
  <access-denied v-if="currentUserId" />
  <v-layout v-else row>
    <v-flex xs12 sm8 offset-sm2 md4 offset-md4 xl2 offset-xl5>
      <v-form v-model="valid" @submit.prevent="onSubmit">
        <v-card>
          <v-card-text>
            <!-- TODO: This should open with "slideDown" effect, where it pushes the content down gradually, as it grows vertically. -->
            <v-alert v-model="errorShow" color="error" dismissible transition="scale-transition" class="mb-3">{{errorMessage}}</v-alert>
            <v-text-field :readonly="formSubmissionInProgress" :label="usernameLabel" v-model="username" :rules="usernameRules" required />
          </v-card-text>
          <v-card-actions>
            <v-btn type="submit" :disabled="!valid || formSubmissionInProgress" block color="primary">
              <span v-translate>Sign in</span>
              <v-progress-linear v-if="formSubmissionInProgress" :indeterminate="true" :height="3" color="primary" class="user-signin__progress" />
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-flex>
  </v-layout>
</template>

<script>
  import {Meteor} from 'meteor/meteor';
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {User} from '/lib/user';
  import {Snackbar} from '../snackbar';

  function checkUsername(username) {
    if (!username) {
      return this.$gettext("Username is required");
    }
    if (username.length < 4) {
      return this.$gettext("Username too short, it should be 4 characters or more");
    }
    if (!User.VALID_USERNAME.test(username)) {
      return this.$gettext("Invalid username, it should contain only basic characters");
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
        usernameLabel: '',
      };
    },

    computed: {
      currentUserId() {
        return Meteor.userId();
      },
    },

    mounted() {
      this.usernameLabel = this.$gettext("username");
    },

    methods: {
      onSubmit() {
        this.errorShow = false;
        this.formSubmissionInProgress = true;

        User.createUserAndSignIn({username: this.username}, (error, user) => {
          this.formSubmissionInProgress = false;

          if (error) {
            this.errorMessage = `${error}`;
            this.errorShow = true;
          }
          else {
            Snackbar.enqueue(this.$gettext("You have been signed in."), 'success');
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

<style lang="scss">
  .user-signin__progress {
    position: absolute;
    bottom: 0;
    margin-bottom: 0;
  }
</style>
