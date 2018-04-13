<template>
  <v-layout v-if="document" row @click="onDocumentClicked">
    <v-flex xs8>
      <!-- TODO: Display editor only if you have permissions. -->
      <editor
        :document-id="document._id"
        :content-key="document.contentKey"
        :client-id="clientId"
        @contentChanged="onContentChanged"
        @highlightSelected="onHighlightSelected"
        @commentAdded="onCommentAdded"
        :read-only="document.isPublished()"
        ref="editor"
      />
    </v-flex>
    <v-flex xs4>
      <sidebar
        :document-id="document._id"
        :content-key="document.contentKey"
        :document-published="document.isPublished()"
        :client-id="clientId"
        @commentClicked="onCommentClicked"
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
      onDocumentClicked(event) {
        if (event.target.className !== 'highlight--selected') {
          this.$refs.sidebar.collapseComments();
        }
      },
      onContentChanged() {
        this.$refs.sidebar.layoutComments();
      },
      onHighlightSelected(highlightKey) {
        this.$refs.sidebar.focusComment(highlightKey);
      },
      onCommentClicked(highlightKey) {
        this.$refs.editor.updateCursor(highlightKey);
      },
      onCommentAdded(highlightKey) {
        this.$refs.sidebar.commentAdded(highlightKey);
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
