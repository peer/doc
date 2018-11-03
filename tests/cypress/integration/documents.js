/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('documents', function () {
  it('can create a document', function () {
    cy.visit('/');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - initial');
    }

    // TODO: Make into a Cypress custom command.
    cy.window().then((window) => {
      window.require('/lib/documents/user').User.passwordlessSignIn({username: 'testuser'});
      cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
    });

    cy.get('.v-btn').contains('Documents').click();

    cy.location('pathname').should('eq', '/document');

    cy.get('div.v-card__text').contains('No documents.');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - documents');
    }

    // No idea why we need force, but it complains without.
    cy.get('.v-btn').contains('New document').click({force: true});

    cy.get('.v-snack__content').should('contain', 'New document has been created.').contains('Close').click();

    cy.get('h1[data-text="Write the title of your document here"]');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - document made');
    }

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

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - focused');
    }

    cy.window().then((window) => {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(window.document.createTextNode('test'));
    });

    cy.wait(500);

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - added text');
    }

    cy.get('button[title="Bold (Ctrl-B)"]').click();

    cy.wait(500);

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('documents - can create a document - bold');
    }

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
  });
});
