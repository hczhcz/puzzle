'use strict';

//////// utilities ////////

var lion = {

    //////// builtin libraries ////////

    core: {},

    std: {
        LIONJS: true,

        // see envq in lion.core
        envq: function (env, ast) {
            throw Error('[LION] can not call envq in the standard library');
        },

        // see getq in lion.core
        getq: function (env, ast) {
            var name = ast[1];

            if (Object.hasOwnProperty.call(lion.core, name)) {
                // found in lion.core
                return lion.core[name];
            } else if (Object.hasOwnProperty.call(lion.std, name)) {
                // found in lion.std
                return lion.std[name];
            } else {
                // not found
                throw Error('[LION] value not found: ' + name);
            }
        },
    },

    //////// constants ////////

    W_DELAY: 1,
    W_ARG_HAS_ENV: 2,
    W_ARG_AS_ARR: 4,

    //////// maps ////////

    typeMap: {
        Object: Object,
        Function: Function,
        Array: Array,
        String: String,
        Boolean: Boolean,
        Number: Number,
        Date: Date,
        RegExp: RegExp,
        Error: Error,
        EvalError: EvalError,
        RangeError: RangeError,
        ReferenceError: ReferenceError,
        SyntaxError: SyntaxError,
        TypeError: TypeError,
        URIError: URIError,
    },

    errorMap: {
        Error: Error,
        EvalError: EvalError,
        RangeError: RangeError,
        ReferenceError: ReferenceError,
        SyntaxError: SyntaxError,
        TypeError: TypeError,
        URIError: URIError,
    },

    //////// wrapper functions ////////

    // convert f([env, ]arg...) to g(env, ast) with calls
    wrap: function (func, option) {
        return function (env, ast) {
            var args = [];

            // scan arguments
            var l = ast.length;
            for (var i = 1; i < l; ++i) {
                if (option & lion.W_DELAY) {
                    // make a function
                    args.push(function (target) {
                        return function () {
                            return lion.call(env, target);
                        };
                    } (ast[i]));
                } else {
                    // call directly
                    args.push(
                        lion.call(env, ast[i])
                    );
                }
            }

            if (option & lion.W_ARG_AS_ARR) {
                if (option & lion.W_ARG_HAS_ENV) {
                    return func(env, args);
                } else {
                    return func(args);
                }
            } else {
                if (option & lion.W_ARG_HAS_ENV) {
                    args.unshift(env);
                }
                return func.apply(this, args);
            }
        };
    },

    // add checker to a function (for lion.core)
    wrapCore: function (func, option) {
        return function (env, ast) {
            if (Object.hasOwnProperty.call(env, 'LIONJS')) {
                return func(env, ast);
            } else {
                throw Error('[LION] core function is not allowed: ' + ast[0]);
            }
        };
    },

    // convert a native object to an environment
    wrapObj: function (obj, option, envname) {
        return {
            LIONJS: true,

            // see envq in lion.core
            envq: function (env, ast) {
                // return ['LIONSTD', ['getq', envname]];
                return envname;
            },

            // see xgetq in lion.core
            xgetq: function (env, ast) {
                var name = ast[1];

                if (Object.hasOwnProperty.call(obj, name)) {
                    return lion.wrap(obj[name], option);
                } else {
                    // find from the standard library
                    return lion.coreFunc(lion.std, ['getq', name]);
                }
            },
        };
    },

    // convert an object with prototype (a class-like object) to an environment
    wrapClass: function (obj, option, envname) {
        return {
            LIONJS: true,

            // see envq in lion.core
            envq: function (env, ast) {
                // return ['LIONSTD', ['getq', envname]];
                return envname;
            },

            // see xgetq in lion.core
            xgetq: function (env, ast) {
                var name = ast[1];

                if (Object.hasOwnProperty.call(obj.prototype, name)) {
                    return lion.wrap(function (args) {
                        var target = args.shift();

                        var map = {
                            String: 'string',
                            Boolean: 'boolean',
                            Number: 'number',
                        };

                        if (
                            target instanceof Object ?
                            // target instanceof obj : typeof target === typeof obj()
                            target instanceof obj : (
                                Object.hasOwnProperty.call(map, envname)
                                && typeof target === typeof envname
                            )
                        ) {
                            return obj.prototype[name].apply(target, args);
                        } else {
                            throw Error('[LION] bad access to object method: ' + name);
                        }
                    }, option | lion.W_ARG_AS_ARR);
                } else {
                    // find from the standard library
                    return lion.coreFunc(lion.std, ['getq', name]);
                }
            },
        };
    },

    //////// helper functions ////////

    // add library functions
    addFunc: function (env, pkg, hook, option) {
        for (var i in pkg) {
            if (i in env) {
                throw Error('[LION] naming conflict in the library: ' + i);
            } else {
                env[i] = hook ? hook(pkg[i], option, i) : pkg[i];
            }
        }
    },

    // execute an AST by getting a callee
    call: function (env, ast) {
        if (ast instanceof Array) {
            // is a function call

            var callee = lion.call(env, ast[0]);

            // call via env.callq
            return lion.coreFunc(
                env,
                ['callq', callee, ast]
            );
        } else {
            // is an object
            return ast;
        }
    },

    // search core function in env and lion.core
    coreFunc: function (env, ast) {
        var name = ast[0];

        if (Object.hasOwnProperty.call(env, name)) {
            return lion.core['callq'](
                env,
                ['callq', env[name], ast]
            );
        } else if (Object.hasOwnProperty.call(lion.core, name)) {
            return lion.core[name](env, ast);
        }
    },

    //////// interface functions ////////

    // create a new environment
    init: function () {
        return {LIONJS: true};
    },

    // parse a string, execute it and return a string
    exec: function (env, str) {
        return JSON.stringify(lion.call(env, JSON.parse(str)));
    },

    // call lion.init and lion.exec
    boot: function (str) {
        return lion.exec(lion.init(), str);
    },
};

//////// modularization support ////////

if (
    typeof require === 'function'
    && typeof module === 'object'
    && typeof module.exports === 'object'
) {
    // CommonJS / NodeJS
    module.exports = lion;
} else if (
    typeof define === 'function'
    // && define['amd']
) {
    // AMD / CMD
    define(lion);
}

//////// core functions ////////

// core-level names:
//     LIONJS
//     callq
//     envq
//     getq
//     xgetq
//     setq
//     delq
//     parent
//     caller
//     callee
//     callenv

lion.addFunc(lion.core, {
    // execute an AST with a given callee
    // proto: callq('callee, 'caller) -> result
    callq: function (env, ast) {
        // TODO: move something to lion.call
        //       and make this function overridable
        var callee = ast[1];
        var caller = ast[2];

        if (typeof callee === 'string') {
            // get the callee from the environment
            var newcallee = lion.coreFunc(
                env,
                ['getq', callee]
            );

            if (newcallee) {
                // apply the callee
                return lion.coreFunc(
                    env,
                    ['callq', newcallee, caller]
                );
            } else {
                // callee not found
                throw Error('[LION] callee not found: ' + callee);
            }
        } else if (callee instanceof Function) {
            // callee is a builtin function

            return callee(env, caller);
        } else if (callee instanceof Array) {
            // callee is an AST

            // call with a new environment
            var newenv = {
                LIONJS: true,
                caller: caller,
                callee: callee,
                callenv: lion.coreFunc(env, ['envq']),
            };

            return lion.call(newenv, callee);
        } else if (callee instanceof Object) {
            // callee is an object

            // use callee as the new environment
            return lion.call(callee, caller[1]);
        } else {
            // callee is not callable

            // return callee;
            throw Error('[LION] callee is not callable: ' + callee);
        }
    },

    // get current environment
    // proto: envq() -> env
    envq: function (env, ast) {
        return env;
    },

    // get value from current environment or call xgetq
    // proto: getq('name) -> value
    getq: function (env, ast) {
        var name = ast[1];

        if (Object.hasOwnProperty.call(env, name)) {
            // found
            return env[name];
        } else {
            // not found
            return lion.coreFunc(env, ['xgetq', name]);
        }
    },

    // get value outside of current environment
    // proto: xgetq('name) -> value
    xgetq: function (env, ast) {
        var name = ast[1];

        if (Object.hasOwnProperty.call(env, 'parent')) {
            // find from env's parent
            return lion.coreFunc(env.parent, ['getq', name]);
        } else {
            // find from the standard library
            return lion.coreFunc(lion.std, ['getq', name]);
        }
    },

    // set value in current environment
    // proto: setq('name, 'value) -> value
    setq: function (env, ast) {
        var name = ast[1];
        var value = ast[2];

        if ((name in env) && !Object.hasOwnProperty.call(env, name)) {
            // js internal property
            throw Error('[LION] name is not acceptable: ' + name);
        } else {
            return env[name] = value;
        }
    },

    // remove value from current environment
    // proto: delq('name) -> success
    delq: function (env, ast) {
        var name = ast[1];

        if ((name in env) && !Object.hasOwnProperty.call(env, name)) {
            // js internal property
            throw Error('[LION] name is not acceptable: ' + name);
        } else {
            if (Object.hasOwnProperty.call(env, name)) {
                // found
                return delete env[name];
            } else {
                // not found
                throw Error('[LION] value not found: ' + name);
            }
        }
    },
}, lion.wrapCore);

//////// the standard library ////////

//// access & call ////

lion.addFunc(lion.std, {
    // callq() with calling
    // proto: callq(callee, caller) -> result
    call: function (env, callee, caller) {
        return lion.coreFunc(env, ['callq', callee, caller]);
    },

    // envq() with calling
    // proto: env() -> env
    env: function (env) {
        return lion.coreFunc(env, ['envq']);
    },

    // getq() with calling
    // proto: get(name) -> value
    get: function (env, name) {
        return lion.coreFunc(env, ['getq', name]);
    },

    // xgetq() with calling
    // proto: xget(name) -> value
    xget: function (env, name) {
        return lion.coreFunc(env, ['xgetq', name]);
    },

    // setq() with calling
    // proto: set(name, value) -> value
    set: function (env, name, value) {
        return lion.coreFunc(env, ['setq', name, value]);
    },

    // delq() with calling
    // proto: del(name) -> success
    del: function (env, name) {
        return lion.coreFunc(env, ['delq', name]);
    },

    // set quoted value
    // proto: var(name, value) -> 'value
    var: function (env, name, value) {
        return lion.coreFunc(env, ['setq', name, ['quote', value]]);
    },
}, lion.wrap, lion.W_ARG_HAS_ENV);

lion.addFunc(lion.std, {
    // return the AST
    // proto: quote('ast) -> 'ast
    quote: function (env, ast) {
        return ast[1];
    },

    // just calling
    // proto: pass(ast) -> (call)^1 -> result
    pass: function (env, ast) {
        return lion.call(env, ast[1]);
    },

    // lion.call() with wrap
    // proto: eval($ast) -> (call)^2 -> result
    eval: function (env, ast) {
        return lion.call(env, lion.call(env, ast[1]));
    },

    // call a function and modify a value
    // proto: mut(func, name, ...) -> new value
    mut: function (env, ast) {
        var name = lion.call(env, ast[2]);
        var oldvalue = lion.coreFunc(env, ['getq', name]);

        var args = ast.slice(1);
        args[1] = oldvalue; // hack

        var newvalue = lion.call(env, args);

        return lion.coreFunc(env, ['setq', name, ['quote', newvalue]]);
    },
});

lion.addFunc(lion.std, {
    // string to AST (JSON only)
    // proto: parse(str) -> ast
    parse: function (json) {
        return JSON.parse(json);
    },

    // AST to string (JSON only)
    // proto: stringify(ast) -> str
    stringify: function (ast) {
        return JSON.stringify(ast);
    },
}, lion.wrap);

//// function ////

lion.addFunc(lion.std, {
    // execute and make quote
    // proto: argcall('env, 'ast) -> 'called
    argcall: function (env, ast) {
        return ['quote', lion.call(ast[1], ast[2])];
    },

    // execute later
    // proto: argpass('env, 'ast) -> 'pass(ast)
    argpass: function (env, ast) {
        return [ast[1], ['pass', ast[2]]];
    },

    // make quote
    // proto: argquote('env, 'ast) -> 'ast
    argquote: function (env, ast) {
        return ['quote', ast[2]];
    },

    // do nothing
    // proto: argraw('env, 'ast) -> ast
    argraw: function (env, ast) {
        return ast[2];
    },
});

lion.addFunc(lion.std, {
    // give name to arguments with wrap
    // proto: setarg(wrapper, ...) -> caller
    setarg: function (env, arr) { // TODO: rename?
        // get arguments
        var caller = lion.coreFunc(
            env,
            ['getq', 'caller']
        );
        var callenv = lion.coreFunc(
            env,
            ['getq', 'callenv']
        );

        var wrapper = arr[0];

        for (var i = 1; i < arr.length; ++i) {
            var arg = lion.call(
                env, [wrapper, callenv, caller[i]]
            );

            lion.coreFunc(
                env, ['setq', arr[i], arg]
            );
        }

        return caller;
    },
}, lion.wrap, lion.W_ARG_HAS_ENV | lion.W_ARG_AS_ARR);

lion.addFunc(lion.std, {
    // make an anonymous function with closure
    // proto: lambda(wrapper, ..., body) -> function
    lambda: function (env, ast) {
        var setparent = ['setq', 'parent', lion.coreFunc(env, ['envq'])];
        var setarg = ['setarg'];

        for (var i = 1; i < ast.length - 1; ++i) {
            setarg.push(ast[i]);
        }

        return [
            'do',
            setparent,
            setarg,
            ast[ast.length - 1]
        ];
    },

    // make an anonymous function without closure
    // proto: macro(wrapper, ..., body) -> function
    macro: function (env, ast) {
        var setarg = ['setarg'];

        for (var i = 1; i < ast.length - 1; ++i) {
            setarg.push(ast[i]);
        }

        return [
            'do',
            setarg,
            ast[ast.length - 1]
        ];
    },
});

//// control flows ////

lion.addFunc(lion.std, {
    // conditional branch
    // proto: cond(cond, action, ...) -> result
    cond: function (arr) {
        var l = arr.length;
        for (var i = 0; i + 1 < l; i += 2) {
            if (arr[i]()) {
                return arr[i + 1]();
            }
        }
    },

    // switch-like branch
    // proto: case(value, default, case, action, ...) -> result
    case: function (arr) {
        var l = arr.length;
        var value = arr[0]();
        for (var i = 2; i + 1 < l; i += 2) {
            var target = arr[i]();
            if (target instanceof Array) {
                // multi cases
                for (var j = 0; j < target.length; ++j) {
                    if (value == target[j]) {
                        return arr[i + 1]();
                    }
                }
            } else {
                // one case
                if (value == target) {
                    return arr[i + 1]();
                }
            }
        }
        // default branch
        return arr[1]();
    },
}, lion.wrap, lion.W_DELAY | lion.W_ARG_AS_ARR);

lion.addFunc(lion.std, {
    // simple branch (if branch)
    // proto: if(cond, then, else) -> result
    if: function (cond, then_br, else_br) {
        if (cond()) {
            return then_br();
        } else if (else_br) {
            return else_br();
        }
    },

    // simple loop
    // proto: loop(count, body) -> all result
    loop: function (count, body) {
        var all = [];

        for (var i = Math.floor(count()); i > 0; --i) {
            all.push(body());
        }

        return all;
    },

    // for loop
    // proto: for(init, cond, step, body) -> all result
    for: function (init, cond, step, body) {
        var all = [];

        for (init(); cond(); step()) {
            all.push(body());
        }

        return all;
    },

    // while loop
    // proto: while(cond, body) -> all result
    while: function (cond, body) {
        var all = [];

        while (cond()) {
            all.push(body());
        }

        return all;
    },

    // until (do-while) loop
    // proto: until(cond, body) -> all result
    until: function (cond, body) {
        var all = [];

        do {
            all.push(body());
        } while (cond());

        return all;
    },
}, lion.wrap, lion.W_DELAY);

//// iteration ////

lion.addFunc(lion.std, {
    // iteration loop (for-in loop) by index
    // proto: forin(iter, data, body) -> all result
    forin: function (env, iter, data, body) {
        var name = iter();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var all = [];

        for (var i in list) {
            lion.coreFunc(env, ['setq', name, ['quote', i]]);
            all.push(body());
        }

        return all;
    },

    // iteration loop (for-in loop) by value
    // proto: each(iter, data, body) -> all result
    each: function (env, iter, data, body) {
        var name = iter();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var all = [];

        for (var i in list) {
            lion.coreFunc(env, ['setq', name, ['quote', list[Math.floor(i)]]]);
            all.push(body());
        }

        return all;
    },

    // find the first value
    // proto: find(iter, data, cond) -> first result
    find: function (env, iter, data, cond) {
        var name = iter();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        for (var i in list) {
            lion.coreFunc(env, ['setq', name, ['quote', list[Math.floor(i)]]]);
            if (cond()) {
                return list[Math.floor(i)];
            }
        }
    },

    // filter values
    // proto: filter(iter, data, cond) -> result list
    filter: function (env, iter, data, cond) {
        var name = iter();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var all = [];

        for (var i in list) {
            lion.coreFunc(env, ['setq', name, ['quote', list[Math.floor(i)]]]);
            if (cond()) {
                all.push(list[Math.floor(i)]);
            }
        }

        return all;
    },

    // linear for loop
    // proto: table(iter, begin, end, step, body) -> all result
    table: function (env, iter, begin, end, step, body) {
        var name = iter();

        var all = [];

        for (var i = begin(); i != end(); i += step()) {
            lion.coreFunc(env, ['setq', name, ['quote', i]]);
            all.push(body());
        }

        return all;
    },

    // generate linear values
    // proto: range(begin, end, step)
    range: function (env, begin, end, step) {
        var all = [];

        // notice: arguments are called dynamically
        for (var i = begin(); i != end(); i += step()) {
            all.push(i);
        }

        return all;
    },

    // left folding by value
    // proto: foldl(iter1, iter2, data, body) -> result
    foldl: function (env, iter1, iter2, data, body) {
        var name1 = iter1();
        var name2 = iter2();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var value = list[0];

        for (var i = 1; i < list.length; ++i) {
            lion.coreFunc(env, ['setq', name1, ['quote', value]]);
            lion.coreFunc(env, ['setq', name2, ['quote', list[i]]]);

            value = body();
        }

        return value;
    },

    // right folding by value
    // proto: foldr(iter1, iter2, data, body) -> result
    foldr: function (env, iter1, iter2, data, body) {
        var name1 = iter1();
        var name2 = iter2();
        var list = data();

        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var value = list[list.length - 1];

        for (var i = list.length - 2; i >= 0; --i) {
            lion.coreFunc(env, ['setq', name1, ['quote', list[i]]]);
            lion.coreFunc(env, ['setq', name2, ['quote', value]]);

            value = body();
        }

        return value;
    },
}, lion.wrap, lion.W_DELAY | lion.W_ARG_HAS_ENV);

lion.addFunc(lion.std, {
    // pass each value in a list to a function
    // proto: map(func, list) -> all result
    map: function (env, func, list) {
        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var all = [];

        for (var i = 0; i < list.length; ++i) {
            all.push(lion.call(
                env,
                [
                    ['quote', func],
                    ['quote', list[i]],
                    ['quote', i]
                ]
            ));
        }

        return all;
    },

    // left folding using a function
    // proto: reducel(func, list) -> result
    reducel: function (env, func, list) {
        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var value = list[0];

        for (var i = 1; i < list.length; ++i) {
            value = lion.call(
                env,
                [
                    ['quote', func],
                    ['quote', value],
                    ['quote', list[i]],
                    ['quote', i - 1],
                    ['quote', i]
                ]
            );
        }

        return value;
    },

    // right folding using a function
    // proto: reducer(func, list) -> result
    reducer: function (env, func, list) {
        if (!list instanceof Array) {
            throw Error('[LION] bad type of list');
        }

        var value = list[list.length - 1];

        for (var i = list.length - 2; i >= 0; --i) {
            value = lion.call(
                env,
                [
                    ['quote', func],
                    ['quote', list[i]],
                    ['quote', value],
                    ['quote', i],
                    ['quote', i + 1]
                ]
            );
        }

        return value;
    },
}, lion.wrap, lion.W_ARG_HAS_ENV);

//// exception ////

lion.addFunc(lion.std, {
    // try structure
    // proto: try(body, except, finally) -> result
    try: function (env, body, except, finally_do) {
        try {
            return body();
        } catch (e) {
            lion.coreFunc(env, ['setq', 'exception', ['quote', e]]);
            return except();
        } finally {
            if (finally_do) {
                finally_do();
            }
        }
    },
}, lion.wrap, lion.W_DELAY | lion.W_ARG_HAS_ENV);

lion.addFunc(lion.std, {
    // throw statement
    // proto: throw(err) -> never return
    throw: function (err) {
        throw err;
    },

    // error constructor
    // proto: error(message, type) -> error object
    error: function (message, type) {
        if (Object.hasOwnProperty.call(lion.errorMap, type)) {
            return lion.errorMap[type](message);
        } else {
            return Error(message);
        }
    },
}, lion.wrap);

//// operators ////

lion.addFunc(lion.std, {
    // unary operators
    // proto: op(a) -> op a (a op)
    positive: function (a) {return +a;},
    negative: function (a) {return -a;},
    // '++': function (a) {return ++a;},
    // '--': function (a) {return --a;},
    // '+++': function (a) {return a++;},
    // '---': function (a) {return a--;},
    '~': function (a) {return ~a;},
    typeof: function (a) {return typeof a;},

    // binary operators
    // proto: op(a, b) -> a op b
    '+': function (a, b) {return a + b;},
    '-': function (a, b) {return a - b;},
    '*': function (a, b) {return a * b;},
    '/': function (a, b) {return a / b;},
    '%': function (a, b) {return a % b;},
    '<': function (a, b) {return a < b;},
    '>': function (a, b) {return a > b;},
    '<=': function (a, b) {return a <= b;},
    '>=': function (a, b) {return a >= b;},
    '==': function (a, b) {return a == b;},
    '!=': function (a, b) {return a != b;},
    '===': function (a, b) {return a === b;},
    '!==': function (a, b) {return a !== b;},
    '<<': function (a, b) {return a << b;},
    '>>': function (a, b) {return a >> b;},
    '>>>': function (a, b) {return a >>> b;},
    '&': function (a, b) {return a & b;},
    '^': function (a, b) {return a ^ b;},
    '|': function (a, b) {return a | b;},
    in: function (a, b) {return a in b;},

    is: function (a, b) {
        if (a instanceof Object) {
            if (Object.hasOwnProperty.call(lion.typeMap, b)) {
                return a instanceof lion.typeMap[b];
            } else {
                return false;
            }
        } else {
            return typeof a == b;
        }
    },

    has: function (a, b) {
        return Object.hasOwnProperty.call(a, b);
    },

    instanceof: function (a, b) {
        if (Object.hasOwnProperty.call(lion.typeMap, b)) {
            return a instanceof lion.typeMap[b];
        } else {
            return false;
        }
    },
}, lion.wrap);

lion.addFunc(lion.std, {
    // unary operators
    // proto: op(a) -> op a (a op)
    '!': function (a) {return !a();},
    void: function (a) {return void a();},

    // binary operators
    // proto: op(a, b) -> a op b
    '&&': function (a, b) {return a() && b();},
    '||': function (a, b) {return a() || b();},
    '&&&': function (a, b) {return Boolean(a()) && Boolean(b());},
    '|||': function (a, b) {return Boolean(a()) || Boolean(b());},
    ',': function (a, b) {return a() , b();},
    // '=': function (a, b) {return a() = b();}, // +=, -=, ...
    // new
    // delete
    // '[]'

    // inline if
    // proto: ?:(a, b, c) -> a ? b : c
    '?:': function (a, b, c) {return a() ? b() : c();},
}, lion.wrap, lion.W_DELAY);

//// object & raw ////

lion.addFunc(lion.std, {
    // convert to an object
    // proto: object(value) -> new Object(value)
    object: function (value) {
        return new Object(value);
    },

    // convert to a string object
    // proto: strObj(value) -> new String(value)
    strObj: function (value) {
        return new String(value);
    },

    // convert to a boolean object
    // proto: boolObj(value) -> new Boolean(value)
    boolObj: function (value) {
        return new Boolean(value);
    },

    // convert to a number object
    // proto: numObj(value) -> new Number(value)
    numObj: function (value) {
        return new Number(value);
    },

    // convert to a raw value
    // proto: raw(object) -> value
    raw: function (object) {
        if (
            object instanceof String
            || object instanceof Boolean
            || object instanceof Number
        ) {
            return object.valueOf();
        } else {
            return object;
        }
    },

    // convert to a raw string
    // proto: string(object) -> string
    string: function (object) {
        return String(object);
    },

    // convert to a raw boolean
    // proto: boolean(object) -> boolean
    boolean: function (object) {
        return Boolean(object);
    },

    // convert to a raw number
    // proto: number(object) -> number
    number: function (object) {
        return Number(object);
    },
}, lion.wrap);

//// list & dict & string ////

lion.addFunc(lion.std, {
    // call and return arguments as a list
    // proto: list(...) -> [...]
    list: function (arr) {
        return arr;
    },

    // call and return the first argument
    // proto: head(first, ...) -> first
    head: function (arr) {
        return arr[0];
    },

    // call and return the last argument
    // proto: do(..., last) -> last
    do: function (arr) {
        return arr[arr.length - 1];
    },

    // make a dict (object)
    // proto: dict(key, value, ...) -> {key: value, ...}
    dict: function (arr) {
        var newenv = {
            LIONJS: true,
        };

        for (var i = 0; i < arr.length; i += 2) {
            lion.coreFunc(newenv, ['setq', arr[i], arr[i + 1]]);
        }

        return newenv;
    },

    // make a dict (object) by counting
    // proto: count(value, ...) -> {value: count, ...}
    count: function (arr) {
        var newenv = {
            LIONJS: true,
        };

        for (var i = 0; i < arr.length; i += 1) {
            var count;

            if (Object.hasOwnProperty.call(newenv, arr[i])) { // TODO: lion.core.hasq?
                count = lion.coreFunc(newenv, ['getq', arr[i]]);
                count += 1;
            } else {
                count = 1;
            }

            lion.coreFunc(newenv, ['setq', arr[i], count]);
        }

        return newenv;
    },
}, lion.wrap, lion.W_ARG_AS_ARR);

lion.addFunc(lion.std, {
    // make a dict (object) and set dict.parent = envq()
    // proto: mkenv(key, value, ...) -> {key: value, ...}
    mkenv: function (env, arr) {
        var newenv = {
            LIONJS: true,
            parent: lion.coreFunc(env, ['envq']),
        };

        for (var i = 0; i < arr.length; i += 2) {
            lion.coreFunc(newenv, ['setq', arr[i], arr[i + 1]]);
        }

        return newenv;
    },
}, lion.wrap, lion.W_ARG_HAS_ENV | lion.W_ARG_AS_ARR);

lion.addFunc(lion.std, {
    // get the length of array
    // proto: length(arr) -> arr.length
    length: function (arr) {
        if (arr instanceof Array || typeof arr === 'string') {
            return arr.length;
        } else {
            throw Error('[LION] object does not have index');
        }
    },

    // get member from array
    // proto: index(arr, i) -> arr[i]
    index: function (arr, i) {
        // notice: the index should be an integer
        if (arr instanceof Array || typeof arr === 'string') {
            return arr[Math.floor(i)];
        } else {
            throw Error('[LION] object does not have index');
        }
    },

    // get member from array (loop if out of range)
    // proto: xindex(arr, i) -> arr[i]
    xindex: function (arr, i) {
        // notice: the index should be an integer
        if (arr instanceof Array || typeof arr === 'string') {
            return arr[Math.floor(i - Math.floor(i / arr.length) * arr.length)];
        } else {
            throw Error('[LION] object does not have index');
        }
    },

    // set member in array
    // proto: indexSet(arr, i, value) -> arr
    indexSet: function (arr, i, value) {
        if (arr instanceof Array) {
            arr[Math.floor(i)] = value;
            return arr;
        } else if (typeof arr === 'string') {
            throw Error('[LION] string is atomic');
        } else {
            throw Error('[LION] object does not have index');
        }
    },

    // convert an object to a string
    // proto: objStr(object, locale) -> string
    objStr: function (object, locale) {
        if (locale) {
            return Object.prototype.toLocaleString.call(object);
        } else {
            return Object.prototype.toString.call(object);
        }
    },
}, lion.wrap);

//// date ////

lion.addFunc(lion.std, {
    // generate a date object
    // proto: date(...) -> new Date(...)
    date: function (arr) {
        arr.unshift(undefined);
        var factory = Date.bind.apply(Date, arr);
        return new factory();
    },
}, lion.wrap, lion.W_ARG_AS_ARR);

//// regexp ////

lion.addFunc(lion.std, {
    // generate a regular expression object
    // proto: regexp(pattern, flags) -> regexp object
    regexp: function (pattern, flags) {
        return RegExp(pattern, flags);
    },

    // get the source of a regular expression
    // proto: reStr(re) -> str
    reStr: function (re) {
        if (!re instanceof RegExp) {
            throw Error('[LION] bad type of regexp');
        }

        return re.source;
    },

    // get the attributes of a regular expression
    // proto: reAttr(re) -> ['g', 'i', 'm']
    reAttr: function (re) {
        if (!re instanceof RegExp) {
            throw Error('[LION] bad type of regexp');
        }

        var result = [];

        if (re.global) {
            result.append('g');
        }
        if (re.ignoreCase) {
            result.append('i');
        }
        if (re.multiline) {
            result.append('m');
        }

        return result;
    },

    // get the match position of a regular expression
    // proto: reIndex(re) -> RegExp.lastIndex
    reIndex: function (re) {
        if (!re instanceof RegExp) {
            throw Error('[LION] bad type of regexp');
        }

        return re.lastIndex;
    },

    // set the match position of a regular expression
    // proto: reSeek(re, index) -> RegExp.lastIndex
    reSeek: function (re, index) {
        if (!re instanceof RegExp) {
            throw Error('[LION] bad type of regexp');
        }

        return re.lastIndex = index;
    },
}, lion.wrap);

//// js built-ins ////

lion.addFunc(lion.std, {
    NaN: ['quote', NaN],
    Infinity: ['quote', Infinity],
    undefined: ['quote', undefined],

    E: ['quote', Math.E],
    LN10: ['quote', Math.LN10],
    LN2: ['quote', Math.LN2],
    LOG2E: ['quote', Math.LOG2E],
    LOG10E: ['quote', Math.LOG10E],
    PI: ['quote', Math.PI],
    SQRT1_2: ['quote', Math.SQRT1_2],
    SQRT2: ['quote', Math.SQRT2],

    NUMMAX: ['quote', Number.MAX_VALUE],
    NUMMIN: ['quote', Number.MIN_VALUE],
});

lion.addFunc(lion.std, {
    isNaN: isNaN,
    isFinite: isFinite,
    isArray: Array.isArray,

    int: parseInt,
    float: parseFloat,
    chr: String.fromCharCode,

    decodeURI: decodeURI,
    decodeURIComponent: decodeURIComponent,
    encodeURI: encodeURI,
    encodeURIComponent: encodeURIComponent,

    // getPrototypeOf: Object.getPrototypeOf,
    getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
    getOwnPropertyNames: Object.getOwnPropertyNames,
    // create: Object.create,
    // defineProperty: Object.defineProperty,
    // defineProperties: Object.defineProperties,
    // seal: Object.seal,
    // freeze: Object.freeze,
    // preventExtensions: Object.preventExtensions,
    isSealed: Object.isSealed,
    isFrozen: Object.isFrozen,
    isExtensible: Object.isExtensible,
    keys: Object.keys,

    // toString: Object.prototype.toString,
    // toLocaleString: Object.prototype.toLocaleString,
    // valueOf: Object.prototype.valueOf, // TODO
    // hasOwnProperty: Object.prototype.hasOwnProperty,
    // isPrototypeOf: Object.prototype.isPrototypeOf, // TODO
    // propertyIsEnumerable: Object.prototype.propertyIsEnumerable, // TODO

    utc: Date.UTC,
    now: Date.now,
    dateParse: Date.parse,

    // object: Object, // new String, new Boolean, new Number
    // function: Function,
    // array: Array,
    // string: String,
    // boolean: Boolean,
    // number: Number,
    // date: Date,
    // regexp: RegExp,
}, lion.wrap);

lion.addFunc(lion.std, {
    Math: Math,
}, lion.wrapObj);

lion.addFunc(lion.std, {
    // Object: Object,
    // Function: Function,
    Array: Array,
    String: String,
    Boolean: Boolean,
    Number: Number,
    Date: Date,
    RegExp: RegExp,
    Error: Error,
}, lion.wrapClass);

//// aliases ////

lion.addFunc(lion.std, {
    ':': 'get',
    ':=': 'set',
    '=': 'var',
    '': 'quote',
    // '#': 'list',
    '~~': 'negative',
    '\\': 'lambda',
    repr: 'stringify',
    unescape: 'decodeURIComponent',
    escape: 'encodeURIComponent',
});
