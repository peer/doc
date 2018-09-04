import {Meteor} from 'meteor/meteor';
import {Tracker} from 'meteor/tracker';

import {nativeScrollBehavior, RouterFactory} from 'meteor/akryum:vue-router2';
import {init} from 'meteor/tozd:activity-instrument';

import moment from 'moment';
import 'moment/locale/pt-br';
import Vue from 'vue';
import GetTextPlugin from 'vue-gettext';
import Vuetify from 'vuetify';

import {Activity} from '/lib/documents/activity';
import {availableLanguages, getLanguage} from '/lib/languages';
// TODO: Load translations only for user's language?
import translations from '/translations/translations.json';

import VueExtensions from './vue-extensions';

Vue.use(Vuetify);
Vue.use(GetTextPlugin, {
  availableLanguages,
  defaultLanguage: getLanguage(),
  translations,
});
Vue.use(VueExtensions);

moment.locale(Vue.config.language);

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

  Tracker.autorun((computation) => {
    const user = Meteor.user({preferredLanguage: 1});
    Vue.config.language = getLanguage(user && user.preferredLanguage);
    moment.locale(Vue.config.language);
  });
});

if (!Tracker._vue) {
  // eslint-disable-next-line no-console
  console.error("Not running using a Vue-enabled Tracker. Have you cloned repository recursively?");
}
