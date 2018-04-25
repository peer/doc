<template>
  <v-layout row>
    <v-flex hidden-xs-only sm3 md2 class="text-xs-center">
      <v-avatar size="36px"><img :src="comment.author.avatarUrl()" :alt="comment.author.username" :title="comment.author.username"></v-avatar>
    </v-flex>
    <v-flex xs6 sm6 md8>
      <div>
        <div style="word-wrap: break-word;" class="comment__body" ref="commentBody">{{comment.body}}</div>
        <transition name="comment__details">
          <div v-show="comment.showDetails">
            <v-divider/>
            <v-chip>{{comment.author.username}}</v-chip> <span class="timestamp" :title="comment.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)" v-translate="{at: $fromNow(comment.createdAt)}">comment-created-at</span>
          </div>
        </transition>
      </div>
    </v-flex>
    <v-flex xs6 sm1 md1>
      <v-btn flat icon small @click.stop="comment.showDetails=!comment.showDetails">
        <v-icon>more_horiz</v-icon>
      </v-btn>
    </v-flex>
  </v-layout>
</template>

<script>

  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {DOMParser} from "prosemirror-model";
  import {schema} from './utils/comment-schema.js';

  // @vue/component
  const component = {
    props: {
      comment: {
        type: Object,
        required: true,
      },
    },

    mounted() {
      // Prosemirror editor is prepared to show the comment body.
      // A dummy html node is created to parse the comment body.
      const domNode = document.createElement("div");
      // For the moment, paragraph tags are appended to have valid content, according to the schema.
      domNode.innerHTML = `<p>${this.comment.body}</p>`;
      const state = EditorState.create({
        schema,
        doc: DOMParser.fromSchema(schema).parse(domNode),
      });
      this.$editorView = new EditorView({mount: this.$refs.commentBody}, {
        state,
        editable: () => {
          return false;
        },
      });
    },
  };

  export default component;
</script>

<style>
  .comment__body {
    min-height: 36px;
    padding-top: 5px;
  }

  .comment__details-enter {
    opacity: 0;
  }

  .comment__details-enter-active {
    transition: opacity 0.5s;
  }

  .comment__details-leave-active {
    transition: opacity 0.2s;
    opacity: 0;
  }
</style>
