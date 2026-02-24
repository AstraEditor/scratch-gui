import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import log from '../lib/log';
import bindAll from 'lodash.bindall';
import SecurityManagerModal from '../components/tw-security-manager-modal/security-manager-modal.jsx';
import SecurityModals from '../lib/tw-security-manager-constants';
import { getPersistedUnsandboxed, setPersistedUnsandboxed } from '../lib/tw-persisted-unsandboxed.js';
import { AESettings } from '../lib/settings.js'

/* eslint-disable require-atomic-updates */

/**
 * Set of extension URLs that the user has manually trusted to load unsandboxed.
 */
const extensionsTrustedByUser = new Set();

const manuallyTrustExtension = url => {
    extensionsTrustedByUser.add(url);
};

/**
 * Trusted extensions are loaded automatically and without a sandbox.
 * @param {string} url URL as a string.
 * @returns {boolean} True if the extension can is trusted
 */
const isTrustedExtension = url => (
    // Always trust our official extension repostiory.
    url.startsWith('https://extensions.turbowarp.org/') ||

    // AstraEditor
    url.startsWith('https://editors.astras.top/extensions/') ||


    // For development.
    url.startsWith('http://localhost:8000/') ||

    extensionsTrustedByUser.has(url)
);

/**
 * Set of fetch resource hosts that were manually trusted by the user.
 * @type {Set<string>}
 */
const fetchHostsTrustedByUser = new Set();

/**
 * Set of hosts manually trusted by the user for embedding.
 * @type {Set<string>}
 */
const embedHostsTrustedByUser = new Set();

/**
 * @param {URL} parsed Parsed URL object
 * @returns {boolean} True if the URL is part of the builtin set of URLs to always trust fetching from.
 */
const isAlwaysTrustedForFetching = parsed => (
    // If we would trust loading an extension from here, we can trust loading resources too.
    isTrustedExtension(parsed.href) ||

    // Any TurboWarp service such as trampoline
    parsed.origin === 'https://turbowarp.org' ||
    parsed.origin.endsWith('.turbowarp.org') ||
    parsed.origin.endsWith('.turbowarp.xyz') ||

    // GitHub API
    // GitHub Pages allows redirects, so not included here.
    parsed.origin === 'https://raw.githubusercontent.com' ||
    parsed.origin === 'https://gist.githubusercontent.com' ||
    parsed.origin === 'https://api.github.com' ||

    // GitLab API
    // GitLab Pages allows redirects, so not included here.
    parsed.origin === 'https://gitlab.com' ||

    // Sourcehut Pages
    parsed.origin.endsWith('.srht.site') ||

    // Itch
    parsed.origin.endsWith('.itch.io') ||

    // GameJolt
    parsed.origin === 'https://api.gamejolt.com' ||

    // httpbin
    parsed.origin === 'https://httpbin.org' ||

    // ScratchDB
    parsed.origin === 'https://scratchdb.lefty.one'
);

const FETCHABLE_PROTOCOLS = [
    'http:',
    'https:',
    'data:',
    'blob:',
    'ws:',
    'wss:'
];

const VISITABLE_PROTOCOLS = [
    // The important one we want to exclude is javascript:
    'http:',
    'https:',
    'data:',
    'blob:',
    'mailto:',
    'steam:',
    'calculator:'
];

/**
 * @param {string} url Original URL string
 * @param {string[]} protocols List of allowed protocols
 * @returns {URL|null} A URL object if it is valid and of a known protocol, otherwise null.
 */
const parseURL = (url, protocols) => {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return null;
    }
    if (!protocols.includes(parsed.protocol)) {
        return null;
    }
    return parsed;
};

let allowedAudio = false;
let allowedVideo = false;
let allowedReadClipboard = false;
let allowedNotify = false;
let allowedGeolocation = false;

const SECURITY_MANAGER_METHODS = [
    'getSandboxMode',
    'rewriteExtensionURL',
    'canLoadExtensionFromProject',
    'canLoadMultipleExtensionsFromProject',
    'canFetch',
    'canOpenWindow',
    'canRedirect',
    'canRecordAudio',
    'canRecordVideo',
    'canReadClipboard',
    'canNotify',
    'canGeolocate',
    'canEmbed',
    'canDownload'
];

class TWSecurityManagerComponent extends React.Component {
    constructor(props) {
        super(props);
        bindAll(this, [
            'handleAllowed',
            'handleDenied'
        ]);
        bindAll(this, SECURITY_MANAGER_METHODS);
        this.nextModalCallbacks = [];
        this.modalLocked = false;
        this.state = {
            type: null,
            data: null,
            callback: null,
            modalCount: 0
        };
        this.skipExt = false;
        this.pendingExtensions = new Map();
        this.hasShownExtensionsList = false;
    }

    componentDidMount() {
        const vmSecurityManager = this.props.vm.extensionManager.securityManager;
        const propsSecurityManager = this.props.securityManager;
        for (const method of SECURITY_MANAGER_METHODS) {
            vmSecurityManager[method] = propsSecurityManager[method] || this[method];
        }
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     * @returns {Promise<() => Promise<boolean>>} Resolves with a function that you can call to show the modal.
     * The resolved function returns a promise that resolves with true if the request was approved.
     */
    async acquireModalLock() {
        // We need a two-step process for showing a modal so that we don't overwrite or overlap modals,
        // and so that multiple attempts to fetch resources from the same origin will all be allowed
        // with just one click. This means that some places have to wait until previous modals are
        // closed before it knows if it needs to display another modal.

        if (this.modalLocked) {
            await new Promise(resolve => {
                this.nextModalCallbacks.push(resolve);
            });
        } else {
            this.modalLocked = true;
        }

        const releaseLock = () => {
            if (this.nextModalCallbacks.length) {
                const nextModalCallback = this.nextModalCallbacks.shift();
                nextModalCallback();
            } else {
                this.modalLocked = false;
                this.setState({
                    // only clear type in case other data needs to be accessed
                    type: null
                });
            }
        };

        const showModal = async (type, data) => {
            const result = await new Promise(resolve => {
                this.setState(oldState => ({
                    type,
                    data,
                    callback: resolve,
                    modalCount: oldState.modalCount + 1
                }));
            });
            releaseLock();
            return result;
        };

        return {
            showModal,
            releaseLock
        };
    }

    handleAllowed() {
        this.state.callback(true);
    }

    handleDenied() {
        this.state.callback(false);
    }

    /**
     * @param {string} url The extension's URL
     * @returns {string} The VM worker mode to use
     */
    getSandboxMode(url) {
        if (this.skipExt) {
            log.info(`Loading extension ${url} unsandboxed (skipExt enabled)`);
            return 'unsandboxed';
        }
        if (isTrustedExtension(url)) {
            log.info(`Loading extension ${url} unsandboxed`);
            return 'unsandboxed';
        }
        return 'iframe';
    }

    /**
     * Rewrite GitHub raw URLs to jsDelivr CDN to fix MIME type issues
     * GitHub raw returns text/plain which browsers reject for script tags
     * @param {string} extensionURL The original extension URL
     * @returns {Promise<string>} The rewritten URL
     */
    async rewriteExtensionURL(extensionURL) {
        try {
            const url = new URL(extensionURL);
            // Convert GitHub raw URLs to jsDelivr CDN
            if (url.hostname === 'raw.githubusercontent.com') {
                const pathParts = url.pathname.split('/');
                // Format: /username/repository/branch/path/to/file
                if (pathParts.length >= 4) {
                    const username = pathParts[1];
                    const repository = pathParts[2];
                    const branch = pathParts[3];
                    const filePath = pathParts.slice(4).join('/');
                    
                    const cdnURL = `https://cdn.jsdelivr.net/gh/${username}/${repository}@${branch}/${filePath}`;
                    log.info(`Rewrote GitHub raw URL to jsDelivr CDN: ${cdnURL}`);
                    return cdnURL;
                }
            }
        } catch (e) {
            log.warn(`Failed to parse URL for rewriting: ${extensionURL}`, e);
        }
        return extensionURL;
    }

    handleChangeUnsandboxed(e) {
        const checked = e.target.checked;
        this.setState(oldState => ({
            data: {
                ...oldState.data,
                unsandboxed: checked
            }
        }));
    }

    /**
     * @param {string} extensionID The extension ID
     * @param {string} url The extension's URL
     * @returns {Promise<boolean>} Whether the extension can be loaded
     */
    async canLoadExtensionFromProject(extensionID, url) {
        console.log('Loading extension:', extensionID);
        if (isTrustedExtension(url)) {
            log.info(`Loading extension ${extensionID} automatically`);
            return true;
        }

        const { showModal } = await this.acquireModalLock();

        // 检查是否启用了跳过警告
        const skipExtWarn = new AESettings().get('skipExtWarn');

        if (skipExtWarn && !this.hasShownExtensionsList) {
            // 等待一小段时间让所有扩展都被收集
            await new Promise(resolve => setTimeout(resolve, 100));

            // 启用了跳过警告，收集所有扩展并一次性显示
            this.hasShownExtensionsList = true;

            // 过滤掉受信任的扩展，只显示需要用户确认的扩展
            const untrustedExtensions = {};
            for (const [id, extUrl] of this.pendingExtensions) {
                if (!isTrustedExtension(extUrl)) {
                    untrustedExtensions[id] = extUrl;
                }
            }

            // 如果所有扩展都是受信任的，直接返回
            if (Object.keys(untrustedExtensions).length === 0) {
                return true;
            }

            // 显示需要确认的扩展
            const allowed = await showModal(SecurityModals.LoadExtension, {
                extensions: untrustedExtensions,
                showAll: true,
                unsandboxed: getPersistedUnsandboxed(),
                onChangeUnsandboxed: this.handleChangeUnsandboxed.bind(this)
            });

            // 如果同意，加载所有扩展
            if (allowed) {
                setPersistedUnsandboxed(this.state.data.unsandboxed);
                if (this.state.data.unsandboxed) {
                    for (const [id, extUrl] of this.pendingExtensions) {
                        if (!isTrustedExtension(extUrl)) {
                            manuallyTrustExtension(extUrl);
                        }
                    }
                }
                this.skipExt = true;
                return true;
            }
            return false;
        } else {
            // 未启用跳过警告，按原版逻辑每次显示单个扩展
            if (url.startsWith('data:')) {
                const allowed = await showModal(SecurityModals.LoadExtension, {
                    url,
                    unsandboxed: getPersistedUnsandboxed(),
                    onChangeUnsandboxed: this.handleChangeUnsandboxed.bind(this)
                });
                if (allowed) {
                    setPersistedUnsandboxed(this.state.data.unsandboxed);
                }
                if (allowed && this.state.data.unsandboxed) {
                    manuallyTrustExtension(url);
                }
                return allowed;
            }
            return showModal(SecurityModals.LoadExtension, {
                url,
                unsandboxed: false
            });
        }
    }

    /**
     * @param {Array<{id: string, url: string}>} extensions Array of extensions to load
     * @returns {Promise<boolean>} Whether the extensions can be loaded
     */
    async canLoadMultipleExtensionsFromProject(extensions) {
        console.log('Loading multiple extensions:', extensions);

        // 过滤掉受信任的扩展
        const untrustedExtensions = {};
        for (const { id, url } of extensions) {
            if (!isTrustedExtension(url)) {
                untrustedExtensions[id] = url;
            }
        }

        // 如果所有扩展都是受信任的，直接返回
        if (Object.keys(untrustedExtensions).length === 0) {
            return true;
        }

        const { showModal } = await this.acquireModalLock();

        // 检查是否启用了跳过警告
        const skipExtWarn = new AESettings().get('skipExtWarn');

        if (skipExtWarn) {
            // 启用了跳过警告，一次性显示所有扩展
            const allowed = await showModal(SecurityModals.LoadExtension, {
                extensions: untrustedExtensions,
                showAll: true,
                unsandboxed: getPersistedUnsandboxed(),
                onChangeUnsandboxed: this.handleChangeUnsandboxed.bind(this)
            });

            // 如果同意，加载所有扩展
            if (allowed) {
                setPersistedUnsandboxed(this.state.data.unsandboxed);
                if (this.state.data.unsandboxed) {
                    for (const [id, extUrl] of Object.entries(untrustedExtensions)) {
                        manuallyTrustExtension(extUrl);
                    }
                }
                this.skipExt = true;
                return true;
            }
            return false;
        } else {
            // 未启用跳过警告，逐个询问每个扩展
            for (const [id, url] of Object.entries(untrustedExtensions)) {
                const allowed = await showModal(SecurityModals.LoadExtension, {
                    url,
                    unsandboxed: getPersistedUnsandboxed(),
                    onChangeUnsandboxed: this.handleChangeUnsandboxed.bind(this)
                });
                if (allowed) {
                    setPersistedUnsandboxed(this.state.data.unsandboxed);
                    if (this.state.data.unsandboxed) {
                        manuallyTrustExtension(url);
                    }
                }
                if (!allowed) {
                    return false;
                }
            }
            return true;
        }
    }

    /**
     * @param {string} url The resource to fetch
     * @returns {Promise<boolean>} True if the resource is allowed to be fetched
     */
    async canFetch(url) {
        const parsed = parseURL(url, FETCHABLE_PROTOCOLS);
        if (!parsed) {
            return false;
        }
        if (isAlwaysTrustedForFetching(parsed)) {
            return true;
        }
        const { showModal, releaseLock } = await this.acquireModalLock();
        const host = (
            parsed.protocol === 'http:' ||
            parsed.protocol === 'https:' ||
            parsed.protocol === 'ws:' ||
            parsed.protocol === 'wss:'
        ) ? parsed.host : null;
        if (host && fetchHostsTrustedByUser.has(host)) {
            releaseLock();
            return true;
        }
        const allowed = await showModal(SecurityModals.Fetch, {
            url
        });
        if (host && allowed) {
            fetchHostsTrustedByUser.add(host);
        }
        return allowed;
    }

    /**
     * @param {string} url The website to open
     * @returns {Promise<boolean>} True if the website can be opened
     */
    async canOpenWindow(url) {
        const parsed = parseURL(url, VISITABLE_PROTOCOLS);
        if (!parsed) {
            return false;
        }
        const { showModal } = await this.acquireModalLock();
        return showModal(SecurityModals.OpenWindow, {
            url
        });
    }

    /**
     * @param {string} url The website to redirect to
     * @returns {Promise<boolean>} True if the website can be redirected to
     */
    async canRedirect(url) {
        const parsed = parseURL(url, VISITABLE_PROTOCOLS);
        if (!parsed) {
            return false;
        }
        const { showModal } = await this.acquireModalLock();
        return showModal(SecurityModals.Redirect, {
            url
        });
    }

    /**
     * @returns {Promise<boolean>} True if audio can be recorded
     */
    async canRecordAudio() {
        if (!allowedAudio) {
            const { showModal } = await this.acquireModalLock();
            allowedAudio = await showModal(SecurityModals.RecordAudio);
        }
        return allowedAudio;
    }

    /**
     * @returns {Promise<boolean>} True if video can be recorded
     */
    async canRecordVideo() {
        if (!allowedVideo) {
            const { showModal } = await this.acquireModalLock();
            allowedVideo = await showModal(SecurityModals.RecordVideo);
        }
        return allowedVideo;
    }

    /**
     * @returns {Promise<boolean>} True if the clipboard can be read
     */
    async canReadClipboard() {
        if (!allowedReadClipboard) {
            const { showModal } = await this.acquireModalLock();
            allowedReadClipboard = await showModal(SecurityModals.ReadClipboard);
        }
        return allowedReadClipboard;
    }

    /**
     * @returns {Promise<boolean>} True if the notifications are allowed
     */
    async canNotify() {
        if (!allowedNotify) {
            const { showModal } = await this.acquireModalLock();
            allowedNotify = await showModal(SecurityModals.Notify);
        }
        return allowedNotify;
    }

    /**
     * @returns {Promise<boolean>} True if geolocation is allowed.
     */
    async canGeolocate() {
        if (!allowedGeolocation) {
            const { showModal } = await this.acquireModalLock();
            allowedGeolocation = await showModal(SecurityModals.Geolocate);
        }
        return allowedGeolocation;
    }

    /**
     * @param {string} url Frame URL
     * @returns {Promise<boolean>} True if embed is allowed.
     */
    async canEmbed(url) {
        const parsed = parseURL(url, FETCHABLE_PROTOCOLS);
        if (!parsed) {
            return false;
        }
        const host = (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.host : null;
        const { showModal, releaseLock } = await this.acquireModalLock();
        if (host && embedHostsTrustedByUser.has(host)) {
            releaseLock();
            return true;
        }
        const allowed = await showModal(SecurityModals.Embed, { url });
        if (host && allowed) {
            embedHostsTrustedByUser.add(host);
        }
        return allowed;
    }

    /**
     * @param {string} url URL to download
     * @param {string} name Name to download as
     * @returns {Promise<boolean>} True if allowed
     */
    async canDownload(url, name) {
        const parsed = parseURL(url, FETCHABLE_PROTOCOLS);
        if (!parsed) {
            return false;
        }
        const { showModal } = await this.acquireModalLock();
        return showModal(SecurityModals.Download, {
            url,
            name
        });
    }


    render() {
        if (this.state.type) {
            return (
                <SecurityManagerModal
                    type={this.state.type}
                    data={this.state.data}
                    onAllowed={this.handleAllowed}
                    onDenied={this.handleDenied}
                    key={this.state.modalCount}
                    skip={() => { this.handleAllowed(); this.skipExt = true }}
                />
            );
        }
        return null;
    }
}

TWSecurityManagerComponent.propTypes = {
    vm: PropTypes.shape({
        extensionManager: PropTypes.shape({
            securityManager: PropTypes.shape(
                SECURITY_MANAGER_METHODS.reduce((obj, method) => {
                    obj[method] = PropTypes.func.isRequired;
                    return obj;
                }, {})
            ).isRequired
        }).isRequired
    }).isRequired,
    securityManager: PropTypes.shape(Object.fromEntries(SECURITY_MANAGER_METHODS.map(i => [i, PropTypes.func])))
};

TWSecurityManagerComponent.defaultProps = {
    securityManager: {}
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

const mapDispatchToProps = () => ({});

const ConnectedSecurityManagerComponent = connect(
    mapStateToProps,
    mapDispatchToProps
)(TWSecurityManagerComponent);

export {
    ConnectedSecurityManagerComponent as default,
    manuallyTrustExtension,
    isTrustedExtension
};
