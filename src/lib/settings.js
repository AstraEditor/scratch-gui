
export class AESettings {
        constructor() {
                this.storageKey = "AESettings";
                this.init();
                this.initset = {
                        enableREADMEAutoDisplay: true,
                        enableHTMLSupportInREADME: false,
                        skipExtWarn: false,
                        EnableExtensionPreview: false,
                        EnableVSCodeLayout: true,
                        EnableMobileLayout: false
                };
        }

        init() {
                if (!localStorage.getItem(this.storageKey)) {
                        const defaultSettings = this.initset
                        this.save(defaultSettings);
                }
        }

        getAll() {
                const stored = localStorage.getItem(this.storageKey);
                if (!stored || stored === 'undefined' || stored === 'null') {
                        return {};
                }
                try {
                        return JSON.parse(stored);
                } catch (e) {
                        console.warn('Failed to parse settings from localStorage:', e);
                        // If parsing fails, return default settings
                        return {};
                }
        }

        get(id) {

                const settings = this.getAll();
                return settings[id];
        }

        set(id, value) {
                const settings = this.getAll();
                settings[id] = value;
                this.save(settings);
                return settings;
        }

        save(settings) {
                localStorage.setItem(this.storageKey, JSON.stringify(settings));
        }
        reset() {
                this.save(this.initset);
        }
}