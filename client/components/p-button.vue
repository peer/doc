<!--
Button equivalent to v-btn component with additional "progress" prop which shows a progress
bar when true. Similar to v-btn's "loading", but subjectively better UI/UX (it does not
hide the content of the button).
-->

<template>
  <v-btn v-bind="btnProps">
    <slot />
    <v-progress-linear
      v-if="progress"
      :indeterminate="true"
      :height="3"
      color="primary"
      class="p-button__progress" />
  </v-btn>
</template>

<script>
  import {_} from 'meteor/underscore';

  import Vue from 'vue';
  import Vuetify from 'vuetify';

  // This registers Vuetify here gives us "v-btn" component now.
  // Vue prevents double importing of plugins, so this assures
  // that files can be loaded in any order.
  Vue.use(Vuetify);

  // @vue/component
  const component = {
    props: _.extend({}, Vue.component('v-btn').options.props, {
      progress: Boolean,
    }),

    computed: {
      btnProps() {
        return _.omit(this.$props, 'progress');
      },
    },
  };

  export default component;
</script>

<style lang="scss">
  .p-button__progress {
    position: absolute;
    bottom: 0;
    margin-bottom: 0;
  }
</style>
