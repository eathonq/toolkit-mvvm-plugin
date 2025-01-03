/**
 * Binding.ts
 * author : vangagh@live.cn
 * create : 2023-03-02
 * update : vangagh@live.cn 2025-01-03
 */

import { _decorator, Node, Enum, Sprite, Button, CCClass, Label, ProgressBar } from 'cc';
import { EDITOR } from 'cc/env';
import { observe, unobserve } from '../core/ReactiveObserve';
import { CCLocator } from '../core/CCLocator';
import { CCElement } from '../core/CCElement';
import { DataContext } from "./DataContext";
import { ItemsSource } from './ItemsSource';
import { DataKind, decoratorData } from '../core/DecoratorData';

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/**
 * 给 ItemsSource 组件的模板节点添加一个默认的删除绑定事件
 */
const ITEMS_SOURCE_DELETE = 'ITEMS_SOURCE_DELETE';

/** 绑定模式 */
export enum BindingMode {
    /** 双向绑定(Model<=>View)，导致对绑定源或目标属性(UI)的更改自动更新另一个。 */
    TwoWay = 0,
    /** 单向绑定(Model->View)，当绑定源改变时更新绑定目标属性(UI)。 */
    OneWay = 1,
    /** 一次绑定(Model->View)，当绑定源改变时更新绑定目标属性(UI)，仅通知一次。 */
    OneTime = 2,
    /** 单向绑定(View->Model)，当绑定目标属性(UI)改变时更新绑定源。 */
    OneWayToSource = 3,
}

/** 
 * 数据绑定组件
 * 绑定上级数据中的基础类型数据（String、Number、Boolean、Function）到组件上
 */
@ccclass('mvvm.Binding')
@help('https://vangagh.gitbook.io/brief-2d-framework/mvvm/binding')
@executeInEditMode
@menu('Brief.Toolkit.Mvvm/Binding')
export class Binding extends CCElement {
    /**
     * 获取绑定数据
     * @param node 有挂载 Binding 的节点
     * @param isParent 是否获取上级数据, 默认为 false
     */
    static Data<T = any>(node: Node, isParent = false): T {
        let binding = node.getComponent(Binding);
        if (!binding) return null;

        const dataContext = binding._parent.getDataContextInRegister(binding);
        if (dataContext === null) return null;

        if (isParent)
            return dataContext as T;
        else
            return dataContext[binding._bindingName] as T;
    }

    /** 数据上下文路径 */
    @property(DataContext)
    private _parent: DataContext = null;
    @property({
        type: DataContext,
        displayName: 'DataContext',
        tooltip: '数据上下文',
        displayOrder: 0,
    })
    get parent() {
        return this._parent;
    }
    private set parent(value) {
        this._parent = value;
        this.updateEditorBindingEnums();
    }

    @property
    private _bindingMode = -1; // 挂载 @property 属性值保存到场景等资源文件中，用于 binding 数据恢复
    private _modeEnums: { name: string, value: number, mode: BindingMode }[] = [];
    private _mode = 0;
    /** 绑定模式 */
    @property({
        type: Enum({}),
        tooltip: '绑定模式:<br>TwoWay: 双向绑定(Model<->View);<br>OneWay: 单向绑定(Model->View);<br>OneTime: 一次单向绑定(Model->View);<br>OneWayToSource: 单向绑定(View->Model)。',
        displayOrder: 3,
    })
    get mode() {
        return this._mode;
    }
    private set mode(value) {
        this._mode = value;
        if (this._modeEnums[value]) {
            this._bindingMode = this._modeEnums[value].mode;
        }
    }

    @property
    private _bindingType = "";  // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
    get bindingType() {
        return this._bindingType;
    }

    @property
    private _bindingName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
    get bindingName() {
        return this._bindingName;
    }

    @property
    private _bindingDataKind = DataKind.String; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
    get bindingDataKind() {
        return this._bindingDataKind;
    }

    private _bindingEnums: { name: string, value: number, type: string, kind: DataKind }[] = [];
    private _binding = 0;
    /** 绑定属性 */
    @property({
        type: Enum({}),
        tooltip: '绑定数据属性（属性或方法）',
        displayOrder: 4,
    })
    get binding() {
        return this._binding;
    }
    private set binding(value) {
        this._binding = value;
        if (this._bindingEnums[value]) {
            this._bindingName = this._bindingEnums[value].name;
            this._bindingType = this._bindingEnums[value].type;
            this._bindingDataKind = this._bindingEnums[value].kind;
            this.selectedBinding();
        }
    }

    /** 上一级绑定数据 */
    private _upperData: any = null;

    /** 当前绑定数据 */
    protected _data: any = null;
    /** 当前绑定数据 */
    get dataContext() {
        return this._data;
    }

    //#region EDITOR
    onRestore() {
        this._parent = null;

        super.onRestore();
    }

    protected checkEditorComponent() {
        this.initParentDataContext();
        if (!this._parent) return; // 上下文数据异常，则不继续执行

        super.checkEditorComponent();
    }

    protected selectedProperty() {
        super.selectedProperty();

        // 这里设置会导致绑定数据丢失的问题
        // // 重置绑定模式
        // this._bindingMode = -1;
        // // 重置绑定数据
        // this._bindingName = '';

        // TODO
        if (!this._parent) return; // 上下文数据异常，则不继续执行
        this.updateEditorModeEnums();
        this.updateEditorBindingEnums();
    }

    /** 更新绑定模式枚举 */
    private updateEditorModeEnums() {
        const newEnums = [];
        let count = 0;
        switch (this._elementName) {
            case Label.name:
                newEnums.push(...[
                    { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
                    { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
                ]);
                break;
            case Button.name:
                newEnums.push(...[
                    { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
                ]);
                break;
            case ProgressBar.name:
                newEnums.push(...[
                    { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
                    { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
                ]);
                break;
            case Sprite.name:
                newEnums.push(...[
                    { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
                    { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
                ]);
                break;
            case Node.name:
                if (this._elementKinds.indexOf(DataKind.Function) != -1) {
                    newEnums.push(...[
                        { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
                    ]);
                    break;
                }
            default:
                newEnums.push(...[
                    { name: 'TwoWay', value: count++, mode: BindingMode.TwoWay },
                    { name: 'OneWay', value: count++, mode: BindingMode.OneWay },
                    { name: 'OneTime', value: count++, mode: BindingMode.OneTime },
                    { name: 'OneWayToSource', value: count++, mode: BindingMode.OneWayToSource },
                ]);
                break;
        }

        this._modeEnums = newEnums;
        // 更新绑定模式枚举
        CCClass.Attr.setClassAttr(this, 'mode', 'enumList', newEnums);

        // 设置绑定模式枚举默认值
        if (this._bindingMode != -1) {
            let findIndex = this._modeEnums.findIndex((item) => { return item.mode == this._bindingMode; });
            if (findIndex != -1) {
                this.mode = findIndex;
                return;
            }
        }
        this.mode = 0;
    }

    /** 更新绑定数据枚举 */
    private updateEditorBindingEnums() {
        // 获取绑定属性
        const newEnums = [];
        let isFunc = this._elementKinds.indexOf(DataKind.Function) != -1;
        if (isFunc) {
            let dataList = decoratorData.getFunctionList(this._parent.bindingType);
            if (dataList) {
                let count = 0;
                dataList.forEach((item) => {
                    newEnums.push({ name: item.name, value: count++, type: item.type, kind: item.kind });
                });
            }

            // 判断 this._parent 是否为 ItemsSource
            if (this._parent instanceof ItemsSource) {
                newEnums.push({ name: ITEMS_SOURCE_DELETE, value: newEnums.length, type: 'function', kind: DataKind.Function });
            }
        }
        else {
            let dataList = decoratorData.getPropertyList(this._parent.bindingType);
            if (dataList) {
                let count = 0;
                dataList.forEach((item) => {
                    if (this._elementKinds.indexOf(item.kind) != -1) {
                        newEnums.push({ name: item.name, value: count++, type: item.type, kind: item.kind });
                    }
                });
            }
        }

        // 更新绑定数据枚举
        this._bindingEnums = newEnums;
        CCClass.Attr.setClassAttr(this, 'binding', 'enumList', newEnums);

        // 如果绑定数据枚举为空，则警告
        if (this._bindingEnums.length === 0) {
            console.warn(`PATH ${CCLocator.getNodeFullPath(this.node)} 组件 Binding 绑定未找到合适的数据（String,Number,Boolean）`);
        }

        // 设置绑定数据枚举默认值
        if (this._bindingName !== '') {
            let findIndex = this._bindingEnums.findIndex((item) => { return item.name === this._bindingName; });
            if (findIndex != -1) {
                this.binding = findIndex;
                return;
            }
            else {
                //console.warn(`PATH ${CCLocator.getNodeFullPath(this.node)} 组件Binding绑定 ${this._bindingName} 已经不存在`);
                // 如果只有一个枚举，就设置为默认值
                if (this._bindingEnums.length == 1) {
                    this.binding = 0;
                    return;
                }
            }
        }
        this.binding = 0;
    }

    protected selectedBinding() {
        if (this._parent) {
            // 如果是函数，不设置默认值
            let isFunc = this._elementKinds.indexOf(DataKind.Function) != -1;
            if (isFunc) return;

            let path = this._parent.path;
            if (this._bindingName !== this._bindingType) {
                path = `${path}.${this._bindingName}`;
            }
            // 通过地址获取默认值
            let data = decoratorData.getDefaultInEditor(path);
            if (data !== null) {
                this.setElementValue(data);
            }
        }
    }

    //#endregion

    protected onLoad() {
        if (EDITOR) {
            this.checkEditorComponent();
            return;
        }

        this.initParentDataContext();

        // 设置绑定模式
        switch (this._bindingMode) {
            case BindingMode.TwoWay:
                //this._parent?.bind(this._path, this.onDataChange, this);
                this._isObservable = true;
                this.onElementCallback(this.onElementValueChange.bind(this));
                break;
            case BindingMode.OneWay:
                this._isObservable = true;
                break;
            case BindingMode.OneTime:
                this._isObservable = true; // 在数据回调通知的时候判断接触绑定
                break;
            case BindingMode.OneWayToSource:
                this.onElementCallback(this.onElementValueChange.bind(this));
                break;
        }

        // 组件数据初始化
        this.onUpdateData();

        // 设置绑定Node
        BindingData.register(this._upperData, this._bindingName, this.node);
    }

    protected onDestroy() {
        if (EDITOR) return;

        this._parent?.unregister(this);

        if (this._reaction) {
            unobserve(this._reaction);
            this._reaction = null;
        }

        BindingData.unregister(this._upperData, this._bindingName);
    }

    private initParentDataContext() {
        if (!this._parent) {
            this._parent = DataContext.lookUp(this.node);
            if (!this._parent) {
                console.warn(`PATH ${CCLocator.getNodeFullPath(this.node)} 组件 Binding 找不到上级 DataContext`);
                return;
            }
        }

        this._parent.register(this, this.onUpdateData);
    }

    private _isObservable = false;
    /** 观察函数 */
    private _reaction = null;
    private onUpdateData() {
        // 上下文数据异常，则不继续执行
        if (!this._parent) return;

        // 清理旧的观察函数
        if (this._reaction) {
            unobserve(this._reaction);
            this._reaction = null;
        }

        this._upperData = this._parent.getDataContextInRegister(this);
        if (this._upperData === null) {
            this.setElementValue(null);
            return;
        }

        // 判断 this._upperData 是否为对象
        if (typeof this._upperData !== 'object') {
            this._data = this._upperData;
            this.setDataValue(this._data);
            return;
        }

        this._data = this._upperData[this._bindingName];
        if (this._isObservable) {
            // 设置观察函数
            if (this._bindingType == 'Vec') {
                this._reaction = observe((operation) => {
                    let data = this._upperData?.[this._bindingName];
                    if (!data) return;
                    let x = data.x; // 监听 x
                    let y = data.y; // 监听 y
                    if (!operation) return;
                    this.setDataValue(data);
                }, this);
            }
            else {
                this._reaction = observe((operation) => {
                    let data = this._upperData?.[this._bindingName];
                    if (!operation) return;
                    this.setDataValue(data);
                }, this);
            }
        }

        this.setDataValue(this._data);
    }

    protected setDataValue(value: any) {
        this.setElementValue(value);

        // 如果是一次绑定，则解绑
        if (this._bindingMode === BindingMode.OneTime) {
            if (this._reaction) {
                unobserve(this._reaction);
            }
        }
    }

    private onElementValueChange(value: any) {
        if (this._bindingName === ITEMS_SOURCE_DELETE) {
            const itemsSource = this._parent as ItemsSource;
            itemsSource.deleteItemWithRegister(this);
            return;
        }

        if (this._upperData && Reflect.has(this._upperData, this._bindingName)) {
            if (this._bindingDataKind === DataKind.Function) {
                this._upperData[this._bindingName](value);
            }
            else if(this._bindingDataKind === DataKind.Enum){
                Reflect.set(this._upperData, this._bindingName, value);
            }
            else {
                Reflect.set(this._upperData, this._bindingName, value);
            }
        }
    }
}

/** Binding 组件数据 */
export class BindingData {
    private static _bindingNodeList: { target: any, map: { [bindingName: string]: Node[] } }[] = [];
    static register(target: any, bindingName: string, node: Node): void {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (!find) {
            find = { target: target, map: {} };
            this._bindingNodeList.push(find);
        }
        // find.map[bindingName] = node;
        if (!find.map[bindingName]) {
            find.map[bindingName] = [];
        }
        if (find.map[bindingName].indexOf(node) === -1) {
            find.map[bindingName].push(node);
        }
    }
    static unregister(target: any, bindingName: string): void {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (!find) return;
        delete find.map[bindingName];
    }

    /**
     * 获取绑定节点（如果多个，默认获取第一个）
     * @param target 绑定名称的上级数据
     * @param bindingName 绑定名称
     * @returns 
     */
    static getNode(target: any, bindingName: string): Node {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (!find) return null;
        return find.map[bindingName][0];
    }

    /**
     * 获取绑定所有节点
     * @param target 绑定名称的上级数据
     * @param bindingName 绑定名称
     * @returns 
     */
    static getNodes(target: any, bindingName: string): Node[] {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (!find) return null;
        return find.map[bindingName];
    }

    /**
     * 获取绑定数据
     * @param node 有挂载 Binding 的节点
     * @param isParent 是否获取上级数据, 默认为 false
     * @returns 
     */
    static get<T = any>(node: Node, isParent = false): T {
        return Binding.Data<T>(node, isParent);
    }
}
