<template>
  <v-layout
    v-if="canUserCompareDocument"
    row
  >
    <v-flex
      xs12
      sm10
      offset-sm1
      md8
      offset-md2
      xl6
      offset-xl3
    >
      <v-card>
        <v-toolbar
          v-if="!apiControlled"
          card
        >
          <v-toolbar-title><translate>compare-document-title</translate></v-toolbar-title>
        </v-toolbar>

        <v-divider v-if="!apiControlled" />

        <v-card-text v-if="!apiControlled">
          <translate>compare-document-body</translate>
        </v-card-text>

        <v-divider />

        <!-- "startVersion" and "endVersion" are inclusive, so we have to add 1 for "endVersion". -->
        <history
          :document-id="document._id"
          :content-key="document.contentKey"
          :start-version="document.version"
          :end-version="document.rebasedAtVersion + 1"
        />

        <v-divider v-if="!apiControlled" />

        <v-card-actions v-if="!apiControlled">
          <v-spacer />
          <v-btn
            :to="{name: 'document', params: {documentId: parentDocument._id}}"
            flat
          ><translate>to-parent-document</translate></v-btn>
          <v-btn
            v-if="canUserMergeDocument"
            :to="{name: 'document-merge', params: {documentId}}"
            flat
          ><translate>document-accept-merge</translate></v-btn>
          <v-btn
            :to="{name: 'document', params: {documentId}}"
            color="primary"
          ><translate>back-to-document</translate></v-btn>
        </v-card-actions>
      </v-card>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {Meteor} from 'meteor/meteor';
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
        apiControlled: Meteor.settings.public.apiControlled,
      };
    },

    computed: {
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

      canUserCompareDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.VIEW) && this.parentDocument && this.parentDocument.canUser(Document.PERMISSIONS.VIEW));
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
        this.$subscribe('Document.one', {documentId: this.documentId, withVersion: true});
      });

      this.$autorun((computation) => {
        if (this.document && this.document.forkedFrom) {
          this.$subscribe('Document.one', {documentId: this.document.forkedFrom._id});
        }
      });
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/compare/:documentId',
        name: 'document-compare',
        props: true,
      },
    ]);
  });

  export default component;
</script>
