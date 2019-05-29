<template>
  <v-toolbar
    flat
    dense
  >
    <v-toolbar-items />
  </v-toolbar>
</template>

<script>
  import Vue from 'vue';

  export const documentToolbarState = Vue.observable({documentId: null});

  // @vue/component
  const component = {
    computed: {
      document() {
        return Document.documents.findOne({
          _id: documentToolbarState.documentId,
        });
      },
    },

    created() {
      this.$autorun((computation) => {
        if (documentToolbarState.documentId) {
          this.$subscribe('Document.one', {documentId: documentToolbarState.documentId});
        }
      });
    },
  };

  export default component;
</script>
