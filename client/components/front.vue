<template>
  <p>
    Front page.
  </p>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import Vue from 'vue';

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
