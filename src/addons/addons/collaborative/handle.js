import { APP_NAME } from "../../../lib/brand";
import ReduxStore from "../../redux.js";
import {
    openLoadingProject,
    closeLoadingProject,
} from "../../../reducers/modals";
import {
    requestProjectUpload,
    onLoadedProject,
} from "../../../reducers/project-state";
import { setURLParamsFromSearchString } from "./utils.js";
import { idHead, pointerSVG, SERVER_OPCODE } from "./constants.js";

let scaleObserver = null;
let scaleUpdateRaf = null;

function syncPointerScales() {
    const ws = Blockly.getMainWorkspace();
    if (!ws) return;
    
    const fixedScale = 0.3 / ws.scale;
    const pointers = document.querySelectorAll(`.${idHead}pointer`);
    
    pointers.forEach(pointer => {
        if (!pointer) return;
        
        const transform = pointer.getAttribute('transform');
        if (!transform) return;
        
        const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
        if (translateMatch) {
            pointer.setAttribute(
                'transform',
                `translate(${translateMatch[1]},${translateMatch[2]}) scale(${fixedScale})`
            );
        }
    });
}

function syncPointerContainerTransform() {
    const ws = Blockly.getMainWorkspace();
    if (!ws) return;
    
    const svg = ws.getParentSvg();
    const pointerContainer = svg.querySelector(`.${idHead}pointer-container`);
    if (!pointerContainer) return;
    
    const canvas = ws.getCanvas();
    if (!canvas) return;
    
    const canvasTransform = canvas.getAttribute('transform');
    if (canvasTransform) {
        pointerContainer.setAttribute('transform', canvasTransform);
    }
    
    syncPointerScales();
}

function setupScaleObserver() {
    if (scaleObserver) return;
    
    const ws = Blockly.getMainWorkspace();
    if (!ws) return;
    
    const canvas = ws.getCanvas();
    if (!canvas) return;
    
    scaleObserver = new MutationObserver((mutations) => {
        if (scaleUpdateRaf) return;
        
        scaleUpdateRaf = requestAnimationFrame(() => {
            scaleUpdateRaf = null;
            syncPointerContainerTransform();
        });
    });
    
    scaleObserver.observe(canvas, { attributes: true });
}

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
    rtc,
}) {
    const vm = addon.tab.traps.vm;

    /**
     * @param {string} peerId
     * @param {object} data
     */
    return async function handlePeerMessage(peerId, msgs) {
        console.log("[协作] 收到来自 " + peerId + " 的消息:", msgs);
        const data = JSON.parse(msgs);
        rtc.onIngoreUpdate(true);

        switch (data.type) {
            // ── Phase 1: snapshot ──
            case SERVER_OPCODE.SNAPSHOT:
                const sb3Base = data.data;
                const binary = atob(sb3Base);

                const bytes = new Uint8Array(binary.length);

                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                setURLParamsFromSearchString(data.config);
                const oldLoadingState =
                    ReduxStore.state.scratchGui.projectState.loadingState;
                ReduxStore.state.scratchGui.projectTitle = data.projectName;

                ReduxStore.dispatch(openLoadingProject());

                const uploadAction = requestProjectUpload(oldLoadingState);
                if (uploadAction) ReduxStore.dispatch(uploadAction);

                const loadingState =
                    ReduxStore.state.scratchGui.projectState.loadingState;
                let success = false;

                try {
                    localStorage.setItem(
                        "IM_SURE_IT_WONT_BREAK_MY_PROJECT",
                        true,
                    );
                    await vm.loadProject(bytes.buffer);
                    vm.renderer.draw();
                    success = true;
                    document.title = `${data.projectName} - ${APP_NAME}`;
                } finally {
                    const doneAction = onLoadedProject(
                        loadingState,
                        false,
                        success,
                    );
                    if (doneAction) ReduxStore.dispatch(doneAction);
                    ReduxStore.dispatch(closeLoadingProject());
                }
                break;

            case SERVER_OPCODE.POINTER:
                if (data.workspaceIndex !== rtc.editingTargetIndex) break;

                const ws = Blockly.getMainWorkspace();
                const svg = ws.getParentSvg();
                
                let pointerContainer = svg.querySelector(`.${idHead}pointer-container`);
                if (!pointerContainer) {
                    pointerContainer = document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "g",
                    );
                    pointerContainer.classList.add(`${idHead}pointer-container`);
                    
                    const canvas = ws.getCanvas();
                    const canvasTransform = canvas.getAttribute('transform');
                    if (canvasTransform) {
                        pointerContainer.setAttribute('transform', canvasTransform);
                    }
                    
                    svg.appendChild(pointerContainer);
                    
                    setupScaleObserver();
                }
                
                const fixedScale = 0.3 / ws.scale;

                const oldPointer = document.querySelector(
                    `.${idHead}pointer[id="${data.id}"]`,
                );
                if (oldPointer) {
                    oldPointer.setAttribute(
                        "transform",
                        `translate(${data.position.x},${data.position.y}) scale(${fixedScale})`,
                    );
                } else {
                    const Pointer = document.createElementNS(
                        "http://www.w3.org/2000/svg",
                        "g",
                    );
                    Pointer.innerHTML = pointerSVG("#0099ff", data.name);
                    Pointer.id = data.id;
                    Pointer.classList.add(`${idHead}pointer`)
                    Pointer.setAttribute(
                        "transform",
                        `translate(${data.position.x},${data.position.y}) scale(${fixedScale})`,
                    );
                    pointerContainer.appendChild(Pointer);

                    const textEl = Pointer.querySelector(".sa-collab-name-text");
                    const bgEl = Pointer.querySelector(".sa-collab-name-bg");
                    if (textEl && bgEl) {
                        const box = textEl.getBBox();
                        bgEl.setAttribute("width", box.width + 20);
                    }
                }
                break;
            case SERVER_OPCODE.BLOCK_UPDATE:
            case SERVER_OPCODE.BLOCK_CREATE:
            case SERVER_OPCODE.BLOCK_DELETE:
            case SERVER_OPCODE.BLOCK_CONNECT:
            case SERVER_OPCODE.BLOCK_DISCONNECT:
                // patch 层在此处理
                break;
            case SERVER_OPCODE.BLOCK_UPDATE:
            case SERVER_OPCODE.BLOCK_CREATE:
            case SERVER_OPCODE.BLOCK_DELETE:
            case SERVER_OPCODE.BLOCK_CONNECT:
            case SERVER_OPCODE.BLOCK_DISCONNECT:
                // patch 层在此处理
                break;
            case SERVER_OPCODE.COSTUME_ADD:
            case SERVER_OPCODE.COSTUME_UPDATE:
            case SERVER_OPCODE.SOUND_ADD:
            case SERVER_OPCODE.SOUND_UPDATE:
                break;

            case SERVER_OPCODE.SPRITE_DELETE:
                rtc._vm.deleteSprite(rtc._vm.runtime.targets[data.targetIndex].id);
                break
            case SERVER_OPCODE.SPRITE_ADD:
                console.log("add a sprite!", data.targetIndex);
                break

            // ── Phase 4: runtime ──
            case SERVER_OPCODE.PING:
                sendToPeer(peerId, { type: SERVER_OPCODE.PONG });
                break;
            case SERVER_OPCODE.PONG:
                break;

            default:
                console.warn("[协作] 未知P2P消息类型:", data.type);
        }
        rtc.onIngoreUpdate(false);
    };
}
