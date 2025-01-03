/**
 * CCLocator.ts
 * author : vangogh@live.cn
 * create : 2023-02-27
 * update : vangagh@live.cn 2025-01-03
 */

import { Node } from 'cc';

/** 定位器 */
export class CCLocator {

    /**
     * 定位节点(支持超时定位)
     * @param root 根节点
     * @param locator 定位地址
     * @returns {Promise<Node>} 节点
     * @example
     * // locator 定位地址格式
     * // '/' 节点的子节点名称, 例如: 'Content/Label'
     * '>' 多级子节点名称, 例如: 'Content>Label2'
     * // '.' 节点的属性, 例如: 'Content.Label'
     * // '#' 多级节点属性, 例如: 'Content#Label2'
     * let node = await Locator.locateNode(this.node, 'Content/Label');
     * let node = await Locator.locateNode(this.node, 'Content>Label2');
     */
    static locateNode(root: Node, locator: string): Node {
        if (!root || !locator) return null;

        let segments = this.parse(locator);
        let child: Node;
        let node = root;
        for (let i = 0; i < segments.length; i++) {
            let item = segments[i];
            switch (item.symbol) {
                case '/':
                    child = node.getChildByName(item.name);
                    break;
                case '.':
                    child = node[item.name];
                    break;
                case '>':
                    child = this.seekNodeByName(node, item.name);
                    break;
                case '#':
                    child = this.seekNodeByTag(node, item.name);
                    break;
            }

            if (!child) {
                node = null;
                break;
            }
            node = child;
        }

        // 节点返回
        if (node && node.active) {
            return node;
        }
        else {
            return null;
        }
    }

    /**
     * 定位解析
     * @param locator 定位地址
     * @returns {Array} 名称数组
     */
    private static parse(locator: string): Array<{ symbol: string, name: string }> {
        //使用正则表达示分隔名字
        let names = locator.split(/[.,//,>,#]/g);
        let segments = names.map(function (name) {
            let index = locator.indexOf(name);
            let symbol = locator[index - 1] || '>';
            return { symbol: symbol, name: name.trim() };
        });
        return segments;
    }

    /**
     * 寻找节点
     * @param root 根节点 
     * @param name 节点名称
     * @returns Node 节点
     * @info 节点名称为节点的name属性, 例如: node.name = 'test';
     */
    static seekNodeByName(root: Node, name: string): Node {
        if (root.name == name) {
            return root;
        }

        let children = root.children;
        for (let i = 0; i < children.length; i++) {
            let node = this.seekNodeByName(children[i], name);
            if (node) {
                return node;
            }
        }
    }

    /**
     * 寻找节点
     * @param root 根节点
     * @param tag 节点标签
     * @returns Node 节点
     * @info 节点标签为节点的自定义属性, 例如: node['tag'] = 'test';
     */
    static seekNodeByTag(root: Node, tag: string): Node {
        if (root[tag]) {
            return root;
        }

        let children = root.children;
        for (let i = 0; i < children.length; i++) {
            let node = this.seekNodeByTag(children[i], tag);
            if (node) {
                return node;
            }
        }
    }

    /**
     * 获取节点全路径
     * @param node 查找的节点
     * @param start 开始的节点
     * @returns 节点全路径
     * @info 路径为 New Node/should_hide_in_hierarchy/ 表示未加载隐藏的节点
     */
    static getNodeFullPath(node: Node, start?: Node): string {
        let array = [];
        let temp = node;
        do {
            array.unshift(temp.name);
            temp = temp.parent;
        } while (temp && temp.name !== 'Canvas' && temp !== start);

        // let fullPath = array.join('/');
        // // 如果头部是 New Node/ 则去掉
        // if (fullPath.indexOf('New Node/') == 0) {
        //     fullPath = fullPath.replace('New Node/', '');
        // }
        // return fullPath;

        return array.join('/');
    }
}
