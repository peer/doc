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
        :key="key"
        @content-changed="onContentChanged"
        @highlight-selected="onHighlightSelected"
        @highlight-added="onHighlightAdded"
        @highlight-deleted="onHighlightDeleted"
        @show-new-comment-form="onShowNewCommentForm"
      />
    </v-flex>
    <v-flex xs4>
      <sidebar
        ref="sidebar"
        :document-id="document._id"
        :content-key="document.contentKey"
        :client-id="clientId"
        @comment-clicked="onCommentClicked"
        @add-highlight="addCommentHighlight"
        @delete-highlight="deleteCommentHighlight"
        @afterCommentAdded="onAfterCommentAdded"
        @undo-changes="reloadEditor"
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
        key: `editor-${Date.now()}`,
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
      reloadEditor(key) {
        this.key = key;
      },

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

      addCommentHighlight(highlightKey) {
        this.$refs.editor.addCommentHighlight(highlightKey);
      },

      deleteCommentHighlight(commentDescriptor, deleteHighlight) {
        this.$refs.editor.deleteCommentHighlight(commentDescriptor, deleteHighlight);
      },

      onHighlightAdded(highlightKey) {
        this.$refs.sidebar.createComment(highlightKey);
      },

      onHighlightDeleted(commentIdAndVersion) {
        this.$refs.sidebar.deleteComment(commentIdAndVersion);
      },

      onAfterCommentAdded(highlightKey) {
        this.$refs.editor.onAfterCommentAdded(highlightKey);
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
