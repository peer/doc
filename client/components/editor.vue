<template>
  <div class="editor"></div>
</template>

<script>
  import {Random} from 'meteor/random';
  import {_} from 'meteor/underscore';

  import {schema} from 'prosemirror-schema-basic';
  import {EditorState} from 'prosemirror-state';
  import {EditorView} from 'prosemirror-view';
  import {undo, redo, history} from 'prosemirror-history';
  import {keymap} from 'prosemirror-keymap';
  import {baseKeymap} from 'prosemirror-commands';
  import {dropCursor} from 'prosemirror-dropcursor';
  import {gapCursor} from 'prosemirror-gapcursor';
  import collab from 'prosemirror-collab';

  import {Content} from '/lib/content';

  import 'prosemirror-view/style/prosemirror.css';
  import 'prosemirror-gapcursor/style/gapcursor.css';

  const component = {
    data() {
      return {
        subscriptionHandle: null,
        addingStepsInProgress: false
      }
    },

    props: {
      contentKey: {
        type: String,
        required: true
      }
    },

    created() {
      this.$autorun((computation) => {
        this.subscriptionHandle = this.$subscribe('Content.feed', {contentKey: this.contentKey});
      });
    },

    mounted() {
      const state = EditorState.create({
        schema,
        plugins: [
          keymap({
            'Mod-z': undo,
            'Mod-y': redo // TODO: shift+mod+z
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history(),
          collab.collab({
            clientID: Random.id()
          })
        ]
      });

      const view = new EditorView({mount: this.$el}, {
        state,
        dispatchTransaction: (transaction) => {
          const newState = view.state.apply(transaction);
          view.updateState(newState);
          const sendable = collab.sendableSteps(newState);
          if (sendable) {
            this.addingStepsInProgress = true;
            Content.addSteps({
              contentKey: this.contentKey,
              currentVersion: sendable.version,
              steps: sendable.steps,
              clientId: sendable.clientID
            }, (error, stepsAdded) => {
              this.addingStepsInProgress = false;

              // TODO: Error handling.
            });
          }
        }
      });

      this.$autorun((computation) => {
        if (this.addingStepsInProgress) {
          return;
        }

        // To register dependency on the latest version available from the server.
        Content.documents.findOne(this.subscriptionHandle.scopeQuery(), {sort: {version: -1}, fields: {version: 1}});

        Tracker.nonreactive(() => {
          const newContents = Content.documents.find(_.extend(this.subscriptionHandle.scopeQuery(), {
            version: {
              $gt: collab.getVersion(view.state)
            }
          }), {
            sort: {
              version: 1
            }
          }).fetch();

          if (newContents.length) {
            view.dispatch(collab.receiveTransaction(view.state, _.pluck(newContents, 'step'), _.pluck(newContents, 'clientId')))
          }
        })
      });
    }
  };

  export default component;
</script>

<style lang="stylus">
  .editor > p:last-child
    margin-bottom 0
</style>