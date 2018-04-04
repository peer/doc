import {Meteor} from 'meteor/meteor';

import {nativeScrollBehavior, RouterFactory} from 'meteor/akryum:vue-router2';

import Vue from 'vue';
import GetTextPlugin from 'vue-gettext';
import Vuetify from 'vuetify';

// TODO: Load translations only for user's language?
import translations from '/translations/translations.json';
// TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
//       See: https://github.com/meteor/meteor-feature-requests/issues/218
import 'vuetify/dist/vuetify.css';

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

  new Vue({ // eslint-disable-line no-new
    router,
    el: '#app',
    render: (createElement) => {
      return createElement(Vue.component('app-layout'));
    },
  });
});
