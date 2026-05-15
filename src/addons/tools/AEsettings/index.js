export const getSetting = (id) => {
    try {
        const settings = JSON.parse(localStorage.getItem('AESettings')) || {};
        if(!settings[id]) return false;
        return settings[id];
    } catch (e) {
        console.error('Failed to get setting:', e);
        return false;
    }
}

/**
 * @returns {'dark' | 'light'}
 */
export const getThemeMode = () => {
    try{
        const tw_gui = JSON.parse(localStorage.getItem('tw:theme'))
        return tw_gui.gui || 'dark'
    } catch (e) {
        return 'dark'
    }
}