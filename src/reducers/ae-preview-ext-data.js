const SET_PREVIEW_EXT_DATA = 'scratch-gui/ae-preview-ext/setData';

const initialState = {
    data: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case SET_PREVIEW_EXT_DATA:
        return Object.assign({}, state, {
            data: action.data
        });
    default:
        return state;
    }
};

const setPreviewExtData = function (data) {
    return {
        type: SET_PREVIEW_EXT_DATA,
        data: data
    };
};

export default reducer;
export { initialState as aePreviewExtDataInitialState, setPreviewExtData };