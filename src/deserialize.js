var { decode } = require("msgpack-lite");
const Transaction = require('ethereumjs-tx');
const BN = require('bn.js');

var toAscii = function(hex) {
  // Find termination
      var str = "";
      var i = 0, l = hex.length;
      if (hex.substring(0, 2) === '0x') {
          i = 2;
      }
      for (; i < l; i+=2) {
          var code = parseInt(hex.substr(i, 2), 16);
          str += String.fromCharCode(code);
      }
  
      return str;
  };  

module.exports = function(rawTx) {
  tx = new Transaction(rawTx)
  var decodedTx = {
    gasLimit: new BN(tx.gasLimit.toString()).toString(),
    gasPrice: new BN(tx.gasPrice.toString()).toString(),
    nonce: new BN(tx.nonce.toString()).toString(),
    from: tx.getSenderAddress().toString('hex'),
    to: tx.to.toString('hex'),
    value: new BN(tx.value.toString()).toString(),
    sig:{
      v:tx.v,
      r:tx.r,
      s:tx.s
    },
    chainId:tx.chainId,
    data:decode(Buffer.from(toAscii(tx.data.toString('hex')), 'hex')),
    rawTx
  }
  return decodedTx;
}