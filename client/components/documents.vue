<template>
  <v-layout row>
    <v-flex v-bind="width">
      <v-card>
        <v-toolbar card>
          <v-spacer />
          <p-button
            v-if="!apiControlled && hasCreateDocumentsPermission"
            :loading="documentCreationInProgress"
            :disabled="documentCreationInProgress"
            outline
            @click.native="onDocumentCreate"
          >
            <translate>document-create</translate>
          </p-button>
        </v-toolbar>
        <v-divider />
        <v-list
          v-if="documents.exists()"
          two-line
        >
          <template v-for="(document, index) in documents">
            <v-list-tile
              :key="'document-' + document._id"
              :to="{name: 'document', params: {documentId: document._id}}"
              ripple
            >
              <v-list-tile-content>
                <v-list-tile-title v-if="document.title">
                  {{document.title}}
                </v-list-tile-title>
                <v-list-tile-title
                  v-else
                  v-translate
                  class="documents__untitled"
                >
                  untitled
                </v-list-tile-title>
                <v-list-tile-sub-title>
                  <span
                    v-if="document.isPublished()"
                    v-translate="{at: $fromNow(document.publishedAt)}"
                    :title="document.publishedAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                    class="timestamp"
                  >document-published-at</span>
                  <span
                    v-else-if="document.isMergeAccepted()"
                    v-translate="{at: $fromNow(document.mergeAcceptedAt)}"
                    :title="document.mergeAcceptedAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                    class="timestamp"
                  >document-merge-accepted-at</span>
                  <span
                    v-else
                    v-translate="{at: $fromNow(document.createdAt)}"
                    :title="document.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                    class="timestamp"
                  >document-created-at</span>
                </v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <document-status :document-id="document._id" />
              </v-list-tile-action>
            </v-list-tile>
            <v-divider
              v-if="index + 1 < documents.count()"
              :key="'divider-' + document._id"
            />
          </template>
        </v-list>
        <v-card-text
          v-else-if="$subscriptionsReady()"
          v-translate
          class="text-xs-center text--secondary"
        >
          no-documents
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>
</template>

<script>
  import {Meteor} from 'meteor/meteor';

  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

  import {isEmbedded} from '../embed';
  import {Snackbar} from '../snackbar';

  // @vue/component
  const component = {
    data() {
      return {
        apiControlled: Meteor.settings.public.apiControlled,
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
        if (!this.contentsHandle) return [];

        return Document.documents.find(this.contentsHandle.scopeQuery(), {sort: {createdAt: -1}});
      },
    },

    created() {
      this.contentsHandle = this.$subscribe('Document.list', {});
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
  .documents__untitled {
    font-style: italic;
  }
</style>
