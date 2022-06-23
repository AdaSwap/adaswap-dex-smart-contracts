const _ = require('lodash');

const revertMsg = 'Returned error: VM Exception while processing transaction: revert';

function isContainedIn(a, b, opts) {
  let ret = true;
  Object.keys(b).forEach(key => {
    ret &= opts.address.includes(key) ? compareAddress(a[key], b[key]) : _.isEqual(b[key].toString(), a[key].toString())
  })

  return ret
}

const compareAddress = function (a, b) {
  return _.isEqual(b.toLowerCase(), a.toLowerCase())
}

const correctEvent = function (tx, name, args, opts) {
  const { logs } = tx
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    if (_.isEqual(log.event, name) && isContainedIn(log.args, args, opts)) return true
  }
  return false
}

module.exports = (chai) => {
  chai.Assertion.addMethod('emit', function (name, args, opts = {address: []}) {
    this.assert(
      this._obj,
      `expected #{this} to be existing`,
      `expected #{this} not to be existing`
    )
    this.assert(
      correctEvent(this._obj, name, args, opts),
      `expected transaction to be containing event '${name}' with args ${JSON.stringify(args)}`,
      `expected transaction not to be containing event '${name}' with args ${JSON.stringify(args)}`
    )
  })

  chai.Assertion.addMethod('revertedWith', function (reason) {
    this.assert(
      this._obj,
      `expected error message to be existing`,
      `expected error message not to be existing`
    )

    this.assert(
      this._obj.message.toString().includes(revertMsg) && this._obj.message.toString().includes(reason),
      `expected error message to be have correct reverted message`,
      `expected error message not to be have correct reverted message`
    )
  })

  chai.Assertion.addProperty('reverted', function () {
    this.assert(
      this._obj,
      `expected error message to be existing`,
      `expected error message not to be existing`
    )
    this.add
    this.assert(
      this._obj.message.toString().includes(revertMsg),
      `expected error message to be have correct reverted message`,
      `expected error message not to be have correct reverted message`
    )
  })
}
