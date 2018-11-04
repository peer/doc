/* eslint-env cypress/globals */
/* eslint-disable func-names, prefer-arrow-callback */

describe('passwordless auth', function () {
  it('should sign in an user', function () {
    cy.visit('/');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('passwordless auth - should sign in an user - initial');
    }

    cy.contains('Sign In').click();

    cy.location('pathname').should('eq', '/user/signin');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('passwordless auth - should sign in an user - sign in');
    }

    cy.get('button[type="submit"]').should('be.disabled');

    cy.get('input[aria-label="Username"]').type('testuser').should('have.value', 'testuser');

    cy.get('button[type="submit"]').should('not.be.disabled').click();

    cy.location('pathname').should('eq', '/');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('passwordless auth - should sign in an user - signed in');
    }

    cy.get('.v-snack__content').should('contain', 'You have been signed in.').contains('Close').click();

    cy.get('nav.v-toolbar .v-menu__activator').should('contain', 'testuser');

    cy.get('nav.v-toolbar .v-menu__activator').click();

    cy.get('.v-list__tile--link').contains('Sign Out').click();

    cy.contains('Sign In');

    if (Cypress.env('PERCY_ENABLED')) {
      cy.percySnapshot('passwordless auth - should sign in an user - signed out');
    }

    cy.get('.v-snack__content').should('contain', 'You have been signed out.').contains('Close').click();
  });
});
