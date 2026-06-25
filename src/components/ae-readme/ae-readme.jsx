
import { intlShape, injectIntl } from 'react-intl';
import React, { useEffect, useState } from 'react';
import Modal from '../../containers/modal.jsx';
import PropTypes from 'prop-types';
import Box from '../box/box.jsx';
import styles from './ae-readme.css';
import ReactMarkdown from 'react-markdown/with-html';
import { get } from '../../lib/settings.js';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight, materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';


const README_ALERT_TYPES = {
    NOTE: {
        label: 'Note',
        className: styles.readmeAlertNote
    },
    TIP: {
        label: 'Tip',
        className: styles.readmeAlertTip
    },
    IMPORTANT: {
        label: 'Important',
        className: styles.readmeAlertImportant
    },
    WARNING: {
        label: 'Warning',
        className: styles.readmeAlertWarning
    },
    CAUTION: {
        label: 'Caution',
        className: styles.readmeAlertCaution
    }
};

var data = null;

export function loadData(loadData) {
    data = loadData;
}

const editorTheme = () => {
    let theme = 'dark'
    try {
        switch (JSON.parse(localStorage.getItem('tw:theme')).gui) {
            case undefined:
                theme = 'dark';
                break
            case 'dark':
                theme = 'dark';
                break
            case 'light':
                theme = 'light';
                break
            default:
                theme = 'dark'
        }
        return theme
    } catch (e) {
        return theme
    }
}

const splitReadmeBlocks = markdown => {
    const lines = markdown.split(/\r?\n/);
    const segments = [];
    let markdownLines = [];

    const flushMarkdown = () => {
        if (markdownLines.some(line => line.trim() !== '')) {
            segments.push({
                type: 'markdown',
                text: markdownLines.join('\n')
            });
        }
        markdownLines = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
        const matchedType = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i.exec(lines[index]);

        if (!matchedType) {
            markdownLines.push(lines[index]);
            continue;
        }

        flushMarkdown();

        const alertLines = [];
        index += 1;

        while (index < lines.length && /^>\s?/.test(lines[index])) {
            alertLines.push(lines[index].replace(/^>\s?/, ''));
            index += 1;
        }

        while (alertLines.length > 0 && alertLines[0].trim() === '') {
            alertLines.shift();
        }

        while (alertLines.length > 0 && alertLines[alertLines.length - 1].trim() === '') {
            alertLines.pop();
        }

        segments.push({
            type: 'alert',
            alertType: matchedType[1].toUpperCase(),
            text: alertLines.join('\n')
        });
        index -= 1;
    }

    flushMarkdown();
    return segments;
};

const renderMarkdownBlock = (text, escapeHtml, key) => (
    <ReactMarkdown
        key={key}
        escapeHtml={escapeHtml}
        renderers={{
            code({ language, value }) {
                if (!language) {
                    return (
                        <pre>
                            <code>{value}</code>
                        </pre>
                    );
                }

                return (
                    <SyntaxHighlighter
                        style={
                            editorTheme() == 'dark' ?
                                materialDark : materialLight
                        }
                        language={language}
                    >
                        {value.replace(/\n$/, '')}
                    </SyntaxHighlighter>
                );
            }
        }}
    >
        {text}
    </ReactMarkdown>
);

const renderAlertBlock = (segment, escapeHtml, key) => {
    const alert = README_ALERT_TYPES[segment.alertType];

    return (
        <div
            key={key}
            className={[styles.readmeAlert, alert.className].join(' ')}
        >
            <div className={styles.readmeAlertTitle}>{alert.label}</div>
            {segment.text ? renderMarkdownBlock(segment.text, escapeHtml, `${key}-content`) : null}
        </div>
    );
};

const renderReadmeContent = (markdown, escapeHtml) => {
    const segments = splitReadmeBlocks(markdown);

    if (segments.length === 0) {
        return renderMarkdownBlock(markdown, escapeHtml, 'markdown');
    }

    return segments.map((segment, index) => (
        segment.type === 'alert' ?
            renderAlertBlock(segment, escapeHtml, `alert-${index}`) :
            renderMarkdownBlock(segment.text, escapeHtml, `markdown-${index}`)
    ));
};

const CustomModalComponent = (props) => {
    try {
        let comments = {};
        if (data != null) { comments = Object.values(data); }
        else { comments = Object.values(props.vm.editingTarget.comments) }
        console.log(comments)
        const readMe = [];
        comments.forEach(comment => {
            if (comment.text.slice(0, 7) == "#README") {
                /*
                #README #标题(可选，它会搜索到换行)
                CONTENT...
                
                */

                if (comment.text.slice(8, 9) == "#") {
                    let title = "";
                    const CheckTitle = comment.text.slice(
                        9,
                        comment.text.length
                    )

                    for (let checkTitle_i = 0; checkTitle_i <= CheckTitle.length; checkTitle_i += 1) {
                        if (CheckTitle.charAt(checkTitle_i) == "\n" || CheckTitle.charAt(checkTitle_i) == "\r") break
                        else title = title + CheckTitle.charAt(checkTitle_i)
                    }
                    readMe.push(
                        {
                            text: comment.text.slice(10 + title.length, comment.text.length),
                            title: title
                        }
                    );

                } else {
                    readMe.push(
                        {
                            text: comment.text.slice(8, comment.text.length),
                        }
                    );
                }

            }
        })

        const [nowTab, setTab] = useState(0)
        const [Title, setTitle] = useState(`README${readMe[0].title != undefined ? readMe[0].title.length < 39 ? ":" + readMe[0].title : ":Title is Too Long" : ""}`)
        const handleClose = () => {
            data = null;
            props.onClose();
        };
        const escapeHtml = get('enableHTMLSupportInREADME') ? false : true;
        return (
            <Modal
                className={styles.modalContent}
                onRequestClose={handleClose}
                contentLabel={Title}
                id="readme"
            >
                <Box>
                    {readMe.length > 1 &&
                        <div className={styles.Modaltab} style={{
                            margin: "0",
                            '--total-tabs': readMe.length,
                            '--active-index': nowTab
                        }}>
                            {readMe.length > 1 && readMe.map((item, index) => (
                                <button key={index} className={
                                    nowTab == index ?
                                        styles.tabButtonEnable : styles.tabButtonUnable
                                } style={{
                                    display: "inline-block",
                                    width: `calc(100% / ${readMe.length})`,
                                    height: '100%'

                                }}
                                    onClick={() => {
                                        setTitle(`README${readMe[index].title != undefined ? readMe[index].title.length < 39 ? ":" + readMe[index].title : ":Title is Too Long" : ""}`); setTab(index)
                                    }}

                                >
                                    {readMe[index].title == undefined ? index + 1 : readMe[index].title}
                                </button>
                            ))}
                        </div>
                    }
                    <div className={styles.body}>
                        {renderReadmeContent(readMe[nowTab].text, escapeHtml)}
                    </div>
                </Box>

            </Modal >
        )
    } catch (e) {
        console.log(e)
        return (<>Hey!There is an ERROR from README Modal. Check the Error in the console and report it on Github</>)
    }
};

CustomModalComponent.propTypes = {
    intl: intlShape,
    vm: PropTypes.shape({
        editingTarget: PropTypes.shape({
            comments: PropTypes.object
        })
    }).isRequired,
    onClose: PropTypes.func,
};


export default injectIntl(CustomModalComponent);
