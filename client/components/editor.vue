<template>
  <div class="editor" />
</template>

<script>
  import {Random} from 'meteor/random';
  import {Tracker} from 'meteor/tracker';
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

  // TODO: Import it in a way which does not add it to <style> but adds it to a file referenced from <head>.
  //       See: https://github.com/meteor/meteor-feature-requests/issues/218
  import 'prosemirror-view/style/prosemirror.css';
  import 'prosemirror-gapcursor/style/gapcursor.css';

  // @vue/component
  const component = {
    props: {
      contentKey: {
        type: String,
        required: true,
      },
    },

    data() {
      return {
        subscriptionHandle: null,
        addingStepsInProgress: false,
      };
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
            'Mod-y': redo, // TODO: shift+mod+z
          }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
          history(),
          collab.collab({
            clientID: Random.id(),
          }),
        ],
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
              clientId: sendable.clientID,
            }, (error, stepsAdded) => {
              this.addingStepsInProgress = false;

              // TODO: Error handling.
            });
          }
        },
      });

      this.$autorun((computation) => {
        if (this.addingStepsInProgress) {
          return;
        }

        // To register dependency on the latest version available from the server.
        const versions = _.pluck(Content.documents.find(this.subscriptionHandle.scopeQuery(), {fields: {version: 1}}).fetch(), 'version');

        // We want all versions to be available without any version missing, before we start applying them.
        // TODO: We could also just apply the initial consecutive set of versions we might have.
        //       Even if later on there is one missing.
        if (_.min(versions) !== 0) {
          return;
        }
        if (versions.length !== _.max(versions) + 1) {
          return;
        }

        Tracker.nonreactive(() => {
          const newContents = Content.documents.find(_.extend(this.subscriptionHandle.scopeQuery(), {
            version: {
              $gt: collab.getVersion(view.state),
            },
          }), {
            sort: {
              version: 1,
            },
          }).fetch();

          if (newContents.length) {
            view.dispatch(collab.receiveTransaction(view.state, _.pluck(newContents, 'step'), _.pluck(newContents, 'clientId')));
          }
        });
      });
    },
  };

  export default component;
</script>

<style lang="scss">
  .editor > p:last-child {
    margin-bottom: 0;
  }
</style>
