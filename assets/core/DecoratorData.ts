/**
 * DecoratorData.ts
 * author : vangagh@live.cn
 * create : 2023-03-02
 * update : vangagh@live.cn 2025-01-03
 */

/** 装饰器类数据信息 */
export enum DataKind {
    /** 未知类型 */
    Unknown = 'unknown',

    /** String类型 */
    String = 'string',
    /** Number类型 */
    Number = 'number',
    /** Boolean类型 */
    Boolean = 'boolean',

    /** Object类型 */
    Object = 'object',

    /** Array类型 */
    Array = 'array',

    /** Function类型 */
    Function = 'function',

    /** Enum类型 */
    Enum = 'enum',

    /** Vec类型 */
    Vec = 'vec',
}

/** 扩展识别类型 */
export enum ExpandType {
    /** 
     * Vec 类型
     * @example
     * // 包含 x, y, z 三个属性
     * {x: number, y: number, z?: number}
     */
    Vec = 'Vec',
}

/**
 * 是否数组类型
 * @param type 
 * @returns 
 */
function is_array_type(type: any): type is Array<any> {
    return type instanceof Array;
}

/**
 * 是否构造函数
 * @param type 
 * @returns 
 */
function is_constructor(type: any) {
    return type instanceof Function;
}

/**
 * 转换数据类型
 * @param type 类型
 * @returns 返回数据类型
 */
function toDataKind(type: any) {
    switch (type) {
        case String:
            return DataKind.String;
        case Number:
            return DataKind.Number;
        case Boolean:
            return DataKind.Boolean;
        case ExpandType.Vec:
            return DataKind.Vec;
        default:
            if (is_array_type(type)) {
                return DataKind.Array;
            }
            else if (is_constructor(type)) {
                return DataKind.Object;
            }
            else {
                return DataKind.Unknown;
            }
    }
}

/**
 * 转换类型名字
 * @param type 
 * @returns 返回类型名字
 */
function toTypeName(type: any) {
    switch (type) {
        case undefined:
        case null:
            return 'unknown';
        case String:
            return 'String';
        case Number:
            return 'Number';
        case Boolean:
            return 'Boolean';
        case ExpandType.Vec:
            return 'Vec';
        default:
            if (is_array_type(type)) {
                return toTypeName(type[0]);
            }
            else if (type.name) {
                return decoratorData.toUnsafeObjTypeName(type.name);
            }
            else {
                return 'unknown';
            }
    }
}

/** 属性数据 */
interface PropertyData {
    /** 属性名字 */
    name: string,
    /** 属性类型 */
    type: string,
    /** 数据类型 */
    kind: DataKind,
}

/** 函数数据 */
interface FunctionData {
    /** 函数名字 */
    name: string,
    /** 函数类型 */
    type?: string,
    /** 数据类型 */
    kind: DataKind,
}

/** 类数据 */
interface ClassData {
    /** 类名字 */
    name: string,
    /** 构造函数 */
    constructor: any,
    /** 属性列表 */
    propertyList: PropertyData[],
    /** 函数列表 */
    functionList: FunctionData[],

    /** 是否ViewModel */
    isViewModel: boolean,

    /** 是否全局单例 */
    isGlobal: boolean,
    /** 全局单例实例 */
    globalInstance?: any,

    /** 是否在编辑器阶段设置为默认值 */
    isSetDefaultInEditor: boolean,
    /** 编辑状态下临时数据 */
    editorTemp?: any,
}

/** 装饰器数据 */
class DecoratorData {
    private _currentClass: ClassData;
    private _classMap = new Map<string, ClassData>();

    constructor() {
        // 设置默认的数据类型
        this._classMap.set('String', {
            name: 'String',
            constructor: String,
            propertyList: [{
                name: 'String',
                type: String.name,
                kind: DataKind.String,
            }],
            functionList: [],
            isViewModel: false,
            isGlobal: false,
            isSetDefaultInEditor: false,
        });
        this._classMap.set('Number', {
            name: 'Number',
            constructor: Number,
            propertyList: [{
                name: 'Number',
                type: Number.name,
                kind: DataKind.Number
            }],
            functionList: [],
            isViewModel: false,
            isGlobal: false,
            isSetDefaultInEditor: false,
        });
        this._classMap.set('Boolean', {
            name: 'Boolean',
            constructor: Boolean,
            propertyList: [{
                name: 'Boolean',
                type: Boolean.name,
                kind: DataKind.Boolean
            }],
            functionList: [],
            isViewModel: false,
            isGlobal: false,
            isSetDefaultInEditor: false,
        });
    }

    private getCurrentClassInfo() {
        if (!this._currentClass) {
            this._currentClass = {
                name: '',
                constructor: null,
                propertyList: [],
                functionList: [],
                isViewModel: false,
                isGlobal: false,
                isSetDefaultInEditor: false,
            };
        }
        return this._currentClass;
    }

    private saveCurrentClassInfo() {
        if (this._currentClass) {
            // 判断并加入到不安全属性列表，解决ts代码压缩导致类名被修改
            var unsafePropertyList: PropertyData[] = [];
            this._currentClass.propertyList.forEach((property) => {
                if (property.type.includes('unsafe-obj-')) {
                    unsafePropertyList.push(property);
                }
            });
            this._classMap.set(this._currentClass.name, this._currentClass);
            this._currentClass = null;

            // 转换不安全对象类型名称
            this.convertUnsafeProperty(unsafePropertyList);
        }
    }

    toUnsafeObjTypeName(name: string) {
        return `unsafe-obj-${name}`;
    }
    private getSafeObjTypeName(type: string) {
        const typeName = type.replace('unsafe-obj-', '');
        // 从_classMap数据中获取，判断 ClassData.constructor.name 是否等于 typeName
        for (const [key, value] of this._classMap) {
            if (value.constructor.name === typeName) {
                return key;
            }
        }
        return '';
    }
    private convertUnsafeProperty(unsafePropertyList: PropertyData[]) {
        for (let i = unsafePropertyList.length - 1; i >= 0; i--) {
            const property = unsafePropertyList[i];
            const typeName = this.getSafeObjTypeName(property.type);
            if (typeName) {
                property.type = typeName;
            }
        }
    }

    /**
     * 尝试获取 unknown 类型的属性
     * @param classInfo 
     * @returns 
     */
    private getUnknownProperty(classInfo: ClassData) {
        const temp = new classInfo.constructor();
        if (!temp) {
            return;
        }
        // propertyList 中的 unknown 类型属性
        classInfo.propertyList.forEach((property) => {
            if (property.kind === DataKind.Unknown) {
                const getTypeAnKind = (value: any) => {
                    const type = typeof value;
                    switch (type) {
                        case 'string':
                            return { type: 'String', kind: DataKind.String };
                        case 'number':
                            return { type: 'Number', kind: DataKind.Number };
                        case 'boolean':
                            return { type: 'Boolean', kind: DataKind.Boolean };
                        default:
                            return { type: 'unknown', kind: DataKind.Unknown };
                    }
                }
                if (temp[property.name] !== undefined) {
                    if (is_array_type(temp[property.name])) {
                        property.kind = DataKind.Array;
                        property.type = getTypeAnKind(temp[property.name][0]).type;
                    }
                    else {
                        const { type, kind } = getTypeAnKind(temp[property.name]);
                        property.type = type;
                        property.kind = kind;
                    }
                }
            }
        });
    }

    addProperty(constructor: any, key: string, type: any) {
        const classInfo = this.getCurrentClassInfo();
        let kind = toDataKind(type);
        let typeName = '';
        // 引用了自己类型为做属性类型，由于还未定义，导致这里 type 为 undefined
        if (type === undefined) {
            typeName = this.toUnsafeObjTypeName(constructor.name);
            kind = DataKind.Object;
        }
        // 引用了自己类型为做属性数组类型，由于还未定义，导致这里 type[0] 为 undefined
        else if (kind === DataKind.Array && type[0] === undefined) {
            typeName = this.toUnsafeObjTypeName(constructor.name);
        }
        else {
            typeName = toTypeName(type);
        }
        classInfo.propertyList.push({ name: key, type: typeName, kind: kind });
    }

    addEnumProperty(constructor: any, key: string, type: any) {
        const classInfo = this.getCurrentClassInfo();
        classInfo.propertyList.push({ name: key, type: "Enum", kind: DataKind.Enum });
    }

    addUnknownProperty(constructor: any, key: string) {
        const classInfo = this.getCurrentClassInfo();
        classInfo.propertyList.push({ name: key, type: 'unknown', kind: DataKind.Unknown });
    }

    addFunction(constructor: any, key: string) {
        const classInfo = this.getCurrentClassInfo();
        classInfo.functionList.push({ name: key, type: "function", kind: DataKind.Function });
    }

    addModel(constructor: any, name: string, global: boolean) {
        const classInfo = this.getCurrentClassInfo();
        classInfo.name = name;
        classInfo.constructor = constructor;
        classInfo.isGlobal = global;
        this.getUnknownProperty(classInfo);
        this.saveCurrentClassInfo();
    }

    addViewModel(constructor: any, name: string, global: boolean) {
        const classInfo = this.getCurrentClassInfo();
        classInfo.name = name;
        classInfo.constructor = constructor;
        classInfo.isGlobal = global;
        classInfo.isViewModel = true;
        this.getUnknownProperty(classInfo);
        this.saveCurrentClassInfo();
    }

    /**
     * 获取安全的类型名字
     * @param constructor 
     * @returns 
     */
    getSafeClassName(constructor: any) {
        const typeName = constructor.name;
        for (const [key, value] of this._classMap) {
            if (value.constructor.name === typeName) {
                return key;
            }
        }
        return '';
    }

    /**
     * 获取 ViewModel 列表
     * @param sortKey 
     * @returns 
     */
    getViewModelList(sortKey?: string) {
        const list: ClassData[] = [];
        this._classMap.forEach((value) => {
            if (value.isViewModel) {
                list.push(value);
            }
        });

        // 排序，将包含 sortKey 的排在前面
        if (sortKey) {
            list.sort((a, b) => {
                if (a.name.includes(sortKey) && !b.name.includes(sortKey)) {
                    return -1;
                }
                else if (!a.name.includes(sortKey) && b.name.includes(sortKey)) {
                    return 1;
                }
                return 0;
            });
        }

        return list;
    }

    /**
     * 创建实例
     * @param className 类名字
     * @returns 
     */
    createInstance(className: string) {
        const classInfo = this._classMap.get(className);
        if (classInfo) {
            if (classInfo.isGlobal) {
                if (!classInfo.globalInstance) {
                    classInfo.globalInstance = new classInfo.constructor();
                }
                return classInfo.globalInstance;
            }
            return new classInfo.constructor();
        }
        return null;
    }

    /**
     * 获取属性列表
     * @param className 类名字
     * @returns 
     */
    getPropertyList(className: string) {
        const classInfo = this._classMap.get(className);
        if (classInfo) {
            return classInfo.propertyList;
        }
        return [];
    }

    /**
     * 获取函数列表
     * @param className 类名字
     * @returns 
     */
    getFunctionList(className: string) {
        const classInfo = this._classMap.get(className);
        if (classInfo) {
            return classInfo.functionList;
        }
        return [];
    }

    /**
     * 设置编辑器默认值
     * @param temp 
     */
    setDefaultInEditor(temp: any) {
        // 查询_classMap 中, ClassData.constructor.name 是否等于 temp.constructor.name
        for (const [key, value] of this._classMap) {
            if (value.constructor.name === temp.constructor.name) {
                value.isSetDefaultInEditor = true;
                value.editorTemp = temp;
            }
        }
    }

    /**
     * 获取编辑器默认值
     * @param path 目标路径 
     * @returns 
     */
    getDefaultInEditor(path: string) {
        let pathList = path.split('.');
        if (pathList.length < 2) {
            return null;
        }
        let typeClass = pathList[0];
        let info = this._classMap.get(typeClass);
        if (!info || !info.isSetDefaultInEditor) {
            return null;
        }

        // let temp = info.temp;
        // for (let i = 1; i < pathList.length; i++) {
        //     let key = pathList[i];
        //     temp = temp[key];
        // }
        // return temp;

        try {
            let temp = info.editorTemp;
            for (let i = 1; i < pathList.length; i++) {
                let key = pathList[i];
                temp = temp[key];
                // 判断是否是数组
                if (temp instanceof Array) {
                    temp = temp[0];
                }
            }
            return temp;
        } catch (error) {
            console.warn(`${path}, ${error}`);
            return null;
        }
    }
}

export const decoratorData = new DecoratorData();