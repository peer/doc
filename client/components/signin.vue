<template>
  <v-layout row>
    <v-flex xs12 sm8 offset-sm2 md4 offset-md4 xl2 offset-xl5>
      <v-form v-model="valid" @submit.prevent="onSubmit">
        <v-card>
          <v-card-text>
            <v-text-field label="Username" v-model="username" :rules="usernameRules" required></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn type="submit" :disabled="!valid" block color="primary">Sign in</v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import Vue from 'vue';

  import {User} from '/lib/user';

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
        usernameRules: [checkUsername]
      }
    },

    methods: {
      onSubmit() {
        User.createUserAndSignIn(this.username, (error, userId) => {
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
