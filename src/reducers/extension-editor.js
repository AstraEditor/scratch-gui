const UPDATE_FONT_SIZE = 'scratch-gui/extension-editor/UPDATE_FONT_SIZE';

const initialState = {
    fontSize: 14
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case UPDATE_FONT_SIZE:
        return Object.assign({}, state, {
            fontSize: action.fontSize
        });
    default:
        return state;
    }
};

const updateFontSize = function (fontSize) {
    return {
        type: UPDATE_FONT_SIZE,
        fontSize: fontSize
    };
};

export {
    reducer as default,
    initialState as extensionEditorInitialState,
    updateFontSize
};