<template>
  <div
    v-if="document"
    class="document-status"
  >
    <v-chip
      v-if="document.isPublished()"
      label
      disabled
      color="green lighten-2"
      class="document-status__status"
    ><translate>document-is-published</translate></v-chip>
    <v-chip
      v-else
      label
      disabled
      color="yellow lighten-2"
      class="document-status__status"
    ><translate>document-is-draft</translate></v-chip>
    <v-chip
      v-if="document.forkedFrom"
      label
      disabled
      color="blue lighten-2"
      class="document-status__status"
    ><translate>document-is-fork</translate></v-chip>
  </div>
</template>

<script>
  import {Document} from '/lib/documents/document';

  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .document-status__status {
    text-transform: uppercase;
    font-weight: bold;
  }
</style>
