<template>
  <access-denied v-if="currentUserId"></access-denied>
  <v-layout v-else row>
    <v-flex xs12 sm8 offset-sm2 md4 offset-md4 xl2 offset-xl5>
      <v-form v-model="valid" @submit.prevent="onSubmit">
        <v-card>
          <v-card-text>
            <v-text-field :readonly="formSubmissionInProgress" label="Username" v-model="username" :rules="usernameRules" required></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn type="submit" :disabled="!valid || formSubmissionInProgress" block color="primary">
              <span>Sign in</span>
              <v-progress-linear v-if="formSubmissionInProgress" :indeterminate="true" :height="3" color="primary" class="signin-progress"></v-progress-linear>
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
        formSubmissionInProgress: false
      }
    },

    computed: {
      currentUserId() {
        return Meteor.userId();
      }
    },

    methods: {
      onSubmit() {
        this.formSubmissionInProgress = true;
        User.createUserAndSignIn(this.username, (error, userId) => {
          this.formSubmissionInProgress = false;

          if (error) {
          }
          else {
            Snackbar.enqueue("You have been signed in.", 'success');
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

<style lang="stylus">
  .signin-progress
    position absolute
    bottom 0
    margin-bottom 0
</style>