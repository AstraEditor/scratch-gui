const STORAGE_KEY = 'AESettings';

const DEFAULTS = {
    enableREADMEAutoDisplay: true,
    enableHTMLSupportInREADME: false,
    skipExtWarn: false,
    EnableExtensionPreview: false,
    EnableVSCodeLayout: true,
    EnableMobileLayout: false,
};

const readAll = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || stored === 'undefined' || stored === 'null') {
        return {};
    }
    try {
        return JSON.parse(stored);
    } catch (e) {
        console.warn('Failed to parse settings from localStorage:', e);
        return {};
    }
};

const writeAll = settings => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const init = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        writeAll(DEFAULTS);
    } else {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored || stored === 'undefined' || stored === 'null') {
            return;
        }
        writeAll({
            ...JSON.parse(stored),
            EnableMobileLayout: false,
            EnableExtensionPreview: false,
        });
    }
};

init();

const get = id => {
    const settings = readAll();
    return settings[id];
};

const set = (id, value) => {
    const settings = readAll();
    settings[id] = value;
    writeAll(settings);
    return settings;
};

const getAll = () => readAll();

const save = settings => writeAll(settings);

const reset = () => writeAll(DEFAULTS);

export { get, set, getAll, save, reset, STORAGE_KEY };
