<template>
  <v-toolbar
    flat
    dense
  >
    <v-toolbar-items>
      <document-status
        v-if="document"
        :document-id="document._id"
      />
      <v-btn
        v-if="!apiControlled && parentDocument && canUserSeeParentDocument"
        :to="{name: 'document', params: {documentId: parentDocument._id}}"
        outline
      ><translate>to-parent-document</translate></v-btn>
      <v-btn
        v-if="!apiControlled && canUserPublishDocument"
        :to="{name: 'document-publish', params: {documentId}}"
        outline
      ><translate>document-publish</translate></v-btn>
      <v-btn
        v-if="!apiControlled && canUserCompareDocument"
        :to="{name: 'document-compare', params: {documentId}}"
        outline
      ><translate>document-compare</translate></v-btn>
      <v-btn
        v-if="!apiControlled && canUserForkDocument"
        :to="{name: 'document-fork', params: {documentId}}"
        outline
      ><translate>document-fork</translate></v-btn>
      <v-btn
        v-if="!apiControlled && canUserMergeDocument"
        :to="{name: 'document-merge', params: {documentId}}"
        outline
      ><translate>document-accept-merge</translate></v-btn>
      <v-btn
        v-if="!apiControlled && canUserAdministerDocument"
        :to="{name: 'document-share', params: {documentId}}"
        outline
      ><translate>share</translate></v-btn>
      <v-btn
        :to="{name: 'document-history', params: {documentId}}"
        outline
      ><translate>history</translate></v-btn>
    </v-toolbar-items>
  </v-toolbar>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import Vue from 'vue';

  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

  export const documentToolbarState = Vue.observable({documentId: null});

  // @vue/component
  const component = {
    data() {
      return {
        apiControlled: Meteor.settings.public.apiControlled,
      };
    },

    computed: {
      documentId() {
        return documentToolbarState.documentId;
      },

      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
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
        if (this.documentId) {
          this.$subscribe('Document.one', {documentId: this.documentId});
        }
      });
    },
  };

  export default component;
</script>
