<template>
  <v-card @mousedown.stop :class="['thread__card', {'elevation-10': comment.focus}]" :style="{'padding-top': `${commentCardPaddingTop}px`, 'padding-bottom': `${commentCardPaddingBottom}px`}">
    <v-container v-if="!comment.dummy" class="thread__container">
      <comment :comment="comment"/>
      <v-container class="thread__show_replies" v-if="!comment.focus && comment.hasManyReplies">
        <v-divider/>
        <v-layout row>
          <v-flex text-xs-center>
            <v-btn flat small @click="commentClick(comment)"><translate>view-all-replies</translate></v-btn>
          </v-flex>
        </v-layout>
        <v-divider/>
      </v-container>
      <v-layout row v-for="(reply, index) of comment.replies" :key="reply._id">
        <comment class="thread__reply" v-if="comment.focus || (!comment.focus && index==comment.replies.length-1)" :comment="reply"/>
      </v-layout>
    </v-container>
    <v-container class="thread__input_container">
      <v-layout row>
        <v-flex xs10 offset-xs1>
          <transition name="thread__form">
            <div @click.stop v-show="comment.focus">
              <comment-editor ref="threadInput" class="thread__input" :comment="comment" :read-only="false" @empty="showActions=false" @contentDetected="showActions=true"/>
              <v-card-actions v-if="showActions" class="thread__actions" >
                <v-btn small color="secondary" flat @click.stop="hideNewCommentForm()"><translate>cancel</translate></v-btn>
                <v-btn small color="primary" flat @click.stop="submitComment(comment)"><translate>insert</translate></v-btn>
              </v-card-actions>
            </div>
          </transition>
        </v-flex>
      </v-layout>
    </v-container>
  </v-card>
</template>

<script>

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
        showActions: false,
      };
    },

    methods: {
      commentClick(comment) {
        this.$emit("commentClick", comment);
      },
      submitComment(comment) {
        this.$emit("commentSubmitted", comment);
        this.$refs.threadInput.clearEditor();
      },
      hideNewCommentForm() {
        this.$emit("hideNewCommentForm");
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

  .thread__form-enter {
    opacity: 0;
  }

  .thread__form-enter-active {
    transition: opacity 0.5s;
    -webkit-transition: opacity 0.5s;
  }

  .thread__form-leave-active {
    transition: opacity 0.5s;
    -webkit-transition: opacity 0.5s;
    opacity: 0;
  }

  .thread__container {
    padding: 0px;
  }

  .thread__show_replies {
    padding-top: 5px;
    padding-bottom: 5px;
  }

  .thread__reply {
    padding-top:5px;
  }

  .thread__input_container {
    padding: 0px;
  }

  .thread__input {
    padding-top: 0px;
    padding-bottom: 5px;
    border-bottom: 1px solid gray;
  }

  .thread__actions {
    padding-top: 5px;
    padding-bottom: 0px;
  }

</style>
