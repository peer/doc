<template>
  <v-layout row>
    <v-container fill-height>
      <v-layout fill-height>
        <v-flex>
          <v-card>
            <v-card-title primary-title>
              <div>
                <h3>Do you wish to publish this document now?</h3>
                <div>Once it's published it will not be editable anymore.</div>
              </div>
            </v-card-title>
            <v-card-actions>
              <v-btn flat color="primary" class="mx-0" @click="onCancelClick">Cancel</v-btn>
              <v-btn flat color="primary" class="mx-0" @click="onPublishClick">Publish</v-btn>
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

import {Document} from '/lib/document';
// @vue/component
const component = {
  props: {
    documentId: {
      type: String,
      required: true,
    },
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
      if (!this.currentUser) {
        // only publish article if current user is set
        this.$router.push({name: 'document', params: {documentId: this.documentId}});
        return;
      }
      Document.publish({documentId: this.documentId});
      this.$router.push({name: 'document', params: {documentId: this.documentId}});
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
