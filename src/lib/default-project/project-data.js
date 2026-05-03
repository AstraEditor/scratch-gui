import { defineMessages } from 'react-intl';
import sharedMessages from '../shared-messages';

const defaultMsg_README = `
#README #Welcome!

# Welcome to ** AstraEditor ** !

AE is a Scratch editor developed based on TurboWarp. We have added more features and addons~~as well as many BUGs and features~~!

Here we are demonstrating the README feature. To learn more, please visit [AstraEditor Documentation](https://editors.astras.top/document/)!

For secondary development based on AstraEditor, please visit our [code repository](https://github.com/AstraEditor).

Go to [this link](https://github.com/AstraEditor/scratch-gui/issues) to report BUGs to us!

> [!NOTE]
> [Follow us on Bilibili](https://space.bilibili.com/3691007061264515)`;

let messages = defineMessages({
    variable: {
        defaultMessage: 'my variable',
        description: 'Name for the default variable',
        id: 'gui.defaultProject.variable'
    },
    tip: {
        defaultMessage: defaultMsg_README,
        description: 'a README',
        id: 'tw.defaultProject.readme'
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
                        "text": translator(messages.tip, { index: 2 }),
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
                        rotationCenterX: 244,
                        rotationCenterY: 188
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
