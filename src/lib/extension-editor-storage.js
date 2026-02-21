/**
 * IndexedDB storage service for Extension Editor
 * Stores extension code with metadata
 */

const DB_NAME = 'ScratchExtensionEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'extensions';

class ExtensionEditorStorage {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open IndexedDB'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for extensions
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
        });
    }

    /**
     * Save or update an extension
     * @param {Object} extension - Extension object { id, name, code, createdAt, updatedAt }
     * @returns {Promise<string>} Extension ID
     */
    async saveExtension(extension) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const now = Date.now();

            const extensionData = {
                ...extension,
                updatedAt: now,
                createdAt: extension.createdAt || now
            };

            const request = store.put(extensionData);

            request.onsuccess = () => {
                resolve(extensionData.id);
            };

            request.onerror = () => {
                reject(new Error('Failed to save extension'));
            };
        });
    }

    /**
     * Get all extensions
     * @returns {Promise<Array>} Array of extensions
     */
    async getAllExtensions() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get extensions'));
            };
        });
    }

    /**
     * Get a single extension by ID
     * @param {string} id - Extension ID
     * @returns {Promise<Object>} Extension object
     */
    async getExtension(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to get extension'));
            };
        });
    }

    /**
     * Delete an extension by ID
     * @param {string} id - Extension ID
     * @returns {Promise<void>}
     */
    async deleteExtension(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete extension'));
            };
        });
    }

    /**
     * Delete all extensions
     * @returns {Promise<void>}
     */
    async clearAllExtensions() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear extensions'));
            };
        });
    }

    /**
     * Generate a unique ID for a new extension
     * @returns {string} Unique ID
     */
    generateId() {
        return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance
const extensionEditorStorage = new ExtensionEditorStorage();

export default extensionEditorStorage;
