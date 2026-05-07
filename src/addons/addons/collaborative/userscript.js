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
    const tabID = 'sa-addon-collaborative-tab';

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

        const Container = document.createElement('div');
        Container.className = 'sa-addon-collaborative-container';

        // "协作"
        const Title = document.createElement('h2');
        Title.textContent = msg('title');
        Title.className = 'sa-addon-collaborative-title';

        // 端口输入
        const portInput = document.createElement('input');
        portInput.type = 'number';
        portInput.value = port;
        portInput.className = 'sa-addon-collaborative-portInput';
        portInput.onChange = e => {
            port = e.target.value;
        }

        if(isVSCL) Container.appendChild(Title);
        Container.appendChild(tipBox('tip', msg('alpha_warn')))
        Container.appendChild(portInput);
        return Container;
    }

    const login = async () => {
        server = new WebSocket(`ws://localhost:${port}`);
        server.onopen = () => {
            server.send("Hello World");
        };
    }
    login()

    addToBar(addon, {
        id: tabID,
        icon: icon,
        name: msg('title'),
        getContent: createElements,
        onClick: () => {

        }
    })
}