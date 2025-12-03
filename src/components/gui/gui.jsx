import classNames from 'classnames';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React, { useState, useRef, useCallback, useEffect } from 'react'; // 添加 useState, useRef, useCallback
import { defineMessages, FormattedMessage, injectIntl, intlShape } from 'react-intl';
import { connect } from 'react-redux';
import MediaQuery from 'react-responsive';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import tabStyles from 'react-tabs/style/react-tabs.css';
import VM from 'scratch-vm';
import { getStageDimensions } from '../../lib/screen-utils.js';

import StageHeader from '../../containers/stage-header.jsx';

import Blocks from '../../containers/blocks.jsx';
import CostumeTab from '../../containers/costume-tab.jsx';
import TargetPane from '../../containers/target-pane.jsx';
import SoundTab from '../../containers/sound-tab.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import MenuBar from '../menu-bar/menu-bar.jsx';
import CostumeLibrary from '../../containers/costume-library.jsx';
import BackdropLibrary from '../../containers/backdrop-library.jsx';
import Watermark from '../../containers/watermark.jsx';

import Backpack from '../../containers/backpack.jsx';
import BrowserModal from '../browser-modal/browser-modal.jsx';
import TipsLibrary from '../../containers/tips-library.jsx';
import Cards from '../../containers/cards.jsx';
import Alerts from '../../containers/alerts.jsx';
import DragLayer from '../../containers/drag-layer.jsx';
import ConnectionModal from '../../containers/connection-modal.jsx';
import TelemetryModal from '../telemetry-modal/telemetry-modal.jsx';
import TWUsernameModal from '../../containers/tw-username-modal.jsx';
import TWSettingsModal from '../../containers/tw-settings-modal.jsx';
import TWSecurityManager from '../../containers/tw-security-manager.jsx';
import TWCustomExtensionModal from '../../containers/tw-custom-extension-modal.jsx';
import TWRestorePointManager from '../../containers/tw-restore-point-manager.jsx';
import TWFontsModal from '../../containers/tw-fonts-modal.jsx';
import TWUnknownPlatformModal from '../../containers/tw-unknown-platform-modal.jsx';
import TWInvalidProjectModal from '../../containers/tw-invalid-project-modal.jsx';
import TWWindChimeSubmitter from '../../containers/tw-windchime-submitter.jsx';
import TWCustomThemeModal from '../../containers/tw-custom-theme-modal.jsx';
import StageModal from '../stage-modal/stage-modal.jsx';
import SpriteModal from '../sprite-modal/sprite-modal.jsx';

import { STAGE_SIZE_MODES, FIXED_WIDTH, UNCONSTRAINED_NON_STAGE_WIDTH } from '../../lib/layout-constants';
import { resolveStageSize } from '../../lib/screen-utils';
import { Theme } from '../../lib/themes';

import { isRendererSupported, isBrowserSupported } from '../../lib/tw-environment-support-prober';

import styles from './gui.css';
import addExtensionIcon from './icon--extensions.svg';
import codeIcon from '!../../lib/tw-recolor/build!./icon--code.svg';
import costumesIcon from '!../../lib/tw-recolor/build!./icon--costumes.svg';
import soundsIcon from '!../../lib/tw-recolor/build!./icon--sounds.svg';
import { closeModeMenu } from '../../reducers/menus.js';

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    }
});

const getFullscreenBackgroundColor = () => {
    const params = new URLSearchParams(location.search);
    if (params.has('fullscreen-background')) {
        return params.get('fullscreen-background');
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return '#111';
    }
    return 'white';
};

const fullscreenBackgroundColor = getFullscreenBackgroundColor();

const GUIComponent = props => {
    const {
        accountNavOpen,
        activeTabIndex,
        alertsVisible,
        authorId,
        authorThumbnailUrl,
        authorUsername,
        basePath,
        backdropLibraryVisible,
        backpackHost,
        backpackVisible,
        blocksId,
        blocksTabVisible,
        cardsVisible,
        canChangeLanguage,
        canChangeTheme,
        canCreateNew,
        canEditTitle,
        canManageFiles,
        canRemix,
        canSave,
        canCreateCopy,
        canShare,
        canUseCloud,
        children,
        connectionModalVisible,
        costumeLibraryVisible,
        costumesTabVisible,
        customStageSize,
        enableCommunity,
        intl,
        isCreating,
        isEmbedded,
        isFullScreen,
        isPlayerOnly,
        isRtl,
        isShared,
        isWindowFullScreen,
        isTelemetryEnabled,
        isTotallyNormal,
        loading,
        logo,
        renderLogin,
        onClickAbout,
        onClickAccountNav,
        onCloseAccountNav,
        onClickAddonSettings,
        onClickDesktopSettings,
        onClickNewWindow,
        onClickPackager,
        onLogOut,
        onOpenRegistration,
        onToggleLoginOpen,
        onActivateCostumesTab,
        onActivateSoundsTab,
        onActivateTab,
        onClickLogo,
        onExtensionButtonClick,
        onOpenCustomExtensionModal,
        onOpenCustomTheme,
        onProjectTelemetryEvent,
        onRequestCloseBackdropLibrary,
        onRequestCloseCostumeLibrary,
        onRequestCloseTelemetryModal,
        onRequestCloseCustomThemeModal,
        onSeeCommunity,
        onShare,
        onShowPrivacyPolicy,
        onStartSelectingFileUpload,
        onTelemetryModalCancel,
        onTelemetryModalOptIn,
        onTelemetryModalOptOut,
        securityManager,
        showComingSoon,
        showOpenFilePicker,
        showSaveFilePicker,
        soundsTabVisible,
        stageSizeMode,
        targetIsStage,
        telemetryModalVisible,
        theme,
        tipsLibraryVisible,
        usernameModalVisible,
        settingsModalVisible,
        customExtensionModalVisible,
        fontsModalVisible,
        unknownPlatformModalVisible,
        invalidProjectModalVisible,
        customThemeModalVisible,
        vm,
        editingTarget,
        hoveredTarget,
        spriteLibraryVisible,
        stage,
        sprites,
        onActivateBlocksTab,
        onChangeSpriteDirection,
        onChangeSpriteName,
        onChangeSpriteRotationStyle,
        onChangeSpriteSize,
        onChangeSpriteVisibility,
        onChangeSpriteX,
        onChangeSpriteY,
        onDeleteSprite,
        onDrop,
        onDuplicateSprite,
        onExportSprite,
        onFileUploadClick,
        onNewSpriteClick,
        onPaintSpriteClick,
        onRequestCloseSpriteLibrary,
        onSelectSprite,
        onSpriteUpload,
        onSurpriseSpriteClick,
        raiseSprites,
        ...componentProps
    } = omit(props, 'dispatch');

    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }


    const [stageIndex, setStageIndex] = useState(480);
    const [costumeIndex, setCostumesIndex] = useState(490);
    // 添加拖动状态管理
    const [isStageDragging, setStageIsDragging] = useState(false);
    const [isCostumesDragging, setCostumesIsDragging] = useState(false);

    const [stageMode, setStageMode] = useState(false);
    
    // 当stageMode变化时控制Modal的显示
    const handleStageModeChange = useCallback((newMode) => {
        setStageMode(newMode);
        if (newMode && !isFullScreen) {
            // 切换到分离模式时自动打开Modal
            setIsStageModalOpen(true);
            setIsSpriteModalOpen(true);
        } else {
            // 切换回停靠模式时关闭Modal
            setIsStageModalOpen(false);
            setIsSpriteModalOpen(false);
        }
    }, [isFullScreen]);
    const stageRef = useRef(null);
    const [stagePosition, setStagePosition] = useState(() => {
        try {
            const saved = localStorage.getItem('stage-position');
            return saved ? JSON.parse(saved) : { x: window.innerWidth - 600, y: 0 };
        } catch {
            return { x: window.innerWidth - 600, y: 0 };
        }
    });
    const [containerSize, setContainerSize] = useState({ width: 480, height: 360 }); //调整舞台大小
    
    // Modal状态管理
    const [isStageModalOpen, setIsStageModalOpen] = useState(false);
    const [isSpriteModalOpen, setIsSpriteModalOpen] = useState(false);


    const [costumesPosition, setCostumesPosition] = useState(() => {
        try {
            const saved = localStorage.getItem('costumes-position');
            return saved ? JSON.parse(saved) : { x: window.innerWidth - 500, y: 500 };
        } catch {
            return { x: window.innerWidth - 500, y: 500 };
        }
    });

    // 自动保存：当位置改变时自动保存到localStorage
    useEffect(() => {
        localStorage.setItem('stage-position', JSON.stringify(stagePosition));
    }, [stagePosition]);

    useEffect(() => {
        localStorage.setItem('costumes-position', JSON.stringify(costumesPosition));
    }, [costumesPosition]);

    const dragRef = useRef(null);



    // 处理鼠标按下事件
    const handleStageMouseDown = useCallback((e) => {
        // 防止在按钮或其他交互元素上触发拖动
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
            return;
        }

        setStageIsDragging(true);
        dragRef.current = {
            startX: e.clientX - stagePosition.x,
            startY: e.clientY - stagePosition.y
        };
        e.preventDefault();
    }, [stagePosition]);

    const handleCostumesMouseDown = useCallback((e) => {
        // 防止在按钮或其他交互元素上触发拖动
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
            return;
        }

        setCostumesIsDragging(true);
        dragRef.current = {
            startX: e.clientX - costumesPosition.x,
            startY: e.clientY - costumesPosition.y
        };
        e.preventDefault();
    }, [costumesPosition]);

    // 处理鼠标移动事件
    const handleStageMouseMove = useCallback((e) => {
        if (!isStageDragging || !dragRef.current) return;

        let newX = e.clientX - dragRef.current.startX;
        let newY = e.clientY - dragRef.current.startY;

        const rect = stageRef.current.getBoundingClientRect();

        if (newX > window.innerWidth - rect.width || newX < 0) {
            newX = newX < 0 ? 0 : window.innerWidth - rect.width;
        }
        if (newY > window.innerHeight - rect.height || newY < 0) {
            newY = newY < 0 ? 0 : window.innerHeight - rect.height;

        }


        setStagePosition({ x: newX, y: newY });
    }, [isStageDragging]);
    const costumesRef = useRef(null);
    const handleCostumesMouseMove = useCallback((e) => {
        if (!isCostumesDragging || !dragRef.current) return;

        let newX = e.clientX - dragRef.current.startX;
        let newY = e.clientY - dragRef.current.startY;


        const rect = costumesRef.current.getBoundingClientRect();


        if (newX > window.innerWidth - rect.width || newX < 0) {
            newX = newX < 0 ? 0 : window.innerWidth - rect.width;
        }
        if (newY > window.innerHeight - rect.height || newY < 0) {
            newY = newY < 0 ? 0 : window.innerHeight - rect.height;

        }


        setCostumesPosition({ x: newX, y: newY });
    }, [isCostumesDragging]);

    // 处理鼠标释放事件
    const handleStageMouseUp = useCallback(() => {
        setStageIsDragging(false);
        dragRef.current = null;
    }, []);

    const handleCostumesMouseUp = useCallback(() => {
        setCostumesIsDragging(false);
        dragRef.current = null;
    }, []);

    // 添加全局事件监听
    useEffect(() => {
        if (window.location.pathname == "/fullscreen.html") {
            window.location.href = ".."
        }
    }, [])//全屏时刷新会跳转到主页（因为有bug）
    useEffect(() => {
        if (isStageDragging) {
            document.addEventListener('mousemove', handleStageMouseMove);
            document.addEventListener('mouseup', handleStageMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleStageMouseMove);
                document.removeEventListener('mouseup', handleStageMouseUp);
            };
        }
    }, [isStageDragging, handleStageMouseMove, handleStageMouseUp]);

    useEffect(() => {
        if (isCostumesDragging) {
            document.addEventListener('mousemove', handleCostumesMouseMove);
            document.addEventListener('mouseup', handleCostumesMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleCostumesMouseMove);
                document.removeEventListener('mouseup', handleCostumesMouseUp);
            };
        }
    }, [isCostumesDragging, handleCostumesMouseMove, handleCostumesMouseUp]);
    useEffect(() => {
        const stageContainer = stageRef.current;
        if (!stageContainer) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                setContainerSize({ width, height });
            }
        });

        resizeObserver.observe(stageContainer);
        return () => resizeObserver.disconnect();
    }, []);
    const tabClassNames = {
        tabs: styles.tabs,
        tab: classNames(tabStyles.reactTabsTab, styles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, styles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, styles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, styles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, styles.isSelected)
    };

    const unconstrainedWidth = (
        UNCONSTRAINED_NON_STAGE_WIDTH +
        FIXED_WIDTH +
        Math.max(0, customStageSize.width - FIXED_WIDTH)
    );


    // 同步全屏状态到localStorage
    useEffect(() => {
        localStorage.setItem('isFullScreen', isFullScreen.toString());
    }, [isFullScreen]);

    // 在页面加载时恢复全屏状态
    useEffect(() => {
        const savedFullScreen = localStorage.getItem('isFullScreen') === 'true';
        if (savedFullScreen && !isFullScreen) {
            setIsFullScreen(true);
        }
    }, []);
    useEffect(() => {
        // 当 stageMode 变化时触发 resize 事件
        window.dispatchEvent(new Event('resize'));
    }, [stageMode]);
    return (
        <MediaQuery minWidth={unconstrainedWidth}>
            {isUnconstrained => {
                const stageSize = resolveStageSize(stageSizeMode, isUnconstrained);
                const stageDimensions = getStageDimensions(stageSize, customStageSize, isFullScreen);

                const alwaysEnabledModals = (
                    <React.Fragment>
                        <TWSecurityManager securityManager={securityManager} />
                        <TWRestorePointManager />
                        <TWWindChimeSubmitter 
                    isEmbedded={isEmbedded} 
                />
                        {usernameModalVisible && <TWUsernameModal />}
                        {settingsModalVisible && <TWSettingsModal />}
                        {customExtensionModalVisible && <TWCustomExtensionModal />}
                        {fontsModalVisible && <TWFontsModal />}
                        {unknownPlatformModalVisible && <TWUnknownPlatformModal />}
                        {invalidProjectModalVisible && <TWInvalidProjectModal />}
                        {customThemeModalVisible && <TWCustomThemeModal />}
                    </React.Fragment>
                );

                return isPlayerOnly ? (
                    <React.Fragment>
                        {isWindowFullScreen ? (
                            <div
                                className={styles.fullscreenBackground}
                                style={{
                                    backgroundColor: fullscreenBackgroundColor
                                }}
                            />
                        ) : null}
                        <StageWrapper
                            isFullScreen={isFullScreen}
                            isEmbedded={isEmbedded}
                            isRendererSupported={isRendererSupported()}
                            isRtl={isRtl}
                            loading={loading}
                            stageSize={STAGE_SIZE_MODES.full}
                            vm={vm}
                        >
                            {alertsVisible ? (
                                <Alerts className={styles.alertsContainer} />
                            ) : null}
                        </StageWrapper>
                        {alwaysEnabledModals}
                    </React.Fragment>
                ) : (
                    <Box
                        className={styles.pageWrapper}
                        dir={isRtl ? 'rtl' : 'ltr'}
                        style={{
                            minWidth: 1024 + Math.max(0, customStageSize.width - 480),
                            minHeight: 640 + Math.max(0, customStageSize.height - 360)
                        }}
                        {...componentProps}
                    >
                        {alwaysEnabledModals}
                        {telemetryModalVisible ? (
                            <TelemetryModal
                                isRtl={isRtl}
                                isTelemetryEnabled={isTelemetryEnabled}
                                onCancel={onTelemetryModalCancel}
                                onOptIn={onTelemetryModalOptIn}
                                onOptOut={onTelemetryModalOptOut}
                                onRequestClose={onRequestCloseTelemetryModal}
                                onShowPrivacyPolicy={onShowPrivacyPolicy}
                            />
                        ) : null}
                        {loading ? (
                            <Loader isFullScreen />
                        ) : null}
                        {isCreating ? (
                            <Loader
                                isFullScreen
                                messageId="gui.loader.creating"
                            />
                        ) : null}
                        {isBrowserSupported() ? null : (
                            <BrowserModal
                                isRtl={isRtl}
                                onClickDesktopSettings={onClickDesktopSettings}
                            />
                        )}
                        {tipsLibraryVisible ? (
                            <TipsLibrary />
                        ) : null}
                        {cardsVisible ? (
                            <Cards />
                        ) : null}
                        {alertsVisible ? (
                            <Alerts className={styles.alertsContainer} />
                        ) : null}
                        {connectionModalVisible ? (
                            <ConnectionModal
                                vm={vm}
                            />
                        ) : null}
                        {costumeLibraryVisible ? (
                            <CostumeLibrary
                                vm={vm}
                                onRequestClose={onRequestCloseCostumeLibrary}
                            />
                        ) : null}
                        {backdropLibraryVisible ? (
                            <BackdropLibrary
                                vm={vm}
                                onRequestClose={onRequestCloseBackdropLibrary}
                            />
                        ) : null}
                        <MenuBar
                            accountNavOpen={accountNavOpen}
                            authorId={authorId}
                            authorThumbnailUrl={authorThumbnailUrl}
                            authorUsername={authorUsername}
                            canChangeLanguage={canChangeLanguage}
                            canChangeTheme={canChangeTheme}
                            canCreateCopy={canCreateCopy}
                            canCreateNew={canCreateNew}
                            canEditTitle={canEditTitle}
                            canManageFiles={canManageFiles}
                            canRemix={canRemix}
                            canSave={canSave}
                            canShare={canShare}
                            className={classNames(styles.menuBarPosition, {
                                [styles.menuBarHidden]: isFullScreen
                            })}
                            enableCommunity={enableCommunity}
                            isShared={isShared}
                            isTotallyNormal={isTotallyNormal}
                            logo={logo}
                            renderLogin={renderLogin}
                            showComingSoon={showComingSoon}
                            showOpenFilePicker={showOpenFilePicker}
                            showSaveFilePicker={showSaveFilePicker}
                            onClickAbout={onClickAbout}
                            onClickAccountNav={onClickAccountNav}
                            onClickAddonSettings={onClickAddonSettings}
                            onClickDesktopSettings={onClickDesktopSettings}
                            onClickNewWindow={onClickNewWindow}
                            onOpenCustomTheme={onOpenCustomTheme}
                            onRequestCloseCustomThemeModal={onRequestCloseCustomThemeModal}
                            onClickPackager={onClickPackager}
                            onClickLogo={onClickLogo}
                            onCloseAccountNav={onCloseAccountNav}
                            onLogOut={onLogOut}
                            onOpenRegistration={onOpenRegistration}
                            onProjectTelemetryEvent={onProjectTelemetryEvent}
                            onSeeCommunity={onSeeCommunity}
                            onShare={onShare}
                            onStartSelectingFileUpload={onStartSelectingFileUpload}
                            onToggleLoginOpen={onToggleLoginOpen}
                        />
                        <Box className={styles.bodyWrapper}>
                            <Box className={styles.flexWrapper}>
                                <Box className={styles.editorWrapper}>
                                    <Tabs
                                        forceRenderTabPanel
                                        className={tabClassNames.tabs}
                                        selectedIndex={activeTabIndex}
                                        selectedTabClassName={tabClassNames.tabSelected}
                                        selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                                        onSelect={onActivateTab}
                                    >
                                        <TabList className={tabClassNames.tabList}>
                                            <Tab className={tabClassNames.tab}>
                                                <img
                                                    draggable={false}
                                                    src={codeIcon()}
                                                />
                                                <FormattedMessage
                                                    defaultMessage="Code"
                                                    description="Button to get to the code panel"
                                                    id="gui.gui.codeTab"
                                                />
                                            </Tab>
                                            <Tab
                                                className={tabClassNames.tab}
                                                onClick={onActivateCostumesTab}
                                            >
                                                <img
                                                    draggable={false}
                                                    src={costumesIcon()}
                                                />
                                                {targetIsStage ? (
                                                    <FormattedMessage
                                                        defaultMessage="Backdrops"
                                                        description="Button to get to the backdrops panel"
                                                        id="gui.gui.backdropsTab"
                                                    />
                                                ) : (
                                                    <FormattedMessage
                                                        defaultMessage="Costumes"
                                                        description="Button to get to the costumes panel"
                                                        id="gui.gui.costumesTab"
                                                    />
                                                )}
                                            </Tab>
                                            <Tab
                                                className={tabClassNames.tab}
                                                onClick={onActivateSoundsTab}
                                            >
                                                <img
                                                    draggable={false}
                                                    src={soundsIcon()}
                                                />
                                                <FormattedMessage
                                                    defaultMessage="Sounds"
                                                    description="Button to get to the sounds panel"
                                                    id="gui.gui.soundsTab"
                                                />
                                            </Tab>
                                        </TabList>
                                        <TabPanel className={tabClassNames.tabPanel}>
                                            <Box className={styles.blocksWrapper}>
                                                <Blocks
                                                    key={`${blocksId}/${theme.id}`}
                                                    canUseCloud={canUseCloud}
                                                    grow={1}
                                                    isVisible={blocksTabVisible}
                                                    options={{
                                                        media: `${basePath}static/${theme.getBlocksMediaFolder()}/`
                                                    }}
                                                    stageSize={stageSize}
                                                    onOpenCustomExtensionModal={onOpenCustomExtensionModal}
                                                    theme={theme}
                                                    vm={vm}
                                                />
                                            </Box>
                                            <Box className={styles.extensionButtonContainer}>
                                                <button
                                                    className={styles.extensionButton}
                                                    title={intl.formatMessage(messages.addExtension)}
                                                    onClick={onExtensionButtonClick}
                                                >
                                                    <img
                                                        className={styles.extensionButtonIcon}
                                                        draggable={false}
                                                        src={addExtensionIcon}
                                                    />
                                                </button>
                                            </Box>

                                            <Box className={styles.watermark}>
                                                <Watermark />
                                            </Box>
                                        </TabPanel>
                                        <TabPanel className={tabClassNames.tabPanel}>
                                            {costumesTabVisible ? <CostumeTab
                                                vm={vm}
                                            /> : null}
                                        </TabPanel>
                                        <TabPanel className={tabClassNames.tabPanel}>
                                            {soundsTabVisible ? <SoundTab vm={vm} /> : null}
                                        </TabPanel>
                                    </Tabs>
                                    <Box className={styles.stageMenuWrapper}>
                                        <StageHeader
                                            stageSize={stageSize}
                                            vm={vm}
                                            stageMode={stageMode}
                                            SetStageMode={handleStageModeChange}
                                            isFullScreen={isFullScreen}
                                        />
                                    </Box>
                                    {backpackVisible ? (
                                        <Backpack host={backpackHost} />
                                    ) : null}
                                </Box>
                                {/* 舞台Modal */}
                                {stageMode && !isFullScreen && (
                                    <StageModal
                                        isOpen={isStageModalOpen}
                                        isFullScreen={isFullScreen}
                                        isRendererSupported={isRendererSupported()}
                                        isRtl={isRtl}
                                        loading={loading}
                                        stageSize={stageSize}
                                        vm={vm}
                                        alertsVisible={alertsVisible}
                                        onRequestClose={() => setIsStageModalOpen(false)}
                                        customStageSize={customStageSize}
                                    />
                                )}
                                
                                {/* 全屏模式保持原有实现 */}
                                {stageMode && isFullScreen && (
                                    <div
                                        className={classNames(styles.stageFull)}
                                        style={{
                                            width: '100vw',
                                            height: '100vh',
                                            zIndex: `${stageIndex}`
                                        }}
                                    >
                                        <Box className={styles.stageMenuWrapper}>
                                            <StageHeader
                                                stageSize={stageSize}
                                                vm={vm}
                                                stageMode={stageMode}
                                                SetStageMode={handleStageModeChange}
                                                isFullScreen={isFullScreen}
                                            />
                                        </Box>
                                        <div style={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            overflow: 'hidden',
                                        }}>
                                            <div>
                                                <StageWrapper
                                                    isFullScreen={isFullScreen}
                                                    isRendererSupported={isRendererSupported()}
                                                    isRtl={isRtl}
                                                    stageSize={stageSize}
                                                    vm={vm}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 角色组件 */}
                                {/* Modal模式 */}
                                {stageMode && !isFullScreen && (
                                    <SpriteModal
                                        isOpen={isSpriteModalOpen}
                                        stageSize={stageSize}
                                        vm={vm}
                                        onRequestClose={() => setIsSpriteModalOpen(false)}
                                        // 传递所有TargetPane需要的props
                                        editingTarget={editingTarget}
                                        hoveredTarget={hoveredTarget}
                                        spriteLibraryVisible={spriteLibraryVisible}
                                        stage={stage}
                                        sprites={sprites}
                                        onActivateBlocksTab={onActivateBlocksTab}
                                        onChangeSpriteDirection={onChangeSpriteDirection}
                                        onChangeSpriteName={onChangeSpriteName}
                                        onChangeSpriteRotationStyle={onChangeSpriteRotationStyle}
                                        onChangeSpriteSize={onChangeSpriteSize}
                                        onChangeSpriteVisibility={onChangeSpriteVisibility}
                                        onChangeSpriteX={onChangeSpriteX}
                                        onChangeSpriteY={onChangeSpriteY}
                                        onDeleteSprite={onDeleteSprite}
                                        onDrop={onDrop}
                                        onDuplicateSprite={onDuplicateSprite}
                                        onExportSprite={onExportSprite}
                                        onFileUploadClick={onFileUploadClick}
                                        onNewSpriteClick={onNewSpriteClick}
                                        onPaintSpriteClick={onPaintSpriteClick}
                                        onRequestCloseSpriteLibrary={onRequestCloseSpriteLibrary}
                                        onSelectSprite={onSelectSprite}
                                        onSpriteUpload={onSpriteUpload}
                                        onSurpriseSpriteClick={onSurpriseSpriteClick}
                                        raiseSprites={raiseSprites}
                                        customStageSize={customStageSize}
                                    />
                                )}

                                {/* 停靠模式 */}
                                {!stageMode && (
                                    <Box 
                                        className={classNames(styles.stageAndTargetWrapper, styles[stageSize])}
                                        style={{
                                            // 动态设置容器大小以适应自定义舞台分辨率
                                            minWidth: `${Math.max(120, stageDimensions.width + 20)}px`, // 添加padding
                                            minHeight: `${Math.max(90, stageDimensions.height + 70)}px`, // 添加padding和控件高度
                                        }}
                                    >
                                        {isFullScreen ?
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                overflow: 'hidden',
                                            }}>
                                                <StageWrapper
                                                    isFullScreen={isFullScreen}
                                                    isRendererSupported={isRendererSupported()}
                                                    isRtl={isRtl}
                                                    stageSize={stageSize}
                                                    vm={vm}
                                                />
                                            </div> :
                                            <StageWrapper
                                                isFullScreen={isFullScreen}
                                                isRendererSupported={isRendererSupported()}
                                                isRtl={isRtl}
                                                stageSize={stageSize}
                                                vm={vm}
                                            />}

                                        <Box className={styles.targetWrapperOld}>
                                            <TargetPane
                                                stageSize={stageSize}
                                                vm={vm}
                                            />
                                        </Box>
                                    </Box>
                                )}


                            </Box>
                        </Box>
                    </Box>
                )
            }}
        </MediaQuery >
    )

};

GUIComponent.propTypes = {
    accountNavOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    backdropLibraryVisible: PropTypes.bool,
    backpackHost: PropTypes.string,
    backpackVisible: PropTypes.bool,
    basePath: PropTypes.string,
    blocksTabVisible: PropTypes.bool,
    blocksId: PropTypes.string,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    cardsVisible: PropTypes.bool,
    children: PropTypes.node,
    costumeLibraryVisible: PropTypes.bool,
    costumesTabVisible: PropTypes.bool,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    enableCommunity: PropTypes.bool,
    intl: intlShape.isRequired,
    isCreating: PropTypes.bool,
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isWindowFullScreen: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loading: PropTypes.bool,
    logo: PropTypes.string,
    onActivateCostumesTab: PropTypes.func,
    onActivateSoundsTab: PropTypes.func,
    onActivateTab: PropTypes.func,
    onClickAccountNav: PropTypes.func,
    onClickAddonSettings: PropTypes.func,
    onClickDesktopSettings: PropTypes.func,
    onClickNewWindow: PropTypes.func,
    onClickPackager: PropTypes.func,
    onClickLogo: PropTypes.func,
    onCloseAccountNav: PropTypes.func,
    onExtensionButtonClick: PropTypes.func,
    onOpenCustomExtensionModal: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onRequestCloseBackdropLibrary: PropTypes.func,
    onRequestCloseCostumeLibrary: PropTypes.func,
    onRequestCloseTelemetryModal: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onShare: PropTypes.func,
    onShowPrivacyPolicy: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onTabSelect: PropTypes.func,
    onTelemetryModalCancel: PropTypes.func,
    onTelemetryModalOptIn: PropTypes.func,
    onTelemetryModalOptOut: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    renderLogin: PropTypes.func,
    securityManager: PropTypes.shape({}),
    showComingSoon: PropTypes.bool,
    showOpenFilePicker: PropTypes.func,
    showSaveFilePicker: PropTypes.func,
    soundsTabVisible: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    targetIsStage: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    theme: PropTypes.instanceOf(Theme),
    tipsLibraryVisible: PropTypes.bool,
    usernameModalVisible: PropTypes.bool,
    settingsModalVisible: PropTypes.bool,
    customExtensionModalVisible: PropTypes.bool,
    fontsModalVisible: PropTypes.bool,
    unknownPlatformModalVisible: PropTypes.bool,
    invalidProjectModalVisible: PropTypes.bool,
    customThemeModalVisible: PropTypes.bool,
    onOpenCustomTheme: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onRequestCloseCustomThemeModal: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};
GUIComponent.defaultProps = {
    backpackHost: null,
    backpackVisible: false,
    basePath: './',
    blocksId: 'original',
    canChangeLanguage: true,
    canChangeTheme: true,
    canCreateNew: false,
    canEditTitle: false,
    canManageFiles: true,
    canRemix: false,
    canSave: false,
    canCreateCopy: false,
    canShare: false,
    canUseCloud: false,
    enableCommunity: false,
    isCreating: false,
    isShared: false,
    isTotallyNormal: false,
    loading: false,
    showComingSoon: false,
    stageSizeMode: STAGE_SIZE_MODES.large
};

const mapStateToProps = state => ({
    customStageSize: state.scratchGui.customStageSize,
    isWindowFullScreen: state.scratchGui.tw.isWindowFullScreen,
    // This is the button's mode, as opposed to the actual current state
    blocksId: state.scratchGui.timeTravel.year.toString(),
    stageSizeMode: state.scratchGui.stageSize.stageSize,
    theme: state.scratchGui.theme.theme
});

export default injectIntl(connect(
    mapStateToProps
)(GUIComponent));
