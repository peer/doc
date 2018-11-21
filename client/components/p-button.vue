<!--
Button equivalent to v-btn component, which defines "loading" with a
subjectively better UI/UX (it does not hide the content of the button).
-->

<template>
  <v-btn
    v-bind="$props"
    class="p-button"
    v-on="$listeners"
  >
    <slot />
    <v-progress-linear
      slot="loader"
      :indeterminate="true"
      :height="3"
      color="primary"
      class="p-button__progress"
    />
  </v-btn>
</template>

<script>
  import Vue from 'vue';
  import Vuetify from 'vuetify';

  // This registers Vuetify here gives us "v-btn" component now.
  // Vue prevents double importing of plugins, so this assures
  // that files can be loaded in any order.
  Vue.use(Vuetify);

  // @vue/component
  const component = {
    props: Vue.component('VBtn').options.props,
  };

  export default component;
</script>

<style lang="scss">
  .p-button.v-btn--loader .v-btn__content {
    opacity: 1;
  }

  .p-button__progress {
    position: absolute;
    bottom: 0;
    margin-bottom: 0;
  }
</style>
