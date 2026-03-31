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