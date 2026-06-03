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
                if (!cbn && csn) cbn = csn;
                let cb = null, cs = null;
                if (cbn) { const co = xmlDomToBlockObj(cbn, blocks, false, id); if (co) { blocks[co.id] = co; cb = co.id; } }
                if (csn && cbn !== csn) { const so = xmlDomToBlockObj(csn, blocks, false, id); if (so) { blocks[so.id] = so; cs = so.id; } }
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
    if (tn === 'block' || tn === 'shadow') { const o = xmlDomToBlockObj(rn, blocks, true, null); if (o) blocks[o.id] = o; }
    return Object.values(blocks);
}

// ── Batching ─────────────────────────────────────────────────────

const _pending = new Map(); let _raf = null, _def = null, _defRaf = null;

function enqueue(op, rtc) {
    _pending.set(`${op.targetIndex}:${op.rootId || 'unknown'}`, op);
    if (!_raf) _raf = requestAnimationFrame(() => { _raf = null; flush(rtc); });
}

function getWS() { return _Blockly ? _Blockly.getMainWorkspace() : null; }

// ── Replace a block tree (shared by create + update) ─────────────

function replaceTree(target, xmlString, rootId, isEditingTarget) {
    const blockObjs = parseXml(xmlString);
    if (blockObjs.length === 0) return;

    // Remove old tree from _blocks + _scripts
    for (const b of blockObjs) {
        delete target.blocks._blocks[b.id];
        const si = target.blocks._scripts.indexOf(b.id);
        if (si > -1) target.blocks._scripts.splice(si, 1);
    }
    // Create from XML — createBlock handles _blocks + _scripts
    for (const b of blockObjs) target.blocks.createBlock(b);

    // Only update Blockly workspace DOM if this target is currently being edited
    // Prevents cross-sprite contamination (e.g., sprite A's blocks appearing in sprite B's workspace)
    if (!isEditingTarget) return;

    const ws = getWS();
    if (ws && rootId) {
        const old = ws.getBlockById(rootId);
        _Blockly.Events.disable();
        try {
            if (old) old.dispose(false);
            const dom = _Blockly.Xml.textToDom(`<xml>${xmlString}</xml>`);
            const bn = dom.querySelector('block, shadow');
            if (bn) {
                const px = parseFloat(bn.getAttribute('x')), py = parseFloat(bn.getAttribute('y'));
                const newBlock = _Blockly.Xml.domToBlock(bn, ws);
                if (newBlock && isFinite(px) && isFinite(py)) newBlock.moveBy(px, py);
            }
        } catch (e) { console.error("[协作] replaceTree 失败:", e); }
        finally { _Blockly.Events.enable(); }
    }
}

function applyDelete(target, op, isEditingTarget) {
    target.blocks.deleteBlock(op.rootId, false);
    if (!isEditingTarget) return;
    const ws = getWS();
    if (ws) { const b = ws.getBlockById(op.rootId); if (b) { _Blockly.Events.disable(); try { b.dispose(true); } finally { _Blockly.Events.enable(); } } }
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
        if (ws) { const blk = ws.getBlockById(fc.blockId); if (blk) { try { blk.setFieldValue(fc.value, fc.name); } catch (e) {} } }
    }
}

function applyMutationChange(target, op) {
    target.blocks.changeBlock({ id: op.rootId, element: 'mutation', value: op.mutation });
    const xml = target.blocks.blockToXML(op.rootId, target.comments || {});
    if (xml) replaceTree(target, xml, op.rootId);
}

// ── Comment sync (full replacement, no ID/index issues) ─────────

function applyCommentSync(target, op, isEditingTarget) {
    const newComments = op.comments || [];
    const oldKeys = Object.keys(target.comments);

    // 1. Clear old comments from VM
    for (const key of oldKeys) delete target.comments[key];

    // 2. Create new comments in VM (with fresh IDs)
    for (const c of newComments) {
        const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        target.createComment(id, c.blockId || null, c.text || '',
            c.x || 0, c.y || 0, c.width || 100, c.height || 100, !!c.minimized);
    }

    // 3. Update Blockly DOM only for current editing target
    if (!isEditingTarget) return;
    const ws = getWS();
    if (!ws) return;
    try {
        _Blockly.Events.disable();
        // Remove all existing workspace comments
        const existing = ws.getTopComments(true);
        for (const ec of existing) ec.dispose();
        // Recreate all comments
        for (const c of newComments) {
            if (!_Blockly.WorkspaceCommentSvg) continue;
            const comment = new _Blockly.WorkspaceCommentSvg(
                ws, c.text || '', c.height || 100, c.width || 100, !!c.minimized,
                `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
            );
            comment.moveBy(c.x || 0, c.y || 0);
            comment.initSvg();
        }
    } catch (e) { console.error("[协作] 同步注释DOM失败:", e); }
    finally { _Blockly.Events.enable(); }
}

// ── Flush ────────────────────────────────────────────────────────

function flush(rtc) {
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

    rtc.onIngoreUpdate(true);
    try {
        const byTarget = new Map();
        for (const op of ops) { if (!byTarget.has(op.targetIndex)) byTarget.set(op.targetIndex, []); byTarget.get(op.targetIndex).push(op); }
        for (const [ti, tops] of byTarget) {
            const target = vm.runtime.targets[ti];
            if (!target?.blocks) continue;

            // Strict target isolation: only update Blockly DOM for the currently edited target
            // This prevents cross-sprite contamination where sprite A's blocks appear in sprite B's workspace
            const isEditingTarget = vm.runtime._editingTarget && target.id === vm.runtime._editingTarget.id;

            const order = { delete: 0, fieldChange: 1, mutationChange: 2, move: 3, create: 4, update: 5,
                commentDelete: -1, commentMove: 0.5, commentCreate: 4.5, commentUpdate: 5.5 };
            tops.sort((a, b) => (order[a.type] || 9) - (order[b.type] || 9));
            target.blocks.suppressProjectChanged();
            try {
                for (const op of tops) {
                    switch (op.type) {
                        case 'delete': applyDelete(target, op, isEditingTarget); break;
                        case 'move': applyMove(target, op, isEditingTarget); break;
                        case 'create': replaceTree(target, op.xml, op.rootId, isEditingTarget); break;
                        case 'update': replaceTree(target, op.xml, op.rootId, isEditingTarget); break;
                        case 'fieldChange': applyFieldChange(target, op); break;
                        case 'mutationChange': applyMutationChange(target, op); break;
                        case 'commentSync': applyCommentSync(target, op, isEditingTarget); break;
                    }
                }
                target.blocks.resetCache();
            } finally { target.blocks.resumeProjectChanged(); }

            if (!rtc._scriptBlockCache.has(target.id)) rtc._scriptBlockCache.set(target.id, new Map());
            const cache = rtc._scriptBlockCache.get(target.id);
            for (const op of tops) {
                switch (op.type) {
                    case 'delete': cache.delete(op.rootId); break;
                    default: if (op.rootId) cache.set(op.rootId, target.blocks.blockToXML(op.rootId, target.comments || {}));
                }
            }

            // Sync comment cache (full JSON string for simple comparison)
            const sortedKeys = Object.keys(target.comments).sort();
            const liveList = sortedKeys.map(k => {
                const c = target.comments[k];
                return { text: c.text, x: c.x, y: c.y, width: c.width, height: c.height, minimized: c.minimized, blockId: c.blockId };
            });
            rtc._commentCache.set(target.id, JSON.stringify(liveList));
        }
    } finally { rtc.onIngoreUpdate(false); }
}

// ── Message router ───────────────────────────────────────────────

export function createHandler({ addon, msg, console, sendToPeer, broadcastToPeers, rtc, Blockly }) {
    _Blockly = Blockly;
    const vm = addon.tab.traps.vm;

    return async function handlePeerMessage(peerId, msgs) {
        const data = JSON.parse(msgs);
        switch (data.type) {
            case SERVER_OPCODE.SNAPSHOT: {
                const bin = atob(data.data); const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                setURLParamsFromSearchString(data.config);
                const oldSt = ReduxStore.state.scratchGui.projectState.loadingState;
                ReduxStore.state.scratchGui.projectTitle = data.projectName;
                ReduxStore.dispatch(openLoadingProject());
                const ua = requestProjectUpload(oldSt); if (ua) ReduxStore.dispatch(ua);
                const ls = ReduxStore.state.scratchGui.projectState.loadingState;
                let ok = false;
                rtc.onIngoreUpdate(true);
                try {
                    localStorage.setItem("IM_SURE_IT_WONT_BREAK_MY_PROJECT", true);
                    await vm.loadProject(bytes.buffer); vm.renderer.draw(); ok = true;
                    document.title = `${data.projectName} - ${APP_NAME}`;
                } finally {
                    const d = onLoadedProject(ls, false, ok); if (d) ReduxStore.dispatch(d);
                    ReduxStore.dispatch(closeLoadingProject());
                }
                setTimeout(() => {
                    // Rebuild comment cache from current state after snapshot load
                    for (const target of vm.runtime.targets) {
                        const sortedKeys = Object.keys(target.comments || {}).sort();
                        const liveList = sortedKeys.map(k => {
                            const c = target.comments[k];
                            return { text: c.text, x: c.x, y: c.y, width: c.width, height: c.height, minimized: c.minimized, blockId: c.blockId };
                        });
                        rtc._commentCache.set(target.id, JSON.stringify(liveList));
                    }
                    rtc.onIngoreUpdate(false);
                }, 200);
                return;
            }
            case SERVER_OPCODE.POINTER: {
                if (data.workspaceIndex !== rtc.editingTargetIndex) break;
                const ws2 = _Blockly.getMainWorkspace(); if (!ws2) break;
                const svg = ws2.getParentSvg();
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
                    el.innerHTML = pointerSVG("#0099ff", data.name); el.id = data.id; el.classList.add(`${idHead}pointer`);
                    el.setAttribute("transform", `translate(${data.position.x},${data.position.y}) scale(${fs})`);
                    pc.appendChild(el);
                    const te = el.querySelector(".sa-collab-name-text"), be = el.querySelector(".sa-collab-name-bg");
                    if (te && be) { const b = te.getBBox(); be.setAttribute("width", b.width + 20); }
                }
                break;
            }
            case SERVER_OPCODE.POINTER_LEAVE:
                if (data.fromIndex !== rtc.editingTargetIndex) break;
                document.querySelectorAll(`.${idHead}pointer[id="${data.id}"]`).forEach(e => e.remove());
                break;
            case SERVER_OPCODE.BLOCK_CREATE:
                if (data.targetIndex !== undefined && data.xml && data.rootId)
                    enqueue({ type: 'create', targetIndex: data.targetIndex, rootId: data.rootId, xml: data.xml }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_UPDATE:
                if (data.targetIndex !== undefined && data.xml)
                    enqueue({ type: 'update', targetIndex: data.targetIndex, rootId: data.rootId, xml: data.xml }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_MOVE:
                if (data.targetIndex !== undefined && data.rootId)
                    enqueue({ type: 'move', targetIndex: data.targetIndex, rootId: data.rootId, x: data.x, y: data.y }, rtc);
                break;
            case SERVER_OPCODE.BLOCK_DELETE:
                if (data.rootIds && data.targetIndex !== undefined)
                    for (const rid of data.rootIds) enqueue({ type: 'delete', targetIndex: data.targetIndex, rootId: rid }, rtc);
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
            case SERVER_OPCODE.SPRITE_DELETE:
                rtc._vm.deleteSprite(rtc._vm.runtime.targets[data.targetIndex].id);
                if (rtc._spriteIdCache) rtc._spriteIdCache.delete(rtc._vm.runtime.targets[data.targetIndex]?.id);
                break;
            case SERVER_OPCODE.SPRITE_ADD:
                if (data.spriteData) {
                    rtc.onIngoreUpdate(true);
                    try {
                        const b2 = atob(data.spriteData); const bytes2 = new Uint8Array(b2.length);
                        for (let i = 0; i < b2.length; i++) bytes2[i] = b2.charCodeAt(i);
                        await vm.addSprite(bytes2.buffer, false);
                        if (rtc._spriteIdCache) rtc._spriteIdCache = new Set(rtc._vm.runtime.targets.map(t => t.id));
                        setTimeout(() => rtc.onIngoreUpdate(false), 200);
                    } catch (e) { console.error("[协作] 角色添加失败:", e); rtc.onIngoreUpdate(false); }
                    return;
                }
                break;
            case SERVER_OPCODE.PING: sendToPeer(peerId, { type: SERVER_OPCODE.PONG }); break;
        }
    };
}
