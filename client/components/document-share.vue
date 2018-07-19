<template>
  <v-layout
    v-if="document"
    row
  >
    <v-flex
      xs12
      sm10
      offset-sm1
      md8
      offset-md2
      xl6
      offset-xl3
    >
      <v-card>
        <v-toolbar card>
          <v-toolbar-title><translate>document-sharing</translate></v-toolbar-title>
        </v-toolbar>

        <v-divider />

        <v-card-text>
          <v-radio-group
            v-model="visibilityLevel"
            class="mt-0"
            hide-details
          >
            <v-list two-line>
              <v-subheader class="document-share__subheader--with-hint">
                <translate>document-visibility</translate>
                <small><translate>document-visibility-hint</translate></small>
              </v-subheader>

              <v-list-tile
                v-for="level in visibilityLevels"
                :key="level.value"
                ripple
                @click="visibilityLevel = level.value"
              >
                <v-list-tile-action>
                  <v-radio
                    :key="level.value"
                    :value="level.value"
                  />
                </v-list-tile-action>
                <v-list-tile-content
                  @click="visibilityLevel = level.value"
                >
                  <v-list-tile-title>{{level.label}}</v-list-tile-title>
                  <v-list-tile-sub-title>{{level.hint}}</v-list-tile-sub-title>
                </v-list-tile-content>
              </v-list-tile>
            </v-list>
          </v-radio-group>
        </v-card-text>

        <v-divider />

        <v-card-text v-if="!visibilityLevelIsPrivate">
          <v-radio-group
            v-model="defaultPermission"
            class="mt-0"
            hide-details
          >
            <v-list two-line>
              <v-subheader class="document-share__subheader--with-hint">
                <translate>document-default-permissions</translate>
                <small><translate>document-default-permissions-hint</translate></small>
              </v-subheader>

              <v-list-tile
                v-for="permission in defaultPermissions"
                :key="permission.value"
                ripple
                @click="defaultPermission = permission.value"
              >
                <v-list-tile-action>
                  <v-radio
                    :key="permission.value"
                    :value="permission.value"
                  />
                </v-list-tile-action>
                <v-list-tile-content
                  @click="defaultPermission = permission.value"
                >
                  <v-list-tile-title>{{permission.label}}</v-list-tile-title>
                  <v-list-tile-sub-title>{{permission.hint}}</v-list-tile-sub-title>
                </v-list-tile-content>
              </v-list-tile>
            </v-list>
          </v-radio-group>
        </v-card-text>

        <v-divider v-if="!visibilityLevelIsPrivate" />

        <v-card-text>
          <v-list two-line>
            <v-subheader class="document-share__subheader--with-hint">
              <translate>document-user-permissions</translate>
              <small><translate>document-user-permissions-hint</translate></small>
            </v-subheader>

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
                <v-list-tile-sub-title>{{contributor.role.hint}}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action class="document-share__role-actions">
                <v-layout row>
                  <v-flex>
                    <v-select
                      :items="roles"
                      v-model="contributor.role"
                      return-object
                      item-text="label"
                      item-value="value"
                      class="document-share__role-select"
                    />
                  </v-flex>
                  <v-flex>
                    <v-btn
                      outline
                      color="red lighten-2"
                      @click="removeFromList(contributor._id)"
                    >
                      <translate>permissions-list-remove-user</translate>
                    </v-btn>
                  </v-flex>
                </v-layout>
              </v-list-tile-action>
            </v-list-tile>

            <v-subheader>
              <translate>permissions-list-add-users-hint</translate>
            </v-subheader>

            <v-list-tile class="document_share__user-search">
              <v-list-tile-content>
                <v-autocomplete
                  :loading="loading"
                  :items="foundUsers"
                  :return-object="true"
                  :search-input.sync="search"
                  :label="usersLabel"
                  :no-data-text="noUserMessage"
                  v-model="selectedUsersInList"
                  item-text="username"
                  item-value="_id"
                  item-avatar="avatar"
                  multiple
                  chips
                  deletable-chips
                  small-chips
                  hide-selected
                />
              </v-list-tile-content>
              <v-list-tile-action class="document-share__role-actions">
                <v-layout row>
                  <v-flex>
                    <v-select
                      :items="roles"
                      v-model="role"
                      return-object
                      item-text="label"
                      item-value="value"
                      class="document-share__role-select"
                    />
                  </v-flex>
                  <v-flex>
                    <v-btn
                      :disabled="selectedUsersInList.length <= 0"
                      outline
                      @click="addToList()"
                    >
                      <translate>permissions-list-add-users</translate>
                    </v-btn>
                  </v-flex>
                </v-layout>
              </v-list-tile-action>
            </v-list-tile>
          </v-list>
        </v-card-text>

        <v-divider />

        <v-card-actions>
          <v-spacer />
          <v-btn
            :to="{name: 'document', params: {documentId: documentId}}"
            flat
          ><translate>document-share-cancel</translate></v-btn>
          <v-btn
            color="primary"
            @click="share()"
          ><translate>document-share-done</translate></v-btn>
        </v-card-actions>
      </v-card>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';
  import {_} from 'meteor/underscore';

  import {Document} from '/lib/documents/document';
  import {User} from '/lib/documents/user';

  import {Snackbar} from '../snackbar';

  // @vue/component
  const component = {
    data() {
      return {
        documentId: {
          type: String,
          required: true,
        },
        loading: false,
        foundUsers: [],
        usersLabel: this.$gettext("permissions-list-select-users"),
        noUserMessage: this.$gettext("permissions-list-no-users-found"),
        roles: [
          {
            value: Document.ROLES.VIEW,
            label: this.$gettext("role-view-label"),
            hint: this.$gettext("role-view-user-hint"),
            show: true,
          },
          {
            value: Document.ROLES.COMMENT,
            label: this.$gettext("role-comment-label"),
            hint: this.$gettext("role-comment-user-hint"),
            show: true,
          },
          {
            value: Document.ROLES.EDIT,
            label: this.$gettext("role-edit-label"),
            hint: this.$gettext("role-edit-user-hint"),
            show: true,
          },
          {
            value: Document.ROLES.ADMIN,
            label: this.$gettext("role-admin-label"),
            hint: this.$gettext("role-admin-user-hint"),
            show: true,
          },
          {
            value: Document.ROLES.CUSTOM,
            label: this.$gettext("role-custom-label"),
            hint: this.$gettext("role-custom-user-hint"),
            show: false,
          },
        ],
        role: {
          value: Document.ROLES.VIEW,
          label: this.$gettext("role-view-label"),
        },
        search: null,
        selectedUsersInList: [],
        visibilityLevels: [
          {
            value: Document.VISIBILITY_LEVELS.PRIVATE,
            label: this.$gettext("document-visibility-private"),
            hint: this.$gettext("document-visibility-private-hint"),
          },
          {
            value: Document.VISIBILITY_LEVELS.PUBLIC,
            label: this.$gettext("document-visibility-public"),
            hint: this.$gettext("document-visibility-public-hint"),
          },
          {
            value: Document.VISIBILITY_LEVELS.LISTED,
            label: this.$gettext("document-visibility-listed"),
            hint: this.$gettext("document-visibility-listed-hint"),
          },
        ],
        visibilityLevel: null,
        defaultPermissions: [
          {
            value: Document.ROLES.VIEW,
            label: this.$gettext("role-view-label"),
            hint: this.$gettext("role-view-users-hint"),
          },
          {
            value: Document.ROLES.COMMENT,
            label: this.$gettext("role-comment-label"),
            hint: this.$gettext("role-comment-users-hint"),
          },
          {
            value: Document.ROLES.EDIT,
            label: this.$gettext("role-edit-label"),
            hint: this.$gettext("role-edit-users-hint"),
          },
        ],
        defaultPermission: null,
        contributors: [],
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      visibilityLevelIsPrivate() {
        return this.visibilityLevel === Document.VISIBILITY_LEVELS.PRIVATE;
      },
    },

    watch: {
      document(val) {
        if (val) {
          const userPermissions = this.document ? this.document.userPermissions : [];

          const users = _.groupBy(userPermissions, (x) => {
            return x.user._id;
          });

          let contributors;

          if (!_.isEmpty(users)) {
            contributors = _.map(users, (x) => {
              const permissions = x.map((y) => {
                return y.permission;
              });
              const role = Document.getRoleByPermissions(permissions);
              return {
                _id: x[0].user._id,
                username: x[0].user.username,
                avatar: x[0].user.avatar,
                role: this.roles.find((r) => {
                  return r.value === role;
                }),
              };
            });
          }
          this.visibilityLevel = this.document.visibility;
          this.contributors = contributors;
        }
      },

      search(val) {
        if (val) {
          this.querySelections(val);
        }
      },

      visibilityLevel(val) {
        if (val) {
          // When visibilityLevel is not PRIVATE, the VIEW role must be hidden.
          this.roles = this.roles.map((x) => {
            let show = x.value !== Document.ROLES.CUSTOM;
            if (x.value === Document.ROLES.VIEW) {
              show = this.visibilityLevel === Document.VISIBILITY_LEVELS.PRIVATE;
            }
            return Object.assign({}, x, {
              show,
            });
          });
        }
      },
    },

    created() {
      this.documentId = this.$route.params.documentId;
      this.$autorun((computation) => {
        this.$subscribe('Document.admin', {documentId: this.documentId});
      });
    },

    methods: {
      addToList() {
        const newContributors = this.selectedUsersInList.map((x) => {
          return {
            _id: x._id,
            username: x.username,
            avatar: x.avatar,
            role: this.role,
          };
        });
        this.contributors = this.contributors.concat(newContributors);
        this.selectedUsersInList = [];
        this.foundUsers = [];
      },

      removeFromList(id) {
        this.contributors = this.contributors.filter((x) => {
          return x._id !== id;
        });
      },

      querySelections(v) {
        this.loading = true;

        User.findByUsername({username: v}, (error, foundUsers) => {
          if (error) {
            this.loading = false;
          }
          else {
            this.foundUsers = foundUsers.filter((x) => {
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
              role: x.role.value,
            };
          }),
        }, (error, document) => {
          if (error) {
            Snackbar.enqueue(this.$gettext("document-shared-error"), 'error');
          }
          else {
            Snackbar.enqueue(this.$gettext("document-shared-success"), 'success');
            this.$router.push({name: 'document', params: {documentId: this.document._id}});
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

<style lang="scss">
  .document-share__subheader--with-hint {
    flex-direction: column;
    align-items: flex-start;
  }

  .document-share__role-select {
    max-width: 150px;

    // To make selector specific enough to override margins.
    &.v-input {
      margin-left: 24px;
      margin-right: 24px;
    }

    .v-select__selection {
      white-space: nowrap;
      // This was determined by having whole component fixed to 150px with "max-width"
      // above and then changing while content being very long, to see when does the
      // dropdown icon stops moving from right to left. Otherwise despite the "max-width"
      // above, the icon was still moved out of the component into empty space around the
      // component. We do not want that.
      max-width: 118px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
  }

  .document-share__role-actions {
    flex: 0 0 auto;
  }

  .document_share__user-search {
    .v-list__tile {
      // Instead of having the list items be fixed based on number of rows we just set the minimal
      // height (to what was otherwise fixed height for two-line), and allow it to expand so that
      // if many users are selected, the autocomplete component has space to grow.
      height: auto;
      min-height: 72px;
      // And we want buttons to be aligned on the top while the autocomplete component grows.
      align-items: flex-start;
    }

    .v-list__tile__content {
      // So that autocomplete's label is not cut when it moves up.
      overflow: visible;
      // And that there is enough space for the lable.
      margin-top: 10px;
    }

    .document-share__role-actions {
      // We want actions to stay at the top as the autocomplete component grows.
      align-items: flex-start;
      // And that there is enough space for the lable.
      margin-top: 10px;
    }

    .v-autocomplete {
      width: 100%;
    }
  }
</style>
