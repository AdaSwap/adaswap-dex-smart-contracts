var assert = require('assert');
describe('String', function () {
  describe('#length()', function () {
    it('the length of the string "Ethereum" should be 8',
      function () {
        assert.equal(8, 'Ethereum'.length);
      });
  });
});