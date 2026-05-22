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
    return async function handlePeerMessage(peerId, msgs) {
        console.log("[协作] 收到来自 " + peerId + " 的消息:", msgs);
        const data = JSON.parse(msgs);
        switch (data.type) {
            // ── Phase 1: snapshot ──
            case "snapshot":
                console.log("[协作] 📸 收到 snapshot");
                const sb3Base = data.data;
                const binary = atob(sb3Base);

                const bytes = new Uint8Array(binary.length);

                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                await vm.loadProject(bytes.buffer);
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
