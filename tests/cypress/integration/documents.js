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
  });
});
