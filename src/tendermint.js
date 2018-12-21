var tendermint = require('tendermint-node')

module.exports = function(app) {
    
    tendermint.initSync(app.options.home)

    let node = tendermint.node(app.options.home, {
        rpc: {
            laddr: 'tcp://127.0.0.1:'+ app.options.rpcPort
        },
        p2p: {
            laddr: 'tcp://127.0.0.1:'+ app.options.p2pPort
        },
        proxyApp: 'tcp://127.0.0.1:'+ app.options.abciPort
    })
    if(app.options.verbose) {
        node.stdout.pipe(process.stdout)
    }
    return node
}   