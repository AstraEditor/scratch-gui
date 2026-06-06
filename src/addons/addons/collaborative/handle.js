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

function replaceTree(target, xmlString, rootId, isEditingTarget, oldRootId) {
    const blockObjs = parseXml(xmlString);
    if (blockObjs.length === 0) return;

    // 1. Find and delete ALL existing trees that overlap with new blocks
    // This handles the case where a head block is replaced: the new XML
    // contains old block IDs that are still in _blocks under a different rootId
    const newIds = new Set(blockObjs.map(b => b.id));
    const rootsToDelete = new Set();
    for (const id of newIds) {
        if (target.blocks._blocks[id]) {
            // Find the root of this block's tree
            let cur = id;
            while (target.blocks._blocks[cur]?.parent) {
                cur = target.blocks._blocks[cur].parent;
            }
            rootsToDelete.add(cur);
        }
    }
    // Also delete the tree rooted at oldRootId if provided
    if (oldRootId) rootsToDelete.add(oldRootId);

    let totalDeleted = 0;
    for (const rid of rootsToDelete) {
        totalDeleted += deleteTree(target, rid);
    }

    // 2. Create new blocks from XML
    for (const b of blockObjs) {
        if (!target.blocks._blocks[b.id]) {
            target.blocks.createBlock(b);
        }
    }

    // 3. Update Blockly workspace DOM only for current editing target
    if (!isEditingTarget) return;
    const ws = getWS();
    if (ws) {
        _Blockly.Events.disable();
        try {
            // Dispose all old DOM blocks
            for (const rid of rootsToDelete) {
                const old = ws.getBlockById(rid);
                if (old) old.dispose(false);
            }
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
    const ids = deleteTree(target, op.rootId);
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

    rtc.onIngoreUpdate(true);
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
                        case 'mutationChange': applyMutationChange(target, op); break;
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
                    // Rebuild all caches from current state after snapshot load
                    for (const target of vm.runtime.targets) {
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
            case SERVER_OPCODE.POINTER_LEAVE: {
                const myTargetId = rtc._vm.runtime._editingTarget?.id;
                if (data.targetId !== myTargetId) break;
                document.querySelectorAll(`.${idHead}pointer[id="${data.id}"]`).forEach(e => e.remove());
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
                    rtc.onIngoreUpdate(true);
                    const loadPromise = data.url
                        ? rtc._vm.extensionManager.loadExtensionURL(data.url, true)
                        : rtc._vm.extensionManager.loadExtensionIdSync(data.id);
                    Promise.resolve(loadPromise).then(() => {
                        console.log(`[协作] extension loaded: ${data.id}`);
                    }).catch(e => {
                        console.error("[协作] 加载扩展失败:", e);
                    }).finally(() => rtc.onIngoreUpdate(false));
                }
                break;
            case SERVER_OPCODE.EXTENSION_REMOVE:
                if (data.id && rtc._vm.extensionManager.isExtensionLoaded(data.id)) {
                    rtc._vm.extensionManager.unloadExtension(data.id);
                }
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
            case SERVER_OPCODE.PING: sendToPeer(peerId, { type: SERVER_OPCODE.PONG }); break;
        }
    };
}
