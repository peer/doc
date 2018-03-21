<template>
  <v-layout row>
    <v-container fill-height>
      <v-layout fill-height>
        <v-flex>
          <v-card>
            <v-card-title primary-title>
              <div>
                <h3><translate>publish-document-confirmation-title</translate></h3>
                <div><translate>publish-document-confirmation-body</translate></div>
              </div>
            </v-card-title>
            <v-card-actions>
              <v-btn flat color="primary" class="mx-0" @click="onCancelClick"><translate>cancel</translate></v-btn>
              <v-btn
                flat
                color="primary"
                class="mx-0"
                @click="onPublishClick"
                :disabled="documentPublishInProgress"><translate>publish</translate></v-btn>
            </v-card-actions>
          </v-card>
        </v-flex>
      </v-layout>
    </v-container>
  </v-layout>
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
      documentPublishInProgress: false,
    };
  },
  computed: {
    currentUser() {
      return Meteor.user({username: 1, avatar: 1});
    },
  },
  methods: {
    onCancelClick() {
      this.$router.push({name: 'document', params: {documentId: this.documentId}});
    },
    onPublishClick() {
      this.documentPublishInProgress = true;
      if (!this.currentUser) {
        // only publish article if current user is set
        this.$router.push({name: 'document', params: {documentId: this.documentId}});
        this.documentPublishInProgress = false;
        return;
      }
      Document.publish({documentId: this.documentId}, (error) => {
        if (error) {
          this.documentPublishInProgress = false;
          Snackbar.enqueue(this.$gettext("publish-error"), 'error');
          return;
        }
        this.documentPublishInProgress = false;
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
      name: 'publishDocument',
      props: true,
    },
  ]);
});

export default component;
</script>
