import { defineMessages } from 'react-intl';

const messages = defineMessages({
    motion_direction: {
        defaultMessage: 'direction',
        description: 'Label for the direction monitor when shown on the stage',
        id: 'gui.opcodeLabels.direction'
    },
    motion_xposition: {
        defaultMessage: 'x position',
        description: 'Label for the x position monitor when shown on the stage',
        id: 'gui.opcodeLabels.xposition'
    },
    motion_yposition: {
        defaultMessage: 'y position',
        description: 'Label for the y position monitor when shown on the stage',
        id: 'gui.opcodeLabels.yposition'
    },

    // Looks
    looks_size: {
        defaultMessage: 'size',
        description: 'Label for the size monitor when shown on the stage',
        id: 'gui.opcodeLabels.size'
    },
    looks_costumename: {
        defaultMessage: 'costume name',
        description: 'Label for the costume name monitor when shown on the stage',
        id: 'gui.opcodeLabels.costumename'
    },
    looks_costumenumber: {
        defaultMessage: 'costume number',
        description: 'Label for the costume number monitor when shown on the stage',
        id: 'gui.opcodeLabels.costumenumber'
    },
    looks_backdropname: {
        defaultMessage: 'backdrop name',
        description: 'Label for the backdrop name monitor when shown on the stage',
        id: 'gui.opcodeLabels.backdropname'
    },
    looks_backdropnumber: {
        defaultMessage: 'backdrop number',
        description: 'Label for the backdrop number monitor when shown on the stage',
        id: 'gui.opcodeLabels.backdropnumber'
    },


    // Sound
    sound_volume: {
        defaultMessage: 'volume',
        description: 'Label for the volume monitor when shown on the stage',
        id: 'gui.opcodeLabels.volume'
    },
    sound_tempo: {
        defaultMessage: 'tempo',
        description: 'Label for the tempo monitor when shown on the stage',
        id: 'gui.opcodeLabels.tempo'
    },

    // Sensing
    sensing_answer: {
        defaultMessage: 'answer',
        description: 'Label for the answer monitor when shown on the stage',
        id: 'gui.opcodeLabels.answer'
    },
    sensing_mousedown: {
        defaultMessage: 'mouse down?',
        description: 'Label for the mouse down monitor when show on the stage',
        id: 'tw.opcode.mousedown'
    },
    sensing_mousex: {
        defaultMessage: 'mouse x',
        description: 'Label for the mouse x monitor when show on the stage',
        id: 'tw.opcode.mousex'
    },
    sensing_mousey: {
        defaultMessage: 'mouse y',
        description: 'Label for the mouse y monitor when show on the stage',
        id: 'tw.opcode.mousey'
    },
    sensing_loudness: {
        defaultMessage: 'loudness',
        description: 'Label for the loudness monitor when shown on the stage',
        id: 'gui.opcodeLabels.loudness'
    },
    sensing_username: {
        defaultMessage: 'username',
        description: 'Label for the username monitor when shown on the stage',
        id: 'gui.opcodeLabels.username'
    },
    sensing_current_year: {
        defaultMessage: 'year',
        description: 'Label for the current year monitor when shown on the stage',
        id: 'gui.opcodeLabels.year'
    },
    sensing_current_month: {
        defaultMessage: 'month',
        description: 'Label for the current month monitor when shown on the stage.',
        id: 'gui.opcodeLabels.month'
    },
    sensing_current_date: {
        defaultMessage: 'date',
        description: 'Label for the current date monitor when shown on the stage. Shows the current day of the month',
        id: 'gui.opcodeLabels.date'
    },
    sensing_current_dayofweek: {
        defaultMessage: 'day of week',
        description: 'Label for the current day of week monitor when shown on the stage',
        id: 'gui.opcodeLabels.dayofweek'
    },
    sensing_current_hour: {
        defaultMessage: 'hour',
        description: 'Label for the current hour monitor when shown on the stage',
        id: 'gui.opcodeLabels.hour'
    },
    sensing_current_minute: {
        defaultMessage: 'minute',
        description: 'Label for the current minute monitor when shown on the stage',
        id: 'gui.opcodeLabels.minute'
    },
    sensing_current_second: {
        defaultMessage: 'second',
        description: 'Label for the current second monitor when shown on the stage',
        id: 'gui.opcodeLabels.second'
    },
    sensing_timer: {
        defaultMessage: 'timer',
        description: 'Label for the timer monitor when shown on the stage',
        id: 'gui.opcodeLabels.timer'
    },
    sensing_dayssince2000: {
        defaultMessage: 'days since 2000',
        description: 'Label for the days since 2000 monitor when shown on the stage',
        id: 'tw.opcode.2000'
    },
    sensing_online: {
        defaultMessage: 'online?',
        description: 'Name of "online?" block',
        id: 'gui.opcodeLabels.online'
    },
    sensing_touchingobject_mouse: {
        defaultMessage: 'touching mouse-pointer?',
        description: 'Name of "touching?" block, input is mouse.',
        id: 'gui.opcodeLabels.touchingobject_mouse'
    },
    sensing_touchingobject_edge: {
        defaultMessage: 'touching edge?',
        description: 'Name of "touching?" block, input is edge.',
        id: 'gui.opcodeLabels.touchingobject_edge',
    },
    sensing_touchingobject: {
        defaultMessage: 'touching ',
        description: 'Name of "touching?" block, input is a sprite.',
        id: 'gui.opcodeLabels.touchingobject',
    },
    sensing_touchingcolor: {
        defaultMessage: 'touching color ',
        description: 'Name of "touching color [HEX]" block.',
        id: 'gui.opcodeLabels.touchingcolor',
    },
    sensing_coloristouchingcolor: {
        defaultMessage: '  is touching color  ',
        description: 'Name of "color [HEX] is touching color [HEX]" block.',
        id: 'gui.opcodeLabels.coloristouchingcolor',
    },
    sensing_distancetomouse: {
        defaultMessage: 'distance to mouse-pointer',
        description: 'Name of "distance to" block, input is mouse.',
        id: 'gui.opcodeLabels.sensing_distancetomouse',
    },
    sensing_distanceto: {
        defaultMessage: 'distance to ',
        description: 'Name of "distance to" block, input is sprite.',
        id: 'gui.opcodeLabels.sensing_distanceto',
    },
    sensing_keypressed: {
        defaultMessage: ' pressed?',
        description: 'Name of "key [KEY] pressed?" block.',
        id: 'gui.opcodeLabels.keypressed',
    },
    control_get_counter: {
        defaultMessage: 'counter',
        description: 'Name of "counter" block.',
        id: 'gui.opcodeLabels.counter',
    }
});

class OpcodeLabels {
    constructor() {
        /**
         * Translation function for labels. By default just return the defaultMessage
         * @private
         * @param {object} message A message object compatible with react-intl formatMessage
         * @return {string} Return the default string initially
         */
        this._translator = message => message.defaultMessage;

        /**
         * Initial opcode map, with categories defined
         * @private
         */
        this._opcodeMap = {
            // Motion
            motion_direction: { category: 'motion' },
            motion_xposition: { category: 'motion' },
            motion_yposition: { category: 'motion' },

            // Looks
            looks_size: { category: 'looks' },
            looks_costumenumbername: { category: 'looks' },
            looks_backdropnumbername: { category: 'looks' },
            looks_backdropname: { category: 'looks' },

            // Data
            data_variable: { category: 'data' },
            data_listcontents: { category: 'list' },

            // Control
            control_get_counter: { category: 'control' },
            // Sound
            sound_volume: { category: 'sound' },
            sound_tempo: { category: 'sound' },

            // Sensing
            sensing_touchingobject: { category: 'sensing' },
            sensing_touchingcolor: { category: 'sensing' },
            sensing_coloristouchingcolor: { category: 'sensing' },
            sensing_distanceto: { category: 'sensing' },
            sensing_answer: { category: 'sensing' },
            sensing_keypressed: { category: 'sensing' },
            sensing_mousedown: { category: 'sensing' },
            sensing_mousex: { category: 'sensing' },
            sensing_mousey: { category: 'sensing' },
            sensing_loudness: { category: 'sensing' },
            sensing_username: { category: 'sensing' },
            sensing_current: { category: 'sensing' },
            sensing_timer: { category: 'sensing' },
            sensing_dayssince2000: { category: 'sensing' },
            sensing_online: { category: 'sensing' }
        };

        // Initialize opcodeMap with default strings
        this._refreshOpcodeMap();
    }

    /**
     * Set the translation function for monitor labels. The function should accept
     * a message object as defined by react-intl defineMessages
     * @param {function} translator the function to use for localization
     */
    setTranslatorFunction(translator) {
        this._translator = translator;
        this._refreshOpcodeMap();
    }

    /**
     * 返回一个颜色框svg，辅助用
     * @private
    */
    _colorbox(Hex) {
        return (
                <svg style={{
                        width: '25px',
                        height: '1px',
                        transform: 'translate(5px, -10px)'
                    }}>
                        <path stroke="#FFFFFF" fill={Hex} fill-opacity="1"
                            d="m 0,4.8 A 4.8,4.8 0 0,1 4.8,0 H 12 a 4.8,4.8 0 0,1 4.8,4.8 v 3.84 a 4.8,4.8 0 0,1 -4.8,4.8 H 4.8 a 4.8,4.8 0 0,1 -4.8,-4.8 z">
                        </path>
                </svg>
        )
    }
    /**
     * Internal function to update opcode Map when translation function is defined
     * @private
     */
    _refreshOpcodeMap() {
        // Motion
        this._opcodeMap.motion_direction.labelFn = () => this._translator(messages.motion_direction);
        this._opcodeMap.motion_xposition.labelFn = () => this._translator(messages.motion_xposition);
        this._opcodeMap.motion_yposition.labelFn = () => this._translator(messages.motion_yposition);

        // Looks
        this._opcodeMap.looks_size.labelFn = () => this._translator(messages.looks_size);
        this._opcodeMap.looks_costumenumbername.labelFn = params => {
            if (params.NUMBER_NAME === 'number') {
                return this._translator(messages.looks_costumenumber);
            }
            return this._translator(messages.looks_costumename);
        };
        this._opcodeMap.looks_backdropnumbername.labelFn = params => {
            if (params.NUMBER_NAME === 'number') {
                return this._translator(messages.looks_backdropnumber);
            }
            return this._translator(messages.looks_backdropname);
        };
        this._opcodeMap.looks_backdropname.labelFn = () => this._translator(messages.looks_backdropname);

        // Data
        this._opcodeMap.data_variable.labelFn = params => params.VARIABLE;
        this._opcodeMap.data_listcontents.labelFn = params => params.LIST;

        // Control
        this._opcodeMap.control_get_counter.labelFn = () => this._translator(messages.control_get_counter)
        // Sound
        this._opcodeMap.sound_volume.labelFn = () => this._translator(messages.sound_volume);
        this._opcodeMap.sound_tempo.labelFn = () => this._translator(messages.sound_tempo);

        // Sensing
        this._opcodeMap.sensing_touchingobject.labelFn = params => {
            switch (params.TOUCHINGOBJECTMENU) {
                case '_mouse_':
                    return this._translator(messages.sensing_touchingobject_mouse);
                case '_edge_':
                    return this._translator(messages.sensing_touchingobject_edge);
                default:
                    // Sprite
                    return `${this._translator(messages.sensing_touchingobject)}${params.TOUCHINGOBJECTMENU}?`;
            }
        }
        this._opcodeMap.sensing_touchingcolor.labelFn = params => {
            return (
                <>
                    <span>{this._translator(messages.sensing_touchingcolor)}</span>
                    {this._colorbox(params.COLOR)}
                </>
            )
        }
        this._opcodeMap.sensing_coloristouchingcolor.labelFn = params => {
            return (
                <>
                    {this._colorbox(params.COLOR)}
                    <span>{this._translator(messages.sensing_coloristouchingcolor)}</span>
                    {this._colorbox(params.COLOR2)}
                    ?
                </>
            )
        };
        this._opcodeMap.sensing_distanceto.labelFn = params => {
            switch (params.DISTANCETOMENU) {
                case '_mouse_':
                    return this._translator(messages.sensing_distancetomouse);
                default:
                    // sprite
                    return `${this._translator(messages.sensing_distanceto)} ${params.DISTANCETOMENU}`
            }
        }
        this._opcodeMap.sensing_answer.labelFn = () => this._translator(messages.sensing_answer);
        this._opcodeMap.sensing_keypressed.labelFn = params => {
            const keypressedText = this._translator(messages.sensing_keypressed)
            const text = () => {
                switch (params.KEY_OPTION) {
                    case 'space':
                        return this._translator({ id: 'makeymakey.spaceKey' })
                    case 'left arrow':
                        return this._translator({ id: 'makeymakey.leftArrow' })
                    case 'up arrow':
                        return this._translator({ id: 'makeymakey.upArrow' })
                    case 'right arrow':
                        return this._translator({ id: 'makeymakey.rightArrow' })
                    case 'down arrow':
                        return this._translator({ id: 'makeymakey.downArrow' })
                    case 'any':
                        return this._translator({ id: 'microbit.buttonsMenu.any' }) //你别管为什么这是microbit的
                    default:
                        return params.KEY_OPTION
                }
            }
            return `${text()} ${keypressedText}`
        }
        this._opcodeMap.sensing_mousedown.labelFn = () => this._translator(messages.sensing_mousedown);
        this._opcodeMap.sensing_mousex.labelFn = () => this._translator(messages.sensing_mousex);
        this._opcodeMap.sensing_mousey.labelFn = () => this._translator(messages.sensing_mousey);
        this._opcodeMap.sensing_loudness.labelFn = () => this._translator(messages.sensing_loudness);
        this._opcodeMap.sensing_username.labelFn = () => this._translator(messages.sensing_username);
        this._opcodeMap.sensing_current.labelFn = params => {
            switch (params.CURRENTMENU.toLowerCase()) {
                case 'year':
                    return this._translator(messages.sensing_current_year);
                case 'month':
                    return this._translator(messages.sensing_current_month);
                case 'date':
                    return this._translator(messages.sensing_current_date);
                case 'dayofweek':
                    return this._translator(messages.sensing_current_dayofweek);
                case 'hour':
                    return this._translator(messages.sensing_current_hour);
                case 'minute':
                    return this._translator(messages.sensing_current_minute);
                case 'second':
                    return this._translator(messages.sensing_current_second);
            }
        };
        this._opcodeMap.sensing_timer.labelFn = () => this._translator(messages.sensing_timer);
        this._opcodeMap.sensing_dayssince2000.labelFn = () => this._translator(messages.sensing_dayssince2000);
        this._opcodeMap.sensing_online.labelFn = () => this._translator(messages.sensing_online);
    }

    /**
     * Return the label for an opcode
     * @param {string} opcode the opcode you want a label for
     * @return {object} object with  label and category
     */
    getLabel(opcode) {
        if (opcode in this._opcodeMap) return this._opcodeMap[opcode];
        return {
            category: 'extension',
            label: opcode
        };
    }
}

export default new OpcodeLabels();
