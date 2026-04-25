import { defineMessages } from 'react-intl';
import sharedMessages from '../shared-messages';

let messages = defineMessages({
    variable: {
        defaultMessage: 'my variable',
        description: 'Name for the default variable',
        id: 'gui.defaultProject.variable'
    }
});

messages = { ...messages, ...sharedMessages };

// use the default message if a translation function is not passed
const defaultTranslator = msgObj => msgObj.defaultMessage;

/**
 * Generate a localized version of the default project
 * @param {function} translateFunction a function to use for translating the default names
 * @return {object} the project data json for the default project
 */
const projectData = translateFunction => {
    const translator = translateFunction || defaultTranslator;
    return ({
        targets: [
            {
                isStage: true,
                name: 'Stage',
                variables: {
                    '`jEk@4|i[#Fk?(8x)AV.-my variable': [
                        translator(messages.variable),
                        0
                    ]
                },
                lists: {},
                broadcasts: {},
                blocks: {},
                currentCostume: 0,
                costumes: [
                    {
                        assetId: 'cd21514d0531fdffb22204e0ec5ed84a',
                        name: translator(messages.backdrop, { index: 1 }),
                        md5ext: 'cd21514d0531fdffb22204e0ec5ed84a.svg',
                        dataFormat: 'svg',
                        rotationCenterX: 240,
                        rotationCenterY: 180
                    }
                ],
                sounds: [],
                volume: 100
            },
            {
                isStage: false,
                name: "LOGO",
                variables: {},
                lists: {},
                broadcasts: {},
                blocks: {},
                comments: {
                    abc: {
                        "text": "#README #欢迎！\n\n# 欢迎使用 <font color=#0099ff>AstraEditor</font> ！\n\nAE 是一款基于 TurboWarp 开发的 Scratch 编辑器，我们加入了更多功能和插件~~以及很多 BUG 和特性~~！\n\n现在向您演示的是 README 功能。了解更多请前往 [AstraEditor 文档](https://editors.astras.top/docunment/)！\n\n基于 AstraEditor 进行二次开发可以前往我们的[代码库](https://github.com/AstraEditor)。\n\n前往[这里](https://github.com/AstraEditor/scratch-gui/issues)为我们反馈 BUG ！",
                        "x": 200,
                        "y": 200,
                        "width": 640,
                        "height": 360,
                        "minimized": false,
                        "blockId": null
                    }
                },
                currentCostume: 0,
                costumes: [
                    {
                        assetId: '927d672925e7b99f7813735c484c6923',
                        name: "Logo",
                        bitmapResolution: 1,
                        md5ext: '927d672925e7b99f7813735c484c6923.svg',
                        dataFormat: 'svg',
                        rotationCenterX: 240,
                        rotationCenterY: 180
                    }
                ],
                sounds: [],
                volume: 100,
                visible: true,
                x: 0,
                y: 0,
                size: 100,
                direction: 90,
                draggable: false,
                rotationStyle: 'all around'
            }
        ],
        meta: {
            semver: '3.0.0',
            vm: '0.1.0',
            agent: ''
        }
    });
};


export default projectData;
