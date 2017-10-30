<template>
  <p>
    Documents.
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
        path: '/document',
        name: 'documents'
      },
    ]);
  });

  export default component;
</script>
