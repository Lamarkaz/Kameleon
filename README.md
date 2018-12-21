# Kameleon
Javascript framework for private and public blockchains powered by Tendermint consensus.

This project is work in progress. It should not be used in production to hold real value.

# Features
* Pure Javascript experience for both public and private blockchain development
* P2P and consensus provided by a Tendermint node under the hood
* Extensible using third party middlewares
* Ethereum transaction format and RLP serialization
* Secp256k1 addresses and signing compatible with Ethereum wallet tools
* Transaction signature validation

# Installation

## Requirements:
* Node.js v.7.6.0 or higher
* Mac or Linux

```bash
npm install --save kameleon
```

# Usage

## Minimal Viable Kameleon

```javascript
let kameleon = require('kameleon')

let node = new kameleon({
    initialState: {
        accounts:{}
    }
})

node.use(function(state, tx) {
  state.accounts[tx.from] = true
})

node.query('account',function(state, account){
  return state.accounts[account] === true
})

node.start()
```

## Configuration

`new kameleon(Object)` creates a new kameleon instance. It can be given an object as an optional argument to configure Kameleon. Below are the default values:

```javascript
{
    initialState: {},
    queryHandlers:{},
    validators:[],
    verbose: false,
    home: process.cwd(),
    blockSize:1000000, // 1MB
    rpcPort:26657,
    abciPort:26658,
    p2pPort:44446,
    chainId:99,
    validatorPubKeyTypes:['ed25519', 'secp256k1']
}
```

# API

API docs will be deployed on a separate site soon.

# Client

To connect to a Kameleon node from a browser or Node.js, use the [Kameleon client package](https://github.com/Lamarkaz/Kameleon-client).

# Acknowledgement

Kameleon was heavily inspired by the great work done by the community. We invite you to also check out their [repo](https://github.com/keppel/lotion).

# Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

# License

[GNU GPLv3](https://choosealicense.com/licenses/gpl-3.0/)