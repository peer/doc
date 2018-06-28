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
              :key="level.value"
              :label="level.label"
              :value="level.value"
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
                  <v-list-tile-avatar>
                    <img :src="contributor.avatar">
                  </v-list-tile-avatar>
                  <v-list-tile-content>
                    <v-list-tile-title>{{contributor.username}}</v-list-tile-title>
                    <v-list-tile-sub-title class="text--primary">({{contributor.permission.label}})</v-list-tile-sub-title>
                  </v-list-tile-content>
                  <v-list-tile-action>
                    <v-btn
                      flat
                      icon
                      color="red lighten-2"
                      @click="removeFromList(contributor._id)"
                    >
                      <v-icon>clear</v-icon>
                    </v-btn>
                  </v-list-tile-action>
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
                :search-input.sync="search"
                v-model="select"
                item-text="username"
                item-value="_id"
                item-avatar="avatar"
                label="Users"
                autocomplete
                multiple
                chips
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
                  <v-list-tile-title>{{item.label}}</v-list-tile-title>
                </v-list-tile>
              </v-list>
            </v-menu>
          </v-layout>
          <v-layout row>
            <v-flex
              xs6
              offset-xs2
              md8
              offset-md1
            >
              <v-btn
                :disabled="select.length <= 0"
                color="primary"
                @click="addToList()"
              >Add to List
              </v-btn>
            </v-flex>
          </v-layout>
          <v-btn
            color="primary"
            @click="share()"
          >Done</v-btn>
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
  import {Document} from '/lib/documents/document';

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
        permissions: [
          {
            value: 'edit',
            label: this.$gettext("edit"),
            icon: 'edit',
          },
          {
            value: 'see',
            label: this.$gettext("see"),
            icon: 'visibility',
          },
          {
            value: 'admin',
            label: this.$gettext("admin"),
            icon: 'settings',
          },
        ],
        permission: {
          value: 'edit',
          label: this.$gettext("edit"),
          icon: 'edit',
        },
        search: null,
        select: [],
        step: 1,
        radioGroup: 1,
        visibilityLevels: [
          {
            value: Document.VISIBILITY_LEVELS.PRIVATE,
            label: this.$gettext("private"),
          },
          {
            value: Document.VISIBILITY_LEVELS.PUBLIC,
            label: this.$gettext("public"),
          },
          {
            value: Document.VISIBILITY_LEVELS.LISTED,
            label: this.$gettext("listed"),
          },
        ],
        visibilityLevel: undefined,
        contributors: [],
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
      addToList() {
        const newContributors = this.select.map((x) => {
          return {
            _id: x._id,
            username: x.username,
            avatar: x.avatar,
            permission: this.permission,
          };
        });
        this.contributors = this.contributors.concat(newContributors);
        this.select = [];
        this.items = [];
      },
      removeFromList(id) {
        this.contributors = this.contributors.filter((x) => {
          return x._id !== id;
        });
      },
      querySelections(v) {
        this.loading = true;

        User.findByUsername({username: v}, (error, document) => {
          if (error) {
            this.loading = false;
          }
          else {
            this.items = document.filter((x) => {
              const found = this.contributors.find((y) => {
                return x._id === y._id;
              });
              return !found;
            });
            this.loading = false;
          }
        });
      },
      share() {
        Document.share({
          documentId: this.documentId,
          visibilityLevel: this.visibilityLevel,
          contributors: this.contributors.map((x) => {
            return {
              user: {
                _id: x._id,
                username: x.username,
                avatar: x.avatar,
              },
              selectedPermission: x.permission.value,
            };
          }),
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

