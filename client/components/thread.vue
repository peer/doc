<template>
  <v-card :class="['thread__card', {'elevation-10': comment.focus}]" :style="{'padding-top': `${commentCardPaddingTop}px`, 'padding-bottom': `${commentCardPaddingBottom}px`}">
    <v-container style="padding: 0px;">
      <comment :comment="comment"/>
      <v-container style="padding-top: 5px; padding-bottom: 5px" v-show="!comment.focus && comment.hasManyReplies">
        <v-divider/>
        <v-layout row>
          <v-flex text-xs-center>
            <v-btn flat small @click="commentClick(comment)"><translate>view-all-replies</translate></v-btn>
          </v-flex>
        </v-layout>
        <v-divider/>
      </v-container>
      <v-layout row v-for="(reply, index) of comment.replies" :key="reply._id">
        <comment style="padding-top:5px" v-show="comment.focus || (!comment.focus && index==comment.replies.length-1)" :comment="reply"/>
      </v-layout>
    </v-container>
    <v-container style="padding: 0px;">
      <v-layout row>
        <v-flex xs10 offset-xs1>
          <transition>
            <div v-show="comment.focus">
              <div ref="commentEditor"/>
              <!-- <v-card-actions v-show="comment.reply != undefined && comment.reply.length > 0" style="padding-top: 5px; padding-bottom: 0px"> -->
              <v-card-actions v-show="true" style="padding-top: 5px; padding-bottom: 0px">
                <v-btn small color="secondary" flat @click.stop="comment.focus = false"><translate>cancel</translate></v-btn>
                <v-btn small color="primary" flat @click.stop="onReply(comment)"><translate>insert</translate></v-btn>
              </v-card-actions>
            </div>
          </transition>
        </v-flex>
      </v-layout>
    </v-container>
  </v-card>
</template>

<script>

  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {DOMSerializer} from "prosemirror-model";
  import {schema} from './utils/comment-schema.js';

  // @vue/component
  const component = {
    props: {
      comment: {
        type: Object,
        required: true,
      },
    },

    data() {
      return {
        commentCardPaddingTop: 10,
        commentCardPaddingBottom: 10,
      };
    },

    mounted() {
      const state = EditorState.create({
        schema,
      });
      this.$editorView = new EditorView({mount: this.$refs.commentEditor}, {
        state,
        dispatchTransaction: (transaction) => {
          const newState = this.$editorView.state.apply(transaction);
          this.$editorView.updateState(newState);
          this.$editorView.state = newState;

          const fragment = DOMSerializer.fromSchema(schema).serializeFragment(newState.doc.content);
          const tmp = document.createElement("div");
          tmp.appendChild(fragment);
          this.comment.reply = tmp.innerHTML;
        },
        editable: () => {
          return true;
        },
      });
    },

    methods: {
      commentClick(comment) {
        this.$emit("commentClick", comment);
      },
      onReply(comment) {
        this.$emit("reply", comment);
      },
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

  .thread__card {
    cursor: pointer;
  }
</style>
