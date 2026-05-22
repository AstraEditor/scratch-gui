/**
 * P2P 消息路由。解析来自其他节点的数据通道消息，分发到对应的处理逻辑。
 *
 * 依赖注入：
 *   addon       — addon 对象（内部获取 vm 等）
 *   sendToPeer  — 由网络层提供的 P2P 回发函数
 */
export function createHandler({
    addon,
    msg,
    console,
    sendToPeer,
    broadcastToPeers,
}) {
    const vm = addon.tab.traps.vm;

    /**
     * @param {string} peerId
     * @param {object} data
     */
    return async function handlePeerMessage(peerId, data) {
        console.log("[协作] 收到来自 " + peerId + " 的消息:", data);
        switch (data.type) {
            // ── Phase 1: snapshot ──
            case "snapshot":
                console.log("[协作] 📸 收到 snapshot");
                const projectData = JSON.parse(data.data);
                const storage = vm.runtime.storage;

                const dataURLToBytes = (dataURL) => {
                    const base64 = dataURL.split(",")[1];
                    const bin = atob(base64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    return bytes;
                };

                const assetTypeForCostume = (fmt) =>
                    fmt === "svg" ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;

                for (const target of projectData.targets) {
                    if (target.costumes) {
                        for (const c of target.costumes) {
                            if (c.data) {
                                const bytes = dataURLToBytes(c.data);
                                const dataObj = {};
                                for (let i = 0; i < bytes.length; i++) dataObj[i] = bytes[i];
                                c.asset = {
                                    assetType: assetTypeForCostume(c.dataFormat),
                                    dataFormat: c.dataFormat,
                                    data: dataObj
                                };
                                delete c.data;
                            }
                        }
                    }
                    if (target.sounds) {
                        for (const s of target.sounds) {
                            if (s.data) {
                                const bytes = dataURLToBytes(s.data);
                                const dataObj = {};
                                for (let i = 0; i < bytes.length; i++) dataObj[i] = bytes[i];
                                s.asset = {
                                    assetType: storage.AssetType.Sound,
                                    dataFormat: s.dataFormat,
                                    data: dataObj
                                };
                                delete s.data;
                            }
                        }
                    }
                }
                // 字体 — 直接注入 fontManager，不走 deserialize
                if (projectData.customFonts) {
                    const fm = vm.runtime.fontManager;
                    for (const f of projectData.customFonts) {
                        if (f.data && !f.system) {
                            const bytes = dataURLToBytes(f.data);
                            const asset = storage.createAsset(
                                storage.AssetType.Font,
                                f.dataFormat,
                                bytes,
                                null,
                                true
                            );
                            fm.addCustomFont(f.family, f.fallback, asset);
                        }
                    }
                    delete projectData.customFonts;
                }
                await vm.loadProject(projectData);
                break;

            // ── Phase 1: patch ──
            case "block-update":
            case "block-create":
            case "block-delete":
            case "block-connect":
            case "block-disconnect":
                // patch 层在此处理
                break;

            // ── Phase 3: assets ──
            case "costume-add":
            case "costume-update":
            case "sound-add":
            case "sound-update":
                break;

            // ── Phase 4: runtime ──
            case "ping":
                sendToPeer(peerId, { type: "pong" });
                break;
            case "pong":
                break;

            default:
                console.warn("[协作] 未知P2P消息类型:", data.type);
        }
    };
}
