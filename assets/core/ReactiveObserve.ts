/**
 * ReactiveObserve.ts
 * reference = https://github.com/sl1673495/typescript-proxy-reactive
 * author : vangagh@live.cn
 * create : 2023-02-08
 * update : vangagh@live.cn 2025-01-03
 */

//#region index 基础类型定义
/** 原始对象 */
type Raw = object;
/** 响应式对象 */
type ReactiveProxy = object;
/** 收集响应依赖的的函数 */
type ReactionFunction = Function & {
    cleaners?: ReactionForKey[]
    unobserved?: boolean
};
/** reactionForRaw的key为对象key值 value为这个key值收集到的Reaction集合 */
type ReactionForRaw = Map<PropertyKey, ReactionForKey>;
/** key值收集到的Reaction集合 */
type ReactionForKey = Set<ReactionFunction>;
/** 操作符 用来做依赖收集和触发依赖更新 */
export interface Operation {
    /**
     * 操作类型
     */
    type: "get" | "iterate" | "add" | "set" | "delete" | "clear" | "has" | "array";
    /**
     * 操作的对象
     */
    target: object;
    /**
     * 操作的key
     */
    key?: PropertyKey;
    /**
     * 操作的值（代理后的值）
     */
    receiver?: any;
    /**
     * 新的值
     */
    value?: any;
    /**
     * 旧的值
     */
    oldValue?: any;

    /**
     * 数组操作的插入值
     */
    inserted?: any[];
    /**
     * 数组操作的插入值的起始位置
     */
    insertedStart?: number;
    /**
     * 数组操作的删除值
     */
    deleted?: any[];
    /**
     * 数组操作的删除值的起始位置
     */
    deletedStart?: number;
};
//#endregion

//#region handlers 响应式对象的处理器
function isObject(val: any): val is object {
    return typeof val === "object" && val !== null;
}

// 全局对象
const globalObj =
    typeof window === "object" ? window : Function("return this")()

/** 对于内置的一些对象不去处理 */
export function shouldInstrument({ constructor }: Raw) {
    const isBuiltIn =
        typeof constructor === "function" &&
        constructor.name in globalObj &&
        globalObj[constructor.name] === constructor;
    // @ts-ignore
    return !isBuiltIn || handlers.has(constructor)
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

const rawToProxy = new WeakMap();
const proxyToRaw = new WeakMap();

const wellKnownSymbols = new Set(
    Object.getOwnPropertyNames(Symbol)
        .map(key => Symbol[key])
        .filter(value => typeof value === "symbol"),
)

const baseHandlers = {
    // 劫持 get 方法，实现依赖收集
    get(target: Raw, key: PropertyKey, receiver: ReactiveProxy) {
        const result = Reflect.get(target, key, receiver);
        // 内置的Symbol不观察
        if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
            return result
        }
        // 收集依赖
        registerRunningReaction({ target, key, receiver, type: "get" });
        // 如果访问的是对象 则返回这个对象的响应式proxy
        // 如果没有就重新调用reactive新建一个proxy
        const reactiveResult = rawToProxy.get(result);
        if (isObject(result)) {
            return reactiveResult || reactive(result);
        }
        return result;
    },
    // 劫持一些遍历访问，比如 Object.keys()、for...in、for...of 等
    ownKeys(target: object) {
        // 收集依赖
        registerRunningReaction({ target, type: "iterate" });
        return Reflect.ownKeys(target);
    },
    // 劫持 set 方法，实现触发更新
    set(target: object, key: string, value: any, receiver: object) {
        // 确保原始值里不要被响应式对象污染
        if (isObject(value)) {
            value = proxyToRaw.get(value) || value;
        }
        const hadKey = hasOwnProperty.call(target, key);
        const oldValue = target[key];
        const result = Reflect.set(target, key, value, receiver);
        if (!hadKey) {
            // 新增key值时以type: add触发观察函数
            queueReactionsForOperation({ target, key, value, receiver, type: "add" });
        } else if (oldValue !== value) {
            // 已存在的key的值发生变化时以type: set触发观察函数
            queueReactionsForOperation({
                target,
                key,
                value,
                oldValue,
                receiver,
                type: "set"
            });
        }
        return result;
    },
    // 劫持 delete 方法，实现触发删除
    deleteProperty(target: object, key: PropertyKey) {
        const hadKey = hasOwnProperty.call(target, key);
        const oldValue = target[key];
        const result = Reflect.deleteProperty(target, key);
        if (hadKey) {
            // 删除key值时以type: delete触发观察函数
            queueReactionsForOperation({ target, key, oldValue, type: "delete" });
        }
        return result;
    },
};

function doArrayKeys(target: any, receiver: object, key: string, args: any[], result?: any | any[]) {
    let inserted: any[] = undefined;
    let insertedStart: number = -1;
    let deleted: any[] = undefined;
    let deletedStart: number = -1;

    switch (key) {
        case 'push':
            inserted = args;
            insertedStart = target.length - args.length;
            break;
        case 'pop':
            deleted = [result];
            deletedStart = target.length;
            break;
        case 'shift':
            deleted = [result];
            deletedStart = 0;
            break;
        case 'unshift':
            inserted = args;
            insertedStart = 0;
            break;
        case 'splice':
            const startIdx = Number(args[0]);
            const deleteCount = Number(args[1]);
            const items = args.slice(2);
            inserted = items;
            insertedStart = startIdx >= 0 ? startIdx : target.length;
            deleted = result;
            deletedStart = deleteCount > 0 ? startIdx : -1;
            break;
    }

    queueReactionsForOperation({ target, receiver, key, inserted, insertedStart, deleted, deletedStart, type: "array" });
}

const arrayHandlers = {
    // 劫持 get 方法，实现依赖收集
    get(target: Raw, key: PropertyKey, receiver: ReactiveProxy) {
        const result = Reflect.get(target, key, receiver);
        // 内置的Symbol不观察
        if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
            return result
        }
        // 收集依赖
        registerRunningReaction({ target, key, receiver, type: "get" });
        if (typeof result === 'function') {
            return function (...args: any[]) {
                // 处理需要使用原始数据的方法
                switch (key) {
                    case 'indexOf':
                        args[0] = proxyToRaw.get(args[0]) || args[0];
                        return Reflect.apply(result, target, args);
                    case 'lastIndexOf':
                        args[0] = proxyToRaw.get(args[0]) || args[0];
                        return Reflect.apply(result, target, args);
                }

                const function_result = Reflect.apply(result, target, args);
                doArrayKeys(target, receiver, String(key), args, function_result);
                return function_result;
            };
        }
        return result;
    }
};

/** 对于返回值 如果是复杂类型 再进一步的定义为响应式 */
function findReactive(obj: Raw) {
    const reactiveObj = rawToProxy.get(obj);
    // 只有正在运行观察函数的时候才去定义响应式
    if (hasRunningReaction() && isObject(obj)) {
        if (reactiveObj) {
            return reactiveObj;
        }
        return reactive(obj);
    }
    return reactiveObj || obj;
}

/** 把iterator劫持成响应式的iterator */
function patchIterator(iterator: any, isEntries: boolean) {
    const originalNext = iterator.next;
    iterator.next = () => {
        let { done, value } = originalNext.call(iterator);
        if (!done) {
            if (isEntries) {
                value[1] = findReactive(value[1]);
            } else {
                value = findReactive(value);
            }
        }
        return { done, value };
    }
    return iterator;
}

const instrumentations = {
    has(key: PropertyKey) {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, key, type: "has" });
        return proto.has.apply(target, arguments);
    },
    get(key: PropertyKey) {
        // 获取原始数据
        const target = proxyToRaw.get(this);
        // 获取原始数据的__proto__ 拿到原型链上的方法
        const proto: any = Reflect.getPrototypeOf(this);
        // 注册get类型的依赖
        registerRunningReaction({ target, key, type: "get" });
        // 调用原型链上的get方法求值 然后对于复杂类型继续定义成响应式
        return findReactive(proto.get.apply(target, arguments));
    },
    forEach(cb: Function, ...args: any[]) {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        /**
         * wrappedCb包裹了用户自己传给forEach的cb函数，然后传给了集合对象原型链上的forEach，这又是一个函数劫持。用户传入的是map.forEach(cb)，而我们最终调用的是map.forEach(wrappedCb)。  
         * 在这个wrappedCb中，我们把cb中本应该获得的原始值value通过`findObservable`定义成响应式数据交给用户，这样用户在forEach中进行的响应式操作一样可以收集到依赖了。 
         */
        const wrappedCb = (value: any, ...rest: any[]) => cb(findReactive(value), ...rest);
        return proto.forEach.call(target, wrappedCb, ...args);
    },
    set(key: PropertyKey, value: any) {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        // 是否是新增的key
        const hadKey = proto.has.call(target, key);
        // 拿到旧值
        const oldValue = proto.get.call(target, key);
        // 求出结果
        const result = proto.set.apply(target, arguments);
        if (!hadKey) {
            // 新增key值时以type: add触发观察函数
            queueReactionsForOperation({ target, key, type: "add" });
        } else if (value !== oldValue) {
            // 已存在的key的值发生变化时以type: set触发观察函数
            queueReactionsForOperation({ target, key, type: "set" });
        }
        return result;
    },
    add(key: PropertyKey) {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        const hadKey = proto.has.call(target, key);
        const result = proto.add.apply(target, arguments);
        if (!hadKey) {
            queueReactionsForOperation({ target, key, type: 'add' });
        }
        return result;
    },
    delete(key: PropertyKey) {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        const hadKey = proto.has.call(target, key);
        const result = proto.delete.apply(target, arguments);
        if (hadKey) {
            queueReactionsForOperation({ target, key, type: 'delete' });
        }
        return result;
    },
    clear() {
        const target: any = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        const hadItems = target.size !== 0;
        const result = proto.clear.apply(target, arguments);
        if (hadItems) {
            queueReactionsForOperation({ target, type: 'clear' });
        }
        return result;
    },
    keys() {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        return proto.keys.apply(target, arguments);
    },
    values() {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        const iterator = proto.values.apply(target, arguments);
        return patchIterator(iterator, false);
    },
    entries() {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        const iterator = proto.entries.apply(target, arguments);
        return patchIterator(iterator, true);
    },
    [Symbol.iterator]() {
        const target = proxyToRaw.get(this);
        const proto: any = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        const iterator = proto[Symbol.iterator].apply(target, arguments);
        return patchIterator(iterator, target instanceof Map);
    },
    get size() {
        const target = proxyToRaw.get(this);
        const proto = Reflect.getPrototypeOf(this);
        registerRunningReaction({ target, type: 'iterate' });
        return Reflect.get(proto, 'size', target);
    }
}

// 真正交给Proxy第二个参数的handlers只有一个get
// 把用户对于map的get、set这些api的访问全部移交给上面的劫持函数
const collectionHandlers = {
    get(target: Raw, key: PropertyKey, receiver: ReactiveProxy) {
        // 返回上面被劫持的api
        target = hasOwnProperty.call(instrumentations, key)
            ? instrumentations
            : target;
        return Reflect.get(target, key, receiver);
    }
}

/** 根据对象的类型 获取Proxy的handlers */
// @ts-ignore
const handlers = new Map([
    [Object, baseHandlers],
    [Array, arrayHandlers],
    [Int8Array, arrayHandlers],
    [Uint8Array, arrayHandlers],
    [Uint8ClampedArray, arrayHandlers],
    [Int16Array, arrayHandlers],
    [Uint16Array, arrayHandlers],
    [Int32Array, arrayHandlers],
    [Uint32Array, arrayHandlers],
    [Float32Array, arrayHandlers],
    [Float64Array, arrayHandlers],
    [Map, collectionHandlers],
    [Set, collectionHandlers],
    [WeakMap, collectionHandlers],
    [WeakSet, collectionHandlers],
])

/** 获取Proxy的handlers */
function getHandlers(obj: Raw) {
    // @ts-ignore
    return handlers.get(obj.constructor) || baseHandlers;
}
//#endregion

//#region store 观察函数与对象的映射关系
const connectionStore = new WeakMap<Raw, ReactionForRaw>();
const ITERATION_KEY = Symbol("iteration key");
function storeObservable(value: Raw) {
    // 存储对象和内部的 Key -> reaction 的映射关系
    connectionStore.set(value, new Map() as ReactionForRaw);
}

/**
 * 把对响应式对象key的访问与观察函数建立关联
 * 后续就可以在修改这个key的时候 找到响应的观察函数触发
 */
function registerReactionForOperation(reaction: ReactionFunction, { target, key, type }: Operation,) {
    if (type === "iterate") {
        key = ITERATION_KEY;
    }
    // 拿到原始对象 -> 观察者的map
    const reactionsForRaw = connectionStore.get(target);
    // 拿到key -> 观察者的set
    let reactionsForKey = reactionsForRaw.get(key);

    if (!reactionsForKey) {
        // 如果这个key之前没有收集过观察函数 就新建一个
        reactionsForKey = new Set();
        // set到整个value的存储里去
        reactionsForRaw.set(key, reactionsForKey);
    }

    if (!reactionsForKey.has(reaction)) {
        // 把这个key对应的观察函数收集起来
        reactionsForKey.add(reaction);
        // 把key收集的观察函数集合 加到cleaners队列中 便于后续取消观察
        reaction.cleaners.push(reactionsForKey);
    }
}

/**
 *  根据key,type和原始对象 拿到需要触发的所有观察函数
 */
function getReactionsForOperation({ target, key, type }: Operation) {
    // 拿到原始对象 -> 观察者的map
    const reactionsForTarget = connectionStore.get(target);
    const reactionsForKey: ReactionForKey = new Set();

    // 把所有需要触发的观察函数都收集到新的set里
    addReactionsForKey(reactionsForKey, reactionsForTarget, key);

    // add和delete的操作 需要触发某些由循环触发的观察函数收集
    // observer(() => rectiveProxy.forEach(() => proxy.foo))
    if (type === "add" || type === "delete" || type === "clear" || type === "array") {
        // ITERATION_KEY:
        // 如果proxy拦截到的ownKeys的操作 就会用ITERATION_KEY作为观察函数收集的key
        // 比如在观察函数里通过Object.keys()访问了proxy对象 就会以这个key进行观察函数收集
        // 那么比如在delete操作的时候 是要触发这个观察函数的 因为很明显Object.keys()的值更新了

        // length:
        // 遍历一个数组的相关操作都会触发对length这个属性的访问
        // 所以如果是数组 只要把访问length时收集到的观察函数重新触发一下就可以了
        // 如observe(() => proxyArray.forEach(() => {}))
        const iterationKey = Array.isArray(target) ? "length" : ITERATION_KEY;
        addReactionsForKey(reactionsForKey, reactionsForTarget, iterationKey);
    }

    return reactionsForKey;
}

function addReactionsForKey(reactionsForKey: ReactionForKey, reactionsForTarget: ReactionForRaw, key: PropertyKey) {
    const reactions = reactionsForTarget.get(key);
    reactions &&
        reactions.forEach(reaction => {
            reactionsForKey.add(reaction)
        });
}

/**
 * 把上次收集到的观察函数清空 重新收集观察函数
 * 这点对于函数内有分支的情况很重要
 * 保证每次收集的都是确实能访问到的观察函数
 */
function releaseReaction(reaction: ReactionFunction) {
    if (reaction.cleaners) {
        // 把key -> reaction的set里相应的观察函数清楚掉
        reaction.cleaners.forEach((reactionsForKey: ReactionForKey) => {
            reactionsForKey.delete(reaction);
        })
    }
    // 重置队列
    reaction.cleaners = [];
}
//#endregion

//#region reaction 依赖收集与触发
/** 依赖收集栈 */
const reactionStack: ReactionFunction[] = [];

/** 依赖收集 在get操作的时候要调用 */
function registerRunningReaction(operation: Operation) {
    const runningReaction = getRunningReaction();
    if (runningReaction) {
        // 把这个函数和当前的操作关联起来
        registerReactionForOperation(runningReaction, operation);
    }
}

/** 触发依赖 在set delete add操作的时候要调用 */
function queueReactionsForOperation(operation: Operation) {
    getReactionsForOperation(operation).forEach(reaction => reaction(operation));
}

/** 把函数包裹为观察函数 */
function runReactionWrap(reaction: ReactionFunction, fn: Function, thisArgument: any, args: any[]) {
    // 已经取消观察了 就直接执行原函数
    if (reaction.unobserved) {
        return Reflect.apply(fn, thisArgument, args);
    }

    // 如果观察函数是已经在运行 直接返回
    if (isRunning(reaction)) {
        return;
    }

    // 把上次收集到的依赖清空 重新收集依赖
    // 这点对于函数内有分支的情况很重要
    // 保证每次收集的都是确实能访问到的依赖
    releaseReaction(reaction)
    try {
        // 把当前的观察函数推入栈内 开始观察响应式proxy
        reactionStack.push(reaction);
        // 运行用户传入的函数 这个函数里访问proxy就会收集reaction函数作为依赖了
        return Reflect.apply(fn, thisArgument, args);
    } finally {
        // 运行完了永远要出栈
        reactionStack.pop();
    }
}

/** 传入的观察函数是否正在运行 */
function isRunning(reaction: ReactionFunction) {
    // return reactionStack.includes(reaction)
    return reactionStack.indexOf(reaction) !== -1;
}

/** 当前是否有正在运行的观察函数 */
function hasRunningReaction() {
    return reactionStack.length > 0;
}

/** 从栈的末尾取到正在运行的observe包裹的函数 */
function getRunningReaction() {
    const [runningReaction] = reactionStack.slice(-1);
    return runningReaction;
}
//#endregion

//#region reactive 响应式对象的创建

/**
 * 获取响应式对象，如果不存在就创建一个
 * @param raw 原始对象
 * @returns 响应式对象
 */
export function reactive<T extends object>(raw: T): T {
    // 已经被定义成响应式proxy了 或者传入的是内置对象 就直接原封不动的返回
    if (proxyToRaw.has(raw) || !shouldInstrument(raw)) {
        return raw;
    }

    // 如果已经是原始对象，直接返回
    const exitProxy = rawToProxy.get(raw);
    if (exitProxy) {
        return exitProxy as T;
    }

    // 新建响应式对象
    return createReactive(raw);
}

function createReactive<T extends object>(raw: T): T {
    const reactive = new Proxy(raw, getHandlers(raw));

    // 双向存储原始对象和响应式对象的映射关系
    rawToProxy.set(raw, reactive);
    proxyToRaw.set(reactive, raw);

    // 存储对象和内部的 Key -> reaction 的映射关系
    storeObservable(raw);

    return reactive as T;
}

/**
 * 获取响应式对象的原始对象
 * @param proxy 响应式对象
 * @returns 原始对象
 */
export function raw<T extends object>(proxy: T): T {
    return proxyToRaw.get(proxy) as T;
}
//#endregion

//#region observe 观察函数绑定与解绑
/** 
 * 观察函数
 * 在传入的函数里去访问响应式的 proxy 会收集传入的函数作为依赖
 * 下次访问的key发生变化的时候 就会重新运行这个函数
 * @param fn 观察函数
 * @param thisArgument this指向
 * @returns 观察函数，让外部也可以手动调用
 * @example
 * const state = reactive({ a: 0, b: 0 });
 * const reaction = observe(operation => {
 *    let a = state.a;          // 这里会收集 a 变化的通知
 *    if(!operation) return;    // 这里来管理依赖的收集（之后都会被忽略）
 *    
 *    let b = state.b;          // 这里不收集 b 变化的通知
 * });
 */
export function observe(fn: (operation?: Operation) => void, thisArgument?: any): ReactionFunction {
    // reaction是包装了原始函数之后的观察函数
    // 在runReactionWrap的上下文中执行原始函数 可以收集到依赖。
    const reaction: ReactionFunction = (...args: any[]) => {
        return runReactionWrap(reaction, fn, thisArgument || this, args);
    }

    // 先执行一遍reaction
    reaction();

    // 返回出去，让外部也可以手动调用
    return reaction;
}

/** 
 * 停止观察函数
 * @param reaction 观察函数
 */
export function unobserve(reaction: ReactionFunction) {
    if (!reaction.unobserved) {
        reaction.unobserved = true;
        releaseReaction(reaction);
    }
}
//#endregion
