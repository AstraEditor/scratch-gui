import addToBar from '../../tools/AddToBar';
import { getSetting } from '../../tools/AEsettings';
import icon from '!../../../lib/tw-recolor/build!./icon.svg';
/*
联机编辑
{
    id: user_id,
    where: {
        mode: code | costume | sound,
        config: {
            target: target_id,
            ...
        }
    }
}
*/

export default async function ({ addon, console, msg }) {
    const vm = addon.tab.traps.vm;
    if (!vm) return;
    const idHead = 'sa-addon-collaborative-';
    const tabID = idHead + 'tab';
    const COMMAND = {
        JOIN: 'join',
        EXIT: 'exit'
    }

    let url = 'localhost:1832';
    // 输入的房间ID 
    let id = '';
    // 连接的服务器
    let server = null;
    let allSTUNURLs = null;

    const tipBox = document.createElement('div');
    tipBox.className = idHead + 'tipBoxScreen'
    document.body.appendChild(tipBox);


    const ID = Date.now()
    const IDSea = {
        Who: [
            '赛博',
            '口四楼',
            '汉堡',
            '猫猫',
            '小猫',
            '枫',
            '虾'
        ],
        Do: [
            '吃',
            '玩',
            '说',
            '丢'
        ],
        Things: [
            'AE',
            '皮球',
            '背带裤'
        ]
    }

    const spawnRoomID = async () => {
        const getRandomNumber = (x, y) => {
            return Math.floor(Math.random() * (y - x + 1)) + x;
        }

        let retryNum = 0;
        const maxRetries = 10;

        while (retryNum < maxRetries) {
            const RoomId = `${IDSea.Who[getRandomNumber(0, IDSea.Who.length - 1)]}${IDSea.Do[getRandomNumber(0, IDSea.Do.length - 1)]}${IDSea.Things[getRandomNumber(0, IDSea.Things.length - 1)]}`;
            console.log('[协作]尝试生成一个ID: ' + RoomId);

            try {
                const response = await fetch(`http://${url}/roomIsFree?roomId=${encodeURIComponent(RoomId)}`);
                const data = await response.json();
                console.log(data)
                if (data.isFree) {
                    console.log('[协作]房间可用: ' + RoomId);
                    return RoomId;
                } else {
                    console.log('[协作]房间已占用，重试...');
                }
            } catch (error) {
                console.error('[协作]检查房间失败:', error);
            }

            retryNum++;
        }
        return `room_${Date.now()}`;
    };

    async function fetchWithTimeout(url, timeout = 3000) {
        const abortController = new AbortController();

        const timeoutId = setTimeout(() => abortController.abort(), timeout);

        try {
            const response = await fetch(url, { signal: abortController.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`请求超时（${timeout}ms）`);
            }
            throw error;
        }
    }


    const createElements = (Mode = 'init') => {
        const isVSCL = getSetting('EnableVSCodeLayout');

        /**
         * 创建一个Tip
         * @param {'warn' | 'tip'} mode 
         * @param {string} text 
         * @returns 
         */
        const tipBox = (mode, text) => {
            const box = document.createElement('div');
            box.className = mode === 'tip' ? idHead + 'tipBox tip' : idHead + 'tipBox warn';
            const title = document.createElement('h3');
            title.textContent = msg(mode);
            const content = document.createElement('p');
            content.textContent = text;
            box.appendChild(title);
            box.appendChild(content);
            return box;
        }
        /**
         * @param {Object} config 
         * @param {String} config.defaultValue
         * @param {'text' | 'number'} config.type
         * @param {String} config.label
         * @param {Function} config.onChange
         * @param {String} text 
         */
        const inputBox = (config, text) => {
            const box = document.createElement('div');
            box.className = idHead + 'inputBox';
            const label = document.createElement('label');
            label.textContent = config.label;
            const input = document.createElement('input');
            input.type = config.type;
            input.value = text;
            input.onchange = e => {
                config.onChange(e.target.value);
            }
            box.appendChild(label);
            box.appendChild(input);
            return box;
        }

        const Container = document.createElement('div');
        Container.className = idHead + 'container';
        if (Mode === 'init') {
            // "协作"
            const Title = document.createElement('h2');
            Title.textContent = msg('title');
            Title.className = idHead + 'title';

            const joinButton = document.createElement('button');
            joinButton.textContent = msg('join');
            joinButton.onclick = () => {
                login()
            }
            const createButton = document.createElement('button');
            createButton.textContent = msg('create');
            createButton.onclick = () => {
                login()
            }

            const NetTipText = document.createElement('span');
            NetTipText.className = idHead + 'netTip';
            NetTipText.style.display = 'none';

            if (isVSCL) Container.appendChild(Title);
            Container.appendChild(tipBox('tip', msg('alpha_warn')))
            Container.appendChild(inputBox({
                type: 'string',
                label: msg('url'),
                value: url,
                onChange: value => {
                    url = value;
                }
            }, url.toString()));
            Container.appendChild(joinButton);
            Container.appendChild(inputBox({
                type: 'string',
                label: msg('id'),
                value: id,
                onChange: value => {
                    id = value;
                }
            }, url.toString()));
            Container.appendChild(createButton);
            Container.appendChild(NetTipText);
        }

        return Container;
    }

    // 处理server的返回
    const handleServerMessage = msg => {
        console.log(msg)
        // switch (msg.type) {
        //     case 'failed':
        //         alert(msg.info) //todo: 改成自定义的提示
        //         break
        //     case 'success':
        //         break
        // }
    }

    // 退出
    const exitColl = () => {
        if (server) server.send(JSON.stringify({
            com: COMMAND.EXIT,
            id: ID
        }))
    }

    const updateTipText = (text = null) => {
        if (!tipBox) return;
        const tipMsg = document.createElement('div');
        tipMsg.className = idHead + 'tipMsgScreen'
        tipMsg.textContent = text;

        setTimeout(() => {
            tipMsg.remove();
        }, 2000)
        tipBox.appendChild(tipMsg);
    }

    const login = async () => {
        // 获取来自https://github.com/pradt2/always-online-stun的在线stun
        updateTipText(msg('loading_vailable_stun'));
        if (!allSTUNURLs) {
            try {
                allSTUNURLs = await fetchWithTimeout("https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt");
            } catch {
                updateTipText(msg('loading_vailable_stun_from_proxy'));
                // 尝试获取镜像站的文件
                // 因为这是镜像而不是官方源，故放在替补位置
                allSTUNURLs = await fetchWithTimeout("https://ghproxy.net/https://raw.githubusercontent.com/pradt2/always-online-stun/master/valid_hosts.txt");
            }
            allSTUNURLs = await allSTUNURLs.text()
        }

        updateTipText(msg('create_rtc_connection'));
        try {
            const RTC = new RTCPeerConnection({
                iceServers: [{
                    urls:
                        allSTUNURLs.split('\n')
                            .filter(url => url !== '')
                            .map(url => `stun:${url.trim()}`)
                }]
            })
        } catch (e) {
            updateTipText(msg('create_rtc_failed'));
            return
        }

        updateTipText(msg('linking to server'));
        server = new WebSocket(`ws://${url}?room=${await spawnRoomID()}`);
        server.onopen = () => {
            server.send(JSON.stringify({ //进入房间
                com: COMMAND.JOIN,
                name: localStorage.getItem('tw:username') || "user",
                id: ID
            }));
        };
        server.onmessage = msgs => {
            const data = JSON.parse(msgs.data)
            handleServerMessage(data)
        };
        server.onerror = msgs => {
            alert(msgs)
        }
        // 退出编辑器
        window.addEventListener('beforeunload', () => {
            exitColl()
        })
        updateTipText();
    }

    addToBar(addon, {
        id: tabID,
        icon: icon,
        name: msg('title'),
        getContent: createElements,
        onClick: () => {

        }
    })
}