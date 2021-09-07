<template>
  <v-layout
    v-if="canUserMergeDocument"
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
          <v-toolbar-title><translate>accept-merge-document-confirmation-title</translate></v-toolbar-title>
        </v-toolbar>

        <v-divider v-if="!apiControlled" />

        <v-card-text v-if="!apiControlled">
          <translate>accept-merge-document-confirmation-body</translate>
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
            :disabled="documentAcceptMergeInProgress"
            :to="{name: 'document', params: {documentId: parentDocument._id}}"
            flat
          >
            <translate>to-parent-document</translate>
          </v-btn>
          <v-btn
            :disabled="documentAcceptMergeInProgress"
            :to="{name: 'document', params: {documentId}}"
            flat
          >
            <translate>cancel</translate>
          </v-btn>
          <p-button
            :loading="documentAcceptMergeInProgress"
            :disabled="documentAcceptMergeInProgress"
            color="primary"
            @click="acceptMerge()"
          >
            <translate>accept-merge</translate>
          </p-button>
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
  import {Snackbar} from '../snackbar';

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
        documentAcceptMergeInProgress: false,
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

    methods: {
      acceptMerge() {
        this.documentAcceptMergeInProgress = true;
        if (!this.$currentUserId) {
          // Only accept merge the document if current user is set.
          this.documentAcceptMergeInProgress = false;
          this.$router.push({name: 'document', params: {documentId: this.documentId}});
          return;
        }
        Document.acceptMerge({documentId: this.documentId}, (error) => {
          this.documentAcceptMergeInProgress = false;
          if (error) {
            Snackbar.enqueue(this.$gettext("accept-merge-error"), 'error');
            return;
          }
          this.$router.push({name: 'document', params: {documentId: this.documentId}});
          Snackbar.enqueue(this.$gettext("accept-merge-success"), 'success');
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/merge/:documentId',
        name: 'document-merge',
        props: true,
      },
    ]);
  });

  export default component;
</script>
