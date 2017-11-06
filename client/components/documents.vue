<template>
  <v-layout row>
    <v-flex xs12 sm10 offset-sm1 md8 offset-md2 xl6 offset-xl3>
      <v-card>
        <v-list v-if="documents.exists()" two-line>
          <template v-for="(document, index) in documents">
            <v-list-tile ripple :to="{name: 'document', params: {documentId: document._id}}" :key="document._id">
              <v-list-tile-content>
                <v-list-tile-title v-if="document.title">{{document.title}}</v-list-tile-title>
                <v-list-tile-title v-else class="documents-untitled">Untitled</v-list-tile-title>
                <!-- TODO: Create a filter which renders this better. -->
                <v-list-tile-sub-title>{{document.createdAt}}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-chip v-if="!document.isPublished()" label color="yellow lighten-2" class="documents-label">Draft</v-chip>
              </v-list-tile-action>
            </v-list-tile>
            <v-divider v-if="index + 1 < documents.count()" :key="document._id"></v-divider>
          </template>
        </v-list>
        <v-card-text v-else-if="$subscriptionsReady()" class="text-xs-center documents-none">
          No documents.
        </v-card-text>
      </v-card>
      <!--
        TODO: Do not hide the button when it is disabled.
              See: https://github.com/vuetifyjs/vuetify/issues/2426
      -->
      <v-btn v-if="canCreateDocument" :disabled="documentCreationInProgress" fab bottom right fixed dark color="primary" @click.native="onDocumentCreate">
        <v-icon>add</v-icon>
      </v-btn>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/document';
  import {User} from '/lib/user';
  import {Snackbar} from '../snackbar';

  const component = {
    data() {
      return {
        subscriptionHandle: null,
        documentCreationInProgress: false
      };
    },

    created() {
      this.subscriptionHandle =  this.$subscribe('Document.list', {});
    },

    computed: {
      canCreateDocument() {
        return User.hasPermission(User.PERMISSIONS.DOCUMENT_CREATE);
      },

      documents() {
        if (!this.subscriptionHandle) return [];

        return Document.documents.find(this.subscriptionHandle.scopeQuery(), {sort: {createdAt: -1}});
      }
    },

    methods: {
      onDocumentCreate() {
        this.documentCreationInProgress = true;
        Document.create({}, (error, documentId) => {
          this.documentCreationInProgress = false;

          if (error) {
            Snackbar.enqueue(`Error creating a new document: ${error}`, 'error');
          }
          else {
            Snackbar.enqueue("New document has been created.", 'success');
            this.$router.push({name: 'document', params: {documentId}});
          }
        });
      }
    }
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document',
        name: 'documents'
      },
    ]);
  });

  export default component;
</script>

<style lang="stylus">
  .documents-label
    cursor pointer

  .documents-none
    font-style italic

  .documents-untitled
    font-style italic
</style>