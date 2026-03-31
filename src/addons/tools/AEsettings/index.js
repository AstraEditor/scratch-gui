export const getSetting = (id) => {
    const settings = JSON.parse(localStorage.getItem('AEsettings')) || {};
    if(!settings[id]) return false;
    return settings[id];
}