<template>
  <v-layout row>
    <v-flex xs12>
      <p v-translate>
        front-page
      </p>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  // @vue/component
  const component = {};

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/',
        name: 'front-page',
      },
    ]);
  });

  export default component;
</script>
