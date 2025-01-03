/**
 * Decorator.ts
 * author : vangagh@live.cn
 * create : 2023-03-02
 * update : vangagh@live.cn 2025-01-03
 */

import { decoratorData } from "./DecoratorData";

//#region vm
/**
 * ViewModel 装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @param name ViewModel 名称
 * @param global 是否全局单例, 默认 false
 * @example
 * ```ts
 * // ViewModel 装饰器
 * .@vm('MyViewModel')
 * class MyViewModel {}
 * 
 * // 全局 ViewModel
 * .@vm('MyViewModel', true)
 * class MyViewModel {}
 * 
 * // 可以继承 IViewModel 接口，便捷重写 onLoad 和 onDestroy 方法（也可以直接重写）
 * .@vm('MyViewModel')
 * class MyViewModel implements IViewModel {
 *     onLoaded() {}  // 可重写 onLoad 方法
 *     onDestroy() {} // 可重写 onDestroy 方法
 * }
 * ```
 */
export function vm(name: string, global?: boolean): ClassDecorator {
    return (target: Function) => {
        decoratorData.addViewModel(target, name, global);
    };
}
//#endregion

//#region model
/**
 * Model 装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @param name Model 名称
 * @example
 * ```ts
 * // Model 装饰器
 * .@model('MyModel')
 * class MyModel {}
 * ```
 */
export function model(name: string): ClassDecorator {
    return (target: Function) => {
        decoratorData.addModel(target, name, false);
    };
}
//#endregion

//#region prop

/**
 * 属性装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @param type 类型可以是 String, Number, Boolean, [String] ...
 * @example
 * ```ts
 * // 无参装饰器，需要设置默认值
 * //（仅支持 string, number, boolean, string[], number[], boolean[]）
 * .@prop
 * myProperty: string = ""; // **这里需要设置默认值**
 * 
 * // 有参装饰器，不需要设置默认值
 * .@prop(String)
 * myProperty: string;
 * ```
 */
export function prop(type: any): PropertyDecorator;
/**
 * 属性装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @param target 
 * @param propertyKey 
 * @example
 * ```ts
 * // 无参装饰器，需要设置默认值
 * //（仅支持 string, number, boolean, string[], number[], boolean[]）
 * .@prop
 * myProperty: string = ""; // **这里需要设置默认值**
 * 
 * // 有参装饰器，不需要设置默认值
 * .@prop(String)
 * myProperty: string;
 * 
 * // 对枚举属性使用 prop 装饰器
 * .@prop(String)   // 或 .@propEnum(StringEnum)
 * myProperty: StringEnum;  // 字符串枚类型字段
 * .@prop(Number)   // 或 .@propEnum(NumberEnum)
 * myProperty: NumberEnum;  // 数值枚举类型字段
 * ```
 */
export function prop(target: any, propertyKey: string | symbol): void;
export function prop(...args: any[]) {
    if (args.length == 1) {
        const arg_type = args[0];
        return (target: any, propertyKey: string | symbol) => {
            const propertyName = typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey;
            decoratorData.addProperty(target.constructor, propertyName, arg_type);
        };
    }
    else {
        const target = args[0];
        const key = args[1];
        decoratorData.addUnknownProperty(target.constructor, key);
    }
}
//#endregion

//#region propEnum
/**
 * 枚举属性装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @param enumType 枚举类型
 * @example
 * ```ts
 * enum StringEnum {
 *    A = 'A',
 *    B = 'B',
 *    C = 'C',
 * }
 * // 枚举属性装饰器
 * .@propEnum(StringEnum)
 * myProperty: StringEnum;
 * 
 * // 也可以使用 prop 装饰器
 * .@prop(String)
 * myProperty: StringEnum;
 * 
 * enum NumberEnum {
 *    A = 1,
 *    B = 2,
 *    C = 3,
 * }
 * .@prop(Number)
 * myProperty: NumberEnum;
 * ```
 */
export function propEnum(type: any) {
    return (target: any, propertyKey: string | symbol) => {
        const propertyName = typeof propertyKey === 'symbol' ? propertyKey.toString() : propertyKey;
        decoratorData.addEnumProperty(target.constructor, propertyName, type);
    };
}
//#endregion

//#region func
/**
 * mvvm 方法装饰器
 * @help https://vangagh.gitbook.io/brief-2d-framework/mvvm/decorator
 * @example
 * ```ts
 * // 方法装饰器
 * .@func
 * myFunction() {}
 * ```
 */
export function func(target: any, key: string, descriptor: PropertyDescriptor): void {
    decoratorData.addFunction(target.constructor, key);
}
//#endregion