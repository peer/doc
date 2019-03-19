/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('documents', function () {
  it('can create, fork, and merge a document', function () {
    cy.visit('/');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'initial');

    cy.resetDatabase();

    // TODO: Make into a Cypress custom command.
    cy.window().then((window) => {
      window.require('/lib/documents/user').User.passwordlessSignIn({username: 'testuser'});
      cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
    });

    cy.contains('.v-btn', 'Documents').click();

    cy.location('pathname').should('eq', '/document');

    cy.contains('div.v-card__text', 'No documents.');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'documents');

    cy.contains('.v-btn', 'New document').click();

    cy.get('.v-snack__content').should('contain', 'New document has been created.').contains('Close').click();

    cy.get('h1[data-text="Write the title of your document here"]');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'document made');

    cy.window().then((window) => {
      cy.get('p[data-text="Add the text of your document here"]').then(($el) => {
        const el = $el.get(0);
        const range = window.document.createRange();
        range.setStart(el, 0);
        range.setEnd(el, 0);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'focused');

    cy.window().then((window) => {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(window.document.createTextNode('test'));
    });

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'added text');

    cy.get('button[title="Bold (Ctrl-B)"]').click();

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'bold');

    cy.location('pathname').then((path) => {
      const match = path.match(/\/document\/(.*)/);

      assert.isNotNull(match);

      cy.call('_test.documentFind', {_id: match[1]}).then((documents) => {
        assert.equal(documents.length, 1);
        assert.deepEqual(documents[0].body, {
          type: 'doc',
          content: [{
            type: 'title',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'test',
              marks: [{
                type: 'strong',
              }],
            }],
          }],
        });
      });
    });

    cy.contains('.document-status', 'draft');
    cy.contains('.document-status', 'fork').should('not.exist');
    cy.contains('.document-status', 'published').should('not.exist');
    cy.contains('.document-status', 'merged').should('not.exist');
    cy.contains('.v-btn', 'Fork').should('not.exist');
    cy.contains('.v-btn', 'Merge').should('not.exist');

    cy.contains('.v-btn', 'Publish').click();

    cy.location('pathname').should('match', /\/document\/publish\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'publish confirmation');

    cy.contains('.v-btn', 'Publish').click();

    cy.get('.v-snack__content').should('contain', 'The document has been successfully published.').contains('Close').click();

    cy.location('pathname').should('match', /\/document\/(.*)/).as('parentDocumentPathname');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'published');

    cy.contains('.document-status', 'draft').should('not.exist');
    cy.contains('.document-status', 'fork').should('not.exist');
    cy.contains('.document-status', 'published');
    cy.contains('.document-status', 'merged').should('not.exist');
    cy.contains('.v-btn', 'Publish').should('not.exist');
    cy.contains('.v-btn', 'Merge').should('not.exist');

    cy.contains('.v-btn', 'Fork').click();

    cy.location('pathname').should('match', /\/document\/fork\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'fork confirmation');

    cy.contains('.v-btn', 'Fork').click();

    cy.get('.v-snack__content').should('contain', 'The document has been successfully forked.').contains('Close').click();

    cy.location('pathname').should('match', /\/document\/(.*)/).as('forkedDocumentPathname');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'forked');

    cy.contains('.document-status', 'draft');
    cy.contains('.document-status', 'fork');
    cy.contains('.document-status', 'published').should('not.exist');
    cy.contains('.document-status', 'merged').should('not.exist');
    cy.contains('.v-btn', 'Publish');
    cy.contains('.v-btn', 'Fork').should('not.exist');

    cy.contains('.v-btn', 'Parent').click();

    cy.get('@parentDocumentPathname').then((pathname) => {
      cy.location('pathname').should('be', pathname);
    });

    cy.get('@forkedDocumentPathname').then((pathname) => {
      cy.visit(pathname);
    });

    cy.contains('.v-btn', 'Compare').click();

    cy.location('pathname').should('match', /\/document\/compare\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'compare no changes');

    cy.contains('.v-alert.warning', 'There are no changes to be shown.');

    cy.contains('.v-btn', 'Editor').click();

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.contains('.document-status', 'draft');
    cy.contains('.document-status', 'fork');
    cy.contains('.document-status', 'published').should('not.exist');
    cy.contains('.document-status', 'merged').should('not.exist');
    cy.contains('.v-btn', 'Publish');
    cy.contains('.v-btn', 'Fork').should('not.exist');

    cy.contains('.v-btn', 'Merge').click();

    cy.location('pathname').should('match', /\/document\/merge\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'merge confirmation no changes');

    cy.contains('.v-alert.warning', 'There are no changes to be shown.');

    cy.contains('.v-btn', 'Cancel').click();

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.contains('.document-status', 'draft');
    cy.contains('.document-status', 'fork');
    cy.contains('.document-status', 'published').should('not.exist');
    cy.contains('.document-status', 'merged').should('not.exist');
    cy.contains('.v-btn', 'Publish');
    cy.contains('.v-btn', 'Fork').should('not.exist');

    cy.get('.editor').type(' test2');

    cy.location('pathname').then((path) => {
      const match = path.match(/\/document\/(.*)/);

      assert.isNotNull(match);

      cy.call('_test.documentFind', {_id: match[1]}).then((documents) => {
        assert.equal(documents.length, 1);
        assert.deepEqual(documents[0].body, {
          type: 'doc',
          content: [{
            type: 'title',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'test test2',
              marks: [{
                type: 'strong',
              }],
            }],
          }],
        });
      });
    });

    cy.contains('.v-btn', 'Compare').click();

    cy.location('pathname').should('match', /\/document\/compare\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'compare');

    cy.contains('.v-btn', 'Editor').click();

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.contains('.v-btn', 'Merge').click();

    cy.location('pathname').should('match', /\/document\/merge\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'merge confirmation');

    cy.contains('.v-btn', 'Merge').click();

    cy.get('.v-snack__content').should('contain', 'The document has been successfully merged into the parent document.').contains('Close').click();

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'merged');

    cy.contains('.document-status', 'draft').should('not.exist');
    cy.contains('.document-status', 'fork');
    cy.contains('.document-status', 'published').should('not.exist');
    cy.contains('.document-status', 'merged');
    cy.contains('.v-btn', 'Publish').should('not.exist');
    cy.contains('.v-btn', 'Fork').should('not.exist');

    cy.get('@parentDocumentPathname').then((pathname) => {
      cy.visit(pathname);
    });

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.contains('.document-status', 'published');

    cy.get('nav.v-toolbar .v-menu__activator').click();

    cy.contains('.v-list__tile--link', 'Sign Out').click();

    cy.contains('Sign In');

    cy.get('.v-snack__content').should('contain', 'You have been signed out.').contains('Close').click();

    cy.get('@parentDocumentPathname').then((pathname) => {
      cy.visit(pathname);
    });

    cy.location('pathname').should('match', /\/document\/(.*)/);

    cy.contains('.document-status', 'published');

    cy.allSubscriptionsReady().should('eq', true);

    cy.visualSnapshot(this.test, 'published signed out');
  });

  it('can see history', function () {
    cy.visit('/document');

    cy.resetDatabase();

    // TODO: Make into a Cypress custom command.
    cy.window().then((window) => {
      window.require('/lib/documents/user').User.passwordlessSignIn({username: 'testuser'});
      cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
    });

    cy.contains('div.v-card__text', 'No documents.');

    cy.contains('.v-btn', 'New document').click();

    cy.get('.v-snack__content').should('contain', 'New document has been created.').contains('Close').click();

    cy.get('.editor').type('first paragraph');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('second paragraph');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('{enter}');
    cy.get('.editor').type('third paragraph');

    cy.wait(500);

    cy.window().then((window) => {
      cy.contains('.editor p', 'second paragraph').then(($el) => {
        const el = $el.get(0);
        const range = window.document.createRange();
        range.selectNode(el);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        range.deleteContents();
      });
    });

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'test content');

    cy.location('pathname').then((path) => {
      const match = path.match(/\/document\/(.*)/);

      assert.isNotNull(match);

      cy.call('_test.documentFind', {_id: match[1]}).then((documents) => {
        assert.equal(documents.length, 1);
        assert.deepEqual(documents[0].body, {
          type: 'doc',
          content: [{
            type: 'title',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'first paragraph',
            }],
          }, {
            type: 'paragraph',
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'third paragraph',
            }],
          }],
        });

        cy.call('_test.contentFind', {contentKeys: documents[0].contentKey}, {sort: {version: 1}}).then((contents) => {
          assert.equal(contents.length, 51);
          // We backdate some steps for 20 minutes to have two sets of changes in the history view.
          for (let i = 0; i <= 32; i += 1) {
            cy.call('_test.contentUpdate', {_id: contents[i]._id}, {$set: {createdAt: new contents[i].createdAt.constructor(contents[i].createdAt.valueOf() - (20 * 60 * 1000))}});
          }
        });
      });
    });

    cy.wait(500);

    cy.contains('.v-btn', 'History').click();

    cy.location('pathname').should('match', /\/document\/history\/(.*)/);

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'initial history');

    cy.get('.v-timeline-item__body .v-card__text').eq(1).click();

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'second change');

    cy.get('.v-timeline-item__body .v-card__text').eq(0).trigger('click', {shiftKey: true});

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'both changes');

    cy.contains('.v-btn', 'Editor').click();

    cy.location('pathname').should('match', /\/document\/(.*)/);
  });
});
