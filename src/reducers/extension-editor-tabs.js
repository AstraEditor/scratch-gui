const ADD_TAB = 'scratch-gui/extension-editor-tabs/ADD_TAB';
const REMOVE_TAB = 'scratch-gui/extension-editor-tabs/REMOVE_TAB';
const ACTIVATE_TAB = 'scratch-gui/extension-editor-tabs/ACTIVATE_TAB';
const UPDATE_TAB_CODE = 'scratch-gui/extension-editor-tabs/UPDATE_TAB_CODE';
const UPDATE_TAB_NAME = 'scratch-gui/extension-editor-tabs/UPDATE_TAB_NAME';
const SET_TAB_SAVED = 'scratch-gui/extension-editor-tabs/SET_TAB_SAVED';

const initialState = {
    tabs: [],
    activeTabId: null
};

const reducer = function (state, action) {
    if (typeof state === 'undefined') state = initialState;
    switch (action.type) {
    case ADD_TAB:
        const newTab = {
            id: action.tab.id,
            name: action.tab.name,
            code: action.tab.code,
            isSaved: action.tab.isSaved || false,
            createdAt: action.tab.createdAt || Date.now(),
            updatedAt: action.tab.updatedAt || Date.now()
        };
        return Object.assign({}, state, {
            tabs: [...state.tabs, newTab],
            activeTabId: action.tab.id
        });
    case REMOVE_TAB:
        const filteredTabs = state.tabs.filter(tab => tab.id !== action.tabId);
        let newActiveTabId = state.activeTabId;
        
        // If the removed tab was active, switch to another tab
        if (state.activeTabId === action.tabId) {
            if (filteredTabs.length > 0) {
                // Try to find the tab after the removed one, or the one before
                const removedIndex = state.tabs.findIndex(tab => tab.id === action.tabId);
                newActiveTabId = filteredTabs[Math.min(removedIndex, filteredTabs.length - 1)].id;
            } else {
                newActiveTabId = null;
            }
        }
        
        return Object.assign({}, state, {
            tabs: filteredTabs,
            activeTabId: newActiveTabId
        });
    case ACTIVATE_TAB:
        return Object.assign({}, state, {
            activeTabId: action.tabId
        });
    case UPDATE_TAB_CODE:
        return Object.assign({}, state, {
            tabs: state.tabs.map(tab => {
                if (tab.id === action.tabId) {
                    return Object.assign({}, tab, {
                        code: action.code,
                        isSaved: false,
                        updatedAt: Date.now()
                    });
                }
                return tab;
            })
        });
    case UPDATE_TAB_NAME:
        return Object.assign({}, state, {
            tabs: state.tabs.map(tab => {
                if (tab.id === action.tabId) {
                    return Object.assign({}, tab, {
                        name: action.name,
                        updatedAt: Date.now()
                    });
                }
                return tab;
            })
        });
    case SET_TAB_SAVED:
        return Object.assign({}, state, {
            tabs: state.tabs.map(tab => {
                if (tab.id === action.tabId) {
                    return Object.assign({}, tab, {
                        isSaved: action.isSaved
                    });
                }
                return tab;
            })
        });
    default:
        return state;
    }
};

const addTab = function (tab) {
    return {
        type: ADD_TAB,
        tab: tab
    };
};

const removeTab = function (tabId) {
    return {
        type: REMOVE_TAB,
        tabId: tabId
    };
};

const activateTab = function (tabId) {
    return {
        type: ACTIVATE_TAB,
        tabId: tabId
    };
};

const updateTabCode = function (tabId, code) {
    return {
        type: UPDATE_TAB_CODE,
        tabId: tabId,
        code: code
    };
};

const updateTabName = function (tabId, name) {
    return {
        type: UPDATE_TAB_NAME,
        tabId: tabId,
        name: name
    };
};

const setTabSaved = function (tabId, isSaved) {
    return {
        type: SET_TAB_SAVED,
        tabId: tabId,
        isSaved: isSaved
    };
};

export {
    reducer as default,
    initialState as extensionEditorTabsInitialState,
    addTab,
    removeTab,
    activateTab,
    updateTabCode,
    updateTabName,
    setTabSaved
};