<template>
  <p>
    Front page.
  </p>
</template>

<script>
  import Vue from 'vue';
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  const component = {
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/',
        name: 'front-page'
      },
    ]);
  });

  export default component;
</script>
