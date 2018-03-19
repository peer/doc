<template>
  <v-layout v-if="document" row>
    <v-flex xs8>
      <v-card>
        <v-card-text>
          <!-- TODO: Display editor only if you have permissions. -->
          <editor :document-id="document._id" :content-key="document.contentKey" :client-id="clientId" :focused-cursor="cursor" @scroll="onEditorScroll" @contentChanged="onContentChanged" />
        </v-card-text>
      </v-card>
    </v-flex>
    <v-flex xs4>
      <sidebar :document-id="document._id" :content-key="document.contentKey" :client-id="clientId" @click="onAvatarClicked" ref="sidebar" />
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {Random} from 'meteor/random';
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

    data() {
      return {
        clientId: Random.id(),
        cursor: null,
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },
      shouldEmbed() {
        return this.$route.query.embed === 'true';
      },
    },
    watch: {
      shouldEmbed: {
        handler: function handler(value) {
          this.$emit('embed', value);
        },
        immediate: true,
      },
    },
    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });
    },

    methods: {
      onAvatarClicked(cursor) {
        this.cursor = cursor;
      },

      onEditorScroll() {
        // We just remove the reference to the previously clicked cursor because all we needed
        // was the `Editor` component to scroll to it.
        this.cursor = null;
      },

      onContentChanged() {
        this.$refs.sidebar.layoutComments();
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/:documentId',
        name: 'document',
        props: true,
      },
    ]);
  });

  export default component;
</script>
