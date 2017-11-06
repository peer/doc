<template>
  <v-layout row>
    <v-flex xs12 sm10 offset-sm1 md8 offset-md2 xl6 offset-xl3>
      <v-card>
        <v-list two-line>
          <template v-for="(document, index) in documents">
            <v-list-tile ripple @click="onDocumentOpen(document._id)" :key="document._id">
              <v-list-tile-content>
                <v-list-tile-title v-if="document.title">{{document.title}}</v-list-tile-title>
                <v-list-tile-title v-else><i>Untitled</i></v-list-tile-title>
                <!-- TODO: Create a filter which renders this better. -->
                <v-list-tile-sub-title>{{document.createdAt}}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-chip v-if="!document.isPublished()" label color="yellow lighten-2">Draft</v-chip>
              </v-list-tile-action>
            </v-list-tile>
            <v-divider v-if="index + 1 < documents.count()" :key="document._id"></v-divider>
          </template>
        </v-list>
      </v-card>
      <v-btn v-if="canCreateDocument" fab bottom right fixed dark color="primary" @click.native="onDocumentCreate">
        <v-icon>add</v-icon>
      </v-btn>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/document';
  import {User} from '/lib/user';

  const component = {
    data() {
      return {
        subscriptionHandle: null,
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
        // TODO: This should just be a normal method call.
        Document.create.call({});
      },

      onDocumentOpen(documentId) {
        // TODO: The whole list tile should be a link.
        console.log(documentId);
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
