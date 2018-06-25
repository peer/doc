<template>
  <v-layout row>
    <v-flex
      sm6
      offset-sm3
    >
      <v-stepper
        v-model="step"
        vertical
      >
        <v-stepper-step
          :complete="step > 1"
          step="1"
        >
          Document visibility
          <small>Select a visibility level</small>
        </v-stepper-step>
        <v-stepper-content step="1">
          <v-radio-group v-model="visibilityLevel">
            <v-radio
              v-for="level in visibilityLevels"
              :key="level"
              :label="level"
              :value="level"
            />
          </v-radio-group>
          <v-btn
            :disabled="!visibilityLevel"
            color="primary"
            @click.native="step = 2"
          >Continue</v-btn>
          <v-btn
            :to="{name: 'document',params: {documentId: documentId}}"
            flat
          >Cancel</v-btn>
        </v-stepper-content>
        <v-stepper-step
          :complete="step > 2"
          step="2"
        >Add users</v-stepper-step>
        <v-stepper-content step="2">
          <v-layout row>
            <v-flex
              sm6
              offset-sm2
              md8
              offset-md1
            >
              <v-list>
                <v-list-tile
                  v-for="contributor in contributors"
                  :key="contributor._id"
                  avatar
                >
                  <v-list-tile-action>
                    <v-icon color="pink">star</v-icon>
                  </v-list-tile-action>
                  <v-list-tile-content>
                    <v-list-tile-title v-text="contributor.username" />
                  </v-list-tile-content>
                  <v-list-tile-avatar>
                    <img :src="contributor.avatar">
                  </v-list-tile-avatar>
                </v-list-tile>
              </v-list>
            </v-flex>
          </v-layout>
          <v-layout row>
            <v-flex
              xs6
              offset-xs2
              md8
              offset-md1
            >
              <v-select
                :loading="loading"
                :items="items"
                :return-object="true"
                :rules="[() => select.length > 0 || 'You must choose at least one']"
                :search-input.sync="search"
                v-model="select"
                item-text="username"
                item-value="_id"
                item-avatar="avatar"
                label="Users"
                autocomplete
                multiple
                cache-items
                chips
                required
              />
            </v-flex>
            <v-menu offset-y>
              <v-btn
                slot="activator"
                color="primary"
                dark
              ><v-icon>{{permission? permission.icon : 'settings'}}</v-icon></v-btn>
              <v-list>
                <v-list-tile
                  v-for="(item, index) in permissions"
                  :key="index"
                  @click="permission = item"
                >
                  <v-list-tile-title>{{item.name}}</v-list-tile-title>
                </v-list-tile>
              </v-list>
            </v-menu>
          </v-layout>
          <v-btn color="primary">Share</v-btn>
          <v-btn
            flat
            @click.native="step = 1"
          >Back</v-btn>
        </v-stepper-content>
      </v-stepper>
    </v-flex>
  </v-layout>
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';
  import {User} from '/lib/documents/user';

  // @vue/component
  const component = {
    data() {
      return {
        documentId: {
          type: String,
          required: true,
        },
        loading: false,
        items: [],
        permissions: [{name: 'Edit', icon: 'edit'}, {name: 'See', icon: 'visibility'}, {name: 'Admin', icon: 'settings'}],
        permission: {name: 'Edit', icon: 'edit'},
        search: null,
        select: [],
        step: 1,
        radioGroup: 1,
        visibilityLevels: ['Private', 'Public', 'Listed'],
        visibilityLevel: undefined,
        // test data.
        contributors: [{avatar: "https://randomuser.me/api/portraits/men/32.jpg", _id: "6Dzu6Fj2wM83P7Cd5", username: "username"},
        {avatar: "https://randomuser.me/api/portraits/men/33.jpg", _id: "6Dzu6Fj2wM83P7Cd2", username: "username2"}],
      };
    },
    watch: {
      search(val) {
        if (val) {
          this.querySelections(val);
        }
      },
    },
    mounted() {
      this.documentId = this.$route.params.documentId;
    },
    methods: {
      querySelections(v) {
        this.loading = true;

        User.findByUsername({username: v}, (error, document) => {
          if (error) {
            this.loading = false;
          }
          else {
            this.items = document;
            this.loading = false;
          }
        });
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/share/:documentId',
        name: 'shareDocument',
      },
    ]);
  });

  export default component;
</script>

