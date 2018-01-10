import {Meteor} from 'meteor/meteor';

import {RouterFactory, nativeScrollBehavior} from 'meteor/akryum:vue-router2';

import Vue from 'vue';
import Vuetify from 'vuetify';

// TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
//       See: https://github.com/meteor/meteor-feature-requests/issues/218
import 'vuetify/dist/vuetify.css';

Vue.use(Vuetify);

Meteor.startup(() => {
  const router = new RouterFactory({
    mode: 'history',
    scrollBehavior: nativeScrollBehavior,
  }).create();

  new Vue({
    router,
    el: '#app',
    render: (createElement) => {
      return createElement(Vue.component('app-layout'));
    }
  });
});
