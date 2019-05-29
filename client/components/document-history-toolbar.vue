<template>
  <v-toolbar
    flat
    dense
  >
    <v-toolbar-items>
      <v-btn
        :to="{name: 'document', params: {documentId}}"
        flat
      ><translate>back-to-document</translate></v-btn>
    </v-toolbar-items>
  </v-toolbar>
</template>

<script>
  import Vue from 'vue';

  export const documentHistoryToolbarState = Vue.observable({documentId: null});

  // @vue/component
  const component = {
    computed: {
      documentId() {
        return documentHistoryToolbarState.documentId;
      },
    },
  };

  export default component;
</script>
