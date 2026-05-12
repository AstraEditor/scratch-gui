import addToBar from '../../tools/AddToBar';
import { getSetting } from '../../tools/AEsettings';
import icon from '!../../../lib/tw-recolor/build!./icon.svg';
import { text } from '../../../../../scratch-vm/src/extension-support/tw-default-extension-urls';
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
    const tabID = 'sa-addon-collaborative-tab';
    const COMMAND = {
        ENTER: 'join'
    }

    let port = 1832;
    // 连接的服务器
    let server = null;

    const createElements = () => {
        const isVSCL = getSetting('EnableVSCodeLayout');

        /**
         * 创建一个Tip
         * @param {'warn' | 'tip'} mode 
         * @param {string} text 
         * @returns 
         */
        const tipBox = (mode, text) => {
            const box = document.createElement('div');
            box.className = mode === 'tip' ? 'sa-addon-collaborative-tipBox tip' : 'sa-addon-collaborative-tipBox warn';
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
            box.className = 'sa-addon-collaborative-inputBox';
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
        Container.className = 'sa-addon-collaborative-container';

        // "协作"
        const Title = document.createElement('h2');
        Title.textContent = msg('title');
        Title.className = 'sa-addon-collaborative-title';

        const joinButton = document.createElement('button');
        joinButton.textContent = msg('join');
        joinButton.onclick = () => {
            login()
        }

        if(isVSCL) Container.appendChild(Title);
        Container.appendChild(tipBox('tip', msg('alpha_warn')))
        Container.appendChild(inputBox({
                type: 'number',
                label: msg('port'),
                value: port,
                onChange: value => {
                    port = value;
                }
            }, port.toString()));
        Container.appendChild(joinButton);
        return Container;
    }

    const login = async () => {
        server = new WebSocket(`ws://localhost:${port}`);
        server.onopen = () => {
            server.send(JSON.stringify({ //进入房间
                com: COMMAND.ENTER,
                name: localStorage.getItem('tw:username') || "user",
                id: Date.now()
            }));
        };
        server.onmessage = msgs => {
            const data = JSON.parse(msgs.data)
            console.log(data)
            if(data.info) alert(data.info)
        }
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