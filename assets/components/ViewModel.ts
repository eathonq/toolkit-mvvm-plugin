/**
 * ViewModel.ts
 * author : vangagh@live.cn
 * create : 2023-03-02
 * update : vangagh@live.cn 2025-01-03
 */

import { _decorator, Component, Enum, CCClass, Node } from "cc";
import { EDITOR } from "cc/env";
import { raw, reactive } from "../core/ReactiveObserve";
import { CCLocator } from "../core/CCLocator";
import { DataContext } from "./DataContext";
import { decoratorData } from "../core/DecoratorData";

const { ccclass, help, executeInEditMode, menu, property } = _decorator;

/** ViewModel 默认方法接口 */
export interface IViewModel {
    /** 
     * 加载完成后调用（ViewModel.onLoad 的下一帧执行，保证UI数据已经准备好）
     */
    onLoaded?(): void;
    /** 销毁时调用 */
    onDestroy?(): void;
}

@ccclass("mvvm.ViewModel")
@help("https://vangagh.gitbook.io/brief-2d-framework/mvvm/viewmodel")
@executeInEditMode
@menu("Brief.Toolkit.Mvvm/ViewModel")
export class ViewModel extends DataContext {

    @property
    protected _viewModelName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于数据恢复
    get viewModelName() {
        return this._viewModelName;
    }

    protected _viewModelEnums: { name: string, value: number }[] = [];
    private _viewModel = 0;
    @property({
        type: Enum({}),
        tooltip: "绑定视图模型",
    })
    get viewModel() {
        return this._viewModel;
    }
    set viewModel(value) {
        this._viewModel = value;
        // 相关本地数据保存
        if (this._viewModelEnums[value]) {
            this._viewModelName = this._viewModelEnums[value].name;
            this.bindingType = this._viewModelName;
            this.path = this.bindingType;
        }
    }

    //#region EDITOR
    onRestore() {
        this.checkEditorComponent();
    }

    protected checkEditorComponent() {
        this.updateEditorViewModelEnums();
    }

    private updateEditorViewModelEnums() {
        // 设置绑定属性
        const newEnums = [];
        let dataList = decoratorData.getViewModelList(this.node.name);
        if (dataList) {
            for (let i = 0; i < dataList.length; i++) {
                const data = dataList[i];
                newEnums.push({ name: data.name, value: i });
            }
        }
        // 更新绑定数据枚举
        this._viewModelEnums = newEnums;
        CCClass.Attr.setClassAttr(this, "viewModel", "enumList", newEnums);

        // 如果绑定数据枚举为空，则警告
        if (newEnums.length == 0) {
            console.warn(`PATH ${CCLocator.getNodeFullPath(this.node)} 组件 ViewModel 绑定未找到合适的数据`);
        }

        // 设置绑定数据枚举默认值
        if (this._viewModelName !== "") {
            let findIndex = newEnums.findIndex((item) => { return item.name === this._viewModelName });
            if (findIndex !== -1) {
                this.viewModel = findIndex;
                return;
            }
        }
        this.viewModel = 0;
    }

    //#endregion

    protected onLoad() {
        // 根节点
        this.isRoot = true;

        super.onLoad();
        if (EDITOR) {
            this.checkEditorComponent();
            return;
        }

        // 组件数据初始化
        this.onUpdateData();

        if (this._data) {
            ViewModelData.register(this._data, this._viewModelName, this.node);
        }

        // 下一帧执行，确保数据初始化完成
        this.scheduleOnce(() => {
            (this._data as IViewModel).onLoaded?.call(this._data);
        });
    }

    protected onDestroy() {
        super.onDestroy();
        if (EDITOR) return;

        if (this._data) {
            ViewModelData.unregister(this._data);
            this._data.onDestroy?.call(this._data);
            this._data = null;
        }
    }

    protected update(dt: number) {
        if (EDITOR) return;

        // 获取原始数据，防止频繁触发 Proxy 更新
        const rawValue = raw(this._data);
        if(rawValue.onUpdate){
            rawValue.onUpdate.call(this._data, dt);
        }
    }

    protected onUpdateData() {
        // 绑定数据设置
        this.parent = this;
        // 创建视图模型
        let vm = decoratorData.createInstance(this._viewModelName);
        if (!vm) {
            console.error(`ViewModel: ${this.node.name} onLoad createInstance is null`);
            return;
        }
        // 创建响应式视图模型
        let reactive_vm = reactive(vm);
        this._data = reactive_vm;
    }
}

/** ViewModel 组件数据 */
export class ViewModelData {
    private static _bindingNodeList: { target: any, viewModel: string, node: Node }[] = [];
    static register(target: any, viewModel: string, node: Node): void {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (find) {
            find.viewModel = viewModel;
            find.node = node;
            return;
        }
        this._bindingNodeList.push({ target: target, viewModel: viewModel, node: node });
    }
    static unregister(target: any): void {
        let findIndex = this._bindingNodeList.findIndex((item) => { return item.target === target; });
        if (findIndex !== -1) {
            this._bindingNodeList.splice(findIndex, 1);
        }
    }

    /**
     * 获取视图模型数据
     * @param target 视图模型
     * @returns 
     */
    static getNode(target: any): Node {
        let find = this._bindingNodeList.find((item) => { return item.target === target; });
        if (find) {
            return find.node;
        }
        return null;
    }

    /**
     * 获取视图模型数据
     * @param constructor 视图模型构造函数
     * @param node 绑定节点
     * @returns 
     */
    static getWithType<T>(constructor: { new(): T; }, node?: Node): T {
        let name = decoratorData.getSafeClassName(constructor);
        let find = this._bindingNodeList.find((item) => {
            return item.viewModel === name
                && (node ? item.node === node : true);
        });
        if (find) {
            return find.target;
        }
        return null;
    }

    /**
     * 获取视图模型数据
     * @param name ViewModel名称
     * @param node 绑定节点
     * @returns 
     */
    static get<T = any>(name: string, node?: Node): T {
        let find = this._bindingNodeList.find((item) => {
            return item.viewModel === name
                && (node ? item.node === node : true);
        });
        if (find) {
            return find.target;
        }
        return null;
    }
}
