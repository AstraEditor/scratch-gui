
import { defineMessages, FormattedMessage, intlShape, injectIntl, useRef } from 'react-intl';
import React, { useEffect, useState } from 'react';
import Modal from '../../containers/modal.jsx';
import PropTypes from 'prop-types';
import Box from '../box/box.jsx';
import styles from './ae-readme.css';
import classNames from 'classnames';
import ReactMarkdown from 'react-markdown/with-html';
import {AESettings} from '../../lib/settings.js';

const settings = new AESettings();

var data = null;

export function loadData(loadData) {
    data = loadData;
}

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
                            margin: "0"
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
                    <ReactMarkdown className={styles.body} escapeHtml={settings.get('enableHTMLSupportInREADME') ? false : true}>
                        {readMe[nowTab].text.replaceAll('\n', '\n\n')}
                    </ReactMarkdown>
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
