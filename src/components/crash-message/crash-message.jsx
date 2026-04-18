import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import Box from '../box/box.jsx';
import { FormattedMessage } from 'react-intl';
import downloadBlob from '../../lib/download-blob';
import { projectTitleInitialState } from '../../reducers/project-title';
import { getIsShowingProject } from '../../reducers/project-state';

import styles from './crash-message.css';
import reloadIcon from './reload.svg';

const getProjectFilename = (curTitle, defaultTitle) => {
    let filenameTitle = curTitle;
    if (!filenameTitle || filenameTitle.length === 0) {
        filenameTitle = defaultTitle;
    }
    return `${filenameTitle.substring(0, 100)}.sb3`;
};

const CrashMessage = ({eventId, errorMessage, onReload, saveProjectSb3, projectFilename}) => (
    <div className={styles.crashWrapper}>
        <Box className={styles.body}>
            <img
                className={styles.reloadIcon}
                src={reloadIcon}
                draggable={false}
            />
            <p className={styles.header}>
                <FormattedMessage
                    defaultMessage="Oops! Something went wrong."
                    description="Crash Message title"
                    id="gui.crashMessage.label"
                />
            </p>
            <p>
                <FormattedMessage
                    defaultMessage={'We are so sorry, but it looks like the page has crashed.' +
                    ' Please refresh your page to try' +
                    ' again.'}
                    description="Message to inform the user that page has crashed."
                    id="tw.gui.crashMessage.description"
                />
            </p>
            {errorMessage && (
                <p className={styles.errorMessage}>
                    {errorMessage}
                </p>
            )}
            {eventId && (
                <p>
                    <FormattedMessage
                        defaultMessage="Your error was logged with id {errorId}"
                        description="Message to inform the user that page has crashed."
                        id="gui.crashMessage.errorNumber"
                        values={{
                            errorId: eventId
                        }}
                    />
                </p>
            )}
            <button
                className={styles.reloadButton}
                onClick={onReload}
            >
                <FormattedMessage
                    defaultMessage="Reload"
                    description="Button to reload the page when page crashes"
                    id="gui.crashMessage.reload"
                />
            </button>
            {saveProjectSb3 && (
                <button
                    className={styles.reloadButton}
                    onClick={() => {
                        saveProjectSb3().then(content => {
                            downloadBlob(projectFilename, content);
                        });
                    }}
                >
                    <FormattedMessage
                        defaultMessage="Try to Save Project"
                        description="Button to try to save project"
                        id="gui.crashMessage.saveproject"
                    />
                </button>
            )}
        </Box>
    </div >
);

CrashMessage.propTypes = {
    eventId: PropTypes.string,
    errorMessage: PropTypes.string,
    onReload: PropTypes.func.isRequired,
    saveProjectSb3: PropTypes.func,
    projectFilename: PropTypes.string
};

const mapStateToProps = state => ({
    saveProjectSb3: state.scratchGui.vm.saveProjectSb3.bind(state.scratchGui.vm),
    projectFilename: getProjectFilename(state.scratchGui.projectTitle, projectTitleInitialState)
});

export default connect(mapStateToProps)(CrashMessage);
