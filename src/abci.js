var createServer = require('abci')
var deserialize = require('./deserialize')
var { encode, decode } = require('msgpack-lite')
module.exports = function (app) {
  var height = 0;
  return createServer({
    info (request) {
      app.emit('info', request)
      return {
        // version: require('./package.json').version,
        // appVersion:app.options.chainId
      }
    },
    deliverTx (request) {
      try {
        let tx = deserialize(request.tx)
        try {
          app.stateMachine.transition({ type: 'transaction', data: tx })
          app.emit('tx', tx)
          return {}
        } catch (e) {
          return { code: 1, log: e.toString() }
        }
      } catch (e) {
        return { code: 1, log: 'Invalid transaction encoding' }
      }
    },
    checkTx (request) {
      try {
        let tx = deserialize(request.tx)
        try {
          app.stateMachine.check(tx)
          app.emit('pendingTx', tx)
          return {}
        } catch (e) {
          return { code: 1, log: e.toString() }
        }
      } catch (e) {
        return { code: 1, log: 'Invalid transaction encoding' }
      }
    },
    beginBlock (request) {
      let time = request.header.time.seconds.toNumber()

      app.stateMachine.transition({ type: 'begin-block', data: { time } })
      app.emit('pendingBlock', request)
      return {}
    },
    endBlock() {
      app.stateMachine.transition({ type: 'block', data: {} })
      let { validators } = app.stateMachine.context()
      let validatorUpdates = []

      for (let pubKey in validators) {
        validatorUpdates.push({
          pubKey: { type: validators[pubKey].type, data: Buffer.from(pubKey, 'base64') },
          power: { low: validators[pubKey].power, high: 0 }
        })
      }
      height++
      app.emit('finalBlock', height)
      return {
        validatorUpdates
      }
    },
    commit() {
      let data = app.stateMachine.commit()
      app.emit('commit', data)
      return { data: Buffer.from(data, 'hex') }
    },
    initChain(request) {
      /**
       * in next abci version, we'll get a timestamp here.
       * height is no longer tracked on info (we want to encourage isomorphic chain/channel code)
       */
      var validators = Object.assign(request.validators, app.options.validators)
      let initialInfo = buildInitialInfo(validators)
      app.stateMachine.initialize(app.initialState, initialInfo)
      return {
        consensusParams: {
          blockSize: {
            maxBytes: app.options.blockSize
          },
          validator: {
            pubKeyTypes: app.options.validatorPubKeyTypes
          }
        },
        validators
      }
    },
    query(request) {
      let path = request.path
      if(request.data.length === 0){
        var data = {}
      }else{
        var data = decode(Buffer.from(request.data, 'hex'))
      }
      let info = '0x'+encode(app.stateMachine.query(path, data)).toString('hex')

      return {
        info,
        height
      }
    }
    
  }).listen(app.options.abciPort)

  function buildInitialInfo(initChainRequest) {
    let result = {
      validators: {}
    }
    initChainRequest.validators.forEach(validator => {
      result.validators[
        validator.pubKey.data.toString('base64')
      ] = {
        power:validator.power.toNumber(),
        type:validator.pubKey.type
      }
    })
  
    return result
  }

}
