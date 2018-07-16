<template>
  <transition
    :css="false"
    @before-enter="beforeEnter"
    @enter="enter"
  >
    <v-card
      :class="['thread__card', {'elevation-10': comment.focus}]"
      @mousedown.stop
    >
      <v-container
        v-if="!comment.dummy"
        class="thread__container"
      >
        <comment
          :comment="comment"
          @delete-clicked="onDeleteClicked(comment)"
        />
        <v-container
          v-if="!comment.focus && comment.hasManyReplies"
          class="thread__show_replies"
        >
          <v-divider />
          <v-layout row>
            <v-flex text-xs-center>
              <v-btn
                flat
                small
                @click="onViewAllReplies"
              ><translate :translate-params="{count: comment.replies.length}">view-all-replies</translate></v-btn>
            </v-flex>
          </v-layout>
          <v-divider />
        </v-container>
        <v-layout
          v-for="(reply, index) of comment.replies"
          :key="reply._id"
          row
        >
          <comment
            v-if="comment.focus || (!comment.focus && index == comment.replies.length - 1)"
            :comment="reply"
            class="thread__reply"
            @delete-clicked="onDeleteClicked(reply)"
          />
        </v-layout>
      </v-container>
      <v-container
        v-if="canUserCreateComments"
        ref="inputContainer"
        class="thread__input_container"
      >
        <v-layout row>
          <v-flex
            xs10
            offset-xs1
          >
            <div
              v-show="comment.focus"
              @click.stop
            >
              <comment-editor
                ref="threadInput"
                v-model="newCommentBody"
                :read-only="false"
                :is-reply="!comment.dummy"
                class="thread__input"
                @body-empty="showActions = !$event"
              />
              <v-card-actions
                v-if="showActions"
                class="thread__actions"
              >
                <v-btn
                  small
                  color="secondary"
                  flat
                  @click.stop="onCancel"
                ><translate>cancel</translate></v-btn>
                <v-btn
                  small
                  color="primary"
                  flat
                  @click.stop="onSubmit"
                ><translate>insert</translate></v-btn>
              </v-card-actions>
            </div>
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </transition>
</template>

<script>

  import Velocity from 'velocity-animate';

  // @vue/component
  const component = {
    props: {
      comment: {
        type: Object,
        required: true,
      },
      canUserCreateComments: {
        type: Boolean,
        required: true,
      },
    },

    data() {
      return {
        newCommentBody: null,
        showActions: false,
      };
    },

    methods: {
      onViewAllReplies() {
        this.$emit('view-all-replies', this.comment);
      },

      onCancel() {
        this.newCommentBody = null;
      },

      onSubmit() {
        this.$emit('comment-submitted', this.comment, this.newCommentBody);
        this.newCommentBody = null;
      },

      beforeEnter(el) {
        el.style.opacity = 0; // eslint-disable-line no-param-reassign
      },

      enter(el, done) {
        setTimeout(() => {
          Velocity(
            el,
            {opacity: 1},
            {complete: done},
          );
        }, 300);
      },

      onDeleteClicked(comment) {
        this.$emit('show-deletion-dialog', comment);
      },
    },
  };

  export default component;
</script>

<style lang="scss">
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
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .thread__container {
    padding: 0;
  }

  .thread__show_replies {
    padding-top: 5px;
    padding-bottom: 5px;
  }

  .thread__reply {
    padding-top:5px;
  }

  .thread__input_container {
    padding: 0;
  }

  .thread__input {
    padding-top: 0;
    padding-bottom: 5px;
    border-bottom: 1px solid gray;
  }

  .thread__actions {
    padding-top: 5px;
    padding-bottom: 0;
  }
</style>
