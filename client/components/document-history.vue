<template>
  <v-layout
    v-if="document"
    row
  >
    <v-flex xs8>
      <v-card>
        <history
          :document-id="document._id"
          :content-key="document.contentKey"
          :start-version="startVersion"
          :end-version="endVersion"
        />
      </v-card>
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
                />
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
                  v-for="event of events"
                  :key="event.key"
                  small
                  color="white"
                  fill-dot
                >
                  <v-radio-group
                    v-if="event.change"
                    slot="icon"
                    :value="selectedChanges.get(event.change.key)"
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
                      @click.prevent="selectChange(event.change, $event)"
                      @mousedown="startDrag(event.change)"
                      @mousemove="continueDrag(event.change)"
                      @mouseup="stopDrag(event.change)"
                    />
                  </v-radio-group>
                  <v-card
                    v-if="event.change"
                    :class="{'elevation-10': selectedChanges.get(event.change.key)}"
                  >
                    <global-events @mouseup="onMouseUp()" />
                    <v-card-text
                      v-ripple
                      :title="selectRangeHint"
                      class="timeline-card change"
                      @click="selectChange(event.change, $event)"
                      @mousedown="startDrag(event.change)"
                      @mousemove="continueDrag(event.change)"
                      @mouseup="stopDrag(event.change)"
                    >
                      <div
                        v-translate="{at: $fromNow(event.change.startsAt)}"
                        :title="event.change.startsAt | formatDate(DEFAULT_DATETIME_FORMAT)"
                        class="timestamp mb-2"
                      >
                        change-starts-at
                      </div>
                      <div>
                        <v-avatar
                          v-for="author of event.change.authors"
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
                  <v-card v-else-if="event.message">
                    <v-card-text class="timeline-card">
                      <div
                        :title="event.timestamp | formatDate(DEFAULT_DATETIME_FORMAT)"
                        class="timestamp mb-2"
                      >
                        <!--
                          We interpolate here and not in "events" computed property so that
                          "$fromNow" reactivity is inside a template.
                        -->
                        {{$gettextInterpolate(event.message, {at: $fromNow(event.timestamp)})}}
                      </div>
                      <v-avatar
                        v-if="event.by"
                        size="36px"
                      ><img
                        :src="event.by.avatarUrl()"
                        :alt="event.by.username"
                        :title="event.by.username"
                      ></v-avatar>
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
  import {Meteor} from 'meteor/meteor';
  import {RouterFactory} from 'meteor/akryum:vue-router2';
  import {_} from 'meteor/underscore';

  import {Step} from 'prosemirror-transform';

  import {Content} from '/lib/documents/content';
  import {Document} from '/lib/documents/document';
  import {schema} from '/lib/full-schema';
  import {stepsAreOnlyHighlights} from '/lib/utils';

  import {documentHistoryToolbarState} from './document-history-toolbar.vue';

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
      startVersion: contents[0].version,
      endsAt: contents[contents.length - 1].createdAt,
      endVersion: contents[contents.length - 1].version,
      steps: contents.map((content) => {
        return Step.fromJSON(schema, content.step);
      }),
    };
  }

  function getChangeFromKey(key, changes) {
    for (const change of changes) {
      if (change.key === key) {
        return change;
      }
    }
    return null;
  }

  function changesBetween(changes, startsWith, endsWith) {
    const result = [];

    let insideRange = false;
    let swapped = null;
    for (const change of changes) {
      // If we have first hit "endsWith" and only it,
      // then "startsWith" and "endsWith" are swapped.
      if (swapped === null) {
        if (startsWith === change.key) {
          swapped = false;
        }
        else if (endsWith === change.key) {
          swapped = true;
        }
      }

      if (swapped) {
        if (endsWith === change.key) {
          insideRange = true;
        }
        if (insideRange) {
          result.push(change.key);
        }
        if (startsWith === change.key) {
          insideRange = false;
        }
      }
      else {
        if (startsWith === change.key) {
          insideRange = true;
        }
        if (insideRange) {
          result.push(change.key);
        }
        if (endsWith === change.key) {
          insideRange = false;
        }
      }
    }

    // If nothing is selected, select the first change.
    if (!result.length && changes.length) {
      result.push(changes[0].key);
    }

    return result;
  }

  function crossesEvent(contents, eventVersions, content) {
    for (const eventVersion of eventVersions) {
      if (content.version <= eventVersion && eventVersion < contents[0].version) {
        return true;
      }
    }

    return false;
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
        contentsHandle: null,
        startsWith: null,
        endsWith: null,
        startDragChange: null,
        dragSelected: [],
        selectRangeHint: this.$gettext("history-select-range"),
      };
    },

    computed: {
      document() {
        return Document.documents.findOne({
          _id: this.documentId,
        });
      },

      events() {
        const events = [];

        for (const change of this.changes) {
          events.push({
            change,
            key: change.key,
            version: change.startVersion,
          });
        }

        if (this.document) {
          if (this.document.forkedFrom) {
            events.push({
              key: 'forked',
              version: this.document.forkedAtVersion,
              timestamp: this.document.createdAt,
              message: this.$gettext("history-forked-event"),
              by: this.document.author,
            });
          }
          else {
            events.push({
              key: 'created',
              version: 0,
              timestamp: this.document.createdAt,
              message: this.$gettext("history-created-event"),
              by: this.document.author,
            });
          }
          if (this.document.publishedAt) {
            events.push({
              key: 'published',
              version: this.document.publishedAtVersion,
              timestamp: this.document.publishedAt,
              message: this.$gettext("history-published-event"),
              by: this.document.publishedBy,
            });
          }
          if (this.document.mergeAcceptedAt) {
            events.push({
              key: 'merge-accepted',
              version: this.document.mergeAcceptedAtVersion,
              timestamp: this.document.mergeAcceptedAt,
              message: this.$gettext("history-merge-accepted-event"),
              by: this.document.mergeAcceptedBy,
            });
          }
        }

        // Sort is stable, so if both a change and a message have the same version, the message will be
        // higher up because messages were added last to the "events" array which is then reversed.
        return _.sortBy(events, 'version').reverse();
      },

      changes() {
        // A list versions of events on the document which a set of changes should not cross.
        const eventVersions = [];
        if (this.document) {
          if (this.document.forkedFrom) {
            eventVersions.push(this.document.forkedAtVersion);
          }
          if (this.document.publishedAt) {
            eventVersions.push(this.document.publishedAtVersion);
          }
          if (this.document.mergeAcceptedAt) {
            eventVersions.push(this.document.mergeAcceptedAtVersion);
          }
        }

        const changes = [];

        if (this.contentsHandle) {
          let contents = [];
          Content.documents.find(this.contentsHandle.scopeQuery(), {sort: {version: -1}}).forEach((content) => {
            if (content.step === null) {
              return;
            }

            if (stepsAreOnlyHighlights([Step.fromJSON(schema, content.step)])) {
              return;
            }

            const lastTimestamp = contents.length ? contents[contents.length - 1].createdAt : null;
            if (lastTimestamp === null) {
              contents.push(content);
            }
            // A set of changes should not cross any of the events.
            else if (!crossesEvent(contents, eventVersions, content) && lastTimestamp.valueOf() - content.createdAt.valueOf() < CHANGES_BREAK) {
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
        const selected = this.dragSelected.length ? this.dragSelected : changesBetween(this.changes, this.startsWith, this.endsWith);

        const changes = new Map();
        for (const key of selected) {
          changes.set(key, true);
        }

        return changes;
      },

      startVersion() {
        let startVersion = null;

        for (const [key] of this.selectedChanges) {
          const change = getChangeFromKey(key, this.changes);
          if (change !== null) {
            if (startVersion === null) {
              startVersion = change.startVersion;
            }
            else if (change.startVersion > startVersion) {
              startVersion = change.startVersion;
            }
          }
        }

        return startVersion;
      },

      endVersion() {
        let endVersion = null;

        for (const [key] of this.selectedChanges) {
          const change = getChangeFromKey(key, this.changes);
          if (change !== null) {
            if (endVersion === null) {
              endVersion = change.endVersion;
            }
            else if (change.endVersion < endVersion) {
              endVersion = change.endVersion;
            }
          }
        }

        return endVersion;
      },
    },

    created() {
      this.$autorun((computation) => {
        documentHistoryToolbarState.documentId = this.documentId;
      });

      this.$autorun((computation) => {
        this.$subscribe('Document.one', {documentId: this.documentId});
      });

      this.$autorun((computation) => {
        if (this.document) {
          this.contentsHandle = this.$subscribe('Content.list', {contentKey: this.document.contentKey, withMetadata: true});
        }
      });
    },

    beforeDestroy() {
      // If we are moving between documents it might have already been set to some other value.
      if (documentHistoryToolbarState.documentId === this.documentId) {
        documentHistoryToolbarState.documentId = null;
      }
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

      startDrag(change) {
        this.startDragChange = change.key;
      },

      continueDrag(change) {
        if (this.startDragChange === null) {
          return;
        }

        if (change.key === this.startDragChange) {
          this.dragSelected = [];
        }
        else {
          this.dragSelected = changesBetween(this.changes, this.startDragChange, change.key);
        }
      },

      stopDrag(change) {
        if (change && change.key !== this.startDragChange) {
          this.startsWith = this.startDragChange;
          this.endsWith = change.key;
        }

        this.startDragChange = null;
        this.dragSelected = [];
      },

      // Workaround for: https://github.com/peer/doc/issues/164
      // See: https://github.com/shentao/vue-global-events/issues/12
      onMouseUp() {
        Meteor.defer(() => {
          this.stopDrag();
        });
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
    user-select: none;

    .timestamp {
      font-weight: bold;
    }

    &.change {
      cursor: pointer;
    }
  }
</style>
