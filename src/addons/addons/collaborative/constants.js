/** 协作模式下用于生成随机房间名的词库 */
export const ID_SEA = {
    Who: ["赛博", "口四楼", "汉堡", "猫猫", "小猫", "枫", "虾", "糖果"],
    Do: ["吃", "玩", "说", "丢", "买"],
    Things: ["AE", "皮球", "背带裤", "鸡"],
};

export const SERVER_OPCODE = {
  POINTER_LEAVE: "pointer-leave",
  POINTER: "pointer",
  SNAPSHOT: "snapshot",
  SPRITE_ADD: "sprite-add",
  SPRITE_DELETE: "sprite-delete",
  BLOCK_CREATE: "block-create",           // 新增积木（完整 XML）
  BLOCK_DELETE: "block-delete",           // 删除积木（只发 rootId）
  BLOCK_MOVE: "block-move",               // 移动积木（只发 rootId + 坐标）
  BLOCK_UPDATE: "block-update",           // 修改字段/连接（完整 XML）
  BLOCK_FIELD_CHANGE: "block-field-change",     // 字段值变更（增量）
  BLOCK_MUTATION_CHANGE: "block-mutation-change", // mutation 变更（增量）
  BLOCK_INPUT_CHANGE: "block-input-change",     // 输入连接变更（增量）
  COMMENT_SYNC: "comment-sync",           // 注释全量同步（简单可靠）
  EXTENSION_ADD: "extension-add",         // 添加扩展
  EXTENSION_REMOVE: "extension-remove",   // 移除扩展
  COSTUME_ADD: "costume-add",             // 添加造型
  COSTUME_UPDATE: "costume-update",       // 更新造型（含数据变更）
  COSTUME_DELETE: "costume-delete",       // 删除造型
  SOUND_ADD: "sound-add",                 // 添加音频
  SOUND_UPDATE: "sound-update",           // 更新音频（含数据变更）
  SOUND_DELETE: "sound-delete",           // 删除音频
  VARIABLE_ADD: "variable-add",             // 创建变量/列表
  VARIABLE_DELETE: "variable-delete",       // 删除变量/列表
  VARIABLE_RENAME: "variable-rename",       // 重命名变量/列表
  CHAT_MESSAGE: "chat-message",             // 实时聊天消息
  EDIT_LOCK: "edit-lock",               // 锁定积木/注释（其他用户不可编辑）
  EDIT_UNLOCK: "edit-unlock",           // 解锁积木/注释
  BLOCK_DRAG_START: "block-drag-start",   // 积木拖动开始（含完整 XML，让远端渲染幽灵）
  BLOCK_DRAG_MOVE: "block-drag-move",     // 积木拖动中（仅坐标）
  BLOCK_DRAG_END: "block-drag-end",       // 积木拖动结束（删除幽灵）
  PING: "ping",
  PONG: "pong",
  KICK: "kick",
  SWITCH_TARGET: 'switch_target',
  MEMBERS_SYNC: 'members_sync'
}

export const idHead = "sa-addon-collaborative-";

function darkenHex(hex, percent = 20) {
    hex = hex.replace("#", "");
    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
    }
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const pointerSVG = (color, name = '') => `
  <path d="M5.41971 103.396L5.33334 5.34406L75.0169 74.3253L38.6685 74.8766C37.9902 74.8871 37.3196 74.9616 36.6557 75.0998C35.9917 75.2383 35.3464 75.4379 34.7207 75.6992C34.0951 75.9606 33.4996 76.2793 32.9343 76.6542C32.3694 77.0293 31.845 77.4539 31.3608 77.9291L5.41971 103.396Z" stroke="${darkenHex(color)}" stroke-width="10.666666666666666" stroke-linejoin="round" stroke-linecap="round" fill="${color}"/>
  <g transform="translate(15,90)">
    <rect class="${'sa-collab-name-bg'}" x="15" y="0" height="80" rx="4" fill="${color}"></rect>
    <text class="${'sa-collab-name-text'}" x="25" y="60" fill="white" font-size="48">${name}</text>
  </g>
`;

// 来自 pradt2/always-online-stun/master/valid_hosts.txt
// 2026.5.22 18：51
export const DEFAULT_STUN_URLS = `
stun.stochastix.de:3478
stun.moonlight-stream.org:3478
stun.ipfire.org:3478
stun.telnyx.com:3478
stun.bridesbay.com:3478
stun.ringostat.com:3478
stun.sonetel.com:3478
stun.mixvoip.com:3478
stun.skydrone.aero:3478
stun.technosens.fr:3478
stun.dcalling.de:3478
stun.bethesda.net:3478
stun.sipthor.net:3478
stun.nextcloud.com:3478
stun.ttmath.org:3478
stun.axialys.net:3478
stun.godatenow.com:3478
stun.vomessen.de:3478
stun.atagverwarming.nl:3478
stun.m-online.net:3478
stun.voztovoice.org:3478
stun.ncic.com:3478
stun.business-isp.nl:3478
stun.diallog.com:3478
stun.framasoft.org:3478
stun.grazertrinkwasseringefahr.at:3478
stun.ru-brides.com:3478
stun.sonetel.net:3478
stun.pure-ip.com:3478
stun.voipia.net:3478
stun.genymotion.com:3478
stun.eol.co.nz:3478
stun.annatel.net:3478
stun.geesthacht.de:3478
stun.bcs2005.net:3478
stun.flashdance.cx:3478
stun.siplogin.de:3478
stun.finsterwalder.com:3478
stun.engineeredarts.co.uk:3478
stun.bitburger.de:3478
stun.antisip.com:3478
stun.frozenmountain.com:3478
stun.sip.us:3478
stun.oncloud7.ch:3478
stun.galeriemagnet.at:3478
stun.graftlab.com:3478
stun.nextcloud.com:443
stun.cellmail.com:3478
stun.verbo.be:3478
stun.signalwire.com:3478
stun.kaseya.com:3478
stun.alpirsbacher.de:3478
stun.fitauto.ru:3478
stun.peethultra.be:3478
stun.telviva.com:3478
stun.nanocosmos.de:3478
stun.lovense.com:3478
stun.hot-chilli.net:3478
stun.ukh.de:3478
stun.zentauron.de:3478
stun.uabrides.com:3478
stun.siptrunk.com:3478
stun.files.fm:3478
stun.romaaeterna.nl:3478
stun.thinkrosystem.com:3478
stun.threema.ch:3478
stun.radiojar.com:3478
stun.vavadating.com:3478
stun.poetamatusel.org:3478
stun.f.haeder.net:3478
stun.tula.nu:3478
stun.fmo.de:3478
stun.acronis.com:3478
stun.schulinformatik.at:3478
stun.meetwife.com:3478
stun.yesdates.com:3478
stun.voipgate.com:3478
stun.romancecompass.com:3478
stun.linuxtrent.it:3478
stun.freeswitch.org:3478
stun.lebendigefluesse.at:3478
stun.healthtap.com:3478
stun.cope.es:3478
stun.kanojo.de:3478
stun.baltmannsweiler.de:3478
`;
