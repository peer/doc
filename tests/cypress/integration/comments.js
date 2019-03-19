/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('comments', function () {
  it('can create and reply', function () {
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
      });
    });

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'comment prompt');

    cy.get('.thread__input .comment-editor').type('comment body');

    cy.wait(500);

    cy.visualSnapshot(this.test, 'comment body');

    cy.contains('.thread__input_container .v-btn', 'Insert').click();

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(1000);

    cy.visualSnapshot(this.test, 'comment made');

    cy.get('.thread__input .comment-editor').type('reply body');

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'reply body');

    cy.contains('.thread__input_container .v-btn', 'Insert').click();

    cy.allSubscriptionsReady().should('eq', true);

    cy.wait(500);

    cy.visualSnapshot(this.test, 'reply made');
  });
});
