const Transaction = require('ethereumjs-tx');
const BN = require('bn.js');

var validNonce = function(nonces, txNonce, sender) {
    if(typeof nonces[sender] == 'undefined' && txNonce === '0') {
        return true; //shortcut
    }

    if(isNaN(txNonce)){
        return false
    }

    if(typeof nonces[sender] == 'undefined' && txNonce != '0') {
        return false;
    }
    var bigNonce = new BN(txNonce)
    var bigLastNonce = new BN(nonces[sender])

    if(typeof txNonce != 'string'){
        return false;
    }
    if(txNonce === "") {
        return false;
    }
    if(bigNonce.isNeg()){
        return false;
    }
    if(bigNonce.sub(bigLastNonce).toString() != '1') {
        return false;
    }
    return true;
}

var validValue = function(value) {
    if(value === '0') {
        return true //shortcut
    }

    if(isNaN(value)){
        return false
    }

    var bigValue = new BN(value);
    if(bigValue.isNeg()){
        return false
    }

    return true
}

var validTo = function(address) {
    var pattern = new RegExp('^[a-fA-F0-9]{40}$');
    return pattern.test(address)
}

module.exports = function(state, incomingTx, chainInfo, type) {
    var tx = new Transaction(incomingTx.rawTx)
    if(tx.verifySignature()){ //Validate signature
        var sender = tx.getSenderAddress().toString('hex')

        // Validate values
        if(!validNonce(state.nonces, incomingTx.nonce, sender)){
            throw new Error('Invalid nonce')
        }
        if(!validValue(incomingTx.value)){
            throw new Error('Invalid value')
        }
        if(!validTo(incomingTx.to)){
            throw new Error('Invalid to address')
        }

        // Mutate state

        if(typeof state.nonces[sender] === 'undefined'){
            state.nonces[sender] = '0'
        }else{
            state.nonces[sender] = new BN(state.nonces[sender]).add(new BN(1)).toString()
        }
    }else{
        throw new Error('Invalid signature')
    }

}