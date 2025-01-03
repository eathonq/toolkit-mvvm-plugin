/**
 * CCResourcesSprite.ts
 * author : vangagh@live.cn
 * create : 2023-02-27
 * update : vangagh@live.cn 2025-01-03
 */

import { Node, AssetManager, SpriteFrame, Texture2D, assetManager, resources, ImageAsset, Sprite } from "cc";

const _res_ = 'resources';

/**
 * 资源精灵
 * @info 本地地址支持 bundle 资源，格式：'db://game/images/goods/i_1_1'，game 为 bundle 名称；
 */
export class CCResourcesSprite {
    private static _currentBundle: string = _res_;
    private static _bundleMap: Map<string, AssetManager.Bundle> = new Map<string, AssetManager.Bundle>([
        [_res_, resources]
    ]);

    private static loadBundle(bundle: string, url?: string, version?: string): AssetManager.Bundle | Promise<AssetManager.Bundle> {
        if (this._bundleMap.has(bundle)) {
            return this._bundleMap.get(bundle);
        }

        return new Promise<AssetManager.Bundle>((resolve, reject) => {
            const option = version ? { version } : undefined;
            assetManager.loadBundle(url ?? bundle, option, (err, _bundle) => {
                if (err) {
                    //return reject(err);
                    console.log("loadBundle err", err);
                    resolve(null);
                }
                this._bundleMap.set(bundle, _bundle);
                resolve(_bundle);
            });
        });
    }

    private static async loadSpriteFrame(path: string, bundle?: string, formate: string = "spriteFrame"): Promise<SpriteFrame> {
        if (!path || path.trim() === '') return null;

        const res = await this.loadBundle(bundle ?? this._currentBundle);
        if (!res) return null;

        if (formate == "spriteFrame") {
            return new Promise<SpriteFrame>((resolve, reject) => {
                res.load(`${path}/spriteFrame`, SpriteFrame, (err: any, spriteFrame: SpriteFrame) => {
                    if (err) {
                        resolve(null);
                    } else {
                        resolve(spriteFrame);
                    }
                });
            });
        }
        else if (formate == "texture") {
            return new Promise<SpriteFrame>((resolve, reject) => {
                res.load(`${path}/texture`, Texture2D, (err: any, texture: Texture2D) => {
                    if (err) {
                        resolve(null);
                    } else {
                        let spriteFrame = new SpriteFrame();
                        spriteFrame.texture = texture;
                        resolve(spriteFrame);
                    }
                });
            });
        }
    }

    private static async loadRemoteSpriteFrame(url: string): Promise<SpriteFrame> {
        return new Promise<SpriteFrame>((resolve, reject) => {
            assetManager.loadRemote<ImageAsset>(url, (err: any, imageAsset) => {
                if (err) {
                    resolve(null);
                } else {
                    const spriteFrame = new SpriteFrame();
                    const texture = new Texture2D();
                    texture.image = imageAsset;
                    spriteFrame.texture = texture;
                    resolve(spriteFrame);
                }
            });
        });
    }

    /**
     * 设置精灵
     * @param path 图片路径，支持本地和远程地址，本地地址支持 bundle 资源
     * @param formate 
     * @returns 
     * @example
     * CCResources.getSpriteFrame(node, 'images/goods/i_1_1');   // 本地地址（不包含图片后缀名，路径从 resources 目录下面开始）
     * CCResources.getSpriteFrame(node, 'db://game/images/goods/i_1_1');   // bundle 资源，game 为 bundle 名称
     * CCResources.getSpriteFrame(node, 'https://xxx.com/xxx.png');   // 远程地址
     */
    static async getSpriteFrame(path: string, formate = "spriteFrame"): Promise<SpriteFrame> {
        // 判断 path 是否为远程地址
        if (path.startsWith('http')) {
            return this.loadRemoteSpriteFrame(path);
        }
        // 本地地址
        else {
            // 判断是否以 db:// 开头
            let bundle: string = undefined;
            if (path.startsWith('db://')) {
                path = path.replace('db://', '');
                const arr = path.split('/');
                bundle = arr[0];
                path = path.replace(`${bundle}/`, '');
            }
            return this.loadSpriteFrame(path, bundle, formate);
        }
    }

    /**
     * 设置精灵
     * @param node Node 或 Sprite 
     * @param path 图片路径，支持本地和远程地址，本地地址支持 bundle 资源
     * @param formate 
     * @returns 
     * @example
     * CCResources.setSprite(node, 'images/goods/i_1_1');   // 本地地址（不包含图片后缀名，路径从 resources 目录下面开始）
     * CCResources.setSprite(node, 'db://game/images/goods/i_1_1');   // bundle 资源，game 为 bundle 名称
     * CCResources.setSprite(node, 'https://xxx.com/xxx.png');   // 远程地址
     */
    static setSprite(node: Node | Sprite, path: string, formate = "spriteFrame"): void {
        // 判断 path 是否为远程地址
        if (path.startsWith('http')) {
            this.loadRemoteSpriteFrame(path).then((spriteFrame: SpriteFrame) => {
                if (!spriteFrame) return;
                if (node instanceof Node) {
                    let sprite: Sprite = node.getComponent(Sprite);
                    if (!sprite) {
                        sprite = node.addComponent(Sprite);
                    }
                    sprite.spriteFrame = spriteFrame;
                }
                else {
                    node.spriteFrame = spriteFrame;
                }
            });
        }
        // 本地地址
        else {
            // 判断是否以 db:// 开头
            let bundle: string = undefined;
            if (path.startsWith('db://')) {
                path = path.replace('db://', '');
                const arr = path.split('/');
                bundle = arr[0];
                path = path.replace(`${bundle}/`, '');
            }
            this.loadSpriteFrame(path, bundle, formate).then((spriteFrame: SpriteFrame) => {
                if (!spriteFrame) return;
                if (node instanceof Node) {
                    let sprite: Sprite = node.getComponent(Sprite);
                    if (!sprite) {
                        sprite = node.addComponent(Sprite);
                    }
                    sprite.spriteFrame = spriteFrame;
                }
                else {
                    node.spriteFrame = spriteFrame;
                }
            });
        }
    }
}