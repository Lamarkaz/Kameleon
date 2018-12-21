var tendermintNode = require('./tendermint')
var abciServer = require('./abci')
var stateMachine = require('./state')
var auth = require('./auth')
var EventEmitter = require('events')
var inherits = require('util').inherits
var BN = require('bn.js')
var { join } = require('path')

class KameleonApp {

    constructor (options) {
        var defaultOptions = {
            initialState: {},
            queryHandlers:{},
            peers:[],
            validators:[],
            verbose: false,
            home: process.cwd(),
            blockSize:1000000, // 1MB
            txSize: 100000,
            rpcPort:26657,
            abciPort:26658,
            p2pPort:44446,
            chainId:99,
            validatorPubKeyTypes:['ed25519', 'secp256k1']
        }
        var options = Object.assign(defaultOptions, options);
        
        // Try finding input validators first
        if(options.validators.length === 0) {
            var validator;
            try {
            validator = require(join(options.home, 'priv_validator.json'))
            } catch(e) {
                try {
                    validator = require(join(options.home, 'config', 'priv_validator.json'))
                } catch(e) {
                    throw new Error("Could not find priv_validator.json file")
                }
            }
            if(validator.pub_key.type = "tendermint/PubKeyEd25519"){
                validator.pub_key.type = "ed25519"
            }else if(validator.pub_key.type = "tendermint/PubKeySecp256k1") {
                validator.pub_key.type = "secp256k1"
            }
            options.validators.push({
                pubKey:{
                    type: validator.pub_key.type,
                    data: Buffer.from(validator.pub_key.value, 'base64')
                },
                power: { low: 1, high: 0 }
            })
        }

        EventEmitter.call(this);
        this.queryHandlers = options.queryHandlers;
        this.options = options;
        this.initialState = Object.assign({nonces:{}}, this.options.initialState);
        this.stateMachine = stateMachine({initialState:this.initialState, queryHandlers: this.queryHandlers})
        this.stateMachine.use(auth) // Native authentication handler
        this.query('nonce', function(state, address){
            if(typeof state.nonces[address] === "undefined"){
                return '0'
            }else{
                return new BN(state.nonces[address]).add(new BN(1)).toString()
            }
        })
    }

    use() {
        this.stateMachine.use.apply(null, arguments)
    }

    useBlock() {
        this.stateMachine.useBlock.apply(null, arguments)
    }

    query () {
        this.stateMachine.useQuery.apply(null, arguments)
    }

    start() {
        this.stateMachine = this.stateMachine.compile()
        this.abciServer = abciServer(this)
        this.tendermint = tendermintNode(this)

        var self = this;
        process.on('SIGINT', function() {
            console.log("Caught interrupt signal. Shutting down");
            self.tendermint.kill()
            process.exit()
        });
    }

}

inherits(KameleonApp, EventEmitter);

module.exports = KameleonApp;