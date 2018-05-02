<template>
  <div>
    <v-dialog
      v-model="linkDialog"
      hide-overlay
      max-width="500px"
    >
      <v-card>
        <v-card-text>
          <v-form
            v-model="validLink"
            @submit.prevent="insertLink"
          >
            <v-text-field
              v-model="link"
              :hint="linkHint"
              :hide-details="link === ''"
              :rules="[linkValidationRule]"
              autofocus
              placeholder="http://"
              single-line
              required
              prepend-icon="link"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn
            color="secondary"
            flat
            @click="closeLinkDialog"
          ><translate>cancel</translate></v-btn>
          <v-btn
            v-if="!!selectedExistingLinks.length"
            color="error"
            flat
            @click="removeLink"
          ><translate>remove</translate></v-btn>
          <v-btn
            :disabled="!validLink"
            color="primary"
            flat
            @click="insertLink"
          ><translate v-if="!!selectedExistingLinks.length">update</translate><translate v-else>insert</translate></v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
  import assert from "assert";

  // @vue/component
  const component = {
    data() {
      return {
        link: '',
        linkDialog: false,
        linkHint: this.$gettext("link-hint"),
        validLink: false,
        selectedExistingLinks: [],
        linkValidationRule: (value) => {
          const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(#[-a-z\d_]*)?$/i;
          return urlRegex.test(value) || this.$gettext("invalid-url");
        },
      };
    },

    methods: {
      insertLink() {
        let {link} = this;

        assert(link !== '');
        assert(this.linkValidationRule(link), link);

        // TODO: Rethink if we want to be user friendly here or in UI and autoprefix there.
        link = link.match(/^[a-zA-Z]+:\/\//) ? link : `http://${link}`;

        // Emit the link-inserted event to the editor to add marks.
        this.$emit("link-inserted", link);
        this.closeLinkDialog();
      },

      removeLink() {
        // Emit the link-removed event to the editor to remove marks.
        this.$emit("link-removed");
        this.closeLinkDialog();
      },

      openLinkDialog(selectedExistingLinks) {
        // TODO: Support handling the case where the are multiple different links selected.
        //       Then UI could allow them to pick one of those values, set a new one, or remove all.
        this.selectedExistingLinks = selectedExistingLinks || [];
        this.link = selectedExistingLinks[0] || '';

        // Open the dialog.
        this.linkDialog = true;
      },

      closeLinkDialog() {
        // Close the dialog.
        this.linkDialog = false;

        this.link = '';
        this.selectedExistingLinks = [];
      },
    },
  };

  export default component;
</script>
