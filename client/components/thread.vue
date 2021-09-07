<template>
  <transition
    :css="false"
    @before-enter="beforeEnter"
    @enter="enter"
  >
    <v-card
      :class="['thread__card', {'elevation-10': commentDescriptor.focus}]"
      @mousedown.stop
    >
      <v-layout
        v-if="!commentDescriptor.dummy"
        row
        wrap
      >
        <comment
          :comment-descriptor="commentDescriptor"
          @delete-clicked="onDeleteClicked(commentDescriptor)"
        />

        <v-flex
          v-if="!commentDescriptor.focus && commentDescriptor.replies.length > 1"
          xs12
          text-xs-center
        >
          <v-divider />
          <v-btn
            flat
            small
            @click="onViewAllReplies"
          >
            <translate :translate-params="{count: commentDescriptor.replies.length}">
              view-all-replies
            </translate>
          </v-btn>
        </v-flex>

        <v-flex
          v-for="replyDescriptor of commentDescriptor.focus ? commentDescriptor.replies.slice(0, commentDescriptor.replies.length - 1) : []"
          :key="replyDescriptor._id"
          xs12
        >
          <v-divider />
          <comment
            :comment-descriptor="replyDescriptor"
            @delete-clicked="onDeleteClicked(replyDescriptor)"
          />
        </v-flex>

        <v-flex
          v-if="commentDescriptor.replies.length > 0"
          xs12
        >
          <v-divider />
          <comment
            :comment-descriptor="commentDescriptor.replies[commentDescriptor.replies.length - 1]"
            @delete-clicked="onDeleteClicked(commentDescriptor.replies[commentDescriptor.replies.length - 1])"
          />
        </v-flex>
      </v-layout>

      <v-layout
        v-if="canUserCreateComments && commentDescriptor.focus"
        ref="inputContainer"
        row
        wrap
        @click.stop
      >
        <v-flex xs12>
          <v-divider />
        </v-flex>
        <v-flex
          xs12
          class="comment__input"
        >
          <comment-editor
            ref="threadInput"
            v-model="newCommentBody"
            :read-only="false"
            :is-reply="!commentDescriptor.dummy"
            @body-empty="showActions = !$event"
          />
          <v-divider
            v-if="showActions"
            class="actions-divider"
          />
          <v-card-actions v-if="showActions">
            <v-spacer />
            <v-btn
              small
              flat
              @click.stop="onCancel"
            >
              <translate>cancel</translate>
            </v-btn>
            <v-btn
              small
              flat
              color="primary"
              @click.stop="onSubmit"
            >
              <translate>insert</translate>
            </v-btn>
          </v-card-actions>
        </v-flex>
      </v-layout>
    </v-card>
  </transition>
</template>

<script>

  import Velocity from 'velocity-animate';

  // @vue/component
  const component = {
    props: {
      commentDescriptor: {
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
        this.$emit('view-all-replies', this.commentDescriptor);
      },

      onCancel() {
        this.newCommentBody = null;
      },

      onSubmit() {
        this.$emit('comment-submitted', this.commentDescriptor, this.newCommentBody);
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

      onDeleteClicked(commentDescriptor) {
        this.$emit('show-deletion-dialog', commentDescriptor);
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .thread__card {
    cursor: pointer;
  }

  .comment__input {
    padding: 12px 12px 0 12px;

    .editor-wrapper {
      padding-bottom: 12px;
      cursor: auto;
    }
  }
</style>
