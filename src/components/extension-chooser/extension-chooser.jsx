import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { defineMessages, injectIntl, intlShape, FormattedMessage } from 'react-intl';

import add from './add.svg';
import custom from './custom.png';
import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';
import AddonHooks from '../../addons/hooks';

import styles from './extension-chooser.css';

import { openPreviewExt } from '../../reducers/modals';
import { setPreviewExtData } from '../../reducers/ae-preview-ext-data';

const messages = defineMessages({
    extensionChooserTitle: {
        defaultMessage: 'Extension Manager',
        description: 'Heading for the extension manager modal',
        id: 'tw.extensionManager.title'
    },
    openLibraryButton: {
        defaultMessage: 'Open Extension Library',
        description: 'Button to open the original extension library',
        id: 'tw.extensionManager.openLibrary'
    }
});

const toResolvedAssetURL = (baseURL, assetPath) => {
    if (!assetPath || typeof assetPath !== 'string') {
        return null;
    }
    if (/^\/\//.test(assetPath)) {
        return `https:${assetPath}`;
    }
    if (/^(?:https?:|data:|blob:|file:)/i.test(assetPath)) {
        return assetPath;
    }
    if (!baseURL) {
        return assetPath;
    }
    const normalizedBaseURL = String(baseURL).replace(/\/+$/, '');
    const normalizedAssetPath = assetPath.replace(/^\/+/, '');
    return `${normalizedBaseURL}/${normalizedAssetPath}`;
};


const ExtensionImage = ({ src, alt, style, fallbackSrc, onLoad }) => {
    const [imageError, setImageError] = useState(false);
    const [loading, setLoading] = useState(true);

    const handleError = () => {
        setImageError(true);
        setLoading(false);
    };

    const handleLoad = () => {
        setLoading(false);
        if (onLoad) {
            onLoad();
        }
    };

    if (imageError || !src) {
        return null;
    }

    return (
        <img
            src={src}
            alt={alt}
            style={style}
            onError={handleError}
            onLoad={handleLoad}
        />
    );
};

ExtensionImage.propTypes = {
    src: PropTypes.string,
    alt: PropTypes.string,
    style: PropTypes.object,
    fallbackSrc: PropTypes.string,
    onLoad: PropTypes.func
};

const ExtensionChooser = props => {
    const { intl, onRequestClose, onOpenExtensionLibrary, onOpenCustomExtensionModal, vm, dispatch } = props;
    const [extensions, setExtensions] = useState([]);
    const [updateExts, setUpdateExts] = useState(false);
    const [galleryData, setGalleryData] = useState({});
    const [backgroundLoaded, setBackgroundLoaded] = useState({});
    const [search, setSearch] = useState("");
    /*
    * a-b : debugger扩展
    */
    const TurboWarp_Exts = ['a-b'];
    /**
     * SPmbpCST无法通过删除方法移除，它不仅仅是个简单扩展
     */
    const RemoveExpect_Exts = ['SPmbpCST']
    /*
    *这里下载的文件实际上为html
    */
    const TurboWarp_IncludeExts = ['ev3', 'makeymakey', 'translate', 'music', 'pen', 'videoSensing', 'text2speech', 'translate', 'microbit', 'boost', 'wedo2', 'gdxfor', 'tw']
    // 删除扩展
    const handleRemoveExtension = (extensionId) => {
        if (!vm || !vm.extensionManager) return;

        vm.extensionManager.unloadExtension(extensionId);

    };

    const getAllDisplayExtensions = (Exts) => {
        let Total = 0;
        Exts.map((item) => {
            if (!TurboWarp_Exts.includes(item.id)) {
                Total += 1;
            }
        })
        return Total
    }
    useEffect(() => {
        const fetchGallery = async () => {
            const extensionsLibs = [
                { id: "tw", url: "https://extensions.turbowarp.org/" },
                { id: "ae", url: "https://editors.astras.top/extensions" },
            ]
            try {
                const getExtLists = extensionsLibs.map(async (item) => {
                    try {
                        const res = await fetch(`${item.url}/generated-metadata/extensions-v0.json`);
                        if (!res.ok) {
                            return { id: item.id, error: true };
                        }
                        const data = await res.json();
                        return { id: item.id, data, error: false };
                    } catch (e) {
                        return { id: item.id, error: true };
                    }
                });
                const results = await Promise.all(getExtLists);
                console.log(results);
                const metadataMap = {};

                results.forEach((result, index) => {
                    if (result.error) {
                        return;
                    }

                    result.data.extensions.forEach(extension => {
                        const sourceURL = extensionsLibs[index].url;
                        metadataMap[extension.id] = {
                            imageURL: toResolvedAssetURL(sourceURL, extension.image),
                            iconURL: toResolvedAssetURL(sourceURL, extension.iconURL),
                            sourceURL
                        };
                    });
                });
                setGalleryData(metadataMap);
            } catch (error) {
                console.error('Failed to fetch extension gallery:', error);
            }
        };
        fetchGallery();
    }, []);

    useEffect(() => {
        if (vm && vm.runtime && vm.runtime._blockInfo) {
            const extensionMap = new Map();
            vm.runtime._blockInfo.forEach(ext => {
                if (ext.id) {
                    extensionMap.set(ext.id, ext);
                }
            });
            const uniqueExtensions = Array.from(extensionMap.values());
            setExtensions(uniqueExtensions);
        }
    }, [vm, updateExts]);

    useEffect(() => {
        if (!vm || !vm.runtime) return;

        const updateInfo = () => {
            if (vm.runtime && vm.runtime._blockInfo) {
                const extensionMap = new Map();
                vm.runtime._blockInfo.forEach(ext => {
                    if (ext.id) {
                        extensionMap.set(ext.id, ext);
                    }
                });
                const uniqueExtensions = Array.from(extensionMap.values());
                setExtensions(uniqueExtensions);
            }
        };

        vm.runtime.on('EXTENSION_ADDED', updateInfo);
        vm.runtime.on('EXTENSION_REMOVED', updateInfo);
        vm.runtime.on('PROJECT_CHANGED', updateInfo)
        return () => {
            vm.runtime.off('EXTENSION_ADDED', updateInfo);
            vm.runtime.off('EXTENSION_REMOVED', updateInfo);
            vm.runtime.off('PROJECT_CHANGED', updateInfo)
        };
    }, [vm]);

    // 获取扩展的背景图
    const getExtensionBackground = (item) => {
        // 对于网页扩展，从 galleryData 获取
        if (galleryData[item.id]) {
            const extData = galleryData[item.id];
            // 如果有 image 字段，使用它（这是背景图）
            if (extData.imageURL) {
                return extData.imageURL;
            }
            // 否则使用 iconURL
            if (extData.iconURL) {
                return extData.iconURL;
            }
            if (extData.sourceURL) {
                return toResolvedAssetURL(extData.sourceURL, `images/${item.id}.svg`);
            }
        }
        if (item.iconURL) {
            return toResolvedAssetURL(null, item.iconURL);
        }

        // 最后尝试使用默认路径
        return `https://extensions.turbowarp.org/images/${item.id}.svg`;
    };

    // 背景图加载成功回调
    const handleBackgroundLoad = (extensionId) => {
        setBackgroundLoaded(prev => ({
            ...prev,
            [extensionId]: true
        }));
    };

    const handleClose = () => {
        onRequestClose();
    };

    const handleOpenLibrary = () => {
        onOpenExtensionLibrary();
    };

    const handleOpenCustomExtension = () => {
        onOpenCustomExtensionModal();
    };

    const getExt = (extensionId) => {
        // 获取扩展的下载 URL
        let url = null;

        if (vm && vm.extensionManager) {
            // 检查是否是内置扩展
            if (vm.extensionManager.isBuiltinExtension(extensionId)) {
                url = `https://extensions.turbowarp.org/${extensionId}.js`;
            } else {
                // 从 getExtensionURLs 获取自定义扩展的 URL
                const urls = vm.extensionManager.getExtensionURLs();
                url = urls[extensionId];
            }
        }
        return url


    }

    const getOpcodefromExt = (Ext) => {
        const AllOpcode = [];
        const color = Ext.color1 || '#0099ff'
        Ext.blocks.forEach((item, index) => {
            if (item.info.opcode == undefined) return;
            if (item.info.blockType == "label") {
                AllOpcode.push({
                    isSVG: true,
                    data: `
                <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                    <g>
                        <text xml:space="preserve" text-anchor="start" font-family="Consolas, 'Courier New', monospace, 'MiSans'" font-size="24" id="svg_1" y="20" x="-380" stroke-width="0" stroke="#888" fill=${color}>
                            ${item.info.text}
                        </text>
                        <line  y2="30" x2="0" y1="30" x1="255" stroke=${color} fill="none"/>
                    </g>
                </svg>
                `
                }); return
            };
            AllOpcode.push(Ext.id + "_" + item.info.opcode) //获取完整的opcode
        });

        return {
            AllOpcode
        }
    }

    const getSVGfromOpcodes = (Opcodes) => {
        const blocksSVG = [];
        const opcodes = Opcodes.AllOpcode;
        opcodes.forEach((item, index) => {
            console.log(item)
            try {
                if (item.isSVG) {
                    blocksSVG.push(item.data);
                } else {
                    const blockSVGgen = AddonHooks.blocklyWorkspace.newBlock(item);
                    blockSVGgen.initSvg();
                    blockSVGgen.render();
                    blocksSVG.push(blockSVGgen.getSvgRoot().innerHTML);
                    // 删除积木
                    blockSVGgen.dispose();
                };
            } catch (e) {
                console.warn("Can't spawn blocks")
            }

        })
        console.log(blocksSVG)
        return blocksSVG
    }
    return (
        <Modal
            fullScreen
            contentLabel={intl.formatMessage(messages.extensionChooserTitle)}
            id="extensionManager"
            onRequestClose={handleClose}
        >
            <div className={styles.container}>
                <Box className={styles.header}>
                    <button
                        className={styles.openLibraryButton}
                        onClick={handleOpenLibrary}
                    >
                        <img src={add} draggable={false} className={styles.openLibraryButtonIcon} />
                    </button>
                    <button
                        className={styles.openCustomExtension}
                        onClick={handleOpenCustomExtension}
                    >
                        <img src={custom} draggable={false} className={styles.openLibraryButtonIcon} />
                    </button>
                </Box>
                <div className={styles.content}>
                    <>
                        {extensions.filter(item => !TurboWarp_Exts.includes(item.id)).length == 0 ? (
                            <span className={styles.tip}>
                                <FormattedMessage
                                    defaultMessage="Nothing... Try loading some extensions"
                                    description="Loaded extensions is empty"
                                    id="tw.extensionManager.tip"
                                />
                            </span>
                        ) : (
                            <span className={styles.allExts}>
                                <FormattedMessage
                                    defaultMessage="Loaded {LENGTH} extensions in total."
                                    description="Loaded extensions isn't empty"
                                    id="tw.extensionManager.total"
                                    values={{
                                        LENGTH: getAllDisplayExtensions(extensions)
                                    }}
                                />
                            </span>
                        )}
                        {extensions.map((item, index) => {
                            return (
                                (!TurboWarp_Exts.includes(item.id)) && (
                                    <div
                                        key={item.id || `ext-${index}`}
                                        style={{
                                            backgroundColor: item.color2 == undefined ? item.color1 : item.color2,
                                            position: 'relative'
                                        }}
                                        className={styles.Extbg}
                                    >
                                        <ExtensionImage
                                            src={getExtensionBackground(item)}
                                            alt={item.name}
                                            onLoad={() => handleBackgroundLoad(item.id || index)}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                height: '100%',
                                                width: 'auto',
                                                zIndex: 7,
                                                WebkitMaskImage: 'linear-gradient(to right, black 0%, black 65%,  transparent 100%)',
                                                maskImage: 'linear-gradient(to right, black 0%, black 65%, transparent 100%)',
                                                pointerEvents: 'none'
                                            }}
                                        />
                                        {backgroundLoaded[item.id || index] && (
                                            <div style={{
                                                width: '175px'
                                            }} />
                                        )}
                                        <ExtensionImage
                                            src={item.menuIconURI}
                                            alt={item.name}
                                            style={{
                                                filter: 'drop-shadow(0px 0px 8px rgba(0, 0, 0, 0.3))',
                                                marginLeft: '20px',
                                                width: '48px',
                                                height: '48px',
                                                zIndex: '11'
                                            }}
                                        />
                                        <div className={styles.manages}>
                                            <div>

                                                <div style={{ position: 'relative', zIndex: '11' }}>
                                                    <span className={styles.ExtTitle} style={{
                                                        textShadow: '0 0 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.5)'
                                                    }}>
                                                        {item.name}
                                                    </span><br />
                                                    <span className={styles.ExtId} style={{
                                                        textShadow: '0 0 3px rgba(0, 0, 0, 0.8), 0 0 6px rgba(0, 0, 0, 0.8), 0 1px 2px rgba(0, 0, 0, 0.5)'
                                                    }}>
                                                        {item.id}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <button
                                                    className={styles.button}
                                                    style={{
                                                        color: item.color2 == undefined ? item.color1 : item.color2
                                                    }}
                                                    onClick={() => {
                                                        dispatch(setPreviewExtData(getSVGfromOpcodes(getOpcodefromExt(item))))
                                                        dispatch(openPreviewExt());
                                                    }}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Preview"
                                                        description="text of View "
                                                        id="tw.extensionManager.preview"
                                                    />
                                                </button>
                                                {(!TurboWarp_IncludeExts.includes(item.id)) && (
                                                    <button
                                                        className={styles.button}
                                                        style={{
                                                            color: item.color2 == undefined ? item.color1 : item.color2
                                                        }}
                                                        onClick={() => {
                                                            fetch(getExt(item.id))
                                                                .then(response => response.blob())
                                                                .then(blob => {
                                                                    const link = document.createElement('a');
                                                                    link.href = URL.createObjectURL(blob);
                                                                    link.download = `${item.name}.js`;
                                                                    link.target = "_blank";
                                                                    link.click();
                                                                })
                                                        }}
                                                    >
                                                        <FormattedMessage
                                                            defaultMessage="Export"
                                                            description="text of Export "
                                                            id="tw.extensionManager.export"
                                                        />
                                                    </button>
                                                )}
                                                {!RemoveExpect_Exts.includes(item.id) && (
                                                    <button
                                                        className={styles.button}
                                                        style={{
                                                            color: item.color2 == undefined ? item.color1 : item.color2
                                                        }}
                                                        onClick={() => { handleRemoveExtension(item.id) }}
                                                    >
                                                        <FormattedMessage
                                                            defaultMessage="Remove"
                                                            description="text of Remove "
                                                            id="tw.extensionManager.remove"
                                                        />
                                                    </button>
                                                )}

                                            </div>
                                        </div>
                                    </div>
                                )
                            )
                        })}
                    </>
                </div>

            </div>
        </Modal>
    );
};

ExtensionChooser.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func,
    onOpenExtensionLibrary: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.object,
    dispatch: PropTypes.func.isRequired
};

export default injectIntl(ExtensionChooser);
