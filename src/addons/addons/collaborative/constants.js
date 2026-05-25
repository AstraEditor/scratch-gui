/** 协作模式下用于生成随机房间名的词库 */
export const ID_SEA = {
    Who: ["赛博", "口四楼", "汉堡", "猫猫", "小猫", "枫", "虾", "糖果"],
    Do: ["吃", "玩", "说", "丢", "买"],
    Things: ["AE", "皮球", "背带裤", "鸡"],
};

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
    <rect class="${'sa-collab-name-bg'}" x="15" y="0" height="40" rx="4" fill="${color}"></rect>
    <text class="${'sa-collab-name-text'}" x="25" y="30" fill="white" font-size="24">${name}</text>
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
