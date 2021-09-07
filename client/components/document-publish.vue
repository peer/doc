<template>
  <v-layout
    v-if="!apiControlled && canUserPublishDocument"
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
        <v-toolbar card>
          <v-toolbar-title><translate>publish-document-confirmation-title</translate></v-toolbar-title>
        </v-toolbar>

        <v-divider />

        <v-card-text v-if="document.forkedFrom">
          <translate>publish-document-confirmation-fork-body</translate>
        </v-card-text>

        <v-card-text v-else>
          <translate>publish-document-confirmation-regular-body</translate>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="documentPublishInProgress"
            :to="{name: 'document', params: {documentId: documentId}}"
            flat
          >
            <translate>cancel</translate>
          </v-btn>
          <p-button
            :loading="documentPublishInProgress"
            :disabled="documentPublishInProgress"
            color="primary"
            @click="publish()"
          >
            <translate>publish</translate>
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
        documentPublishInProgress: false,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      canUserPublishDocument() {
        return !!(this.document && this.document.canUser(Document.PERMISSIONS.PUBLISH));
      },
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },

    methods: {
      publish() {
        this.documentPublishInProgress = true;
        if (!this.$currentUserId) {
          // Only publish the document if current user is set.
          this.documentPublishInProgress = false;
          this.$router.push({name: 'document', params: {documentId: this.documentId}});
          return;
        }
        Document.publish({documentId: this.documentId}, (error, changed) => {
          this.documentPublishInProgress = false;
          if (error || !changed) {
            Snackbar.enqueue(this.$gettext("publish-error"), 'error');
            return;
          }
          this.$router.push({name: 'document', params: {documentId: this.documentId}});
          Snackbar.enqueue(this.$gettext("publish-success"), 'success');
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/publish/:documentId',
        name: 'document-publish',
        props: true,
      },
    ]);
  });

  export default component;
</script>
