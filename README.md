# cocos 插件使用指南

## 1. 插件安装方式

### 1.1 安装插件
- 扩展 -> 扩展管理器 -> 导入扩展包文件(.zip)

## 2. 插件项目结构
```shell
├── assets           // 插件的资源文件
├── dist             // 插件的编译输出目录
├── i18n             // 插件的国际化文件
├── package.json     // 插件的配置文件
└── README.md        // 插件的说明文件
```

### 2.1 package.json
```json
{
    ...
    "contributions": {
        ...
        "asset-db": {
            "mount": {
                "path": "./assets",
                "readonly": true,
                "visible": true
            }
        }
    }
}
```

## 3. 插件使用
- 在脚本中使用插件的模块
```ts
import * as mvvm from 'db://toolkit-mvvm/index';
```