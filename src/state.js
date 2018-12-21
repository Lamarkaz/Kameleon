var Router = require('./router')
var { createHash } = require('crypto')
var djson = require('deterministic-json')
var muta = require('muta')

"use strict";
//Object.defineProperty(exports, "__esModule", { value: true });
// defines an FSM to ensure state machine transitions
// are called in the proper order
var validTransitions = {
    'none': new Set(['initialize']),
    'initialize': new Set(['begin-block']),
    'begin-block': new Set(['transaction', 'block']),
    'transaction': new Set(['transaction', 'block']),
    'block': new Set(['commit']),
    'commit': new Set(['begin-block'])
};
function StateMachine(opts) {
    var transactionHandlers = [];
    var initializers = [];
    var blockHandlers = [];
    var routes;
    var appMethods = {
        use: function (middleware, route) {
            if (typeof middleware === 'string') {
                if (routes == null) {
                    routes = {};
                }
                var routeName = middleware;
                if (routeName in routes) {
                    throw Error("Route \"" + routeName + "\" already exists");
                }
                if (route == null) {
                    throw Error('Expected middleware for route');
                }
                routes[routeName] = route;
            }
            else if (middleware instanceof Array) {
                middleware.forEach(appMethods.use);
            }
            else if (typeof middleware === 'function') {
                appMethods.useTx(middleware);
            }
            else if (middleware.type === 'tx') {
                appMethods.useTx(middleware.middleware);
            }
            else if (middleware.type === 'block') {
                appMethods.useBlock(middleware.middleware);
            }
            else if (middleware.type === 'initializer') {
                appMethods.useInitializer(middleware.middleware);
            }
            else if (middleware.type === 'query') {
                appMethods.useQuery(middleware.path, middleware.middleware);
            }
            else {
                throw Error('Unknown middleware type');
            }
            return appMethods;
        },
        useBlock: function (blockHandler) {
            blockHandlers.push(blockHandler);
        },
        useTx: function (txHandler) {
            transactionHandlers.push(txHandler);
        },
        useInitializer: function (initializer) {
            initializers.push(initializer);
        },
        useQuery: function(path, handler) {
            opts.queryHandlers[path] = handler
        },
        compile: function () {
            if (routes != null) {
                var router = Router(routes);
                appMethods.use(router);
            }
            var appState = opts.initialState || {};
            var mempoolState = muta(appState);
            var nextState, nextValidators, nextContext;
            var chainValidators, mempoolValidators, mempoolContext;
            var prevOp = 'none';
            function applyTx(state, tx, context, type) {
                /**
                 * wrap the state and context for this one tx.
                 * try applying this transaction.
                 * if an error is thrown, transaction is invalid.
                 * if neither wrapper is mutated, transaction is invalid.
                 * if the transaction is invalid, rollback any mutations.
                 */
                var txState = muta(state);
                var txValidators = muta(context.validators);
                context = Object.assign({}, context, { validators: txValidators });
                try {
                    transactionHandlers.forEach(function (m) { return m(txState, tx, context, type); });
                    /**
                     * tx was applied without error.
                     * now make sure something was mutated.
                     */
                    if (wasMutated(txState) || wasMutated(txValidators)) {
                        /**
                         * valid tx.
                         * commit wrappers back to their sources.
                         */
                        muta.commit(txState);
                        muta.commit(txValidators);
                        return {};
                    }
                    else {
                        throw new Error('transaction must mutate state or validators to be valid');
                    }
                }
                catch (e) {
                    /**
                     * tx error.
                     * invalid, don't mutate state.
                     */
                    throw e;
                }
            }
            // check FSM to ensure consumer is transitioning us in the right order
            function checkTransition(type) {
                var valid = validTransitions[prevOp].has(type);
                if (!valid) {
                    throw Error("Invalid transition: type=" + type + " prev=" + prevOp);
                }
                prevOp = type;
            }
            return {
                initialize: function (initialState, initialContext) {
                    if (initialContext === void 0) { initialContext = {}; }
                    checkTransition('initialize');
                    nextContext = initialContext;
                    chainValidators = initialContext.validators || {};
                    mempoolValidators = muta(chainValidators);
                    Object.assign(appState, initialState);
                    // TODO: should this get the initial context?
                    initializers.forEach(function (m) { return m(appState); });
                },
                transition: function (action) {
                    checkTransition(action.type);
                    if (action.type === 'transaction') {
                        applyTx(nextState, action.data, nextContext, 'deliver');
                    }
                    else if (action.type === 'block') {
                        /**
                         * end block.
                         * apply block handlers.
                         * compute validator set updates.
                         */
                        blockHandlers.forEach(function (m) { return m(nextState, nextContext); });
                    }
                    else if (action.type === 'begin-block') {
                        /**
                         * begin block.
                         * reset mempool state.
                         * also set timestamp.
                         */
                        nextState = muta(appState);
                        nextValidators = muta(chainValidators);
                        nextContext = Object.assign({}, action.data, {
                            validators: nextValidators
                        });
                    }
                },
                commit: function () {
                    checkTransition('commit');
                    /**
                     * reset mempool state/ctx on commit
                     */
                    muta.commit(nextState);
                    muta.commit(nextValidators);
                    mempoolState = muta(appState);
                    mempoolValidators = muta(chainValidators);
                    return createHash('sha256')
                        .update(djson.stringify(appState))
                        .digest('hex');
                },
                check: function (tx) {
                    var context = Object.assign({}, nextContext, {
                        validators: mempoolValidators,
                    });
                    applyTx(mempoolState, tx, context, 'check');
                },
                query: function (path, data) {
                    if(opts.queryHandlers[path]) {
                        return opts.queryHandlers[path](appState, data);
                    } else {
                        return {}
                    }
                },
                context: function () {
                    return nextContext;
                }
            };
        }
    };
    return appMethods;
}
function wasMutated(wrapper) {
    var patch = muta.patch(wrapper);
    return (Object.getOwnPropertySymbols(patch).length > 0 ||
        Object.keys(patch).length > 0);
}
module.exports = StateMachine;
