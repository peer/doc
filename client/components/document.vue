<template>
  <v-layout
    v-if="document"
    row
    @mousedown="onMouseDown"
  >
    <v-flex xs8>
      <!-- TODO: Display editor only if you have permissions. -->
      <editor
        ref="editor"
        :document-id="document._id"
        :content-key="document.contentKey"
        :client-id="clientId"
        :read-only="document.isPublished()"
        @contentChanged="onContentChanged"
        @highlightSelected="onHighlightSelected"
        @showNewCommentForm="onShowNewCommentForm"
      />
    </v-flex>
    <v-flex xs4>
      <sidebar
        ref="sidebar"
        :document-id="document._id"
        :content-key="document.contentKey"
        :document-published="document.isPublished()"
        :client-id="clientId"
        @commentClicked="onCommentClicked"
        @commentAdded="onCommentAdded"
        @afterCommentAdded="onAfterCommentAdded"
        @delete-comment="onDeleteComment"
      />
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
      onMouseDown(event) {
        if (event.target.className !== 'highlight--selected') {
          this.$refs.sidebar.focusComment();
        }
      },
      onContentChanged(version) {
        this.$refs.sidebar.onContentChanged(version);
      },
      onHighlightSelected(highlightKey) {
        this.$refs.sidebar.focusComment(highlightKey);
      },
      onCommentClicked(highlightKey) {
        this.$refs.editor.updateCursor(highlightKey);
      },
      onShowNewCommentForm(show, start) {
        this.$refs.sidebar.showNewCommentForm(show, start);
      },
      onCommentAdded(highlightKey) {
        this.$refs.editor.onCommentAdded(highlightKey);
      },
      onAfterCommentAdded(highlightKey) {
        this.$refs.editor.onAfterCommentAdded(highlightKey);
      },
      onDeleteComment(comment, deleteHighlight) {
        this.$refs.editor.deleteComment(comment, deleteHighlight);
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
