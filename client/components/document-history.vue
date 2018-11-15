<template>
  <v-layout
    v-if="document"
    row
  >
    <v-flex xs8>
      TODO
    </v-flex>
    <v-flex xs4>
      <v-container
        fluid
        fill-height
        class="sidebar"
      >
        <v-layout column>
          <v-layout
            row
            class="sidebar__controlbox"
          >
            <v-flex xs12>
              <v-card>
                <v-toolbar
                  dense
                  card
                >
                  <v-btn
                    :to="{name: 'document', params: {documentId}}"
                    outline
                  ><translate>back-to-document</translate></v-btn>
                </v-toolbar>
              </v-card>
            </v-flex>
          </v-layout>
          <v-layout
            row
            wrap
            fill-height
            align-content-start
          >
            <v-flex xs12>
              <v-timeline
                dense
                align-top
              >
                <v-timeline-item
                  v-for="change of changes"
                  :key="change.key"
                  small
                  color="white"
                  fill-dot
                >
                  <v-radio-group
                    slot="icon"
                    :value="selectedChanges.get(change.key)"
                    :hide-details="true"
                    :title="selectRangeHint"
                    class="timeline-icon"
                  >
                    <!--
                      We use JavaScript value "true" as its value so that when we
                      set "selectedChanges" to "true" it matches".
                    -->
                    <v-radio
                      :value="true"
                      @click.prevent="selectChange(change, $event)"
                    />
                  </v-radio-group>
                  <v-card :class="{'elevation-10': selectedChanges.get(change.key)}">
                    <v-card-text
                      v-ripple
                      :title="selectRangeHint"
                      class="timeline-card"
                      @click="selectChange(change, $event)"
                    >
                      <div
                        v-translate="{at: $fromNow(change.startsAt)}"
                        :title="change.startsAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                        class="timestamp mb-2"
                      >
                        change-starts-at
                      </div>
                      <div>
                        <v-avatar
                          v-for="author of change.authors"
                          :key="author._id"
                          size="36px"
                        ><img
                          :src="author.avatarUrl()"
                          :alt="author.username"
                          :title="author.username"
                        ></v-avatar>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-timeline-item>
              </v-timeline>
            </v-flex>
          </v-layout>
        </v-layout>
      </v-container>
    </v-flex>
  </v-layout>
  <not-found v-else-if="$subscriptionsReady()" />
</template>

<script>
  import {RouterFactory} from 'meteor/akryum:vue-router2';

  import {Step} from 'prosemirror-transform';

  import {Content} from '/lib/documents/content';
  import {Document} from '/lib/documents/document';
  import {schema} from '/lib/full-schema';

  // How long between steps for them to be counted as a separate change?
  const CHANGES_BREAK = 15 * 60 * 1000; // milliseconds

  function convertContentsToChange(contents) {
    const authorsMap = new Map();

    contents.forEach((content) => {
      if (!content.author) {
        return;
      }

      if (authorsMap.has(content.author._id)) {
        authorsMap.get(content.author._id).count += 1;
      }
      else {
        authorsMap.set(content.author._id, {
          count: 1,
          author: content.author,
        });
      }
    });

    const authors = [...authorsMap.values()].sort((a, b) => {
      return b.count - a.count;
    }).map((x) => {
      return x.author;
    });

    return {
      authors,
      // We use the last ID as a key, it is probably changing the least.
      key: contents[contents.length - 1]._id,
      startsAt: contents[0].createdAt,
      endsAt: contents[contents.length - 1].createdAt,
      steps: contents.map((content) => {
        return Step.fromJSON(schema, content.step);
      }),
    };
  }

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
        subscriptionHandle: null,
        startsWith: null,
        endsWith: null,
        selectRangeHint: this.$gettext("history-select-range"),
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      changes() {
        const changes = [];

        if (this.subscriptionHandle) {
          let contents = [];
          Content.documents.find(this.subscriptionHandle.scopeQuery(), {sort: {version: -1}}).forEach((content) => {
            if (content.step === null) {
              return;
            }

            const lastTimestamp = contents.length ? contents[contents.length - 1].createdAt : null;
            if (lastTimestamp === null) {
              contents.push(content);
            }
            else if (lastTimestamp.valueOf() - content.createdAt.valueOf() < CHANGES_BREAK) {
              contents.push(content);
            }
            else {
              changes.push(convertContentsToChange(contents));
              contents = [content];
            }
          });

          if (contents.length) {
            changes.push(convertContentsToChange(contents));
          }
        }

        return changes;
      },

      selectedChanges() {
        const changes = new Map();

        let insideRange = false;
        let swapped = null;
        for (const change of this.changes) {
          // If we have first hit "endsWith" and only it,
          // then "startsWith" and "endsWith" are swapped.
          if (swapped === null) {
            if (this.startsWith === change.key) {
              swapped = false;
            }
            else if (this.endsWith === change.key) {
              swapped = true;
            }
          }

          if (swapped) {
            if (this.endsWith === change.key) {
              insideRange = true;
            }
            if (insideRange) {
              changes.set(change.key, true);
            }
            if (this.startsWith === change.key) {
              insideRange = false;
            }
          }
          else {
            if (this.startsWith === change.key) {
              insideRange = true;
            }
            if (insideRange) {
              changes.set(change.key, true);
            }
            if (this.endsWith === change.key) {
              insideRange = false;
            }
          }
        }

        return changes;
      },
    },

    created() {
      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        if (this.document) {
          this.subscriptionHandle = this.$subscribe('Content.list', {contentKey: this.document.contentKey, withMetadata: true});
        }
      });
    },

    methods: {
      selectChange(change, event) {
        if (this.startsWith !== null && event.shiftKey) {
          this.endsWith = change.key;
        }
        else {
          this.startsWith = change.key;
          this.endsWith = change.key;
        }
      },
    },
  };

  RouterFactory.configure((factory) => {
    factory.addRoutes([
      {
        component,
        path: '/document/history/:documentId',
        name: 'document-history',
        props: true,
      },
    ]);
  });

  export default component;
</script>

<style lang="scss">
  .timeline-icon {
    margin: 0;
    padding: 0;

    .v-radio, .v-input--selection-controls__input {
      margin-right: 0;
    }
  }

  .timeline-card {
    cursor: pointer;
    user-select: none;

    .timestamp {
      font-weight: bold;
    }
  }
</style>
