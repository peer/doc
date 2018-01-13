<template>
  <v-layout v-if="document" row>
    <v-flex xs12>
      <v-card>
        <v-card-text>
          <!-- TODO: Display editor only if you have permissions. -->
          <editor :content-key="document.contentKey" />
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/document';

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

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/:documentId',
        name: 'document',
        props: true,
      },
    ]);
  });

  export default component;
</script>
