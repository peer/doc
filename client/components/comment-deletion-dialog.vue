<template>
  <div>
    <v-dialog
      v-model="show"
      hide-overlay
      max-width="500px"
    >
      <v-card>
        <v-card-title>
          <div v-if="dialogType === 'thread'">
            <translate>thread-deletion-confirmation</translate>
          </div>
          <div v-else>
            <translate>comment-deletion-confirmation</translate>
          </div>
        </v-card-title>
        <v-card-actions>
          <v-btn
            color="secondary"
            flat
            @click="show = false"
          ><translate>cancel</translate></v-btn>
          <v-btn
            color="error"
            flat
            @click="deleteComment"
          ><translate>delete</translate></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>

  // @vue/component
  const component = {
    props: {
      dialogType: {
        type: String,
        default: 'single',
      },
    },
    data() {
      return {
        show: false,
      };
    },
    methods: {
      deleteComment() {
        this.$emit('delete-clicked');
        this.show = false;
      },
    },
  };

  export default component;
</script>
