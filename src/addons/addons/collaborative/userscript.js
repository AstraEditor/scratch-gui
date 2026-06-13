import addToBar from "../../tools/AddToBar";
import { getSetting, getThemeMode } from "../../tools/AEsettings";
import icon from "!../../../lib/tw-recolor/build!./icon.svg";
import copyImg from "./copy.svg";
import { join } from "path-browserify";
import SideBar from "../../ui/side-bar/side-bar.js";
import { RTCServer } from "./rtc-server.js";
import { idHead } from "./constants.js";
import { createHandler, cleanupRemoteByUser } from "./handle.js";
import ReduxStore from "../../redux.js";
import {
    openLoadingProject, closeLoadingProject,
} from "../../../reducers/modals";

let _initialLoadShown = false;

export default async function ({ addon, console, msg }) {
    const vm = addon.tab.traps.vm;
    if (!vm) return;

    const tabID = idHead + "tab";


    let url = "154.9.252.181:1832";
    let id = "";
    const isVSCLayout = getSetting("EnableVSCodeLayout");


    const tipBox = document.createElement("div");
    tipBox.className = idHead + "tipBoxScreen";
    document.body.appendChild(tipBox);

    let roomMembersEl = null; // 模块级引用，用于实时更新成员列表

    // 渲染/更新成员列表（含 Host 标识和踢出按钮）
    const renderMemberList = (rtcState, rtc) => {
        if (!roomMembersEl) return;
        roomMembersEl.innerHTML = '';
        const isHost = rtc._isHost;

        rtcState.allMembers.forEach((member) => {
            const item = document.createElement("span");
            item.className = idHead + "roomMember";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = member.userName;

            if (member.cid === rtcState.clientId) {
                nameSpan.textContent += " (你)";
            }
            if (member.owner) {
                nameSpan.textContent += ` [${msg('host')}]`;
                nameSpan.style.fontWeight = "bold";
            }

            item.appendChild(nameSpan);

            // Host 可以踢出其他成员
            if (isHost && member.cid !== rtcState.clientId) {
                const kickBtn = document.createElement("button");
                kickBtn.textContent = msg('kick');
                kickBtn.className = idHead + "kickBtn";
                kickBtn.onclick = () => {
                    rtc.kickMember(member.cid);
                };
                item.appendChild(kickBtn);
            }

            roomMembersEl.appendChild(item);
        });
    };

    /**
     * @param {string} text
     * @param {'normal' | 'error' | 'warn'} mode
     */
    const updateTipText = (text = null, mode = "normal") => {
        if (!tipBox || !text) return;
        const tipMsg = document.createElement("div");
        tipMsg.className = idHead + "tipMsgScreen";
        tipMsg.style.background =
            mode === "normal"
                ? "#09f"
                : mode === "error"
                    ? "#f00"
                    : mode === "warn" && "#ff0";
        tipMsg.textContent = text;

        setTimeout(() => {
            tipMsg.className = `${tipMsg.className} end`;
            setTimeout(() => tipMsg.remove(), 500);
        }, 2000);
        tipBox.appendChild(tipMsg);
    };

    // ── 房间提示条 ─────────────────────────────────────────────

    const enterRoom = (roomId) => {
        const oldRoomIdText = document.querySelector(
            `.${idHead}roomTip-container`,
        );
        if (oldRoomIdText) oldRoomIdText.remove();

        const container = document.createElement("div");
        container.className = idHead + "roomTip-container";

        const roomIdText = document.createElement("span");
        roomIdText.textContent = roomId;

        container.appendChild(roomIdText);

        document
            .querySelector("[class*=menu-bar_menuGroup]")
            .appendChild(container);

        refreshGUI();
    };

    // ── UI 渲染 ────────────────────────────────────────────────

    const refreshGUI = () => {
        if (isVSCLayout) {
            SideBar.clearContent();
            SideBar.setContent(createElements());
        } else {
            const content = document.querySelector(
                "[class*='sa-todo-modal-content']",
            );
            content.childNodes.forEach((ele) => ele.remove());
            content.appendChild(createElements());
        }
    };

    const createElements = () => {
        /**
         * 创建一个Tip
         * @param {'warn' | 'tip'} mode
         * @param {string} text
         * @returns
         */
        const tipBox = (mode, text) => {
            const box = document.createElement("div");
            box.className =
                mode === "tip" ? idHead + "tipBox tip" : idHead + "tipBox warn";
            const title = document.createElement("h3");
            title.textContent = msg(mode);
            const content = document.createElement("p");
            content.textContent = text;
            box.appendChild(title);
            box.appendChild(content);
            return box;
        };
        /**
         * @param {Object} config
         * @param {String} config.defaultValue
         * @param {'text' | 'number'} config.type
         * @param {String} config.label
         * @param {String} config.tip
         * @param {Function} config.onChange
         * @param {String} text
         */
        const inputBox = (config, text) => {
            const box = document.createElement("div");
            box.className = idHead + "inputBox";
            const label = document.createElement("label");
            label.textContent = config.label;
            const input = document.createElement("input");
            input.type = config.type;
            input.value = text;
            input.placeholder = config.tip || "";
            input.onchange = (e) => {
                config.onChange(e.target.value);
            };
            box.appendChild(label);
            box.appendChild(input);
            return box;
        };

        const Container = document.createElement("div");
        Container.className = idHead + "container";
        const Title = document.createElement("h1");
        Title.textContent = msg("title");
        Title.className = idHead + "title";

        const rtcState = rtc.getState();

        // 未加入房间
        if (!rtcState.clientId) {
            const joinButton = document.createElement("button");
            joinButton.textContent = msg("join");
            joinButton.onclick = () => {
                rtc.login("join", url, id);
            };
            const createButton = document.createElement("button");
            createButton.textContent = msg("create");
            createButton.onclick = () => {
                rtc.login("reg", url);
            };

            const NetTipText = document.createElement("span");
            NetTipText.className = idHead + "netTip";
            NetTipText.style.display = "none";

            if (isVSCLayout) Container.appendChild(Title);
            Container.appendChild(tipBox("tip", msg("alpha_warn")));
            // Container.appendChild(
            //     inputBox(
            //         {
            //             type: "string",
            //             label: msg("url"),
            //             value: url,
            //             onChange: (value) => {
            //                 url = value;
            //             },
            //         },
            //         url.toString(),
            //     ),
            // );
            Container.appendChild(createButton);

            Container.appendChild(
                inputBox(
                    {
                        type: "string",
                        label: msg("id"),
                        value: id,
                        tip: "赛博玩AE",
                        onChange: (value) => {
                            id = value;
                        },
                    },
                    id.toString(),
                ),
            );
            Container.appendChild(joinButton);

            Container.appendChild(NetTipText);
        } else {
            if (isVSCLayout) Container.appendChild(Title);

            const roomTitleDiv = document.createElement("div");
            roomTitleDiv.className = idHead + "roomTitleDiv";
            const roomTitleCopyButton = document.createElement("img");
            roomTitleCopyButton.src = copyImg;
            roomTitleCopyButton.className = idHead + "roomTitleCopyButton";
            roomTitleCopyButton.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(rtcState.roomId);
                    updateTipText(msg("copied_room_id"));
                } catch {
                    updateTipText(msg("copy_room_id_failed"));
                }
            };
            const roomTitle = document.createElement("span");
            roomTitle.textContent = rtcState.roomId;
            roomTitle.className = idHead + "roomTitle";
            const roomMembers = document.createElement("div");
            roomMembers.className = idHead + "roomMembers";
            roomMembersEl = roomMembers; // 保存引用供 renderMemberList 使用
            renderMemberList(rtcState, rtc); // 初始渲染

            const exitRoomButton = document.createElement('button');
            exitRoomButton.textContent = msg('exitRoomButton')
            exitRoomButton.onclick = () => {
                rtc.exit()
            }

            roomTitleDiv.appendChild(roomTitleCopyButton);
            roomTitleDiv.appendChild(roomTitle);
            Container.appendChild(roomTitleDiv);
            Container.appendChild(roomMembers);
            Container.appendChild(exitRoomButton);
        }


        const testButton = document.createElement("button");
        testButton.textContent = "Test Button";
        testButton.onclick = async () => {
            const sb3 = await vm.saveProjectSb3("arraybuffer");
            console.log("sb3 size:", sb3.byteLength);
        };

        // Container.appendChild(testButton)
        return Container;
    };

    // ── 消息路由（P2P 数据通道） ────────────────────────────────

    let handlePeerMessage = null;

    // ── 网络层初始化 ────────────────────────────────────────────

    const rtc = new RTCServer({
        msg,
        console,
        updateTipText,
        vm,
        onStateChange: (newState) => {
            // 首次连接成功时显示房间提示条
            if (newState.clientId) {
                enterRoom(newState.roomId);
                renderMemberList(newState, rtc); // 成员变化时刷新列表
                // 非 Host 成员：仅在首次连接时进入加载界面，防止重复触发
                if (!rtc.isHost() && !_initialLoadShown) {
                    _initialLoadShown = true;
                    ReduxStore.dispatch(openLoadingProject());
                }
            } else {
                _initialLoadShown = false;
                refreshGUI();
            }
        },
        onPeerMessage: async (peerId, data) => {
            await handlePeerMessage(peerId, data);
        },
        onPeerLeft: (peerId) => {
            cleanupRemoteByUser(peerId);
        },
    });

    const Blockly = await addon.tab.traps.getBlockly();
    rtc.setBlockly(Blockly);

    handlePeerMessage = createHandler({
        addon,
        console,
        sendToPeer: rtc.sendToPeer,
        rtc,
        Blockly,
    });

    // ── 注册菜单栏 ─────────────────────────────────────────────

    addToBar(addon, {
        id: tabID,
        icon: icon,
        name: msg("title"),
        getContent: createElements,
        onClick: () => { },
    });
}