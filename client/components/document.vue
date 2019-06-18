<template>
  <v-layout
    v-if="document"
    row
    @mousedown="onMouseDown"
  >
    <v-flex xs8>
      <v-card>
        <editor
          ref="editor"
          :document-id="document._id"
          :content-key="document.contentKey"
          :client-id="clientId"
          :read-only="isReadOnly"
          @content-changed="onContentChanged"
          @highlight-selected="onHighlightSelected"
          @highlight-added="onHighlightAdded"
          @highlight-deleted="onHighlightDeleted"
          @show-new-comment-form="onShowNewCommentForm"
        />
      </v-card>
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
      />
    </v-flex>
    <portal to="toolbar">
      <v-toolbar
        flat
        dense
        class="document-toolbar"
      >
        <v-toolbar-items>
          <v-btn
            v-if="!apiControlled && parentDocument && canUserSeeParentDocument"
            :to="{name: 'document', params: {documentId: parentDocument._id}}"
            flat
          ><translate>to-parent-document</translate></v-btn>
          <v-btn
            v-if="!apiControlled && canUserPublishDocument"
            :to="{name: 'document-publish', params: {documentId}}"
            flat
          ><translate>document-publish</translate></v-btn>
          <v-btn
            v-if="!apiControlled && canUserCompareDocument"
            :to="{name: 'document-compare', params: {documentId}}"
            flat
          ><translate>document-compare</translate></v-btn>
          <v-btn
            v-if="!apiControlled && canUserForkDocument"
            :to="{name: 'document-fork', params: {documentId}}"
            flat
          ><translate>document-fork</translate></v-btn>
          <v-btn
            v-if="!apiControlled && canUserMergeDocument"
            :to="{name: 'document-merge', params: {documentId}}"
            flat
          ><translate>document-accept-merge</translate></v-btn>
          <v-btn
            v-if="!apiControlled && canUserAdministerDocument"
            :to="{name: 'document-share', params: {documentId}}"
            flat
          ><translate>share</translate></v-btn>
          <v-btn
            :to="{name: 'document-history', params: {documentId}}"
            flat
          ><translate>history</translate></v-btn>
          <v-spacer />
          <document-status
            v-if="document"
            :document-id="document._id"
          />
        </v-toolbar-items>
      </v-toolbar>
    </portal>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {Meteor} from 'meteor/meteor';
  import {Random} from 'meteor/random';

  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

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
        apiControlled: Meteor.settings.public.apiControlled,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      isReadOnly() {
        return !!(this.document.isPublished() || this.document.isMergeAccepted() || this.document.hasContentModifyLock);
      },

      parentDocument() {
        if (this.document && this.document.forkedFrom) {
          return Document.documents.findOne({
            _id: this.document.forkedFrom._id,
          });
        }
        else {
          return null;
        }
      },

      canUserAdministerDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.ADMIN));
      },

      canUserSeeParentDocument() {
        return !!(this.parentDocument && this.parentDocument.canUser(Document.PERMISSIONS.VIEW));
      },

      canUserCompareDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.VIEW) && this.parentDocument && this.parentDocument.canUser(Document.PERMISSIONS.VIEW));
      },

      canUserPublishDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.PUBLISH));
      },

      canUserForkDocument() {
        const condition = !!(this.document && this.document.canUser(Document.PERMISSIONS.VIEW) && User.hasClassPermission(Document.PERMISSIONS.CREATE));
        if (Meteor.settings.public.mergingForkingOfAllDocuments) {
          return condition;
        }
        else {
          return condition && this.document.isPublished();
        }
      },

      canUserMergeDocument() {
        return !!(
          // TODO: Use "SUGGEST_MERGE" instead of "VIEW" here.
          this.document && this.document.canUser(Document.PERMISSIONS.VIEW)
          && !this.document.isMergeAccepted() && !this.document.isPublished()
          && this.parentDocument && this.parentDocument.canUser(Document.PERMISSIONS.ACCEPT_MERGE)
        );
      },
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        if (this.documentId) {
          this.$subscribe('Document.one', {documentId: this.documentId});
        }
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

<style lang="scss">
  .document-toolbar .v-toolbar__items {
    align-items: center;
    width: 100%;
  }
</style>
