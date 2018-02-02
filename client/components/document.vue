<template>
  <v-layout v-if="document" row>
    <v-flex xs8>
      <v-card>
        <v-card-text>
          <!-- TODO: Display editor only if you have permissions. -->
          <editor :content-key="document.contentKey" :client-id="clientId" :focused-cursor="cursor" @scroll="onEditorScroll"/>
        </v-card-text>
      </v-card>
    </v-flex>
    <v-flex xs4>
      <sidebar :content-key="document.contentKey" :client-id="clientId" @click="onAvatarClicked"/>
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
        // we just remove the reference to the previously clicked cursor because all we needed
        // was the `Editor` component to scroll to it.
        this.cursor = null;
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

<style lang="scss">
  .app-layout__user {
    flex: 0 0 auto;

    button {
      margin: 2px;
      border-radius: 50%;
      height: 42px;
      width: 42px;
      border-width: 2px;
      border-style: solid;
      padding: 1px;
    }
  }

  .app-layout__users {
    padding-top: 0;
    padding-right: 0;
  }
</style>
