<template>
  <v-layout row>
    <v-flex xs12 sm10 offset-sm1 md8 offset-md2 xl6 offset-xl3>
      <v-card>
        <v-list v-if="documents.exists()" two-line>
          <template v-for="(document, index) in documents">
            <v-list-tile ripple :to="{name: 'document', params: {documentId: document._id}}" :key="document._id">
              <v-list-tile-content>
                <v-list-tile-title v-if="document.title">{{document.title}}</v-list-tile-title>
                <v-list-tile-title v-else class="documents__untitled" v-translate>Untitled</v-list-tile-title>
                <v-list-tile-sub-title>
                  <span class="timestamp" :title="document.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)">{{document.createdAt | fromNow}}</span>
                </v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-chip v-if="!document.isPublished()" label color="yellow lighten-2" class="documents__label"><translate>Draft</translate></v-chip>
              </v-list-tile-action>
            </v-list-tile>
            <v-divider v-if="index + 1 < documents.count()" :key="document._id" />
          </template>
        </v-list>
        <v-card-text v-else-if="$subscriptionsReady()" class="text-xs-center documents__none" v-translate>
          No documents.
        </v-card-text>
      </v-card>
      <v-btn v-if="canCreateDocument" :disabled="documentCreationInProgress" fab bottom right fixed color="primary" @click.native="onDocumentCreate">
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

  // @vue/component
  const component = {
    data() {
      return {
        subscriptionHandle: null,
        documentCreationInProgress: false,
      };
    },

    computed: {
      canCreateDocument() {
        return User.hasPermission(User.PERMISSIONS.DOCUMENT_CREATE);
      },

      documents() {
        if (!this.subscriptionHandle) return [];

        return Document.documents.find(this.subscriptionHandle.scopeQuery(), {sort: {createdAt: -1}});
      },
    },

    created() {
      this.subscriptionHandle = this.$subscribe('Document.list', {});
    },

    methods: {
      onDocumentCreate() {
        this.documentCreationInProgress = true;
        Document.create({}, (error, document) => {
          this.documentCreationInProgress = false;

          if (error) {
            Snackbar.enqueue(`Error creating a new document: ${error}`, 'error');
          }
          else {
            Snackbar.enqueue("New document has been created.", 'success');
            this.$router.push({name: 'document', params: {documentId: document._id}});
          }
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document',
        name: 'documents',
      },
    ]);
  });

  export default component;
</script>

<style lang="scss">
  .documents__label {
    cursor: pointer;
  }

  .documents__none {
    font-style: italic;
  }

  .documents__untitled {
    font-style: italic;
  }
</style>
