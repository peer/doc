<template>
  <p>
    Documents.
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
        path: '/document',
        name: 'documents'
      },
    ]);
  });

  export default component;
</script>