import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';
import { defineMessages, injectIntl, intlShape } from 'react-intl';
import log from '../lib/log';

import extensionLibraryContent, {
    galleryError as galleryTwError,
    galleryLoading as galleryTwLoading,
    galleryMore as galleryTwMore,
    aeGalleryError as galleryAeError,
    aeGalleryMore as galleryAeMore
} from '../lib/libraries/extensions/index.jsx';
import extensionTags from '../lib/libraries/tw-extension-tags';

import LibraryComponent from '../components/library/library.jsx';
import extensionIcon from '../components/action-menu/icon--sprite.svg';


const messages = defineMessages({
    extensionTitle: {
        defaultMessage: 'Choose an Extension',
        description: 'Heading for the extension library',
        id: 'gui.extensionLibrary.chooseAnExtension'
    }
});

const toLibraryItem = extension => {
    if (typeof extension === 'object') {
        return ({
            rawURL: extension.iconURL || extensionIcon,
            ...extension
        });
    }
    return extension;
};

const translateGalleryItem = (extension, locale) => ({
    ...extension,
    name: extension.nameTranslations[locale] || extension.name,
    description: extension.descriptionTranslations[locale] || extension.description
});

let cachedGallery = null;
let cachedTwError = false;
let cachedAeError = false;

const fetchLibrary = async () => {
    const getExtLists = extensionTags.map(async (item) => {
        if (item.tag === 'scratch') {
            return { id: item.tag, data: {extensions: []}, error: false };
        }
        try {
            const res = await fetch(`${item.url}/generated-metadata/extensions-v0.json`);
            if (!res.ok) {
                return { id: item.tag, error: true };
            }
            const data = await res.json();
            return { id: item.tag, data, error: false };
        } catch (e) {
            return { id: item.tag, error: true };
        }
    });

    const results = await Promise.all(getExtLists);
    console.log(results);
    
    let extensionsData = {
        "extensions": []
    };
    
    results.forEach((result, index) => {
        if (result.error) {
            if (result.id === 'tw') {
                cachedTwError = true;
            } else if (result.id === 'ae') {
                cachedAeError = true;
            }
            return;
        }
        
        extensionsData.extensions.push(extensionTags[index]);
        result.data.extensions.forEach(extension => {
            extensionsData.extensions.push(extension);
        });
    })


    const returnData = []
    let tag = "";
    let link = "";
    extensionsData.extensions.forEach((extension, index) => {
        if (extension.tag !== undefined && extension.url !== undefined) {
            tag = extension.tag; //平台
            link = extension.url //链接
        } else { //扩展
            returnData.push({
                name: extension.name,
                nameTranslations: extension.nameTranslations || {},
                description: extension.description,
                descriptionTranslations: extension.descriptionTranslations || {},
                extensionId: extension.id,
                extensionURL: `${link}/${extension.slug}.js`,
                iconURL: extension.image ? `${link}/${extension.image}` : 'https://extensions.turbowarp.org/images/unknown.svg',
                tags: [tag],
                credits: [
                    ...(extension.original || []),
                    ...(extension.by || [])
                ]
                    .filter(credit => credit && typeof credit === 'object')
                    .map(credit => {
                        if (credit.link) {
                            return (
                                <a
                                    href={credit.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={credit.name}
                                >
                                    {credit.name}
                                </a>
                            );
                        }
                        return credit.name;
                    }),
                docsURI: extension.docs ? `${link}/${extension.slug}` : null,
                samples: extension.samples ? extension.samples.map(sample => ({
                    href: `${process.env.ROOT}editor?project_url=${link}/samples/${encodeURIComponent(sample)}.sb3`,
                    text: sample
                })) : null,
                incompatibleWithScratch: !extension.scratchCompatible,
                featured: true
            })
        }
    })
    return {
        gallery: returnData,
        twError: cachedTwError,
        aeError: cachedAeError
    };
};

class ExtensionLibrary extends React.PureComponent {
    constructor(props) {
        super(props);
        bindAll(this, [
            'handleItemSelect'
        ]);
        this.state = {
            gallery: cachedGallery,
            twGalleryError: null,
            aeGalleryError: null,
            galleryTimedOut: false
        };
    }
    componentDidMount() {
        if (!this.state.gallery) {
            const timeout = setTimeout(() => {
                this.setState({
                    galleryTimedOut: true
                });
            }, 750);

            fetchLibrary()
                .then(result => {
                    cachedGallery = result.gallery;
                    this.setState({
                        gallery: result.gallery,
                        twGalleryError: result.twError ? galleryTwError : null,
                        aeGalleryError: result.aeError ? galleryAeError : null
                    });
                    clearTimeout(timeout);
                })
                .catch(error => {
                    log.error(error);
                    this.setState({
                        twGalleryError: galleryTwError,
                        aeGalleryError: galleryAeError
                    });
                    clearTimeout(timeout);
                });
        }
    }
    handleItemSelect(item) {
        if (!item) {
            log.error('handleItemSelect received undefined item');
            return;
        }

        if (item.href) {
            return;
        }

        const extensionId = item.extensionId;

        if (extensionId === 'custom_extension') {
            this.props.onOpenCustomExtensionModal();
            return;
        }

        if (extensionId === 'upload_extension') {
            window.open("./upload.html", "_blank");
            return;
        }

        if (extensionId === 'procedures_enable_return') {
            this.props.onEnableProcedureReturns();
            this.props.onCategorySelected('myBlocks');
            return;
        }

        const url = item.extensionURL ? item.extensionURL : extensionId;
        if (!item.disabled) {
            if (this.props.vm.extensionManager.isExtensionLoaded(extensionId)) {
                this.props.onCategorySelected(extensionId);
            } else {
                this.props.vm.extensionManager.loadExtensionURL(url)
                    .then(() => {
                        this.props.onCategorySelected(extensionId);
                    })
                    .catch(err => {
                        log.error(err);
                        // eslint-disable-next-line no-alert
                        alert(err);
                    });
            }
        }
    }
    render() {
        let library = null;
        if (this.state.gallery || this.state.twGalleryError || this.state.aeGalleryError || this.state.galleryTimedOut) {
            library = extensionLibraryContent.map(toLibraryItem);
            library.push('---');
            
            const locale = this.props.intl.locale;
            
            // TW 扩展区
            if (this.state.twGalleryError) {
                library.push(toLibraryItem(galleryTwError));
            } else if (this.state.gallery) {
                library.push(toLibraryItem(galleryTwMore));
                library.push(
                    ...this.state.gallery
                        .filter(i => i.tags.includes('tw') && i.extensionId !== 'faceSensing')
                        .map(i => translateGalleryItem(i, locale))
                        .map(toLibraryItem)
                );
            } else {
                library.push(toLibraryItem(galleryTwLoading));
            }
            
            // AE 扩展区
            if (this.state.aeGalleryError) {
                library.push(toLibraryItem(galleryAeError));
            } else if (this.state.gallery) {
                library.push(toLibraryItem(galleryAeMore));
                library.push(
                    ...this.state.gallery
                        .filter(i => i.tags.includes('ae'))
                        .map(i => translateGalleryItem(i, locale))
                        .map(toLibraryItem)
                );
            } else {
                library.push(toLibraryItem(galleryAeMore));
            }
        }

        return (
            <LibraryComponent
                data={library}
                filterable
                persistableKey="extensionId"
                id="extensionLibrary"
                tags={extensionTags}
                title={this.props.intl.formatMessage(messages.extensionTitle)}
                visible={this.props.visible}
                onItemSelected={this.handleItemSelect}
                onRequestClose={this.props.onRequestClose}
            />
        );
    }
}

ExtensionLibrary.propTypes = {
    intl: intlShape.isRequired,
    onCategorySelected: PropTypes.func,
    onEnableProcedureReturns: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onRequestClose: PropTypes.func,
    visible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired // eslint-disable-line react/no-unused-prop-types
};

export default injectIntl(ExtensionLibrary);
