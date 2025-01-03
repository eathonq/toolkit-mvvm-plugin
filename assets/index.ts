/**
 * mvvm_export.ts
 * author : vangagh@live.cn
 * create : 2025-01-03
 * update : vangagh@live.cn 2025-01-03
 */

export { vm, model, prop, propEnum, func } from './core/Decorator';

export { ViewModelData } from './components/ViewModel';
export type { IViewModel } from './components/ViewModel';
export { BindingData } from './components/Binding';
export { DataContextData } from './components/DataContext';
export { ItemsSourceData } from './components/ItemsSource';

export { ExpandType } from './core/DecoratorData';

export { reactive, raw, observe, unobserve } from './core/ReactiveObserve';

//#region 属性设置监听
import { observe } from './core/ReactiveObserve';
/**
 * 属性设置监听
 * @param property 
 * @param target 
 * @param callback 
 */
export function onSet(property: string, target: any, callback: (value: any) => void) {
    return observe((operation) => {
        var value = target[property];
        if (!operation) return;
        callback(value);
    });
}
//#endregion

//#region SetEditor
import { decoratorData } from "./core/DecoratorData";
/**
 * 编辑器模式下设置显示数据
 * @param data 
 */
export function SetEditor(data: any) {
    decoratorData.setDefaultInEditor(data);
}
//#endregion
