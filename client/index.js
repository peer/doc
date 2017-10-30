import Vue from 'vue';
import Vuetify from 'vuetify';
import {RouterFactory, nativeScrollBehavior} from 'meteor/akryum:vue-router2';
import {Meteor} from 'meteor/meteor';

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
