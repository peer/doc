<template>
  <p>{{$route.params.documentId}}</p>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  const component = {};

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/:documentId',
        name: 'document'
      },
    ]);
  });

  export default component;
</script>
