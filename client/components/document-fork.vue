<template>
  <v-layout
    v-if="!apiControlled && canUserForkDocument"
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
          <v-toolbar-title><translate>fork-document-confirmation-title</translate></v-toolbar-title>
        </v-toolbar>

        <v-divider />

        <v-card-text>
          <translate>fork-document-confirmation-body</translate>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn
            :disabled="documentForkInProgress"
            :to="{name: 'document', params: {documentId: documentId}}"
            flat
          ><translate>cancel</translate></v-btn>
          <p-button
            :progress="documentForkInProgress"
            :disabled="documentForkInProgress"
            color="primary"
            @click="fork()"
          ><translate>fork</translate></p-button>
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
  import {User} from '/lib/documents/user';
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
        documentForkInProgress: false,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
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
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },

    methods: {
      fork() {
        this.documentForkInProgress = true;
        if (!this.$currentUserId) {
          // Only fork the document if current user is set.
          this.documentForkInProgress = false;
          this.$router.push({name: 'document', params: {documentId: this.documentId}});
          return;
        }
        Document.fork({documentId: this.documentId}, (error, response) => {
          this.documentForkInProgress = false;
          if (error) {
            Snackbar.enqueue(this.$gettext("fork-error"), 'error');
            return;
          }
          this.$router.push({name: 'document', params: {documentId: response._id}});
          Snackbar.enqueue(this.$gettext("fork-success"), 'success');
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/fork/:documentId',
        name: 'document-fork',
        props: true,
      },
    ]);
  });

  export default component;
</script>
