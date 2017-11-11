<template>
  <v-layout v-if="document" row>
    <v-flex xs12>
      <v-card>
        <v-card-text>
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()"></not-found>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/document';

  const component = {
    props: {
      documentId: {
        type: String,
        required: true
      }
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId
        });
      }
    }
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/:documentId',
        name: 'document',
        props: true
      },
    ]);
  });

  export default component;
</script>
