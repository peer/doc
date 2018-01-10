<template>
  <access-denied v-if="currentUserId"></access-denied>
  <v-layout v-else row>
    <v-flex xs12 sm8 offset-sm2 md4 offset-md4 xl2 offset-xl5>
      <v-form v-model="valid" @submit.prevent="onSubmit">
        <v-card>
          <v-card-text>
            <!-- TODO: This should open with "slideDown" effect, where it pushes the content down gradually, as it grows vertically. -->
            <v-alert v-model="errorShow" color="error" dismissible transition="scale-transition" class="mb-3">{{errorMessage}}</v-alert>
            <v-text-field :readonly="formSubmissionInProgress" label="Username" v-model="username" :rules="usernameRules" required></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn type="submit" :disabled="!valid || formSubmissionInProgress" block color="primary">
              <span>Sign in</span>
              <v-progress-linear v-if="formSubmissionInProgress" :indeterminate="true" :height="3" color="primary" class="user-signin-progress"></v-progress-linear>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {User} from '/lib/user';
  import {Snackbar} from '../snackbar';

  function checkUsername(username) {
    if (!username) {
      return "Username is required";
    }
    if (username.length < 4) {
      return "Username too short, it should be 4 characters or more"
    }
    if (!User.VALID_USERNAME.test(username)) {
      return "Invalid username, it should contain only basic characters"
    }
    return true;
  }

  const component = {
    data() {
      return {
        valid: false,
        username: '',
        usernameRules: [checkUsername],
        formSubmissionInProgress: false,
        errorShow: false,
        errorMessage: null
      }
    },

    computed: {
      currentUserId() {
        return Meteor.userId();
      }
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
            Snackbar.enqueue("You have been signed in.", 'success');
            // TODO: Redirect to the previous page and not just to the front page.
            //       See: https://github.com/vuejs/vue-router/issues/883
            this.$router.push({name: 'front-page'});
          }
        });
      }
    }
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/user/signin',
        name: 'user-signin'
      },
    ]);
  });

  export default component;
</script>

<style lang="scss">
  .user-signin-progress {
    position: absolute;
    bottom: 0;
    margin-bottom: 0;
  }
</style>
