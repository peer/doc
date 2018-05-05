import {Meteor} from 'meteor/meteor';
import {Tracker} from 'meteor/tracker';

import {nativeScrollBehavior, RouterFactory} from 'meteor/akryum:vue-router2';

import Vue from 'vue';
import GetTextPlugin from 'vue-gettext';
import Vuetify from 'vuetify';

// TODO: Load translations only for user's language?
import translations from '/translations/translations.json';

import VueExtensions from './vue-extensions';

Vue.use(Vuetify);
Vue.use(GetTextPlugin, {
  availableLanguages: {
    en_US: "American English",
    pt_BR: "Português do Brasil",
  },
  defaultLanguage: Meteor.settings.public.defaultLanguage || 'en_US',
  translations,
});
Vue.use(VueExtensions);

Meteor.startup(() => {
  const router = new RouterFactory({
    mode: 'history',
    scrollBehavior: nativeScrollBehavior,
  }).create();

  // eslint-disable-next-line no-new
  new Vue({
    router,
    // Loading message will be replaced by the app.
    el: '#app',
    render: (createElement) => {
      return createElement(Vue.component('app-layout'));
    },
  });
});

if (!Tracker._vue) {
  // eslint-disable-next-line no-console
  console.error("Not running using a Vue-enabled Tracker. Have you cloned repository recursively?");
}
