/* eslint-env cypress/globals */

// Call a Meteor method.
// TODO: This should be improved. See: https://github.com/cypress-io/cypress/issues/2443
Cypress.Commands.add('call', (methodName, ...args) => {
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

    const testConnection = Meteor.connect(Meteor.absoluteUrl());

    testConnection.call(methodName, ...args, (error, result) => {
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
