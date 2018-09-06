/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('passwordless auth', function () {
  it('should fail without query', function () {
    cy.visit('/');

    cy.contains('Sign In')
      .click();

    cy.location('pathname').should('eq', '/user/signin');

    cy.get('button[type=submit]').should('be.disabled');

    cy.get('input[aria-label=Username]').type('testuser').should('have.value', 'testuser');

    cy.get('button[type=submit]').should('not.be.disabled').click();

    cy.location('pathname').should('eq', '/');

    cy.get('.v-snack__content').should('contain', 'You have been signed in.');

    cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');
  });
});
