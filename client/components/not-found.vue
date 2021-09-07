<template>
  <v-layout row>
    <v-flex xs12>
      <h4 v-translate>
        not-found
      </h4>
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
        path: '*',
        name: 'not-found',
      },
    ]);
  }, -1);

  export default component;
</script>
