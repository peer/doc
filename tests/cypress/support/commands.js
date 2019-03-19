/* eslint-env cypress/globals */

// Call a Meteor method.
// TODO: This should be improved. See: https://github.com/cypress-io/cypress/issues/2443
Cypress.Commands.add('call', function call(methodName, ...args) {
  const log = Cypress.log({
    name: 'call',
    message: `${methodName}(${Cypress.utils.stringify(args)})`,
    consoleProps() {
      return {
        methodName,
        arguments: args,
      };
    },
  });

  return new Promise((resolve, reject) => {
    const Meteor = cy.state('window').Meteor;

    // If app is reloaded, a new "Meteor" instance is created
    // and we have to re-create connection in that case.
    if (!this.testConnection || this.Meteor !== Meteor) {
      this.testConnection = Meteor.connect(Meteor.absoluteUrl());
      this.Meteor = Meteor;
    }

    this.testConnection.apply(methodName, args, (error, result) => {
      log.set({
        consoleProps() {
          return {
            methodName,
            arguments: args,
            error,
            result,
          };
        },
      });

      if (error) {
        reject(error);
      }
      else {
        resolve(result);
      }
    });
  }).catch((error) => {
    Cypress.utils.throwErr(error, {
      onFail: log,
    });
  });
});

Cypress.Commands.add('resetDatabase', function resetDatabase() {
  const log = Cypress.log({
    name: 'resetDatabase',
    message: 'resetDatabase',
  });

  return new Promise((resolve, reject) => {
    const Meteor = cy.state('window').Meteor;

    if (!this.testConnection) {
      this.testConnection = Meteor.connect(Meteor.absoluteUrl());
    }

    this.testConnection.apply('xolvio:cleaner/resetDatabase', [], (error) => {
      if (error) {
        reject(error);
      }
      else {
        resolve();
      }
    });
  }).catch((error) => {
    Cypress.utils.throwErr(error, {
      onFail: log,
    });
  });
});

Cypress.Commands.add('visualSnapshot', (test, name) => {
  const titlePath = [];
  let t = test;
  while (t && !t.root) {
    titlePath.unshift(t.title);
    t = t.parent;
  }
  titlePath.push(name);
  cy.percySnapshot(titlePath.join(' - '));
});
