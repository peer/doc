<template>
  <v-layout row>
    <v-flex
      hidden-xs-only
      sm3
      md2
      class="text-xs-center">
      <v-avatar size="36px"><img
        :src="comment.author.avatarUrl()"
        :alt="comment.author.username"
        :title="comment.author.username"></v-avatar>
    </v-flex>
    <v-flex
      xs6
      sm6
      md8>
      <div>
        <comment-editor
          :comment="comment"
          :read-only="true"
          class="comment__body" />
        <transition name="comment__details">
          <div v-show="comment.showDetails">
            <v-divider/>
            <v-chip>{{comment.author.username}}</v-chip> <span
              v-translate="{at: $fromNow(comment.createdAt)}"
              :title="comment.createdAt | formatDate(DEFAULT_DATETIME_FORMAT)"
              class="timestamp">comment-created-at</span>
          </div>
        </transition>
      </div>
    </v-flex>
    <v-flex
      xs6
      sm1
      md1>
      <v-btn
        flat
        icon
        small
        @click.stop="comment.showDetails=!comment.showDetails">
        <v-icon>more_horiz</v-icon>
      </v-btn>
    </v-flex>
  </v-layout>
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
  };

  export default component;
</script>

<style lang="scss">
  .comment__body {
    min-height: 36px;
    padding-top: 5px;
    word-wrap: break-word;
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
