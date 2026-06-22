import { APP_NAME } from "../../../lib/brand";
import ReduxStore from "../../redux.js";
import {
    openLoadingProject, closeLoadingProject,
} from "../../../reducers/modals";
import {
    requestProjectUpload, onLoadedProject,
} from "../../../reducers/project-state";
import { setURLParamsFromSearchString } from "./utils.js";
import { idHead, pointerSVG, SERVER_OPCODE } from "./constants.js";

let _Blockly = null;
let _vm = null;
let _rtc = null;
let scaleObserver = null, scaleUpdateRaf = null;

function syncPointerScales() {
    const ws = _Blockly && _Blockly.getMainWorkspace();
    if (!ws) return;
    const f = 0.3 / ws.scale;
    document.querySelectorAll(`.${idHead}pointer`).forEach(p => {
        if (!p) return;
        const m = (p.getAttribute("transform") || "").match(/translate\(([^,]+),([^)]+)\)/);
        if (m) p.setAttribute("transform", `translate(${m[1]},${m[2]}) scale(${f})`);
    });
}
function syncPointerContainerTransform() {
    const ws = _Blockly && _Blockly.getMainWorkspace();
    if (!ws) return;
    const svg = ws.getParentSvg(), pc = svg.querySelector(`.${idHead}pointer-container`);
    if (!pc) return;
    const c = ws.getCanvas(); if (!c) return;
    const t = c.getAttribute("transform"); if (t) pc.setAttribute("transform", t);
    syncPointerScales();
}
function setupScaleObserver() {
    if (scaleObserver) return;
    const ws = _Blockly && _Blockly.getMainWorkspace();
    if (!ws) return;
    const c = ws.getCanvas(); if (!c) return;
    scaleObserver = new MutationObserver(() => {
        if (scaleUpdateRaf) return;
        scaleUpdateRaf = requestAnimationFrame(() => { scaleUpdateRaf = null; syncPointerContainerTransform(); });
    });
    scaleObserver.observe(c, { attributes: true });
}

// ── XML → blocks (parser) ────────────────────────────────────────

function xmlDomToBlockObj(node, blocks, isTop, parentId) {
    if (!node || !node.tagName) return null;
    const isShadow = node.tagName.toLowerCase() === 'shadow';
    const id = node.getAttribute('id') || null;
    const b = {
        id, opcode: node.getAttribute('type') || '',
        inputs: {}, fields: {}, next: null,
        topLevel: isTop, parent: parentId || null, shadow: isShadow,
        x: isTop ? (parseFloat(node.getAttribute('x')) || 0) : undefined,
        y: isTop ? (parseFloat(node.getAttribute('y')) || 0) : undefined,
    };
    for (const ch of Array.from(node.children || [])) {
        const nm = ch.tagName ? ch.tagName.toLowerCase() : '';
        switch (nm) {
            case 'field': {
                const fn = ch.getAttribute('name'), fi = ch.getAttribute('id');
                let tv = ''; if (ch.childNodes.length > 0) tv = ch.childNodes[0].textContent || '';
                b.fields[fn] = { name: fn, id: fi, value: tv }; break;
            }
            case 'value': case 'statement': {
                const iname = ch.getAttribute('name'); let cbn = null, csn = null;
                for (const gc of Array.from(ch.children || [])) {
                    const gn = gc.tagName ? gc.tagName.toLowerCase() : '';
                    if (gn === 'block') cbn = gc; else if (gn === 'shadow') csn = gc;
                }
                let cb = null, cs = null;
                if (cbn) { const co = xmlDomToBlockObj(cbn, blocks, false, id); if (co) { blocks[co.id] = co; cb = co.id; } }
                if (csn) { const so = xmlDomToBlockObj(csn, blocks, false, id); if (so) { blocks[so.id] = so; cs = so.id; } }
                b.inputs[iname] = { name: iname, block: cb, shadow: cs }; break;
            }
            case 'next': {
                let nn = null;
                for (const gc of Array.from(ch.children || []))
                    if (gc.tagName && gc.tagName.toLowerCase() === 'block') nn = gc;
                if (nn) { const no = xmlDomToBlockObj(nn, blocks, false, id); if (no) { blocks[no.id] = no; b.next = no.id; } }
                break;
            }
            case 'mutation': {
                b.mutation = { tagName: 'mutation', children: [] };
                for (let i = 0; i < ch.attributes.length; i++) b.mutation[ch.attributes[i].name] = ch.attributes[i].value;
                for (const gc of Array.from(ch.children || [])) {
                    if (!gc.tagName) continue;
                    const nm2 = { tagName: gc.tagName.toLowerCase(), children: [] };
                    for (let i = 0; i < gc.attributes.length; i++) nm2[gc.attributes[i].name] = gc.attributes[i].value;
                    b.mutation.children.push(nm2);
                }
                break;
            }
        }
    }
    return b;
}

function parseXml(xmlString) {
    const p = new DOMParser().parseFromString(xmlString, 'text/xml');
    const blocks = {};
    const rn = p.documentElement, tn = rn.tagName ? rn.tagName.toLowerCase() : '';
    if (tn === 'block') { const o = xmlDomToBlockObj(rn, blocks, true, null); if (o) blocks[o.id] = o; }
    return Object.values(blocks);
}

// ── Batching ─────────────────────────────────────────────────────

const _pending = new Map(); let _raf = null, _def = null, _defRaf = null;

function enqueue(op, rtc) {
    // costume/sound 操作用 type+index 做 key，block 操作用 rootId
    let key;
    if (op.type === 'costumeAdd' || op.type === 'costumeUpdate' || op.type === 'costumeDelete') {
        key = `${op.targetIndex}:costume:${op.index}`;
    } else if (op.type === 'soundAdd' || op.type === 'soundUpdate' || op.type === 'soundDelete') {
        key = `${op.targetIndex}:sound:${op.index}`;
    } else {
        key = `${op.targetIndex}:${op.rootId || 'unknown'}`;
    }
    _pending.set(key, op);
    if (!_raf) _raf = requestAnimationFrame(() => { _raf = null; flush(rtc); });
}

function getWS() { return _Blockly ? _Blockly.getMainWorkspace() : null; }

// ── 编辑锁定遮罩 ──────────────────────────────────────────────

// 远端用户的锁定状态：Map<lockKey, { userId, userName, lockType, lockId }>
const _remoteLocks = new Map();

function lockKey(lockType, lockId) { return `${lockType}:${lockId}`; }

// 在积木/注释的 svgGroup_ 上添加遮罩，阻止交互
function addLockOverlay(svgGroup, userName, noLabel) {
    if (!svgGroup) return;
    // 移除旧遮罩（如果有）
    removeLockOverlay(svgGroup);

    // 直接禁用注释 textarea
    const textarea = svgGroup.querySelector('textarea');
    if (textarea) {
        textarea.disabled = true;
        textarea.readOnly = true;
        textarea.dataset.collabLocked = 'true';
        textarea.style.cursor = 'not-allowed';
    }

    // 获取主题色
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--looks-secondary').trim() || '#855cd6';

    try {
        const bbox = svgGroup.getBBox();
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        overlay.setAttribute('x', bbox.x - 1);
        overlay.setAttribute('y', bbox.y - 1);
        overlay.setAttribute('width', bbox.width + 2);
        overlay.setAttribute('height', bbox.height + 2);
        overlay.setAttribute('rx', '4');
        overlay.setAttribute('pointer-events', 'all');
        overlay.setAttribute('cursor', 'not-allowed');
        overlay.dataset.collabLockOverlay = 'true';

        if (noLabel) {
            overlay.setAttribute('fill', `${themeColor}20`); // 12% 透明度
            overlay.setAttribute('stroke', `${themeColor}80`); // 50% 透明度
            overlay.setAttribute('stroke-width', '1.5');
            overlay.setAttribute('stroke-dasharray', '4 3');
        } else {
            overlay.setAttribute('fill', `${themeColor}30`); // 19% 透明度，更醒目
            overlay.setAttribute('stroke', `${themeColor}CC`); // 80% 透明度
            overlay.setAttribute('stroke-width', '2');

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', bbox.x + bbox.width / 2);
            label.setAttribute('y', bbox.y - 8);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '14'); // 增大字体
            label.setAttribute('font-weight', '500');
            label.setAttribute('fill', themeColor);
            label.setAttribute('pointer-events', 'none');
            // 使用国际化文本
            const msg = _rtc?._msg || ((key) => key);
            label.textContent = msg('user_editing', { user: userName });
            label.dataset.collabLockOverlay = 'true';
            svgGroup.appendChild(label);
        }

        const stop = e => { e.stopPropagation(); e.preventDefault(); };
        overlay.addEventListener('mousedown', stop, true);
        overlay.addEventListener('touchstart', stop, true);
        overlay.addEventListener('contextmenu', stop, true);

        svgGroup.appendChild(overlay);
    } catch (e) {
    }
}

function removeLockOverlay(svgGroup) {
    if (!svgGroup) return;
    svgGroup.querySelectorAll('[data-collab-lock-overlay]').forEach(el => el.remove());
    // 恢复被锁定的 textarea
    const lockedTA = svgGroup.querySelector('textarea[data-collab-locked]');
    if (lockedTA) {
        lockedTA.disabled = false;
        lockedTA.readOnly = false;
        delete lockedTA.dataset.collabLocked;
        lockedTA.style.cursor = '';
    }
}

// 根据 lockType + lockId 查找对应的 SVG 元素
// 积木用 ID 查找，注释用 index 查找（因为两端注释 ID 不同）
function findSvgElement(lockType, lockId) {
    const ws = getWS();
    if (!ws) return null;
    if (lockType === 'block') {
        return ws.getBlockById(lockId)?.svgGroup_ || null;
    } else if (lockType === 'comment') {
        // lockId 是注释在 target.comments 排序后的 index
        const idx = parseInt(lockId, 10);
        const target = _vm?.runtime?.getEditingTarget();
        const sortedKeys = Object.keys(target.comments).sort();
        if (idx < 0 || idx >= sortedKeys.length) return null;
        const commentId = sortedKeys[idx];
        const commentData = target.comments[commentId];

        // Block comment：锁定注释气泡
        if (commentData?.blockId) {
            const block = ws.getBlockById(commentData.blockId);
            const el = block?.comment?.bubble_?.bubbleGroup_ || null;
            return el;
        }
        // Workspace comment：锁定注释本身
        const comment = ws.getCommentById(commentId);
        const el = comment?.svgGroup_ || null;
        return el;
    }
    return null;
}

// 应用远端锁定：添加遮罩（找不到 SVG 时仍存储锁定，等元素出现后补加）
function applyRemoteLock(lockType, lockId, userName, userId, noLabel) {
    const key = lockKey(lockType, lockId);
    _remoteLocks.set(key, { lockType, lockId, userName, userId, noLabel });
    const svgEl = findSvgElement(lockType, lockId);
    if (svgEl) addLockOverlay(svgEl, userName, noLabel);
    // 关闭可能已打开的输入框
    if (_Blockly) {
        _Blockly.WidgetDiv.hide?.();
        _Blockly.DropDownDiv.hide?.();
    }
}

// 移除远端锁定：移除遮罩
function removeRemoteLock(lockType, lockId) {
    const key = lockKey(lockType, lockId);
    _remoteLocks.delete(key);
    const svgEl = findSvgElement(lockType, lockId);
    if (svgEl) removeLockOverlay(svgEl);
}

// 重新应用所有远端锁定遮罩（replaceTree 后旧 svgGroup_ 被 dispose，需要重新添加）
function reapplyRemoteLocks() {
    for (const [key, lock] of _remoteLocks) {
        const svgEl = findSvgElement(lock.lockType, lock.lockId);
        if (svgEl) {
            removeLockOverlay(svgEl);
            addLockOverlay(svgEl, lock.userName, lock.noLabel);
        }
    }
}

// 清理某个用户的所有锁定（断线时调用）
export function clearLocksByUser(userId) {
    for (const [key, lock] of _remoteLocks) {
        if (lock.userId === userId) {
            const svgEl = findSvgElement(lock.lockType, lock.lockId);
            if (svgEl) removeLockOverlay(svgEl);
            _remoteLocks.delete(key);
        }
    }
}

// 清理所有远端锁定
function clearAllRemoteLocks() {
    for (const [, lock] of _remoteLocks) {
        const svgEl = findSvgElement(lock.lockType, lock.lockId);
        if (svgEl) removeLockOverlay(svgEl);
    }
    _remoteLocks.clear();
}

// ── 拖动幽灵（实时显示远端用户正在拖动的积木簇） ──────────────

const _dragGhosts = new Map();   // userId -> SVG group element
const _dragOffsets = new Map();  // userId -> { x, y } 积木原点与鼠标的相对偏移

function removeDragGhost(userId) {
    const ghost = _dragGhosts.get(userId);
    if (ghost) {
        ghost.remove();
        _dragGhosts.delete(userId);
    }
    _dragOffsets.delete(userId);
}

function updateDragGhostPosition(userId, x, y) {
    const ghost = _dragGhosts.get(userId);
    if (ghost) {
        const off = _dragOffsets.get(userId) || { x: 0, y: 0 };
        ghost.setAttribute('transform', `translate(${x + off.x},${y + off.y})`);
    }
}

function showDragGhost(userId, xmlString, x, y, offsetX, offsetY) {
    if (!_Blockly) return;
    const ws = _Blockly.getMainWorkspace();
    if (!ws) return;
    removeDragGhost(userId);

    const dom = _Blockly.Xml.textToDom(`<xml>${xmlString}</xml>`);
    const rootEl = dom.querySelector('block');
    if (!rootEl) return;

    _Blockly.Events.disable();
    try {
        const rootBlock = _Blockly.Xml.domToBlock(rootEl, ws);
        if (!rootBlock || !rootBlock.getSvgRoot()) { _Blockly.Events.enable(); return; }

        // 深克隆整个 SVG 树
        const ghostGroup = rootBlock.getSvgRoot().cloneNode(true);
        // 清除克隆中的 id，避免与真实积木冲突
        ghostGroup.removeAttribute('id');
        ghostGroup.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        // 幽灵样式
        ghostGroup.setAttribute('opacity', '0.5');
        ghostGroup.setAttribute('pointer-events', 'none');
        ghostGroup.setAttribute('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))');

        // 销毁真实积木（SVG 已克隆，不受影响）
        rootBlock.dispose(false);

        // 放入画布
        const canvas = ws.getCanvas();
        if (canvas) {
            _dragOffsets.set(userId, { x: offsetX || 0, y: offsetY || 0 });
            ghostGroup.setAttribute('transform', `translate(${x + (offsetX || 0)},${y + (offsetY || 0)})`);
            canvas.appendChild(ghostGroup);
            _dragGhosts.set(userId, ghostGroup);
        }
    } catch (e) {
        console.error('[协作] 创建拖动幽灵失败:', e);
    } finally {
        _Blockly.Events.enable();
    }
}

// 清理单个用户的所有远端元素（指针、聊天气泡、锁定遮罩、拖动幽灵）
export function cleanupRemoteByUser(userId) {
    clearLocksByUser(userId);
    removeDragGhost(userId);
    const ws = getWS();
    if (ws) {
        const svg = ws.getParentSvg();
        if (svg) {
            svg.querySelectorAll(`.${idHead}pointer[id="${userId}"]`).forEach(e => e.remove());
        }
    }
    removeRemoteChatBubble(userId);
}

// 退出时清理所有远端元素（指针、聊天气泡、锁定遮罩）
export function cleanupAllRemote() {
    clearAllRemoteLocks();
    _remoteChatBubbles.clear();
    // 清除所有拖动幽灵
    for (const [, ghost] of _dragGhosts) ghost.remove();
    _dragGhosts.clear();
    // 移除所有指针容器
    const ws = getWS();
    if (ws) {
        const svg = ws.getParentSvg();
        const pc = svg?.querySelector(`.${idHead}pointer-container`);
        if (pc) pc.remove();
    }
}

// ── 远端聊天气泡（复用指针SVG内部的名字组） ────────────────

const _remoteChatBubbles = new Map();

function applyRemoteChatBubble(data) {
    const { id: userId, text } = data;
    const pointerEl = document.querySelector(`.${idHead}pointer[id="${userId}"]`);
    if (!pointerEl) return;

    const nameGroup = pointerEl.querySelector('g');
    if (!nameGroup) return;

    // 保存原始状态（首次）
    if (!_remoteChatBubbles.has(userId)) {
        const nameText = nameGroup.querySelector('.sa-collab-name-text');
        const nameBg = nameGroup.querySelector('.sa-collab-name-bg');
        _remoteChatBubbles.set(userId, {
            nameGroup,
            originalName: nameText?.textContent || '',
            originalY: nameText?.getAttribute('y') || '60',
            originalBgH: nameBg?.getAttribute('height') || '80',
            originalBgW: nameBg?.getAttribute('width') || '0',
            originalBgY: nameBg?.getAttribute('y') || '0',
            smallNameEl: null,  // 小字名字元素（动态创建）
        });
    }

    const chatData = _remoteChatBubbles.get(userId);
    const nameText = nameGroup.querySelector('.sa-collab-name-text');
    const nameBg = nameGroup.querySelector('.sa-collab-name-bg');
    if (!nameText || !nameBg) return;

    // text === null 表示清除
    if (text === null) {
        // 移除小字名字元素
        chatData.smallNameEl?.remove();
        chatData.smallNameEl = null;
        // 恢复原状
        nameText.textContent = chatData.originalName;
        nameText.setAttribute('y', chatData.originalY);
        nameText.removeAttribute('font-weight');
        nameBg.setAttribute('height', chatData.originalBgH);
        nameBg.setAttribute('width', chatData.originalBgW);
        nameBg.setAttribute('y', chatData.originalBgY);
        _remoteChatBubbles.delete(userId);
        return;
    }

    if (text && text.length > 0) {
        // 创建/复用小字名字元素（放在上方）
        if (!chatData.smallNameEl) {
            const smallName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            smallName.setAttribute('class', `${idHead}chat-small-name`);
            smallName.setAttribute('fill', 'white');
            smallName.setAttribute('font-size', '48');
            smallName.setAttribute('x', '35');
            smallName.setAttribute('y', '55');
            Object.assign(smallName.style, { opacity: '0', transition: 'opacity 0.25s ease' });
            nameGroup.appendChild(smallName);
            chatData.smallNameEl = smallName;
            requestAnimationFrame(() => { smallName.style.opacity = '1'; });
        }
        chatData.smallNameEl.textContent = chatData.originalName;

        // 主文字改为聊天内容 + 动画
        if (!nameText.style.transition) {
            nameText.style.transition = 'all 0.25s ease';
            nameBg.style.transition = 'all 0.25s ease';
        }

        nameText.textContent = text;
        nameText.setAttribute('font-size', '48');
        nameText.setAttribute('font-weight', 'bold');
        nameText.setAttribute('y', '105');

        // 背景宽度用实际测量
        const textBBox = nameText.getBBox();
        const newWidth = Math.max(chatData.originalBgW ? parseFloat(chatData.originalBgW) + 15 : 60, textBBox.width + 30);
        nameBg.setAttribute('width', newWidth);
        nameBg.setAttribute('height', '130');   // 原80 + 上方35放名字 + 下方15间距
    } else {
        // 空内容：恢复原状但保留缓存
        chatData.smallNameEl?.remove();
        chatData.smallNameEl = null;
        nameText.textContent = chatData.originalName;
        nameText.setAttribute('font-size', '48');
        nameText.removeAttribute('font-weight');
        nameText.setAttribute('y', chatData.originalY);
        nameBg.setAttribute('height', chatData.originalBgH);
        nameBg.setAttribute('width', chatData.originalBgW);
        nameBg.setAttribute('y', chatData.originalBgY);
    }
}

function removeRemoteChatBubble(userId) {
    applyRemoteChatBubble({ id: userId, text: null });
}

// ── Replace a block tree (shared by create + update) ─────────────

function deleteTree(target, rootId) {
    const root = target.blocks._blocks[rootId];
    if (!root) return 0;
    const collectIds = (id, ids) => {
        const b = target.blocks._blocks[id];
        if (!b || ids.has(id)) return;
        ids.add(id);
        if (b.next) collectIds(b.next, ids);
        for (const input of Object.values(b.inputs || {})) {
            if (input.block) collectIds(input.block, ids);
            if (input.shadow) collectIds(input.shadow, ids);
        }
    };
    const ids = new Set();
    collectIds(rootId, ids);
    for (const id of ids) {
        delete target.blocks._blocks[id];
        const si = target.blocks._scripts.indexOf(id);
        if (si > -1) target.blocks._scripts.splice(si, 1);
    }
    return ids;
}

function replaceTree(target, xmlString, _rootId, isEditingTarget, oldRootId) {
    const blockObjs = parseXml(xmlString);
    if (blockObjs.length === 0) return;

    // 1. Find and delete ALL existing trees that overlap with new blocks
    const newIds = new Set(blockObjs.map(b => b.id));
    const rootsToDelete = new Set();
    for (const id of newIds) {
        if (target.blocks._blocks[id]) {
            let cur = id;
            while (target.blocks._blocks[cur]?.parent) {
                cur = target.blocks._blocks[cur].parent;
            }
            rootsToDelete.add(cur);
        }
    }
    if (oldRootId) rootsToDelete.add(oldRootId);

    // 2. 收集所有需要从 Blockly workspace 移除的 block ID（在 deleteTree 之前收集）
    let domIdsToDelete = [];
    if (isEditingTarget) {
        const ws = getWS();
        if (ws) {
            for (const rid of rootsToDelete) {
                const root = target.blocks._blocks[rid];
                if (!root) continue;
                const collectIds = (id, ids) => {
                    const b = target.blocks._blocks[id];
                    if (!b || ids.has(id)) return;
                    ids.add(id);
                    if (b.next) collectIds(b.next, ids);
                    for (const input of Object.values(b.inputs || {})) {
                        if (input.block) collectIds(input.block, ids);
                        if (input.shadow) collectIds(input.shadow, ids);
                    }
                };
                const ids = new Set();
                collectIds(rid, ids);
                for (const id of ids) {
                    if (ws.getBlockById(id)) domIdsToDelete.push(id);
                }
            }
        }
    }

    // 3. 从 VM 中删除旧树
    for (const rid of rootsToDelete) {
        deleteTree(target, rid);
    }

    // 4. 在 VM 中创建新 block
    for (const b of blockObjs) {
        if (!target.blocks._blocks[b.id]) {
            target.blocks.createBlock(b);
        }
    }

    // 5. 更新 Blockly workspace DOM（先 dispose 旧 block，再 create 新 block）
    if (!isEditingTarget) return;
    const ws = getWS();
    if (ws) {
        _Blockly.Events.disable();
        try {
            for (const id of domIdsToDelete) {
                const b = ws.getBlockById(id);
                if (b) b.dispose(false);
            }
            const dom = _Blockly.Xml.textToDom(`<xml>${xmlString}</xml>`);
            const bn = dom.querySelector('block');
            if (bn) {
                const px = parseFloat(bn.getAttribute('x')), py = parseFloat(bn.getAttribute('y'));
                const newBlock = _Blockly.Xml.domToBlock(bn, ws);
                if (newBlock && isFinite(px) && isFinite(py)) newBlock.moveBy(px, py);
            }
        } catch (e) { console.error("[协作] replaceTree 失败:", e); }
        finally { _Blockly.Events.enable(); }
        // replaceTree 后重新应用远端锁定遮罩（旧 svgGroup_ 已被 dispose）
        reapplyRemoteLocks();
    }
}

function applyDelete(target, op, isEditingTarget) {
    const ids = deleteTree(target, op.rootId);
    // 清理被删除积木的远端锁定
    for (const id of ids) _remoteLocks.delete(lockKey('block', id));
    if (!isEditingTarget) return;
    const ws = getWS();
    if (ws) {
        _Blockly.Events.disable();
        try {
            for (const id of ids) {
                const b = ws.getBlockById(id);
                if (b) b.dispose(false);
            }
        } finally { _Blockly.Events.enable(); }
    }
}

function applyMove(target, op, isEditingTarget) {
    const b = target.blocks._blocks[op.rootId];
    if (b) { b.x = op.x; b.y = op.y; }
    if (!isEditingTarget) return;
    const ws = getWS();
    if (ws) { const blk = ws.getBlockById(op.rootId); if (blk) { const cp = blk.getRelativeToSurfaceXY(); blk.moveBy(op.x - cp.x, op.y - cp.y); } }
}

function applyFieldChange(target, op) {
    const ws = getWS();
    for (const fc of op.fields) {
        const isVar = fc.name === 'VARIABLE' || fc.name === 'LIST' || fc.name === 'BROADCAST_OPTION';
        target.blocks.changeBlock({ id: fc.blockId, element: 'field', name: fc.name, value: isVar ? (fc.id || fc.value) : fc.value });
        if (ws) { const blk = ws.getBlockById(fc.blockId); if (blk) { try { blk.setFieldValue(fc.value, fc.name); } catch (e) { } } }
    }
}

function applyMutationChange(target, op, isEditingTarget) {
    target.blocks.changeBlock({ id: op.rootId, element: 'mutation', value: op.mutation });
    const xml = target.blocks.blockToXML(op.rootId, target.comments || {});
    if (xml) replaceTree(target, xml, op.rootId, isEditingTarget);
}

// ── Comment sync (full replacement, no ID/index issues) ─────────

function applyCommentSync(target, op, isEditingTarget) {
    const newComments = op.comments || [];
    const oldKeys = Object.keys(target.comments);

    // 1. Clear old comments from VM
    for (const key of oldKeys) delete target.comments[key];

    // 2. Create new comments in VM (preserve original IDs)
    for (const c of newComments) {
        const id = c.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        target.createComment(id, c.blockId || null, c.text || '',
            c.x || 0, c.y || 0, c.width || 100, c.height || 100, !!c.minimized);
    }

    // 3. Update Blockly DOM only for current editing target
    if (!isEditingTarget) return;
    const ws = getWS();
    if (!ws) return;
    try {
        _Blockly.Events.disable();

        // 3a. 移除所有 workspace comments（无 blockId 的注释）
        const existing = ws.getTopComments(true);
        for (const ec of existing) ec.dispose();

        // 3b. 处理 block comments（有 blockId 的注释）
        // 先移除所有积木上的旧注释
        const allBlocks = ws.getAllBlocks(false);
        for (const block of allBlocks) {
            if (block.comment) {
                block.comment.dispose();
                block.comment = null;
            }
        }

        // 3c. 重建所有注释
        for (const c of newComments) {
            const id = c.id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            if (c.blockId) {
                // Block comment：通过积木的 setCommentText 创建
                const block = ws.getBlockById(c.blockId);
                if (block) {
                    block.setCommentText(c.text || '', id, c.x, c.y, !!c.minimized);
                    if (block.comment && c.width && c.height) {
                        block.comment.setBubbleSize(c.width, c.height);
                    }
                }
            } else {
                // Workspace comment：独立创建
                if (!_Blockly.WorkspaceCommentSvg) continue;
                const comment = new _Blockly.WorkspaceCommentSvg(
                    ws, c.text || '', c.height || 100, c.width || 100, !!c.minimized, id
                );
                comment.moveBy(c.x || 0, c.y || 0);
                comment.initSvg();
            }
        }
        // 注释重建后重新应用远端锁定遮罩
        reapplyRemoteLocks();
    } catch (e) { console.error("[协作] 同步注释DOM失败:", e); }
    finally { _Blockly.Events.enable(); }
}

// ── Costume / Sound sync (index-based, in-place update) ─────────

function applyCostumeAdd(target, op) {
    const vm = target.runtime?.vm || window.vm;
    if (!vm || !op.data) { console.warn("[协作-造型] ADD 跳过: vm或data缺失"); return Promise.resolve(); }
    const runtime = vm.runtime;
    const storage = runtime && runtime.storage;
    if (!storage) { console.warn("[协作] storage 不可用，无法添加造型"); return Promise.resolve(); }
    try {
        const bin = atob(op.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const fmt = (op.dataFormat || '').toLowerCase();
        const assetType = fmt === 'svg' ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;
        const asset = storage.createAsset(assetType, op.dataFormat, bytes, null, true);
        const md5ext = `${asset.assetId}.${op.dataFormat}`;
        console.log(`[协作-造型] ADD target=${target.id} index=${op.index} name=${op.name} assetId=${asset.assetId} fmt=${fmt} size=${bytes.byteLength}`);
        const costumeObj = {
            name: op.name,
            assetId: asset.assetId,
            dataFormat: op.dataFormat,
            md5: md5ext,
            bitmapResolution: op.bitmapResolution || 2,
            rotationCenterX: op.rotationCenterX || 0,
            rotationCenterY: op.rotationCenterY || 0,
            asset: asset,
        };
        return vm.addCostume(md5ext, costumeObj, target.id).then(() => {
            const costumes = target.sprite?.costumes || [];
            const insertIdx = (op.index !== undefined) ? Math.min(op.index, costumes.length) : costumes.length;
            const newIdx = costumes.length - 1;
            if (newIdx !== insertIdx && newIdx >= 0) {
                target.reorderCostume(newIdx, insertIdx);
            }
        }).catch(e => console.error("[协作] 添加造型失败:", e));
    } catch (e) { console.error("[协作] 创建造型 asset 失败:", e); return Promise.resolve(); }
}

function applyCostumeUpdate(target, op) {
    // 原地修改指定索引的造型，模仿 vm._updateSvg / vm._updateBitmap
    // 支持格式转换（SVG<->Bitmap）
    // 销毁旧 skin 并创建新 skin，使 skinId 变化触发画板刷新
    const vm = target.runtime?.vm || window.vm;
    if (!vm || !op.data) { console.warn("[协作-造型] UPDATE 跳过: vm或data缺失"); return; }
    const runtime = vm.runtime;
    const storage = runtime && runtime.storage;
    const renderer = runtime && runtime.renderer;
    if (!storage || !renderer) { console.warn("[协作] storage/renderer 不可用，无法更新造型"); return; }
    const costumes = target.sprite?.costumes || [];
    if (op.index === undefined || op.index < 0 || op.index >= costumes.length) {
        console.warn(`[协作-造型] UPDATE 跳过: index=${op.index} 越界 costumes.length=${costumes.length}`);
        return;
    }
    const costume = costumes[op.index];
    if (!costume) { console.warn(`[协作-造型] UPDATE 跳过: index=${op.index} costume为null`); return; }
    console.log(`[协作-造型] UPDATE target=${target.id} index=${op.index} name=${op.name} oldAssetId=${costume.assetId} newAssetId=${op.assetId} fmt=${op.dataFormat} oldSkinId=${costume.skinId}`);
    try {
        const bin = atob(op.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const fmt = (op.dataFormat || '').toLowerCase();

        // 更新元数据
        if (op.name !== undefined) costume.name = op.name;
        if (op.rotationCenterX !== undefined) costume.rotationCenterX = op.rotationCenterX;
        if (op.rotationCenterY !== undefined) costume.rotationCenterY = op.rotationCenterY;

        // 销毁旧 skin 并创建新 skin（skinId 变化 → imageId 变化 → 画板刷新）
        if (costume.skinId != null) renderer.destroySkin(costume.skinId);

        if (fmt === 'svg') {
            // SVG：同步创建 skin
            const textDecoder = new TextDecoder();
            const svgString = textDecoder.decode(bytes);
            costume.dataFormat = storage.DataFormat.SVG;
            costume.bitmapResolution = 1;
            costume.skinId = renderer.createSVGSkin(svgString, [costume.rotationCenterX, costume.rotationCenterY]);
            costume.size = renderer.getSkinSize(costume.skinId);
            costume.asset = storage.createAsset(storage.AssetType.ImageVector, costume.dataFormat, (new TextEncoder()).encode(svgString), null, true);
            costume.assetId = costume.asset.assetId;
            costume.md5 = `${costume.assetId}.${costume.dataFormat}`;
            if (target.currentCostume === op.index) {
                renderer.updateDrawableSkinId(target.drawableID, costume.skinId);
            }
            vm.emitTargetsUpdate();
        } else {
            // Bitmap：需要异步加载图片后创建 skin
            costume.dataFormat = storage.DataFormat.PNG;
            costume.bitmapResolution = op.bitmapResolution ?? costume.bitmapResolution ?? 2;
            costume.asset = storage.createAsset(storage.AssetType.ImageBitmap, costume.dataFormat, bytes, null, true);
            costume.assetId = costume.asset.assetId;
            costume.md5 = `${costume.assetId}.${costume.dataFormat}`;
            const blob = new Blob([bytes], { type: 'image/png' });
            const img = new Image();
            img.onload = () => {
                costume.skinId = renderer.createBitmapSkin(img, costume.bitmapResolution, [costume.rotationCenterX / costume.bitmapResolution, costume.rotationCenterY / costume.bitmapResolution]);
                costume.size = renderer.getSkinSize(costume.skinId);
                if (target.currentCostume === op.index) {
                    renderer.updateDrawableSkinId(target.drawableID, costume.skinId);
                }
                vm.emitTargetsUpdate();
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(blob);
        }
    } catch (e) { console.error("[协作] 更新造型失败:", e); }
}

function applyCostumeDelete(target, op) {
    if (op.index !== undefined && op.index >= 0) {
        const costumes = target.sprite?.costumes || [];
        if (op.index < costumes.length) {
            console.log(`[协作-造型] DELETE target=${target.id} index=${op.index} name=${costumes[op.index].name}`);
            target.deleteCostume(op.index);
        }
    }
}

function applySoundAdd(target, op) {
    const vm = target.runtime?.vm || window.vm;
    if (!vm || !op.data) { console.warn("[协作-音频] ADD 跳过: vm或data缺失"); return Promise.resolve(); }
    const runtime = vm.runtime;
    const storage = runtime && runtime.storage;
    if (!storage) { console.warn("[协作] storage 不可用，无法添加音频"); return Promise.resolve(); }
    try {
        const bin = atob(op.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const asset = storage.createAsset(storage.AssetType.Sound, op.dataFormat, bytes, null, true);
        console.log(`[协作-音频] ADD target=${target.id} index=${op.index} name=${op.name} assetId=${asset.assetId} fmt=${op.dataFormat} size=${bytes.byteLength}`);
        const soundObj = {
            name: op.name,
            assetId: asset.assetId,
            dataFormat: op.dataFormat,
            md5: `${asset.assetId}.${op.dataFormat}`,
            rate: op.rate || 44100,
            sampleCount: op.sampleCount || 0,
            asset: asset,
        };
        return vm.addSound(soundObj, target.id).then(() => {
            const sounds = target.sprite?.sounds || [];
            const insertIdx = (op.index !== undefined) ? Math.min(op.index, sounds.length) : sounds.length;
            const newIdx = sounds.length - 1;
            if (newIdx !== insertIdx && newIdx >= 0) {
                target.reorderSound(newIdx, insertIdx);
            }
        }).catch(e => console.error("[协作] 添加音频失败:", e));
    } catch (e) { console.error("[协作] 创建音频 asset 失败:", e); return Promise.resolve(); }
}

function applySoundUpdate(target, op) {
    // 原地修改指定索引的音频，模仿 vm.updateSoundBuffer
    const vm = target.runtime?.vm || window.vm;
    if (!vm || !op.data) { console.warn("[协作-音频] UPDATE 跳过: vm或data缺失"); return; }
    const runtime = vm.runtime;
    const storage = runtime && runtime.storage;
    if (!storage) { console.warn("[协作] storage 不可用，无法更新音频"); return; }
    const sounds = target.sprite?.sounds || [];
    if (op.index === undefined || op.index < 0 || op.index >= sounds.length) {
        console.warn(`[协作-音频] UPDATE 跳过: index=${op.index} 越界 sounds.length=${sounds.length}`);
        return;
    }
    const sound = sounds[op.index];
    if (!sound) { console.warn(`[协作-音频] UPDATE 跳过: index=${op.index} sound为null`); return; }
    console.log(`[协作-音频] UPDATE target=${target.id} index=${op.index} name=${op.name} oldAssetId=${sound.assetId} newAssetId=${op.assetId} fmt=${op.dataFormat}`);
    try {
        const bin = atob(op.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        // 更新元数据
        if (op.name !== undefined) sound.name = op.name;
        if (op.rate !== undefined) sound.rate = op.rate;
        if (op.sampleCount !== undefined) sound.sampleCount = op.sampleCount;
        // 更新 asset
        sound.asset = storage.createAsset(storage.AssetType.Sound, op.dataFormat || sound.dataFormat, bytes, null, true);
        sound.assetId = sound.asset.assetId;
        sound.dataFormat = op.dataFormat || sound.dataFormat;
        sound.md5 = `${sound.assetId}.${sound.dataFormat}`;
        vm.emitTargetsUpdate();
    } catch (e) { console.error("[协作] 更新音频失败:", e); }
}

function applySoundDelete(target, op) {
    if (op.index !== undefined && op.index >= 0) {
        const sounds = target.sprite?.sounds || [];
        if (op.index < sounds.length) {
            console.log(`[协作-音频] DELETE target=${target.id} index=${op.index} name=${sounds[op.index].name}`);
            target.deleteSound(op.index);
        }
    }
}

// ── Flush ────────────────────────────────────────────────────────

async function flush(rtc) {
    if (_pending.size === 0 && !_def) return;
    const newOps = Array.from(_pending.values()); _pending.clear();
    const ops = _def ? _def.concat(newOps) : newOps; _def = null;

    if (!rtc || !rtc._vm) return;
    const vm = rtc._vm;

    // Defer during local drag
    const editIdx = vm.runtime.targets.findIndex(t => vm.runtime._editingTarget && t.id === vm.runtime._editingTarget.id);
    const ws = _Blockly && _Blockly.getMainWorkspace();
    if (ws && ws.isDragging()) {
        for (const op of ops) { if (op.targetIndex === editIdx) { _def = ops; if (!_defRaf) _defRaf = requestAnimationFrame(() => { _defRaf = null; flush(rtc); }); return; } }
    }

    // Flush local debounce before applying remote
    if (rtc._updateTimer) { clearTimeout(rtc._updateTimer); rtc._updateTimer = null; rtc.updateProject(); }

    const opId = rtc.startIgnoreUpdate('flush');
    try {
        const byTarget = new Map();
        for (const op of ops) { if (!byTarget.has(op.targetIndex)) byTarget.set(op.targetIndex, []); byTarget.get(op.targetIndex).push(op); }
        for (const [ti, tops] of byTarget) {
            const target = vm.runtime.targets[ti];
            if (!target?.blocks) continue;

            const isEditingTarget = vm.runtime._editingTarget && target.id === vm.runtime._editingTarget.id;

            const order = { delete: 0, fieldChange: 1, mutationChange: 2, move: 3, create: 4, update: 5, commentSync: 6, costumeUpdate: 7, costumeDelete: 7, costumeAdd: 8, soundUpdate: 8, soundDelete: 8, soundAdd: 9 };
            tops.sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));
            target.blocks.suppressProjectChanged();
            try {
                const assetPromises = [];
                for (const op of tops) {
                    switch (op.type) {
                        case 'delete': applyDelete(target, op, isEditingTarget); break;
                        case 'move': applyMove(target, op, isEditingTarget); break;
                        case 'create': replaceTree(target, op.xml, op.rootId, isEditingTarget); break;
                        case 'update': replaceTree(target, op.xml, op.rootId, isEditingTarget, op.oldRootId); break;
                        case 'fieldChange': applyFieldChange(target, op); break;
                        case 'mutationChange': applyMutationChange(target, op, isEditingTarget); break;
                        case 'commentSync': applyCommentSync(target, op, isEditingTarget); break;
                        case 'costumeAdd': { const p = applyCostumeAdd(target, op); if (p) assetPromises.push(p); break; }
                        case 'costumeUpdate': applyCostumeUpdate(target, op); break;
                        case 'costumeDelete': applyCostumeDelete(target, op); break;
                        case 'soundAdd': { const p = applySoundAdd(target, op); if (p) assetPromises.push(p); break; }
                        case 'soundUpdate': applySoundUpdate(target, op); break;
                        case 'soundDelete': applySoundDelete(target, op); break;
                    }
                }
                // 等待所有异步的 addCostume/addSound 完成后再更新缓存，防止缓存与实际状态不一致导致循环广播
                if (assetPromises.length > 0) await Promise.all(assetPromises);
                target.blocks.resetCache();
            } finally { target.blocks.resumeProjectChanged(); }

            if (!rtc._scriptBlockCache.has(target.id)) rtc._scriptBlockCache.set(target.id, new Map());
            const cache = rtc._scriptBlockCache.get(target.id);
            for (const op of tops) {
                switch (op.type) {
                    case 'delete': cache.delete(op.rootId); break;
                    default:
                        if (op.rootId) {
                            try {
                                const xml = target.blocks.blockToXML(op.rootId, target.comments || {});
                                if (xml) cache.set(op.rootId, xml);
                            } catch (e) { }
                        }
                }
            }

            // Sync comment cache (must match updateProject's format exactly)
            const sortedKeys = Object.keys(target.comments).sort();
            const liveList = sortedKeys.map(k => {
                const c = target.comments[k];
                return { id: k, text: c.text, x: c.x, y: c.y, width: c.width, height: c.height, minimized: c.minimized, blockId: c.blockId };
            });
            rtc._commentCache.set(target.id, JSON.stringify(liveList));

            // Update costume/sound caches (含 assetId，与检测端快照格式一致)
            if (rtc._costumeCache) {
                const costumes = target.sprite?.costumes || [];
                rtc._costumeCache.set(target.id, costumes.map(c => ({
                    assetId: c.assetId,
                    name: c.name, dataFormat: c.dataFormat,
                    bitmapResolution: c.bitmapResolution,
                    rotationCenterX: c.rotationCenterX, rotationCenterY: c.rotationCenterY,
                })));
            }
            if (rtc._soundCache) {
                const sounds = target.sprite?.sounds || [];
                rtc._soundCache.set(target.id, sounds.map(s => ({
                    assetId: s.assetId,
                    name: s.name, dataFormat: s.dataFormat,
                    rate: s.rate, sampleCount: s.sampleCount,
                })));
            }
        }
    } finally { rtc.endIgnoreUpdate(opId); }
}

function renderSpriteList(rtc) {
    if (!rtc.state.clientId || !rtc.members || rtc.members.length === 0) return;

    const itemsWrapper = document.querySelector('[class*="sprite-selector_items-wrapper"]');
    if (!itemsWrapper) return;

    // 清理旧的成员照片
    document.querySelectorAll(`[class*="${idHead}member-photo"]`).forEach(ele => ele.remove());

    // editingIndex: 0 = 背景（stage），1+ = sprite（targets 数组索引）
    // items-wrapper 不含背景，第 0 个子节点对应 targets[1]
    const childNodes = Array.from(itemsWrapper.children).filter(
        el => el.className && el.className.includes('sprite-wrapper')
    );

    childNodes.forEach((spriteEl, idx) => {
        const editingIndex = idx + 1; // items-wrapper 不含背景，0 = 背景，1+ = sprite
        const members = rtc.members.filter(mem => mem.editingIndex === editingIndex);
        members.forEach(mem => {
            if (mem.cid === rtc.state.clientId) return; // 不显示自己
            spriteEl.style.position = 'relative';
            const memberPhoto = document.createElement('div');
            memberPhoto.className = `${idHead}member-photo`;
            memberPhoto.dataset.cid = mem.cid;
            memberPhoto.textContent = mem.userName;
            spriteEl.appendChild(memberPhoto);
        });
    });
}

// ── Message router ───────────────────────────────────────────────

export function createHandler({ addon, console, sendToPeer, rtc, Blockly }) {
    _Blockly = Blockly;
    _vm = addon.tab.traps.vm;
    _rtc = rtc;
    const vm = _vm;

    // 监听 targetsUpdate：React 重建 sprite 列表 DOM 后重新渲染成员照片
    _vm.on('targetsUpdate', () => {
        // setTimeout(0) 确保 React 渲染完成后再操作 DOM
        setTimeout(() => {
            if (_rtc) renderSpriteList(_rtc);
        }, 0);
    });

    return async function handlePeerMessage(peerId, msgs) {
        const data = JSON.parse(msgs);
        switch (data.type) {
            case SERVER_OPCODE.SNAPSHOT: {
                // 清除加入房间时的超时定时器
                if (rtc._snapshotTimeout) { clearTimeout(rtc._snapshotTimeout); rtc._snapshotTimeout = null; }
                const bin = atob(data.data); const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                setURLParamsFromSearchString(data.config);
                const oldSt = ReduxStore.state.scratchGui.projectState.loadingState;
                ReduxStore.state.scratchGui.projectTitle = data.projectName;
                ReduxStore.dispatch(openLoadingProject());
                const ua = requestProjectUpload(oldSt); if (ua) ReduxStore.dispatch(ua);
                const ls = ReduxStore.state.scratchGui.projectState.loadingState;
                let ok = false;
                const snapshotOpId = rtc.startIgnoreUpdate('snapshot');
                clearAllRemoteLocks();
                try {
                    localStorage.setItem("IM_SURE_IT_WONT_BREAK_MY_PROJECT", true);
                    // 先加载 Host 已安装但项目数据未包含的扩展。
                    // runtime.dispose() 不清除扩展，loadProject 的 _loadExtensions 会跳过已加载项。
                    if (data.extensions && data.extensions.length > 0) {
                        for (const ext of data.extensions) {
                            if (!vm.extensionManager.isExtensionLoaded(ext.id)) {
                                try {
                                    if (ext.url) {
                                        await vm.extensionManager.loadExtensionURL(ext.url, true);
                                    } else {
                                        vm.extensionManager.loadExtensionIdSync(ext.id);
                                    }
                                } catch (e) {
                                    console.error("[协作] 加载快照中的扩展失败:", ext.id, e);
                                }
                            }
                        }
                    }
                    await vm.loadProject(bytes.buffer);
                    vm.renderer.draw(); ok = true;
                    document.title = `${data.projectName} - ${APP_NAME}`;
                } finally {
                    const d = onLoadedProject(ls, false, ok); if (d) ReduxStore.dispatch(d);
                    ReduxStore.dispatch(closeLoadingProject());
                }
                setTimeout(() => {
                    // Rebuild all caches from current state after snapshot load
                    for (const target of vm.runtime.targets) {
                        // Block cache + fingerprint cache
                        if (target.blocks && target.blocks._scripts) {
                            const nc = new Map();
                            for (const rid of target.blocks._scripts) {
                                try { nc.set(rid, target.blocks.blockToXML(rid, target.comments || {})); } catch (e) { }
                            }
                            rtc._scriptBlockCache.set(target.id, nc);
                        }
                        // Comment cache
                        const sortedKeys = Object.keys(target.comments || {}).sort();
                        const liveList = sortedKeys.map(k => {
                            const c = target.comments[k];
                            return { text: c.text, x: c.x, y: c.y, width: c.width, height: c.height, minimized: c.minimized, blockId: c.blockId };
                        });
                        rtc._commentCache.set(target.id, JSON.stringify(liveList));
                        // Costume cache
                        const costumes = target.sprite?.costumes || [];
                        rtc._costumeCache.set(target.id, costumes.map(c => ({
                            assetId: c.assetId,
                            name: c.name, dataFormat: c.dataFormat,
                            bitmapResolution: c.bitmapResolution,
                            rotationCenterX: c.rotationCenterX, rotationCenterY: c.rotationCenterY,
                        })));
                        // Sound cache
                        const sounds = target.sprite?.sounds || [];
                        rtc._soundCache.set(target.id, sounds.map(s => ({
                            assetId: s.assetId,
                            name: s.name, dataFormat: s.dataFormat,
                            rate: s.rate, sampleCount: s.sampleCount,
                        })));
                    }
                    // 重建 sprite ID 缓存
                    rtc._spriteIdCache = new Set(vm.runtime.targets.map(t => t.id));
                    // 重建 extension 缓存
                    rtc._extensionCache = new Set(vm.extensionManager._loadedExtensions.keys());
                    rtc.endIgnoreUpdate(snapshotOpId);
                    // Member 加载完 snapshot 后发送自己的 editingIndex 给 Host
                    // （snapshot 加载期间 switchTarget 被 ignore 跳过了）
                    if (!rtc._isHost) {
                        rtc.switchTarget();
                    }
                    renderSpriteList(rtc);
                }, 200);
                return;
            }
            case SERVER_OPCODE.POINTER: {
                if (data.workspaceIndex !== rtc.editingTargetIndex) break;
                const ws2 = _Blockly.getMainWorkspace(); if (!ws2) break;
                const svg = ws2.getParentSvg(); if (!svg) break;
                let pc = svg.querySelector(`.${idHead}pointer-container`);
                if (!pc) {
                    pc = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    pc.classList.add(`${idHead}pointer-container`);
                    const ct = ws2.getCanvas().getAttribute("transform"); if (ct) pc.setAttribute("transform", ct);
                    svg.appendChild(pc); setupScaleObserver();
                }
                const fs = 0.3 / ws2.scale;
                const old = document.querySelector(`.${idHead}pointer[id="${data.id}"]`);
                if (old) { old.setAttribute("transform", `translate(${data.position.x},${data.position.y}) scale(${fs})`); }
                else {
                    const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    el.innerHTML = pointerSVG(data.themeColor || '#0099ff', data.name); el.id = data.id; el.classList.add(`${idHead}pointer`);
                    el.setAttribute("transform", `translate(${data.position.x},${data.position.y}) scale(${fs})`);
                    pc.appendChild(el);
                    const te = el.querySelector(".sa-collab-name-text"), be = el.querySelector(".sa-collab-name-bg");
                    if (te && be) { const b = te.getBBox(); be.setAttribute("width", b.width + 20); }
                }
                break;
            }
            case SERVER_OPCODE.POINTER_LEAVE: {
                const myTargetId = rtc._vm.runtime._editingTarget?.id;
                if (data.targetId !== myTargetId) break;
                document.querySelectorAll(`.${idHead}pointer[id="${data.id}"]`).forEach(e => e.remove());
                removeRemoteChatBubble(data.id);
                break;
            }
            case SERVER_OPCODE.CHAT_MESSAGE: {
                if (data.id === rtc.state.clientId) break;
                applyRemoteChatBubble(data);
                break;
            }
            case SERVER_OPCODE.BLOCK_CREATE:
                if (data.targetIndex !== undefined && data.xml && data.rootId)
                    enqueue({ type: 'create', targetIndex: data.targetIndex, rootId: data.rootId, xml: data.xml }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_UPDATE:
                if (data.targetIndex !== undefined && data.xml)
                    enqueue({ type: 'update', targetIndex: data.targetIndex, rootId: data.rootId, oldRootId: data.oldRootId, xml: data.xml }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_MOVE:
                if (data.targetIndex !== undefined && data.rootId)
                    enqueue({ type: 'move', targetIndex: data.targetIndex, rootId: data.rootId, x: data.x, y: data.y }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_DELETE:
                if (data.targetIndex !== undefined) {
                    const rids = data.rootIds || (data.rootId ? [data.rootId] : []);
                    for (const rid of rids) enqueue({ type: 'delete', targetIndex: data.targetIndex, rootId: rid }, rtc);
                }
                break;
            case SERVER_OPCODE.BLOCK_FIELD_CHANGE:
                if (data.targetIndex !== undefined && data.fields && data.rootId)
                    enqueue({ type: 'fieldChange', targetIndex: data.targetIndex, rootId: data.rootId, fields: data.fields }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_MUTATION_CHANGE:
                if (data.targetIndex !== undefined && data.rootId && data.mutation)
                    enqueue({ type: 'mutationChange', targetIndex: data.targetIndex, rootId: data.rootId, mutation: data.mutation }, rtc);
                break;
            // ── Comment sync ──
            case SERVER_OPCODE.COMMENT_SYNC:
                if (data.targetIndex !== undefined && data.comments)
                    enqueue({ type: 'commentSync', targetIndex: data.targetIndex, comments: data.comments }, rtc);
                break;
            case SERVER_OPCODE.EXTENSION_ADD:
                if (data.id) {
                    const extOpId = rtc.startIgnoreUpdate(`ext_add:${data.id}`);
                    const loadPromise = data.url
                        ? rtc._vm.extensionManager.loadExtensionURL(data.url, true)
                        : rtc._vm.extensionManager.loadExtensionIdSync(data.id);
                    Promise.resolve(loadPromise).then(() => {
                        console.log(`[协作] extension loaded: ${data.id}`);
                    }).catch(e => {
                        console.error("[协作] 加载扩展失败:", e);
                    }).finally(() => rtc.endIgnoreUpdate(extOpId));
                }
                break;
            case SERVER_OPCODE.EXTENSION_REMOVE:
                if (data.id && rtc._vm.extensionManager.isExtensionLoaded(data.id)) {
                    rtc._vm.extensionManager.unloadExtension(data.id);
                }
                break;
            case SERVER_OPCODE.SPRITE_DELETE: {
                const target = rtc._vm.runtime.targets[data.targetIndex];
                if (target) {
                    const spriteOpId = rtc.startIgnoreUpdate(`sprite_delete:${data.targetIndex}`);
                    try {
                        const spriteId = target.id;
                        rtc._vm.deleteSprite(spriteId);
                        // 立即更新 sprite ID 缓存
                        if (rtc._spriteIdCache) {
                            rtc._spriteIdCache.delete(spriteId);
                        }
                        rtc.endIgnoreUpdate(spriteOpId);
                    } catch (e) {
                        console.error("[协作] 角色删除失败:", e);
                        rtc.endIgnoreUpdate(spriteOpId);
                    }
                }
                break;
            }
            case SERVER_OPCODE.SPRITE_ADD:
                if (data.spriteData) {
                    const spriteOpId = rtc.startIgnoreUpdate(`sprite_add:${data.targetIndex}`);
                    try {
                        // 保存当前编辑目标，阻止 addSprite 自动切换工作区到新角色
                        const prevEditingTarget = vm.runtime._editingTarget;
                        const origEmitWorkspaceUpdate = vm.emitWorkspaceUpdate;
                        vm.emitWorkspaceUpdate = () => { };
                        const b2 = atob(data.spriteData); const bytes2 = new Uint8Array(b2.length);
                        for (let i = 0; i < b2.length; i++) bytes2[i] = b2.charCodeAt(i);
                        await vm.addSprite(bytes2.buffer, false);
                        vm.emitWorkspaceUpdate = origEmitWorkspaceUpdate;
                        // 恢复 runtime 编辑目标，不影响 GUI 但保持内部状态一致
                        if (prevEditingTarget) {
                            vm.runtime.setEditingTarget(prevEditingTarget);
                        }
                        // 立即更新 sprite ID 缓存，确保 updateProject 不会检测到差异
                        if (rtc._spriteIdCache) {
                            rtc._spriteIdCache = new Set(rtc._vm.runtime.targets.map(t => t.id));
                        }
                        // 立即结束忽略，不再使用 setTimeout
                        rtc.endIgnoreUpdate(spriteOpId);
                    } catch (e) {
                        console.error("[协作] 角色添加失败:", e);
                        rtc.endIgnoreUpdate(spriteOpId);
                    }
                    return;
                }
                break;
            case SERVER_OPCODE.COSTUME_ADD:
                if (data.targetIndex !== undefined && data.data)
                    enqueue({ type: 'costumeAdd', targetIndex: data.targetIndex, index: data.index, name: data.name, assetId: data.assetId, dataFormat: data.dataFormat, bitmapResolution: data.bitmapResolution, rotationCenterX: data.rotationCenterX, rotationCenterY: data.rotationCenterY, data: data.data }, rtc);
                break;
            case SERVER_OPCODE.COSTUME_UPDATE:
                if (data.targetIndex !== undefined && data.data)
                    enqueue({ type: 'costumeUpdate', targetIndex: data.targetIndex, index: data.index, name: data.name, assetId: data.assetId, dataFormat: data.dataFormat, bitmapResolution: data.bitmapResolution, rotationCenterX: data.rotationCenterX, rotationCenterY: data.rotationCenterY, data: data.data }, rtc);
                break;
            case SERVER_OPCODE.COSTUME_DELETE:
                if (data.targetIndex !== undefined && data.index !== undefined)
                    enqueue({ type: 'costumeDelete', targetIndex: data.targetIndex, index: data.index }, rtc);
                break;
            case SERVER_OPCODE.SOUND_ADD:
                if (data.targetIndex !== undefined && data.data)
                    enqueue({ type: 'soundAdd', targetIndex: data.targetIndex, index: data.index, name: data.name, assetId: data.assetId, dataFormat: data.dataFormat, rate: data.rate, sampleCount: data.sampleCount, data: data.data }, rtc);
                break;
            case SERVER_OPCODE.SOUND_UPDATE:
                if (data.targetIndex !== undefined && data.data)
                    enqueue({ type: 'soundUpdate', targetIndex: data.targetIndex, index: data.index, name: data.name, assetId: data.assetId, dataFormat: data.dataFormat, rate: data.rate, sampleCount: data.sampleCount, data: data.data }, rtc);
                break;
            case SERVER_OPCODE.SOUND_DELETE:
                if (data.targetIndex !== undefined && data.index !== undefined)
                    enqueue({ type: 'soundDelete', targetIndex: data.targetIndex, index: data.index }, rtc);
                break;
            case SERVER_OPCODE.EDIT_LOCK:
                if (data.lockType && data.lockId && data.userId !== rtc.state.clientId)
                    applyRemoteLock(data.lockType, data.lockId, data.userName || '?', data.userId, !!data.noLabel);
                break;
            case SERVER_OPCODE.EDIT_UNLOCK:
                if (data.lockType && data.lockId && data.userId !== rtc.state.clientId)
                    removeRemoteLock(data.lockType, data.lockId);
                break;
            case SERVER_OPCODE.BLOCK_DRAG_START:
                if (data.targetIndex === rtc.editingTargetIndex && data.xml && data.userId) {
                    showDragGhost(data.userId, data.xml, data.x, data.y, data.offsetX, data.offsetY);
                }
                break;
            case SERVER_OPCODE.BLOCK_DRAG_MOVE:
                if (data.targetIndex === rtc.editingTargetIndex && data.userId) {
                    updateDragGhostPosition(data.userId, data.x, data.y);
                }
                break;
            case SERVER_OPCODE.BLOCK_DRAG_END:
                if (data.userId) removeDragGhost(data.userId);
                break;
            case SERVER_OPCODE.PING: sendToPeer(peerId, { type: SERVER_OPCODE.PONG }); break;
            case SERVER_OPCODE.KICK:
                if (data.targetId === rtc.state.clientId) {
                    rtc.exit(rtc);
                }
                break;
            case SERVER_OPCODE.SWITCH_TARGET:
                // 只有 Host 会收到 SWITCH_TARGET（非 Host 发出的）
                if (rtc._isHost) {
                    const member = rtc.members.find(m => m.cid === data.id);
                    if (member) {
                        member.editingIndex = data.index;
                        rtc._broadcastMembersSync();
                        renderSpriteList(rtc);
                    }
                }
                break;
            case SERVER_OPCODE.MEMBERS_SYNC:
                // 非 Host 接收 Host 广播的完整成员列表
                if (!rtc._isHost && Array.isArray(data.members)) {
                    rtc.members = data.members;
                    renderSpriteList(rtc);
                }
                break;
        }
    };
}
