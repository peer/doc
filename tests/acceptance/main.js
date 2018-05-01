/* eslint-env mocha */
/* eslint-disable func-names, prefer-arrow-callback */

/* eslint-disable-next-line no-unused-vars */
/* globals browser assert server */

describe('front page', function () {
  beforeEach(function () {
    browser.url('http://localhost:3000');
  });

  it('has toolbar with title', function () {
    browser.waitForExist('.toolbar__title');
    const elements = browser.elements('.toolbar__title');
    assert.equal(elements.value.length, 1);
    assert.equal(browser.elementIdText(elements.value[0].ELEMENT).value, 'PeerDoc');
  });
});
