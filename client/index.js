import {Meteor} from 'meteor/meteor';

import {nativeScrollBehavior, RouterFactory} from 'meteor/akryum:vue-router2';

import Vue from 'vue';
import GetTextPlugin from 'vue-gettext';
import Vuetify from 'vuetify';

// TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
//       See: https://github.com/meteor/meteor-feature-requests/issues/218
import translations from '/translations/translations.json';
import 'vuetify/dist/vuetify.css';

Vue.use(Vuetify);
Vue.use(GetTextPlugin, {translations});

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
