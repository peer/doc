import {Meteor} from 'meteor/meteor';

import {RouterFactory, nativeScrollBehavior} from 'meteor/akryum:vue-router2';

import Vue from 'vue';
import Vuetify from 'vuetify';

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
