/**
 * CCElement.ts
 * author : vangagh@live.cn
 * create : 2023-03-02
 * update : vangagh@live.cn 2025-01-03
 */

import { _decorator, Component, Node, Label, RichText, EditBox, Toggle, Button, Slider, ProgressBar, PageView, Sprite, ToggleContainer, Enum, CCClass, EventHandler } from 'cc';
import { EDITOR } from 'cc/env';
import { DataKind } from './DecoratorData';
import { CCResourcesSprite } from './CCResourcesSprite';

const { ccclass, property, help, executeInEditMode } = _decorator;

type ElementBinding = {
    name: string;
    kind: DataKind[];
};

type Element = {
    component: any;
    binding: ElementBinding[];
}

const COMP_ELEMENT: Element[] = [
    {
        component: Label,
        binding: [{ name: 'string', kind: [DataKind.String, DataKind.Number, DataKind.Boolean, DataKind.Enum] }]
    },
    {
        component: RichText,
        binding: [{ name: 'string', kind: [DataKind.String, DataKind.Number, DataKind.Boolean, DataKind.Enum] }]
    },
    {
        component: EditBox,
        binding: [{ name: 'string', kind: [DataKind.String, DataKind.Number, DataKind.Boolean, DataKind.Enum] }]
    },
    {
        component: Toggle,
        binding: [{ name: 'isChecked', kind: [DataKind.Boolean] }]
    },
    {
        component: Button,
        binding: [{ name: 'click', kind: [DataKind.Function] }]
    },
    {
        component: Slider,
        binding: [{ name: 'progress', kind: [DataKind.Number] }]
    },
    {
        component: ProgressBar,
        binding: [{ name: 'progress', kind: [DataKind.Number] }]
    },
    {
        component: PageView,
        binding: [{ name: 'currentPageIndex', kind: [DataKind.Number] }]
    },
    {
        component: Sprite,
        binding: [{ name: 'spriteFrame', kind: [DataKind.String] }]
    },
    {
        component: ToggleContainer,
        binding: [{ name: 'checkedIndex', kind: [DataKind.Number] }] // 仅支持 allowSwitchOff = false
    },
];

const NODE_ELEMENT: Element[] = [
    {
        component: Node,
        binding: [
            { name: 'active', kind: [DataKind.Boolean, DataKind.Number, DataKind.String, DataKind.Object] },
            { name: 'position', kind: [DataKind.Vec] },
            { name: 'touch-start', kind: [DataKind.Function] },
            { name: 'touch-move', kind: [DataKind.Function] },
            { name: 'touch-end', kind: [DataKind.Function] }
        ]
    }
];

/**
 * Cocos Creator 元素
 * 用于识别元素的数据类型
 * 不直接使用，请使用 Binding 组件
 */
@ccclass('mvvm.CCElement')
@help('https://vangagh.gitbook.io/brief-2d-framework/mvvm/ccelement')
@executeInEditMode
export abstract class CCElement extends Component {
    @property
    protected _elementName = ""; // 挂载 @property 属性值保存到场景等资源文件中，用于 binding 数据恢复
    private _elementEnums: { name: string, value: number }[] = [];

    private _bindingElement = 0;
    /** 绑定元素的名字 */
    @property({
        type: Enum({}),
        displayName: 'Element',
        tooltip: '绑定元素（组件或节点）',
        displayOrder: 1,
    })
    get bindingElement() {
        return this._bindingElement;
    }
    protected set bindingElement(value) {
        this._bindingElement = value;
        if (this._elementEnums[value]) {
            this._elementName = this._elementEnums[value].name;
            this.selectedComponent();
        }
    }

    @property
    protected _propertyName = "";
    private _propertyEnums: { name: string, value: number }[] = [];
    private _bindingProperty = 0;
    /** 组件上需要监听的属性 */
    @property({
        type: Enum({}),
        displayName: 'Property',
        tooltip: '绑定元素属性（属性或方法）',
        displayOrder: 2,
    })
    get bindingProperty() {
        return this._bindingProperty;
    }
    protected set bindingProperty(value) {
        this._bindingProperty = value;
        if (this._propertyEnums[value]) {
            this._propertyName = this._propertyEnums[value].name;
            this.selectedProperty();
        }
    }

    /** 组件上需要监听的属性的数据类型 */
    protected _elementKinds: DataKind[] = [];

    /** 绑定方法自定义参数 */
    @property({
        tooltip: '绑定方法自定义参数',
        displayName: 'CustomEventData',
        visible() {
            return this._elementKinds.indexOf(DataKind.Function) != -1;
        },
        displayOrder: 10,
    })
    private customEventData: string = "";

    //#region EDITOR
    onRestore() {
        this._elementName = '';
        this._propertyName = '';
        this.checkEditorComponent();
    }

    protected checkEditorComponent() {
        this.identifyComponent();
        this.updateEditorElementEnums();
    }

    /** 识别到的组件列表 */
    private _identifyList: Element[] = [];
    private identifyComponent() {
        this._identifyList = [];
        for (let i = 0; i < COMP_ELEMENT.length; i++) {
            if (this.node.getComponent(COMP_ELEMENT[i].component)) {
                this._identifyList.push(COMP_ELEMENT[i]);
            }
        }
        // 添加节点（默认Node）组件
        this._identifyList = this._identifyList.concat(NODE_ELEMENT);
    }

    private updateEditorElementEnums() {
        const newEnums = [];
        if (this._identifyList.length > 0) {
            for (let i = 0; i < this._identifyList.length; i++) {
                const element = this._identifyList[i];
                newEnums.push({ name: element.component.name, value: i });
            }
        }

        this._elementEnums = newEnums;
        CCClass.Attr.setClassAttr(this, 'bindingElement', 'enumList', newEnums);

        // 设置绑定数据枚举默认值
        if (this._elementName !== '') {
            const findIndex = this._elementEnums.findIndex((item) => { return item.name === this._elementName; });
            if (findIndex != -1) {
                this.bindingElement = findIndex;
                return;
            }
        }
        this.bindingElement = 0;
    }

    private updateEditorPropertyEnums() {
        const newEnums = [];
        if (this._identifyList.length > 0) {
            const element = this._identifyList[this._bindingElement];
            if (element) {
                for (let i = 0; i < element.binding.length; i++) {
                    newEnums.push({ name: element.binding[i].name, value: i });
                }
            }
        }

        this._propertyEnums = newEnums;
        CCClass.Attr.setClassAttr(this, 'bindingProperty', 'enumList', newEnums);

        // 设置绑定数据枚举默认值
        if (this._propertyName !== '') {
            let findIndex = this._propertyEnums.findIndex((item) => { return item.name === this._propertyName; });
            if (findIndex != -1) {
                this.bindingProperty = findIndex;
                return;
            }
        }
        this.bindingProperty = 0;
    }

    private selectedComponent() {
        this.updateEditorPropertyEnums();
    }

    protected selectedProperty() {
        const element = this._identifyList[this._bindingElement];
        if (element) {
            this._elementKinds = element.binding[this._bindingProperty].kind;
        }
        else {
            this._elementKinds = [];
        }
    }
    //#endregion

    protected onLoad() {
        if (EDITOR) {
            this.checkEditorComponent();
            return;
        }
    }

    protected setElementValue(value: any) {
        switch (this._elementName) {
            case "Label":
                if (value === undefined || value === null) {
                    value = "";
                }
                this.node.getComponent(Label).string = `${value}`;
                break;
            case "RichText":
                if (value === undefined || value === null) {
                    value = "";
                }
                this.node.getComponent(RichText).string = `${value}`;
                break;
            case "EditBox":
                if (value === undefined || value === null) {
                    value = "";
                }
                this.node.getComponent(EditBox).string = `${value}`;
                break;
            case "Toggle":
                if (value === undefined || value === null) {
                    value = false;
                }
                this.node.getComponent(Toggle).isChecked = Boolean(value);
                break;
            case "Button":
                // 按钮的点击事件不做处理，Button绑定模式为BindingMode.OneWayToSource。
                break;
            case "Slider":
                if (value === undefined || value === null) {
                    value = 0;
                }
                this.node.getComponent(Slider).progress = Number(value);
                break;
            case "ProgressBar":
                if (value === undefined || value === null){
                    value = 0;
                }
                this.node.getComponent(ProgressBar).progress = Number(value);
                break;
            case "PageView":
                if (value === undefined || value === null) {
                    value = 0;
                }
                // PageView 组件在初始化时候，设置当前页会无效，所以延迟设置
                this.scheduleOnce(() => {
                    this.node.getComponent(PageView).setCurrentPageIndex(Number(value));
                }, 0);
                break;
            case "Sprite":
                const sprite = this.node.getComponent(Sprite);
                if (!value) {
                    sprite.spriteFrame = null;
                }
                else {
                    CCResourcesSprite.setSprite(sprite, value);
                }
                break;
            case "ToggleContainer":
                if (value === undefined || value === null) {
                    value = 0;
                }
                let toggles = this.node.getComponent(ToggleContainer).getComponentsInChildren(Toggle);
                let index = Number(value);
                for (let i = 0; i < toggles.length; i++) {
                    toggles[i].isChecked = i === index;
                }
                break;
            case "Node":
                this.setNodeValue(value);
                break;
        }
    }

    private _elementValueChange: (value: any) => void = null;
    protected onElementCallback(elementValueChange: (value: any) => void) {
        this._elementValueChange = elementValueChange;
        switch (this._elementName) {
            case "EditBox":
                let editBox = this.node.getComponent(EditBox);
                editBox.node.on(EditBox.EventType.TEXT_CHANGED, (editBox: EditBox) => {
                    this._elementValueChange?.(editBox.string);
                }, this);
                break;
            case "Toggle":
                let toggle = this.node.getComponent(Toggle);
                toggle.node.on(Toggle.EventType.TOGGLE, (toggle: Toggle) => {
                    this._elementValueChange?.(toggle.isChecked);
                }, this);
                break;
            case "Button":
                let button = this.node.getComponent(Button);
                button.node.on(Button.EventType.CLICK, (button: Button) => {
                    this._elementValueChange?.(this.customEventData);
                });
                break;
            case "Slider":
                let slider = this.node.getComponent(Slider);
                slider.node.on('slide', (slider: Slider) => {
                    this._elementValueChange?.(slider.progress);
                }, this);
                break;
            case "PageView":
                let pageView = this.node.getComponent(PageView);
                pageView.node.on(PageView.EventType.PAGE_TURNING, (pageView: PageView) => {
                    this._elementValueChange?.(pageView.getCurrentPageIndex());
                }, this);
                break;
            case "ToggleContainer":
                const containerEventHandler = new EventHandler();
                containerEventHandler.target = this.node; // 这个 node 节点是你的事件处理代码组件所属的节点
                containerEventHandler.component = 'mvvm.CCElement';// 这个是脚本类名
                containerEventHandler.handler = 'onToggleGroup';
                containerEventHandler.customEventData = '0';

                const container = this.node.getComponent(ToggleContainer);
                container.checkEvents.push(containerEventHandler);
                break;
            case "Node":
                // this.node.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, () => {
                //     this._elementValueChange?.(this.node.active);
                // }, this);
                this.onNodeCallback();
                break;
        }
    }

    private onToggleGroup(event: any, customEventData: string) {
        let parent: Node = event.node.parent;
        if (!parent || EDITOR) return;

        // 获取位置索引
        let index = parent.children.indexOf(event.node);
        this._elementValueChange?.(index);
    }

    //#region Node get set value
    private _value: any = null;
    private setNodeValue(value: any) {
        this._value = value;
        switch (this._propertyName) {
            case 'active':
                if (!this._value) {
                    this.node.active = false;
                }
                else {
                    this.node.active = true;
                }
                break;
            case 'position':
                if (!this._value) {
                    this._value = { x: 0, y: 0, z: 0 };
                }
                let pos = this.node.position;
                pos.set(this._value.x, this._value.y, this._value.z);
                this.node.position = pos;
                break;
        }
    }

    private onNodeCallback() {
        switch (this._propertyName) {
            case 'active':
                this.node.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, () => {
                    this._elementValueChange?.(this.node.active);
                }, this);
                break;
            case 'position':
                this.node.on(Node.EventType.TRANSFORM_CHANGED, () => {
                    if (!this._value) {
                        this._value = { x: 0, y: 0, z: 0 };
                    }
                    this._value.x = this.node.position.x;
                    this._value.y = this.node.position.y;
                    this._value.z = this.node.position.z;
                    this._elementValueChange?.(this._value);
                }, this);
                break;
            case 'touch-start':
                this.node.on(Node.EventType.TOUCH_START, (event: any) => {
                    this._elementValueChange?.(this.customEventData);
                }, this);
                break;
            case 'touch-move':
                this.node.on(Node.EventType.TOUCH_MOVE, (event: any) => {
                    this._elementValueChange?.(this.customEventData);
                }, this);
                break;
            case 'touch-end':
                this.node.on(Node.EventType.TOUCH_END, (event: any) => {
                    this._elementValueChange?.(this.customEventData);
                }, this);
                break;
        }
    }
    //#endregion
}
