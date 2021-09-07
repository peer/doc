<template>
  <v-layout
    row
    wrap
    class="pa-2"
  >
    <v-flex xs12>
      <!-- eslint-disable vue/no-mutating-props -->
      <v-btn
        flat
        icon
        small
        class="comment__more-button"
        @click="commentDescriptor.showDetails = !commentDescriptor.showDetails"
      >
        <v-icon>more_vert</v-icon>
      </v-btn>
      <!-- eslint-enable vue/no-mutating-props -->
      <v-chip>
        <v-avatar size="36px">
          <img
            :src="commentDescriptor.comment.author.avatarUrl()"
            :alt="commentDescriptor.comment.author.username"
          >
        </v-avatar>
        {{commentDescriptor.comment.author.username}}
      </v-chip>
    </v-flex>
    <transition name="comment__details-expand">
      <v-flex
        v-show="commentDescriptor.showDetails"
        xs12
        class="comment__details px-1"
      >
        <v-btn
          v-if="canUserDeleteComment"
          flat
          icon
          small
          class="comment__delete-button"
          @click="onDeleteClicked"
        >
          <v-icon>delete</v-icon>
        </v-btn>
        <span
          v-translate="{at: $fromNow(commentDescriptor.comment.createdAt)}"
          :title="commentDescriptor.comment.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)"
          class="timestamp"
        >
          comment-created-at
        </span>
        <div class="clear" />
        <v-divider class="pb-1" />
      </v-flex>
    </transition>
    <v-flex
      xs12
      class="pa-1"
    >
      <comment-editor
        :body="commentDescriptor.comment.body"
        :read-only="true"
        class="comment__body"
      />
    </v-flex>
  </v-layout>
</template>

<script>
  import {Comment} from '/lib/documents/comment';

  // @vue/component
  const component = {
    props: {
      commentDescriptor: {
        type: Object,
        required: true,
      },
    },

    computed: {
      canUserDeleteComment() {
        return !!(this.commentDescriptor && this.commentDescriptor.comment && this.commentDescriptor.comment.canUser(Comment.PERMISSIONS.DELETE));
      },
    },

    methods: {
      onDeleteClicked() {
        this.$emit('delete-clicked');
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .comment__body {
    word-wrap: break-word;
  }

  .comment__details-expand-enter {
    opacity: 0;
  }

  .comment__details-expand-enter-active {
    transition: opacity 0.5s;
  }

  .comment__details-expand-leave-active {
    transition: opacity 0.2s;
    opacity: 0;
  }

  .comment__more-button {
    float: right;
    margin-right: 0;
  }

  .comment__delete-button {
    float: right;
  }

  .clear {
    clear: both;
  }

  .comment__details {
    line-height: 40px;
  }
</style>
