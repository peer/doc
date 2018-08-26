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
            v-model="defaultRole"
            class="mt-0"
            hide-details
          >
            <v-list two-line>
              <v-subheader class="document-share__subheader--with-hint">
                <translate>document-default-permissions</translate>
                <small><translate>document-default-permissions-hint</translate></small>
              </v-subheader>

              <v-list-tile
                v-for="role in defaultRoles"
                :key="role.value"
                ripple
                @click="defaultRole = role.value"
              >
                <v-list-tile-action>
                  <v-radio
                    :value="role.value"
                  />
                </v-list-tile-action>
                <v-list-tile-content
                  @click="defaultRole = role.value"
                >
                  <v-list-tile-title>{{role.label}}</v-list-tile-title>
                  <v-list-tile-sub-title>{{role.hint}}</v-list-tile-sub-title>
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
              :key="contributor.user._id"
              avatar
            >
              <v-list-tile-avatar>
                <img :src="contributor.user.avatarUrl()">
              </v-list-tile-avatar>
              <v-list-tile-content>
                <v-list-tile-title>{{contributor.user.username}}</v-list-tile-title>
                <v-list-tile-sub-title>{{contributor.role.hint}}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action class="document-share__role-actions">
                <v-layout row>
                  <v-flex>
                    <v-select
                      :items="contributorRoles(contributor)"
                      :disabled="contributor.user._id === $currentUserId"
                      v-model="contributor.role"
                      return-object
                      item-text="label"
                      item-value="value"
                      class="document-share__role-select"
                    />
                  </v-flex>
                  <v-flex>
                    <v-btn
                      :disabled="contributor.user._id === $currentUserId"
                      outline
                      color="red lighten-2"
                      @click="removeUserFromContributors(contributor.user._id)"
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
                <!--
                  TODO: Make sure avatar is shown both in the menu and the results list.
                        Currently "item-avatar" option does not really work.
                        See: https://github.com/vuetifyjs/vuetify/issues/4169
                -->
                <v-autocomplete
                  :loading="userSearchLoading"
                  :items="userSearchResults"
                  :filter="filterUserSearchResults"
                  :search-input.sync="userSearchQuery"
                  :label="userSearchLabel"
                  :no-data-text="userSearchNoUsersMessage"
                  :item-avatar="(user) => user.avatarUrl()"
                  v-model="selectedUsers"
                  return-object
                  item-text="username"
                  item-value="_id"
                  multiple
                  chips
                  deletable-chips
                  small-chips
                  hide-selected
                  cache-items
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
                      :disabled="selectedUsers.length <= 0"
                      outline
                      @click="addSelectedUsersToContributors()"
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
    props: {
      documentId: {
        type: String,
        required: true,
      },
    },

    data() {
      return {
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
        defaultRoles: [
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
        defaultRole: null,
        roles: [
          {
            value: Document.ROLES.VIEW,
            label: this.$gettext("role-view-label"),
            hint: this.$gettext("role-view-user-hint"),
          },
          {
            value: Document.ROLES.COMMENT,
            label: this.$gettext("role-comment-label"),
            hint: this.$gettext("role-comment-user-hint"),
          },
          {
            value: Document.ROLES.EDIT,
            label: this.$gettext("role-edit-label"),
            hint: this.$gettext("role-edit-user-hint"),
          },
          {
            value: Document.ROLES.ADMIN,
            label: this.$gettext("role-admin-label"),
            hint: this.$gettext("role-admin-user-hint"),
          },
        ],
        role: {
          value: Document.ROLES.VIEW,
          label: this.$gettext("role-view-label"),
          hint: this.$gettext("role-view-user-hint"),
        },
        userSearchLoading: false,
        userSearchResults: [],
        userSearchQuery: null,
        userSearchLabel: this.$gettext("permissions-list-select-users"),
        userSearchNoUsersMessage: this.$gettext("permissions-list-no-users-found"),
        selectedUsers: [],
        // This is a list of {user, role} objects.
        contributors: [],
        // We have to remember them so that we can display a "custom" option.
        contributorsStartingWithCustomRoles: new Set(),
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
      userSearchQuery(value, oldValue) {
        if (value) {
          this.userSearchLoading = true;
          // TODO: Make into a subscribe, so that we update the list reactively.
          User.findByUsername({username: value}, (error, foundUsers) => {
            if (error) {
              // TODO: Handle error.
              // eslint-disable-next-line no-console
              console.error(error);
              this.userSearchLoading = false;
            }
            else {
              // We have to map to get access to "User" methods. This would not
              // be necessary if we were accessing documents through a subscription.
              this.userSearchResults = foundUsers.map((user) => {
                return new User(user);
              });
              this.userSearchLoading = false;
            }
          });
        }
        else {
          this.userSearchResults = [];
        }
      },
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.admin', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        // We wait for the document to be available.
        if (!this.$subscriptionsReady() || !this.document) {
          return;
        }
        // We wait only once. This means that if document permissions are changed at
        // the same time by somebody else, those changes will not reflect to this user.
        // The last user who saves the permissions sets the permissions.
        // TODO: Reflect changes to permissions by somebody else to the current user.
        computation.stop();

        const userPermissions = this.document.userPermissions || [];

        const permissionsByUsers = _.groupBy(userPermissions, (userPermission) => {
          return userPermission.user._id;
        });

        this.contributorsStartingWithCustomRoles = new Set();
        this.contributors = _.map(permissionsByUsers, (permissionsByUser, userId) => {
          const permissions = permissionsByUser.map((userPermission) => {
            return userPermission.permission;
          });

          const roleValue = Document.getRoleFromPermissions(permissions);
          let role = this.roles.find((r) => {
            return r.value === roleValue;
          });

          if (!role) {
            role = {
              value: null,
              label: this.$gettext("role-custom-label"),
              hint: this.$gettext("role-custom-user-hint"),
            };
            this.contributorsStartingWithCustomRoles.add(permissionsByUser[0].user._id);
          }

          return {
            role,
            user: permissionsByUser[0].user,
          };
        });
        this.visibilityLevel = this.document.visibility;
        this.defaultRole = Document.getRoleFromPermissions(this.document.defaultPermissions || []);

        if (this.defaultRole === null) {
          this.defaultRoles.push({
            value: null,
            label: this.$gettext("role-custom-label"),
            hint: this.$gettext("role-custom-users-hint"),
          });
        }
      });
    },

    methods: {
      addSelectedUsersToContributors() {
        const newContributors = this.selectedUsers.map((user) => {
          return {user, role: this.role};
        });

        // It should not be really possible that "newContributors" contain users
        // from "oldContributors" because the user should not be able to select them.
        // But we still make sure this is the case and make things consistent.
        const oldContributors = this.contributors.filter((x) => {
          const found = newContributors.find((y) => {
            return x.user._id === y.user._id;
          });
          return !found;
        });

        this.contributors = oldContributors.concat(newContributors);
        this.selectedUsers = [];
      },

      removeUserFromContributors(userId) {
        this.contributors = this.contributors.filter((contributor) => {
          return contributor.user._id !== userId;
        });
      },

      // TODO: This does not really filter items when queryText is empty, because it is not called.
      //       See: https://github.com/vuetifyjs/vuetify/issues/4670
      filterUserSearchResults(item, queryText, itemText) {
        const found = this.contributors.find((contributor) => {
          return contributor.user._id === item._id;
        });

        // We filter out all existing contributors.
        if (found) {
          return false;
        }

        const hasValue = (val) => {
          return val != null ? val : '';
        };

        const text = hasValue(itemText);
        const query = hasValue(queryText);

        // Default comparison.
        return text.toString().toLowerCase().indexOf(query.toString().toLowerCase()) > -1;
      },

      contributorRoles(contributor) {
        if (this.contributorsStartingWithCustomRoles.has(contributor.user._id)) {
          return [].concat(this.roles, [
            {
              value: null,
              label: this.$gettext("role-custom-label"),
              hint: this.$gettext("role-custom-user-hint"),
            },
          ]);
        }
        else {
          return this.roles;
        }
      },

      share() {
        Document.share({
          documentId: this.documentId,
          visibility: this.visibilityLevel,
          defaultRole: this.defaultRole,
          contributors: this.contributors.map((x) => {
            return {
              userId: x.user._id,
              role: x.role.value,
            };
          }),
        }, (error, changed) => {
          if (error) {
            // TODO: Should we show the error to the user? Maybe as a form error?
            // eslint-disable-next-line no-console
            console.error(error);
            Snackbar.enqueue(this.$gettext("document-shared-error"), 'error');
          }
          else {
            if (changed) {
              Snackbar.enqueue(this.$gettext("document-shared-success"), 'success');
            }
            else {
              Snackbar.enqueue(this.$gettext("document-shared-no-change"), 'success');
            }
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
        name: 'document-share',
        props: true,
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
