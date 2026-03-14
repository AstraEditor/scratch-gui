import { defineMessages, FormattedMessage, intlShape, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import FancyCheckbox from '../tw-fancy-checkbox/checkbox.jsx';
import Input from '../forms/input.jsx';
import BufferedInputHOC from '../forms/buffered-input-hoc.jsx';
import DocumentationLink from '../tw-documentation-link/documentation-link.jsx';
import styles from './settings-modal.css';
import helpIcon from './help-icon.svg';
import { APP_NAME } from '../../lib/brand.js';
import { AESettings } from '../../lib/settings.js'

/* eslint-disable react/no-multi-comp */

const BufferedInput = BufferedInputHOC(Input);

const messages = defineMessages({
    title: {
        defaultMessage: 'Advanced Settings',
        description: 'Title of settings modal',
        id: 'tw.settingsModal.title'
    },
    help: {
        defaultMessage: 'Click for help',
        description: 'Hover text of help icon in settings',
        id: 'tw.settingsModal.help'
    }
});

const LearnMore = props => (
    <React.Fragment>
        {' '}
        <DocumentationLink {...props}>
            <FormattedMessage
                defaultMessage="Learn more."
                id="gui.alerts.cloudInfoLearnMore"
            />
        </DocumentationLink>
    </React.Fragment>
);

class UnwrappedSetting extends React.Component {
    constructor(props) {
        super(props);
        bindAll(this, [
            'handleClickHelp'
        ]);
        this.state = {
            helpVisible: false
        };
    }
    componentDidUpdate(prevProps) {
        if (this.props.active && !prevProps.active) {
            // eslint-disable-next-line react/no-did-update-set-state
            this.setState({
                helpVisible: true
            });
        }
    }
    handleClickHelp() {
        this.setState(prevState => ({
            helpVisible: !prevState.helpVisible
        }));
    }
    render() {
        return (
            <div
                className={classNames(styles.setting, {
                    [styles.active]: this.props.active
                })}
            >
                <div className={styles.label}>
                    {this.props.primary}
                    <button
                        className={styles.helpIcon}
                        onClick={this.handleClickHelp}
                        title={this.props.intl.formatMessage(messages.help)}
                    >
                        <img
                            src={helpIcon}
                            draggable={false}
                        />
                    </button>
                </div>
                {this.state.helpVisible && (
                    <div className={styles.detail}>
                        {this.props.help}
                        {this.props.slug && <LearnMore slug={this.props.slug} />}
                    </div>
                )}
                {this.props.secondary}
            </div>
        );
    }
}
UnwrappedSetting.propTypes = {
    intl: intlShape,
    active: PropTypes.bool,
    help: PropTypes.node,
    primary: PropTypes.node,
    secondary: PropTypes.node,
    slug: PropTypes.string
};
const Setting = injectIntl(UnwrappedSetting);

const BooleanSetting = ({ value, onChange, label, ...props }) => (
    <Setting
        {...props}
        active={value}
        primary={
            <label className={styles.label}>
                <FancyCheckbox
                    className={styles.checkbox}
                    checked={value}
                    onChange={onChange}
                />
                {label}
            </label>
        }
    />
);
BooleanSetting.propTypes = {
    onChange: PropTypes.func.isRequired,
    value: PropTypes.bool.isRequired,
    label: PropTypes.node.isRequired
};

const HighQualityPen = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="High Quality Pen"
                description="High quality pen setting"
                id="tw.settingsModal.highQualityPen"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Allows pen projects to render at higher resolutions and disables some coordinate rounding in the editor. Not all projects benefit from this setting and it may impact performance."
                description="High quality pen setting help"
                id="tw.settingsModal.highQualityPenHelp"
            />
        }
        slug="high-quality-pen"
    />
);

const CustomFPS = props => (
    <BooleanSetting
        value={props.framerate !== 30}
        onChange={props.onChange}
        label={
            <FormattedMessage
                defaultMessage="60 FPS (Custom FPS)"
                description="FPS setting"
                id="tw.settingsModal.fps"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Runs scripts 60 times per second instead of 30. Most projects will not work properly with this enabled. You should try Interpolation with 60 FPS mode disabled if that is the case. {customFramerate}."
                description="FPS setting help"
                id="tw.settingsModal.fpsHelp"
                values={{
                    customFramerate: (
                        <a
                            onClick={props.onCustomizeFramerate}
                            tabIndex="0"
                        >
                            <FormattedMessage
                                defaultMessage="Click to use a framerate other than 30 or 60"
                                description="FPS settings help"
                                id="tw.settingsModal.fpsHelp.customFramerate"
                            />
                        </a>
                    )
                }}
            />
        }
        slug="custom-fps"
    />
);
CustomFPS.propTypes = {
    framerate: PropTypes.number,
    onChange: PropTypes.func,
    onCustomizeFramerate: PropTypes.func
};

const Interpolation = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Interpolation"
                description="Interpolation setting"
                id="tw.settingsModal.interpolation"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Makes projects appear smoother by interpolating sprite motion. Interpolation should not be used on 3D projects, raytracers, pen projects, and laggy projects as interpolation will make them run slower without making them appear smoother."
                description="Interpolation setting help"
                id="tw.settingsModal.interpolationHelp"
            />
        }
        slug="interpolation"
    />
);

const InfiniteClones = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Infinite Clones"
                description="Infinite Clones setting"
                id="tw.settingsModal.infiniteClones"
            />
        }
        help={
            <FormattedMessage
                defaultMessage="Disables Scratch's 300 clone limit."
                description="Infinite Clones setting help"
                id="tw.settingsModal.infiniteClonesHelp"
            />
        }
        slug="infinite-clones"
    />
);

const RemoveFencing = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Remove Fencing"
                description="Remove Fencing setting"
                id="tw.settingsModal.removeFencing"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Allows sprites to move offscreen, become as large or as small as they want, and makes touching blocks work offscreen."
                description="Remove Fencing setting help"
                id="tw.settingsModal.removeFencingHelp"
            />
        }
        slug="remove-fencing"
    />
);

const RemoveMiscLimits = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Remove Miscellaneous Limits"
                description="Remove Miscellaneous Limits setting"
                id="tw.settingsModal.removeMiscLimits"
            />
        }
        help={
            <FormattedMessage
                defaultMessage="Removes sound effect limits and pen size limits."
                description="Remove Miscellaneous Limits setting help"
                id="tw.settingsModal.removeMiscLimitsHelp"
            />
        }
        slug="remove-misc-limits"
    />
);

const WarpTimer = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Warp Timer"
                description="Warp Timer setting"
                id="tw.settingsModal.warpTimer"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Makes scripts check if they are stuck in a long or infinite loop and run at a low framerate instead of getting stuck until the loop finishes. This fixes most crashes but has a significant performance impact, so it's only enabled by default in the editor."
                description="Warp Timer help"
                id="tw.settingsModal.warpTimerHelp"
            />
        }
        slug="warp-timer"
    />
);

const DisableCompiler = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Disable Compiler"
                description="Disable Compiler setting"
                id="tw.settingsModal.disableCompiler"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Disables the {APP_NAME} compiler. You may want to enable this while editing projects so that scripts update immediately. Otherwise, you should never enable this."
                description="Disable Compiler help"
                id="tw.settingsModal.disableCompilerHelp"
                values={{
                    APP_NAME
                }}
            />
        }
        slug="disable-compiler"
    />
);

const CustomStageSize = ({
    customStageSizeEnabled,
    stageWidth,
    onStageWidthChange,
    stageHeight,
    onStageHeightChange
}) => (
    <Setting
        active={customStageSizeEnabled}
        primary={(
            <div className={classNames(styles.label, styles.customStageSize)}>
                <FormattedMessage
                    defaultMessage="Custom Stage Size:"
                    description="Custom Stage Size option"
                    id="tw.settingsModal.customStageSize"
                />
                <BufferedInput
                    value={stageWidth}
                    onSubmit={onStageWidthChange}
                    className={styles.customStageSizeInput}
                    type="number"
                    min="0"
                    max="1024"
                    step="1"
                />
                <span>{'×'}</span>
                <BufferedInput
                    value={stageHeight}
                    onSubmit={onStageHeightChange}
                    className={styles.customStageSizeInput}
                    type="number"
                    min="0"
                    max="1024"
                    step="1"
                />
            </div>
        )}
        secondary={
            (stageWidth >= 1000 || stageHeight >= 1000) && (
                <div className={styles.warning}>
                    <FormattedMessage
                        // eslint-disable-next-line max-len
                        defaultMessage="Using a custom stage size this large is not recommended! Instead, use a lower size with the same aspect ratio and let fullscreen mode upscale it to match the user's display."
                        description="Warning about using stages that are too large in settings modal"
                        id="tw.settingsModal.largeStageWarning"
                    />
                    <LearnMore slug="custom-stage-size" />
                </div>
            )
        }
        help={(
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Changes the size of the Scratch stage from 480x360 to something else. Try 640x360 to make the stage widescreen. Very few projects will handle this properly."
                description="Custom Stage Size option"
                id="tw.settingsModal.customStageSizeHelp"
            />
        )}
        slug="custom-stage-size"
    />
);
CustomStageSize.propTypes = {
    customStageSizeEnabled: PropTypes.bool,
    stageWidth: PropTypes.number,
    onStageWidthChange: PropTypes.func,
    stageHeight: PropTypes.number,
    onStageHeightChange: PropTypes.func
};

const StoreProjectOptions = ({ onStoreProjectOptions }) => (
    <div className={styles.setting}>
        <div>
            <button
                onClick={onStoreProjectOptions}
                className={styles.button}
            >
                <FormattedMessage
                    defaultMessage="Store settings in project"
                    description="Button in settings modal"
                    id="tw.settingsModal.storeProjectOptions"
                />
            </button>
            <p>
                <FormattedMessage
                    // eslint-disable-next-line max-len
                    defaultMessage="Stores the selected settings in the project so they will be automatically applied when TurboWarp loads this project. Warp timer and disable compiler will not be saved."
                    description="Help text for the store settings in project button"
                    id="tw.settingsModal.storeProjectOptionsHelp"
                />
            </p>
        </div>
    </div>
);
StoreProjectOptions.propTypes = {
    onStoreProjectOptions: PropTypes.func
};

const Header = props => (
    <div className={styles.header}>
        {props.children}
        <div className={styles.divider} />
    </div>
);
Header.propTypes = {
    children: PropTypes.node
};
const AutoDisplayREADME = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Automatically Display README"
                description="Auto Displat Readme label"
                id="tw.settingsModal.autodisplayreadme"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="After the project is opened, if there is a Sprite named 'README', the README inside the Sprite will be automatically displayed."
                description="Auto Displat Readme label help"
                id="tw.settingsModal.autodisplayreadmeHelp"
            />}
    />
);
const EnableHTMLSupportREADME = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Enable HTML Support"
                description="Enable HTML Support in README label"
                id="tw.settingsModal.enablehtmlsupportreadme"
            />
        }
        help={<>
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Allows you to use HTML tags in the README."
                description="Enable HTML Support in README help"
                id="tw.settingsModal.enablehtmlsupportreadmeHelp"
            />
            <WarningTip>
                <FormattedMessage
                    // eslint-disable-next-line max-len
                    defaultMessage="Some malicious READMEs can write dangerous HTML content, and we hope to add detection to avoid it, but this is very difficult. So please only enable this setting if you trust the project you are opening and understand the risks."
                    description="Enable HTML Support in README warning help"
                    id="tw.settingsModal.enablehtmlsupportreadmeWarn"
                />
            </WarningTip>
        </>
        }
    />
);
const SkipCustomExtWarn = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Skip custom extension warning"
                description="Skip custom extension warning label"
                id="tw.settingsModal.skipcustomextwarn"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="When the project loads, you do not need to agree to each custom extension request sequentially. You only need to click 'Agree All' once."
                description="Skip custom extension warning help"
                id="tw.settingsModal.skipcustomextwarnhelp"
            />
        }
    />
);
const EnableExtensionPreview = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Enable extension preview when load extension (Deprecated)"
                description="extension preview label"
                id="tw.settingsModal.enableextensionpreview"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Before loading custom extensions, you can preview the extensions you want to load."
                description="extension preview help"
                id="tw.settingsModal.enableextensionpreviewhelp"
            />
        }
    />
);
const EnableVSCodeLayout = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Enable VSCode Layout (Need Refresh)"
                description="EnableVSCodeLayout label"
                id="tw.settingsModal.enablevscodelayout"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Change the interface layout to a style similar to VSCode."
                description="EnableVSCodeLayout help"
                id="tw.settingsModal.enablevscodelayouthelp"
            />
        }
    />
);
const EnableMobileLayout = props => (
    <BooleanSetting
        {...props}
        label={
            <FormattedMessage
                defaultMessage="Enable Mobile Layout (Need Refresh)"
                description="EnableMobileLayout label"
                id="tw.settingsModal.enablecoblielayout"
            />
        }
        help={
            <FormattedMessage
                // eslint-disable-next-line max-len
                defaultMessage="Adjust the stage and sprite area positions to make them slightly more suitable for Mobile editing."
                description="EnableMobileLayout help"
                id="tw.settingsModal.enablecoblielayouthelp"
            />
        }
    />
);
const AEsettings = new AESettings();
const WarningTip = props => {
    return (
        <div className={styles.warning}>
            {props.children}
        </div>
    )
}
const SettingsModalComponent = props => {
    const [settingsTab, setSettingsTab] = useState(1)
    const [settingsUpdate, onUpdate] = useState(false);
    const update = () => {
        onUpdate(!settingsUpdate)
    }
    return (
        <Modal
            className={styles.modalContent}
            onRequestClose={props.onClose}
            contentLabel={props.intl.formatMessage(messages.title)}
            id="settingsModal"
        >
            <div className={styles.Modaltab} style={{
                margin: "0"
            }}>
                <button
                    className={
                        settingsTab == 1 ?
                            styles.tabButtonEnable : styles.tabButtonUnable
                    }
                    style={{
                        display: "inline-block",
                        width: `50%`,
                        height: '100%',
                    }}
                    onClick={() => setSettingsTab(1)}
                ><FormattedMessage
                        defaultMessage="Project"
                        description="Settings modal tab"
                        id="tw.settingsModal.project"
                    /></button>
                <button
                    className={
                        settingsTab == 2 ?
                            styles.tabButtonEnable : styles.tabButtonUnable
                    }
                    style={{
                        display: "inline-block",
                        width: `50%`,
                        height: '100%'
                    }}
                    onClick={() => setSettingsTab(2)}
                >AstraEditor</button>
            </div>

            <Box className={styles.body}>
                {settingsTab == 1 && <>
                    <Header>
                        <FormattedMessage
                            defaultMessage="Featured"
                            description="Settings modal section"
                            id="tw.settingsModal.featured"
                        />
                    </Header>
                    <CustomFPS
                        framerate={props.framerate}
                        onChange={props.onFramerateChange}
                        onCustomizeFramerate={props.onCustomizeFramerate}
                    />
                    <Interpolation
                        value={props.interpolation}
                        onChange={props.onInterpolationChange}
                    />
                    <HighQualityPen
                        value={props.highQualityPen}
                        onChange={props.onHighQualityPenChange}
                    />
                    <WarpTimer
                        value={props.warpTimer}
                        onChange={props.onWarpTimerChange}
                    />
                    <Header>
                        <FormattedMessage
                            defaultMessage="Remove Limits"
                            description="Settings modal section"
                            id="tw.settingsModal.removeLimits"
                        />
                    </Header>
                    <InfiniteClones
                        value={props.infiniteClones}
                        onChange={props.onInfiniteClonesChange}
                    />
                    <RemoveFencing
                        value={props.removeFencing}
                        onChange={props.onRemoveFencingChange}
                    />
                    <RemoveMiscLimits
                        value={props.removeLimits}
                        onChange={props.onRemoveLimitsChange}
                    />
                    <Header>
                        <FormattedMessage
                            defaultMessage="Danger Zone"
                            description="Settings modal section"
                            id="tw.settingsModal.dangerZone"
                        />
                    </Header>
                    {!props.isEmbedded && (
                        <CustomStageSize
                            {...props}
                        />
                    )}
                    <DisableCompiler
                        value={props.disableCompiler}
                        onChange={props.onDisableCompilerChange}
                    />
                    {!props.isEmbedded && (
                        <StoreProjectOptions
                            {...props}
                        />
                    )}
                </>}
                {settingsTab == 2 &&
                    <>
                        <Header>
                            README
                        </Header>
                        <AutoDisplayREADME
                            value={AEsettings.get('enableREADMEAutoDisplay')}
                            onChange={(e) => { AEsettings.set("enableREADMEAutoDisplay", e.target.checked); update() }}
                        />
                        <EnableHTMLSupportREADME
                            value={AEsettings.get('enableHTMLSupportInREADME')}
                            onChange={(e) => { AEsettings.set("enableHTMLSupportInREADME", e.target.checked); update() }}
                        />
                        <Header>
                            <FormattedMessage
                                defaultMessage="Safe Settings"
                                description="Settings modal safe settings"
                                id="tw.settingsModal.safeSetings"
                            />
                        </Header>
                        <SkipCustomExtWarn
                            value={AEsettings.get('skipExtWarn')}
                            onChange={(e) => { AEsettings.set("skipExtWarn", e.target.checked); update() }}
                        />
                        <EnableExtensionPreview
                            value={AEsettings.get('EnableExtensionPreview')}
                            onChange={(e) => { AEsettings.set("EnableExtensionPreview", e.target.checked); update() }}
                        />
                        <Header>
                            <FormattedMessage
                                defaultMessage="Interface Settings"
                                description="Settings modal interface. settings"
                                id="tw.settingsModal.interfaceSettings"
                            />
                        </Header>
                        <EnableVSCodeLayout
                            value={AEsettings.get('EnableVSCodeLayout')}
                            onChange={(e) => { AEsettings.set("EnableVSCodeLayout", e.target.checked); location.reload(); update() }}
                        />
                        <EnableMobileLayout
                            value={AEsettings.get('EnableMobileLayout')}
                            onChange={(e) => { AEsettings.set("EnableMobileLayout", e.target.checked); location.reload(); update() }}
                        />
                    </>}

            </Box>
        </Modal>
    )
}

SettingsModalComponent.propTypes = {
    intl: intlShape,
    onClose: PropTypes.func,
    isEmbedded: PropTypes.bool,
    framerate: PropTypes.number,
    onFramerateChange: PropTypes.func,
    onCustomizeFramerate: PropTypes.func,
    highQualityPen: PropTypes.bool,
    onHighQualityPenChange: PropTypes.func,
    interpolation: PropTypes.bool,
    onInterpolationChange: PropTypes.func,
    infiniteClones: PropTypes.bool,
    onInfiniteClonesChange: PropTypes.func,
    removeFencing: PropTypes.bool,
    onRemoveFencingChange: PropTypes.func,
    removeLimits: PropTypes.bool,
    onRemoveLimitsChange: PropTypes.func,
    warpTimer: PropTypes.bool,
    onWarpTimerChange: PropTypes.func,
    disableCompiler: PropTypes.bool,
    onDisableCompilerChange: PropTypes.func
};

export default injectIntl(SettingsModalComponent);
