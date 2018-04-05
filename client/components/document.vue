<template>
  <v-layout v-if="document" row>
    <v-flex xs8>
      <!-- TODO: Display editor only if you have permissions. -->
      <editor
        :document-id="document._id"
        :content-key="document.contentKey"
        :client-id="clientId"
        @contentChanged="onContentChanged"
        @highlightSelected="onhighlightSelected"
        :read-only="document.isPublished()"
      />
    </v-flex>
    <v-flex xs4>
      <sidebar
        :document-id="document._id"
        :content-key="document.contentKey"
        :document-published="document.isPublished()"
        :client-id="clientId"
        ref="sidebar" />
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {Random} from 'meteor/random';
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/documents/document';

  // @vue/component
  const component = {
    props: {
      documentId: {
        type: String,
        required: true,
      },
    },

    data() {
      return {
        clientId: Random.id(),
      };
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

    methods: {
      onContentChanged() {
        this.$refs.sidebar.layoutComments();
      },
      onhighlightSelected(highlightKey) {
        this.$refs.sidebar.focusComment(highlightKey);
      },
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
