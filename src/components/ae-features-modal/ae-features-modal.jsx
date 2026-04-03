import { defineMessages, FormattedMessage, intlShape, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import classNames from 'classnames';
import fullLogo from './fulllogo.png';
import version from '../../lib/ae-version.js';

import styles from './ae-features-modal.css';
import backIcon from './arrow_button.svg';
import dorpdownIcon from './dropdown-caret.svg'

import README_IMG_1 from './README/1.png';
import README_IMG_2 from './README/2.png';
import README_IMG_3 from './README/3.png';
import README_IMG_4 from './README/4.png';

/* Copy it from settings Modal */
const Header = props => (
    <div className={styles.header}>
        {props.children}
        <div className={styles.divider} />
        <div
            style={props.enabled ? {
                "transform": "rotate(0deg)",
                "cursor": "pointer"
            } : {
                "transform": "rotate(180deg)",
                "cursor": "pointer"
            }}
            onClick={() => props.setEnabled(!props.enabled)}
        > <img src={dorpdownIcon} className={styles.dorpdownIcon} alt="more" /></div>

    </div>
);
Header.propTypes = {
    children: PropTypes.node
};

const isUpdated = () => {
    try {
        const lastVersion = localStorage.getItem('ae:lastVersion');
        if (!lastVersion) { //第一次进入
            localStorage.setItem('ae:lastVersion', version.version);
            return false;
        }
        if (lastVersion !== version.version) {
            localStorage.setItem('ae:lastVersion', version.version);
            return true;
        }
        return false
    } catch (e) {
        return false;
    }
}


const mainMessages = defineMessages({
    title: {
        defaultMessage: 'Welcome to AstraEditor!',
        description: 'Title of the ae-features modal',
        id: 'tw.aeFeaturesModal.title'
    },
    introduction: {
        defaultMessage: 'We made more features to make your coding speed lighting fast.',
        description: 'Introduction of the ae-features modal',
        id: 'tw.aeFeaturesModal.introduction'
    },
    linkDiv: {
        defaultMessage: 'What is new?',
        description: 'Link of the ae-features modal',
        id: 'tw.aeFeaturesModal.linkDiv'
    },
    MoreOptimizes: {
        defaultMessage: 'More Optimizes',
        description: 'More Optimizes of the ae-features modal',
        id: 'tw.aeFeaturesModal.MoreOptimizes'
    },
    MoreNewAddons: {
        defaultMessage: 'More New Addons',
        description: 'More New Addons of the ae-features modal',
        id: 'tw.aeFeaturesModal.MoreNewAddons'
    },
    InitializationMessage: {
        defaultMessage: 'You need some settings to be initialized before using AstraEditor.',
        description: 'Initialization Message of the ae-features modal',
        id: 'tw.aeFeaturesModal.InitializationMessage'
    },
    InitializationStart: {
        defaultMessage: 'Here we go!',
        description: 'Initialization Start Message in button of the ae-features modal',
        id: 'tw.aeFeaturesModal.InitializationStart'
    },
    warn: {
        defaultMessage: 'You need to initialize!',
        description: 'Warn Message of the ae-features modal',
        id: 'tw.aeFeaturesModal.warn'
    },
    More: {
        defaultMessage: 'More',
        description: 'More Message of the ae-features modal',
        id: 'tw.aeFeaturesModal.more'
    },
    StayTuned: {
        defaultMessage: 'Stay tuned.',
        description: 'Stay tuned Message of the ae-features modal',
        id: 'tw.aeFeaturesModal.stayTuned'
    }
});

const InitializeUI = props => {
    const [nowInitPage, setInitPage] = useState(1)
    return (
        <>
            {nowInitPage === 2 && (
                <>
                    <h1>
                        <FormattedMessage
                            defaultMessage="Thank You!"
                            description='last init of the ae-features modal'
                            id='tw.aeFeaturesModal.Initltitle'
                        />
                    </h1>
                    <p>
                        <FormattedMessage
                            defaultMessage="All done! Now you can enjoy AstraEditor! ;)"
                            description='last init intro of the ae-features modal'
                            id='tw.aeFeaturesModal.Initlintro'
                        />
                    </p><br />
                    <Box className={styles.buttonRow}>
                        <button
                            className={styles.okButton}
                            onClick={() => { props.onClose() }}
                            disabled={!props.valueValid}
                        >
                            <FormattedMessage
                                defaultMessage="Done"
                                description="Next button"
                                id="tw.aeFeaturesModal.InitDone"
                            />
                        </button>
                    </Box>
                </>
            )}
            {nowInitPage === 1 && (
                <>
                    <h1>
                        <FormattedMessage
                            defaultMessage="How should we call you?"
                            description='first init of the ae-features modal'
                            id='tw.aeFeaturesModal.Init1title'
                        />
                    </h1>
                    <p>
                        <FormattedMessage
                            defaultMessage="Please type your user name in this input ↓"
                            description='first init intro of the ae-features modal'
                            id='tw.aeFeaturesModal.Init1intro'
                        />
                    </p><br />
                    <Box>
                        <input
                            autoFocus
                            className={styles.textInput}
                            value={props.value}
                            onChange={props.onChange}
                            onFocus={props.onFocus}
                            onKeyPress={props.onKeyPress}
                            pattern="[a-zA-Z0-9_\-]*"
                            maxLength="20"
                            spellCheck="false"
                        />
                    </Box>
                    <Box className={styles.buttonRow}>
                        <button
                            className={styles.okButton}
                            onClick={() => { props.onOk(); setInitPage(2) }}
                            disabled={!props.valueValid}
                        >
                            <FormattedMessage
                                defaultMessage="Next"
                                description="Next button"
                                id="tw.aeFeaturesModal.InitNext"
                            />
                        </button>
                    </Box>
                </>
            )}
        </>
    )
}

InitializeUI.propTypes = {
    value: PropTypes.string.isRequired,
    valueValid: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    onFocus: PropTypes.func.isRequired,
    onKeyPress: PropTypes.func.isRequired,
    onOk: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired
};
const AeFeaturesComponent = props => {
    const [nowPage, setPage] = useState('main');
    const [showFeatures, setShowFeatures] = useState(false);
    return (
        <Modal
            className={styles.modalContent}
            onRequestClose={() => {
                if (isUpdated() || localStorage.getItem('ae:webBuild') !== version.webBuild) {
                    props.onCancel()
                } else {
                    alert(props.intl.formatMessage(mainMessages.warn))
                }
            }}
            contentLabel={props.intl.formatMessage(mainMessages.title)}
            id="aeFeaturesModal"
        >
            <Box className={styles.body}>
                {nowPage === 'init' &&
                    (<InitializeUI
                        value={props.value}
                        valueValid={props.valueValid}
                        onChange={props.onChange}
                        onFocus={props.onFocus}
                        onKeyPress={props.onKeyPress}
                        onOk={props.onOk}
                        onReset={props.onReset}
                        onClose={props.onCancel}
                    />)
                }
                {nowPage !== 'main' && nowPage !== 'init'
                    //这里是回退按钮
                    && (
                        <button className={styles.backButton} onClick={() => setPage('main')}>
                            <img src={backIcon} alt="back" className={styles.backIcon} />
                        </button>
                    )}
                {nowPage === 'readme' && (
                    <>
                        <h1 className={styles.title}>
                            README
                        </h1>
                        <div style={{
                            maxHeight: '50vh',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}>
                            <h2>
                                <FormattedMessage
                                    defaultMessage="What is?"
                                    description='README Introduction of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeIntroduction'
                                />
                            </h2>
                            <p>
                                <FormattedMessage
                                    defaultMessage="README can show your project details, instructions, and more. You can create a README in your project, and it will be save in project."
                                    description='README Introduction Detail of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeIntroductionDetail'
                                />
                            </p>
                            <br />
                            <h2>
                                <FormattedMessage
                                    defaultMessage="How to use this?"
                                    description='How to use README of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeHowToUse'
                                />
                            </h2>

                            <img src={README_IMG_1} alt="README_CREATE_COMMENT" className={styles.readmeImg} />
                            <p>
                                <FormattedMessage
                                    defaultMessage='1. Right-click in the blank area of the blocks area to open the context menu, then click "Add Comment" in it.'
                                    description='First step of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeFirst'
                                />
                            </p>

                            <img src={README_IMG_2} alt="README_TYPE_CONTENT" className={styles.readmeImg} style={{
                                width: '50%',
                            }} />
                            <p>
                                <FormattedMessage
                                    defaultMessage={'2. Type "#README" at the beginning, then write the project\'s README in Markdown format after that.'}
                                    description='Second step of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeSecond'
                                />
                            </p>
                            <img src={README_IMG_3} alt="README_TYPE_CONTENT" className={styles.readmeImg} style={{
                                width: '75%',
                            }} /><br />
                            <img src={README_IMG_4} alt="README_TYPE_CONTENT" className={styles.readmeImg} style={{
                                width: '75%',
                            }} />
                            <p>
                                <FormattedMessage
                                    defaultMessage={'Click button "README" and enjoy!'}
                                    description='last step of the ae-features modal'
                                    id='tw.aeFeaturesModal.readmeLast'
                                />
                            </p><br />
                            <a href="https://editors.astras.top/document/features/readme/" target="_blank" rel="noreferrer">
                                <FormattedMessage
                                    {...mainMessages.More}
                                />
                            </a>
                        </div>
                    </>
                )}
                {nowPage === 'main' && (
                    <>
                        <img src={fullLogo} alt="AstraEditor" className={styles.logo} />
                        <h1 className={styles.title}>
                            <FormattedMessage {...mainMessages.title} />
                        </h1>
                        <p className={styles.intro}><i>
                            <FormattedMessage {...mainMessages.introduction} />
                        </i></p>

                        <hr className={styles.hr} />
                        {isUpdated() ?
                            <button className={styles.linkDivContent} onClick={() => window.open('https://github.com/AstraEditor/Desktop/releases', '_blank')}>
                                <FormattedMessage
                                    defaultMessage="You have updated to version {version} ( {date} )! Click this button to see what's new in this version"
                                    description='Update Message of the ae-features modal'
                                    id='tw.aeFeaturesModal.UpdateMessage'
                                    values={{
                                        version: version.version,
                                        date: version.date
                                    }}
                                />
                            </button>
                            : localStorage.getItem('ae:webBuild') !== version.webBuild ? (
                                <>
                                    <h3>
                                        <FormattedMessage
                                            defaultMessage="Web is updated in {date} :"
                                            description='Web Update Message of the ae-features modal'
                                            id='tw.aeFeaturesModal.UpdateMessageofWeb'
                                            values={{
                                                date: version.date
                                            }}
                                        />
                                    </h3>
                                    <ul>
                                        {localStorage.getItem('ae:webBuild') !== version.webBuild && (
                                            version.webUpdate.map(content => (
                                                <li>
                                                    {content}
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </>
                            ) : (
                                <>
                                    <h4>
                                        <FormattedMessage {...mainMessages.InitializationMessage} />
                                    </h4>
                                    <button className={styles.linkDivContent} onClick={() => setPage('init')}>
                                        <FormattedMessage {...mainMessages.InitializationStart} />
                                    </button>
                                </>
                            )
                        }
                        <Header
                            enabled={showFeatures}
                            setEnabled={(enabled) => setShowFeatures(enabled)}
                        >
                            <FormattedMessage {...mainMessages.linkDiv} />
                        </Header>

                        {showFeatures &&
                            (<div className={styles.linkDiv}>
                                <div className={styles.linkDivContent} onClick={() => setPage('readme')}>
                                    README
                                </div>
                                <div className={styles.linkDivContent} onClick={() => alert(props.intl.formatMessage(mainMessages.StayTuned))}>
                                    <FormattedMessage {...mainMessages.MoreOptimizes} />
                                </div>
                                <div className={styles.linkDivContent} onClick={() => alert(props.intl.formatMessage(mainMessages.StayTuned))}>
                                    <FormattedMessage {...mainMessages.MoreNewAddons} />
                                </div>
                                <br />
                                <div className={styles.linkDivContent} onClick={() => alert(props.intl.formatMessage(mainMessages.StayTuned))}>
                                    <FormattedMessage {...mainMessages.More} />
                                </div>
                            </div>
                            )
                        }


                    </>
                )}

            </Box>
        </Modal>
    )
};

AeFeaturesComponent.propTypes = {
    intl: intlShape,
    mustChangeUsername: PropTypes.bool,
    value: PropTypes.string.isRequired,
    valueValid: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    onFocus: PropTypes.func.isRequired,
    onKeyPress: PropTypes.func.isRequired,
    onOk: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

export default injectIntl(AeFeaturesComponent);
