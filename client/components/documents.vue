<template>
  <v-layout row>
    <v-flex v-bind="width">
      <v-card>
        <v-toolbar card>
          <v-spacer />
          <v-btn
            v-if="hasCreateDocumentsPermission"
            :disabled="documentCreationInProgress"
            outline
            @click.native="onDocumentCreate"
          >
            <translate>document-create</translate>
          </v-btn>
        </v-toolbar>
        <v-divider />
        <v-list
          v-if="documents.exists()"
          two-line
        >
          <template v-for="(document, index) in documents">
            <v-list-tile
              :to="{name: 'document', params: {documentId: document._id}}"
              :key="document._id"
              ripple
            >
              <v-list-tile-content>
                <v-list-tile-title v-if="document.title">{{document.title}}</v-list-tile-title>
                <v-list-tile-title
                  v-translate
                  v-else
                  class="documents__untitled"
                >untitled</v-list-tile-title>
                <v-list-tile-sub-title>
                  <span
                    v-translate="{at: $fromNow(document.publishedAt)}"
                    v-if="document.isPublished()"
                    :title="document.publishedAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                    class="timestamp"
                  >document-published-at</span>
                  <span
                    v-translate="{at: $fromNow(document.createdAt)}"
                    v-else
                    :title="document.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                    class="timestamp"
                  >document-created-at</span>
                </v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-chip
                  v-if="!document.isPublished()"
                  label
                  disabled
                  color="yellow lighten-2"
                  class="documents__label"
                ><translate>document-draft</translate></v-chip>
              </v-list-tile-action>
            </v-list-tile>
            <v-divider
              v-if="index + 1 < documents.count()"
              :key="document._id"
            />
          </template>
        </v-list>
        <v-card-text
          v-translate
          v-else-if="$subscriptionsReady()"
          class="text-xs-center text--secondary"
        >
          no-documents
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';
  import {isEmbedded} from '../embed';
  import {Snackbar} from '../snackbar';

  // @vue/component
  const component = {
    data() {
      return {
        subscriptionHandle: null,
        documentCreationInProgress: false,
        width: isEmbedded() ? {} : {
          xs12: true,
          sm10: true,
          'offset-sm1': true,
          md8: true,
          'offset-md2': true,
          xl6: true,
          'offset-xl3': true,
        },
      };
    },

    computed: {
      hasCreateDocumentsPermission() {
        return User.hasClassPermission(Document.PERMISSIONS.CREATE);
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
            const translated = this.$gettext("document-created-error");
            Snackbar.enqueue(this.$gettextInterpolate(translated, {error}), 'error');
          }
          else {
            Snackbar.enqueue(this.$gettext("document-created-success"), 'success');
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

  .documents__untitled {
    font-style: italic;
  }
</style>
