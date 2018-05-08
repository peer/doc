import {Meteor} from 'meteor/meteor';
import {Tracker} from 'meteor/tracker';

import {nativeScrollBehavior, RouterFactory} from 'meteor/akryum:vue-router2';
import {init} from 'meteor/tozd:activity-instrument';

import moment from 'moment';
import 'moment/locale/pt-br';
import Vue from 'vue';
import GetTextPlugin from 'vue-gettext';
import Vuetify from 'vuetify';

// TODO: Load translations only for user's language?
import translations from '/translations/translations.json';

import {Activity} from '/lib/documents/activity';
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

moment.locale(Meteor.settings.public.defaultLanguage || 'en_US');

Meteor.startup(() => {
  const router = new RouterFactory({
    mode: 'history',
    scrollBehavior: nativeScrollBehavior,
  }).create();

  const vm = new Vue({
    router,
    // Loading message will be replaced by the app.
    el: '#app',
    render: (createElement) => {
      return createElement(Vue.component('app-layout'));
    },
  });

  init(Activity, vm);
});

if (!Tracker._vue) {
  // eslint-disable-next-line no-console
  console.error("Not running using a Vue-enabled Tracker. Have you cloned repository recursively?");
}
