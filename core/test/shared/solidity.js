const _ = require('lodash');

function isContainedIn(a, b) {
  let ret = true;
  Object.keys(b).forEach(key => {
    ret &= _.isEqual(b[key].toString(), a[key].toString())
  })

  return ret
}

const correctEventName = function (tx, name) {
  const { logs } = tx
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    if (_.isEqual(log.event, name)) return true
  }
  return false
}

const correctEventArgs = function (tx, args) {
  const { logs } = tx
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    if (isContainedIn(log.args, args)) return true
  }
  return false
}

module.exports = (chai) => {
  chai.Assertion.addMethod('emit', function (name, args) {
    this.assert(
      this._obj,
      `expected #{this} to be existing`,
      `expected #{this} not to be existing`
    )
    this.assert(
      correctEventName(this._obj, name),
      `expected transaction to be containing event name ${name}`,
      `expected transaction not to be containing event name ${name}`
    )
    this.assert(
      correctEventArgs(this._obj, args),
      `expected transaction to be containing event args ${JSON.stringify(args)}`,
      `expected transaction not to be containing event args ${JSON.stringify(args)}`
    )
  })

  chai.Assertion.addProperty('reverted', function (){
    this.assert(
      this._obj,
      `expected #{this} to be existing`,
      `expected #{this} not to be existing`
    )
    this.assert(
      _.isEqual(this._obj.message, "Returned error: VM Exception while processing transaction: revert"),
      `expected #{this} to be have correct reverted message`,
      `expected #{this} not to be have correct reverted message`
    )
  })
}
