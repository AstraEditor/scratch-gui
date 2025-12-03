import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactModal from 'react-modal';
import { FormattedMessage } from 'react-intl';

import Box from '../box/box.jsx';
import Button from '../button/button.jsx';
import CloseButton from '../close-button/close-button.jsx';

import backIcon from '../../lib/assets/icon--back.svg';
import helpIcon from '../../lib/assets/icon--help.svg';
import minimizeIcon from './icon--minimize.svg';
import maximizeIcon from './icon--maximize.svg';
import restoreIcon from './icon--restore.svg';

import styles from './modal.css';

// 从CSS变量中获取z-index
const zIndexModal = 1000; // 对应 $z-index-modal

// 全局modal图层管理
let modalInstances = [];
let nextZIndex = zIndexModal;

const registerModal = (id) => {
    if (!modalInstances.find(m => m.id === id)) {
        modalInstances.push({
            id,
            zIndex: nextZIndex++
        });
        return nextZIndex - 1;
    }
    return modalInstances.find(m => m.id === id).zIndex;
};

const unregisterModal = (id) => {
    modalInstances = modalInstances.filter(m => m.id !== id);
};

const bringToFront = (id) => {
    const modal = modalInstances.find(m => m.id === id);
    if (modal) {
        modal.zIndex = nextZIndex++;
        return modal.zIndex;
    }
    return nextZIndex++;
};

// 获取当前最高z-index
const getHighestZIndex = () => {
    if (modalInstances.length === 0) return zIndexModal;
    return Math.max(...modalInstances.map(m => m.zIndex));
};

// 检查modal是否在最顶层
const isTopMost = (id) => {
    if (modalInstances.length === 0) return true;
    const highestZ = getHighestZIndex();
    const modal = modalInstances.find(m => m.id === id);
    return modal && modal.zIndex === highestZ;
};

// 最小化窗口位置管理
const minimizedWindows = [];
const getMinimizedPosition = () => {
    const baseY = window.innerHeight - 50;
    const spacing = 5; // 减小间距避免重叠
    const windowWidth = 280;
    const totalWindows = minimizedWindows.length;

    if (totalWindows === 0) return { x: window.innerWidth / 2 - windowWidth / 2, y: baseY };

    // 计算所有窗口的布局
    const positions = [];
    for (let i = 0; i < totalWindows; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;

        // 计算当前行的窗口数量
        const windowsInCurrentRow = Math.min(4, totalWindows - row * 4);

        // 计算当前行的总宽度（包括间距）
        const totalRowWidth = windowsInCurrentRow * windowWidth + (windowsInCurrentRow - 1) * spacing;

        // 计算整组窗口的起始X坐标（屏幕居中）
        const groupStartX = (window.innerWidth - totalRowWidth) / 2;

        // 从左到右正常排列，整组居中
        const relativeX = col * (windowWidth + spacing);
        const x = groupStartX + relativeX;
        const y = baseY - (row + 1) * 50 - spacing * row; // 50px高度 + 间距

        positions.push({ x: Math.max(0, x), y: Math.max(0, y) });
    }

    // 返回最后一个窗口的位置
    return positions[positions.length - 1];
};

const addMinimizedWindow = (id) => {
    if (!minimizedWindows.includes(id)) {
        minimizedWindows.push(id);
    }
    return getMinimizedPosition();
};

// 重新计算所有最小化窗口的位置
const recalculateAllMinimizedPositions = () => {
    const positions = [];
    for (let i = 0; i < minimizedWindows.length; i++) {
        const baseY = window.innerHeight - 50;
        const spacing = 5;
        const windowWidth = 280;
        const row = Math.floor(i / 4);
        const col = i % 4;

        // 计算当前行的窗口数量
        const windowsInCurrentRow = Math.min(4, minimizedWindows.length - row * 4);

        // 计算当前行的总宽度（包括间距）
        const totalRowWidth = windowsInCurrentRow * windowWidth + (windowsInCurrentRow - 1) * spacing;

        // 计算整组窗口的起始X坐标（屏幕居中）
        const groupStartX = (window.innerWidth - totalRowWidth) / 2;

        // 从左到右正常排列，整组居中
        const relativeX = col * (windowWidth + spacing);
        const x = groupStartX + relativeX;
        const y = baseY - (row + 1) * 50 - spacing * row;

        positions.push({ x: Math.max(0, x), y: Math.max(0, y) });
    }
    return positions;
};

const removeMinimizedWindow = (id) => {
    const index = minimizedWindows.indexOf(id);
    if (index > -1) {
        minimizedWindows.splice(index, 1);
    }
};

const ModalComponent = props => {
    // 状态管理
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({
        width: window.innerWidth * 0.8,
        height: window.innerHeight * 0.8
    });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [previousState, setPreviousState] = useState({ position: null, size: null });
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentZIndex, setCurrentZIndex] = useState(zIndexModal);
    const [isOpening, setIsOpening] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isTopMostModal, setIsTopMostModal] = useState(true);

    // Refs
    const dragRef = useRef(null);
    const resizeRef = useRef(null);
    const modalRef = useRef(null);
    const contentRef = useRef(null);
    const modalId = useRef(`modal-${Date.now()}-${Math.random()}`);

    // 初始化显示和注册modal
    useEffect(() => {
        if (!isInitialized) {
            // 检查是否有自定义的位置和大小
            const contentStyle = props.style?.content;

            if (contentStyle && contentStyle.transform) {
                // 从transform中提取位置
                const transformMatch = contentStyle.transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                if (transformMatch) {
                    const x = parseInt(transformMatch[1]);
                    const y = parseInt(transformMatch[2]);
                    setPosition({ x, y });
                }

                // 设置自定义大小
                if (contentStyle.width && contentStyle.height) {
                    const width = parseInt(contentStyle.width);
                    const height = parseInt(contentStyle.height);
                    setSize({ width, height });
                }
            } else {
                // 默认居中显示
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;

                const initialWidth = screenWidth * 0.8;
                const initialHeight = screenHeight * 0.8;

                setSize({ width: initialWidth, height: initialHeight });

                const centerX = (screenWidth - initialWidth) / 2;
                const centerY = (screenHeight - initialHeight) / 2;
                setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
            }

            // 注册modal并设置z-index
            const zIndex = registerModal(modalId.current);
            setCurrentZIndex(zIndex);

            setIsInitialized(true);

            // 触发开场动画
            setTimeout(() => {
                setIsOpening(false);
            }, 100);
        }
    }, [isInitialized, props.style]);

    // 监听最小化窗口重新排列事件和图层变化
    useEffect(() => {
        const handleMinimizedWindowAdded = (event) => {
            if (isMinimized && event.detail.positions) {
                const myIndex = minimizedWindows.indexOf(modalId.current);
                if (myIndex >= 0 && myIndex < event.detail.positions.length) {
                    const newPosition = event.detail.positions[myIndex];
                    setIsAnimating(true);
                    setPosition(newPosition);
                    setTimeout(() => setIsAnimating(false), 300);
                }
            }
        };

        const handleMinimizedWindowRemoved = (event) => {
            if (isMinimized && event.detail.positions) {
                const myIndex = minimizedWindows.indexOf(modalId.current);
                if (myIndex >= 0 && myIndex < event.detail.positions.length) {
                    const newPosition = event.detail.positions[myIndex];
                    setIsAnimating(true);
                    setPosition(newPosition);
                    setTimeout(() => setIsAnimating(false), 300);
                }
            }
        };

        // 监听其他modal置顶事件
        const handleModalBroughtToFront = (event) => {
            if (event.detail.modalId !== modalId.current) {
                // 其他modal被置顶，更新当前modal的置顶状态
                setIsTopMostModal(false);
            }
        };

        window.addEventListener('minimizedWindowAdded', handleMinimizedWindowAdded);
        window.addEventListener('minimizedWindowRemoved', handleMinimizedWindowRemoved);
        window.addEventListener('modalBroughtToFront', handleModalBroughtToFront);
        return () => {
            window.removeEventListener('minimizedWindowAdded', handleMinimizedWindowAdded);
            window.removeEventListener('minimizedWindowRemoved', handleMinimizedWindowRemoved);
            window.removeEventListener('modalBroughtToFront', handleModalBroughtToFront);
        };
    }, [isMinimized]);

    // 清理时注销modal
    useEffect(() => {
        return () => {
            unregisterModal(modalId.current);
            removeMinimizedWindow(modalId.current);
        };
    }, []);



    // 最大化处理
    const handleMaximize = useCallback(() => {
        if (isMaximized) {
            // 恢复原始大小和位置
            if (previousState.position && previousState.size) {
                setPosition(previousState.position);
                setSize(previousState.size);
            }
            setIsMaximized(false);
        } else {
            // 最大化
            setPreviousState({ position: { ...position }, size: { ...size } });
            setPosition({ x: 0, y: 0 });
            setSize({ width: window.innerWidth, height: window.innerHeight });
            setIsMaximized(true);
        }
    }, [isMaximized, position, size, previousState]);

    // 点击modal置顶
    const handleModalClick = useCallback((e) => {
        if (!isMinimized && !isDragging) {
            const wasTopMost = isTopMost(modalId.current);
            const newZIndex = bringToFront(modalId.current);
            setCurrentZIndex(newZIndex);
            setIsTopMostModal(true);

            // 通知其他modal更新置顶状态
            window.dispatchEvent(new CustomEvent('modalBroughtToFront', {
                detail: { modalId: modalId.current, zIndex: newZIndex }
            }));
        }
    }, [isMinimized, isDragging]);

    // 拖动处理 - 支持鼠标和触摸
    const handleStartDrag = useCallback((clientX, clientY) => {
        if (isMaximized || isMinimized) return;

        // 点击时置顶
        const newZIndex = bringToFront(modalId.current);
        setCurrentZIndex(newZIndex);
        setIsTopMostModal(true);

        // 通知其他modal更新置顶状态
        window.dispatchEvent(new CustomEvent('modalBroughtToFront', {
            detail: { modalId: modalId.current, zIndex: newZIndex }
        }));

        setIsDragging(true);
        dragRef.current = {
            startX: clientX - position.x,
            startY: clientY - position.y
        };
    }, [position, isMaximized, isMinimized]);

    // 鼠标拖动处理
    const handleMouseDown = useCallback((e) => {
        // 首先检查是否处于最大化或最小化状态
        if (isMaximized || isMinimized) return;

        if (e.target.closest('button')) return;
        handleStartDrag(e.clientX, e.clientY);
        e.preventDefault();
    }, [handleStartDrag, isMaximized, isMinimized]);

    // 触摸拖动处理
    const handleTouchStart = useCallback((e) => {
        // 首先检查是否处于最大化或最小化状态
        if (isMaximized || isMinimized) return;

        // 检查是否点击在按钮上
        const target = e.target;
        const isButton = target.closest('button') ||
            target.closest('[class*="windowControl"]') ||
            target.closest('[class*="close-button"]') ||
            target.closest('[class*="help"]');

        if (isButton) return; // 如果是按钮，不启动拖动

        const touch = e.touches[0];
        handleStartDrag(touch.clientX, touch.clientY);
        e.preventDefault();
    }, [handleStartDrag, isMaximized, isMinimized]);

    // 双击标题栏最大化/恢复
    const handleDoubleClick = useCallback(() => {
        if (!props.fullScreen && !isMinimized && !props.disableResize) {
            handleMaximize();
        }
    }, [props.fullScreen, isMinimized, handleMaximize, props.disableResize]);

    // 拉伸处理 - 支持鼠标和触摸
    const handleStartResize = useCallback((clientX, clientY) => {
        if (isMaximized || isMinimized || props.disableResize || props.disableResizeOnly) return;

        setIsResizing(true);
        resizeRef.current = {
            startX: clientX,
            startY: clientY,
            startWidth: size.width,
            startHeight: size.height
        };
    }, [size, isMaximized, isMinimized, props.disableResize, props.disableResizeOnly]);

    // 鼠标拉伸处理
    const handleResizeMouseDown = useCallback((e) => {
        handleStartResize(e.clientX, e.clientY);
        e.preventDefault();
        e.stopPropagation();
    }, [handleStartResize]);

    // 触摸拉伸处理
    const handleResizeTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        handleStartResize(touch.clientX, touch.clientY);
        e.preventDefault();
        e.stopPropagation();
    }, [handleStartResize]);

    // 移动处理 - 支持鼠标和触摸
    const handleMove = useCallback((clientX, clientY) => {
        // 额外的状态检查 - 确保在最大化和最小化状态下不执行移动操作
        if (isMaximized || isMinimized) {
            setIsDragging(false);
            setIsResizing(false);
            dragRef.current = null;
            resizeRef.current = null;
            return;
        }

        if (isDragging && dragRef.current) {
            let newX = clientX - dragRef.current.startX;
            let newY = clientY - dragRef.current.startY;

            // 边界检查
            const maxX = window.innerWidth - 100; // 至少保留100px可见
            const maxY = window.innerHeight - 100;

            newX = Math.max(-size.width + 100, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            setPosition({ x: newX, y: newY });
        }

        if (isResizing && resizeRef.current && !props.disableResize) {
            const deltaX = clientX - resizeRef.current.startX;
            const deltaY = clientY - resizeRef.current.startY;

            const newWidth = Math.max(300, resizeRef.current.startWidth + deltaX);
            const newHeight = Math.max(200, resizeRef.current.startHeight + deltaY);

            // 计算位置偏移，保持左上角位置不变
            const positionDeltaX = clientX - resizeRef.current.startX;
            const positionDeltaY = clientY - resizeRef.current.startY;

            setSize({ width: newWidth, height: newHeight });

            // 如果拖动右下角，保持左上角不变
            if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                setPosition(prev => ({
                    x: prev.x,
                    y: prev.y
                }));
            }
        }
    }, [isDragging, isResizing, size.width, props.disableResize, isMaximized, isMinimized]);

    // 鼠标移动处理
    const handleMouseMove = useCallback((e) => {
        handleMove(e.clientX, e.clientY);
    }, [handleMove]);

    // 触摸移动处理
    const handleTouchMove = useCallback((e) => {
        // 只有在拖动或拉伸状态下才阻止默认行为
        if (isDragging || isResizing) {
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
            e.preventDefault(); // 防止页面滚动
        }
    }, [handleMove, isDragging, isResizing]);

    // 释放处理 - 支持鼠标和触摸
    const handleEnd = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        dragRef.current = null;
        resizeRef.current = null;
    }, []);

    // 鼠标释放处理
    const handleMouseUp = useCallback(() => {
        handleEnd();
    }, [handleEnd]);

    // 触摸释放处理
    const handleTouchEnd = useCallback((e) => {
        handleEnd();
        e.preventDefault();
    }, [handleEnd]);

    // 最小化处理
    const handleMinimize = useCallback(() => {
        const minimizedWidth = 280; // 最小化窗口宽度
        const minimizedHeight = 40; // 最小化窗口高度

        // 添加到最小化窗口列表
        addMinimizedWindow(modalId.current);

        // 获取当前窗口的位置
        const minimizedPos = getMinimizedPosition();

        setPreviousState({ position: { ...position }, size: { ...size } });
        setIsAnimating(true);

        // 同时移动和改变大小
        requestAnimationFrame(() => {
            setPosition({ x: minimizedPos.x, y: minimizedPos.y });
            setSize({ width: minimizedWidth, height: minimizedHeight });
            setIsMinimized(true);

            setTimeout(() => {
                setIsAnimating(false);

                // 触发全局事件，通知其他最小化窗口重新排列
                window.dispatchEvent(new CustomEvent('minimizedWindowAdded', {
                    detail: { positions: recalculateAllMinimizedPositions() }
                }));
            }, 300);
        });
    }, [position, size]);

    // 窗口大小变化时处理最大化状态和自适应
    useEffect(() => {
        const handleWindowResize = () => {
            if (isMaximized) {
                setSize({ width: window.innerWidth, height: window.innerHeight });
                setPosition({ x: 0, y: 0 });
            } else if (isMinimized) {
                // 确保最小化窗口始终在屏幕底部居中
                const minimizedWidth = 280;
                const minimizedHeight = 40;
                const centerX = Math.max(0, (window.innerWidth - minimizedWidth) / 2);
                const bottomY = Math.max(0, window.innerHeight - minimizedHeight - 10);
                setPosition({ x: centerX, y: bottomY });
            } else {
                // 确保窗口不会超出屏幕边界
                const maxX = window.innerWidth - 100;
                const maxY = window.innerHeight - 100;

                setPosition(prev => ({
                    x: Math.max(-size.width + 100, Math.min(prev.x, maxX)),
                    y: Math.max(0, Math.min(prev.y, maxY))
                }));
            }
        };

        window.addEventListener('resize', handleWindowResize);
        return () => window.removeEventListener('resize', handleWindowResize);
    }, [isMaximized, isMinimized, size.width]);



    // 恢复处理
    const handleRestore = useCallback(() => {
        removeMinimizedWindow(modalId.current);
        setIsAnimating(true);

        // 同时改变大小和位置
        if (previousState.position && previousState.size) {
            // 先设置为最小化状态，然后同时改变大小和位置
            setIsMinimized(false);

            // 使用 requestAnimationFrame 确保动画流畅
            requestAnimationFrame(() => {
                setSize(previousState.size);
                setPosition(previousState.position);

                setTimeout(() => {
                    setIsAnimating(false);
                }, 300);
            });
        } else {
            setIsMinimized(false);
            setIsAnimating(false);
        }

        // 恢复时置顶
        const newZIndex = bringToFront(modalId.current);
        setCurrentZIndex(newZIndex);

        // 通知其他最小化窗口重新排列
        window.dispatchEvent(new CustomEvent('minimizedWindowRemoved', {
            detail: { positions: recalculateAllMinimizedPositions() }
        }));
    }, [previousState]);

    // 全局事件监听 - 支持鼠标和触摸
    useEffect(() => {
        if (isDragging || isResizing) {
            // 鼠标事件
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            // 触摸事件
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            document.addEventListener('touchcancel', handleTouchEnd);

            return () => {
                // 清理鼠标事件
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);

                // 清理触摸事件
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                document.removeEventListener('touchcancel', handleTouchEnd);
            };
        }
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    // 检查是否是特殊modal类型
    const isSpriteOrStageModal = props.className && (
        props.className == 'stage-modal_stage-modal_i2EZo' ||
        props.className == 'sprite-modal_sprite-modal_3WDj4'
    );
    const isSpecialModal = props.id && (
        props.id === 'unknownPlatformModal' ||
        props.id === 'securitymanagermodal'
    );

    // 计算z-index：特殊modal在loader之上，其他modal在loader之下
    const baseZIndex = isSpecialModal ? 525 : 510;
    
    // 使用动态z-index，考虑窗口置顶
    const ZIndex = Math.max(baseZIndex, currentZIndex);

    // 在组件挂载后检查实际的DOM结构
    setTimeout(() => {
        console.log('=== ReactModal DOM Structure Analysis ===');
        console.log('Modal ID:', props.id);
        
        // 查找所有可能的modal元素
        const allOverlays = document.querySelectorAll('[class*="Overlay"]');
        const allContents = document.querySelectorAll('[class*="Content"]');
        const allModals = document.querySelectorAll('[id*="modal"], [class*="modal"]');
        
        console.log('All overlay elements:', allOverlays);
        console.log('All content elements:', allContents);
        console.log('All modal elements:', allModals);
        
        // 查找特定ID的modal
        const specificModal = props.id ? document.getElementById(props.id) : null;
        if (specificModal) {
            console.log(`Found modal with ID ${props.id}:`, specificModal);
            console.log('Classes:', specificModal.className);
            console.log('Z-index:', window.getComputedStyle(specificModal).zIndex);
        }
        
        // 检查我们的CSS选择器是否匹配
        const cssSelector = `.ReactModal__Content#${props.id}`;
        const matchedElement = document.querySelector(cssSelector);
        console.log(`CSS selector "${cssSelector}" matches:`, matchedElement);
        
        // 查找loader
        const loaderElement = document.querySelector('.background');
        if (loaderElement) {
            console.log('Loader element:', loaderElement);
            console.log('Loader z-index:', window.getComputedStyle(loaderElement).zIndex);
        }
    }, 200);

    // 特殊modal全屏处理
    let finalSize = { width: size.width, height: size.height };
    let finalPosition = { ...position };
    let shouldMaximize = false;

    if (isSpecialModal && !isMinimized && !isMaximized) {
        // unknown-platform-modal和load-extension modal全屏显示
        shouldMaximize = true;
        finalSize = { width: window.innerWidth, height: window.innerHeight };
        finalPosition = { x: 0, y: 0 };
    }

    // 样式计算
    const modalStyle = {
        width: props.disableResize ? (props.style?.content?.width || finalSize.width) : (isMinimized ? 280 : finalSize.width),
        height: props.disableResize ? (props.style?.content?.height || finalSize.height) : (isMinimized ? 40 : finalSize.height),
        minWidth: props.disableResize ? (props.style?.content?.minWidth || finalSize.width) : (isMinimized ? 280 : 300),
        minHeight: props.disableResize ? (props.style?.content?.minHeight || finalSize.height) : (isMinimized ? 40 : 200),
        maxWidth: props.disableResize ? (props.style?.content?.maxWidth || finalSize.width) : (isMaximized || shouldMaximize ? window.innerWidth : 'none'),
        maxHeight: props.disableResize ? (props.style?.content?.maxHeight || finalSize.height) : (isMaximized || shouldMaximize ? window.innerHeight : 'none'),
        resize: (props.disableResize || props.disableResizeOnly || shouldMaximize) ? 'none' : (isMinimized ? 'none' : 'both'),
        opacity: isInitialized ? 1 : 0,
        transition: isInitialized ?
            (isAnimating ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' :
                (isOpening ? 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' :
                    (props.isClosing ? 'opacity 0.2s ease-in, transform 0.2s ease-in' :
                        'opacity 0.1s ease-in-out'))) : 'none',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        transform: props.style?.content?.transform && !isInitialized ?
            (isOpening ?
                `${props.style.content.transform} scale(0.9)` :
                (props.isClosing ?
                    `${props.style.content.transform} scale(0.95)` :
                    props.style.content.transform)) :
            (isOpening ?
                `translate(${finalPosition.x}px, ${finalPosition.y}px) scale(0.9)` :
                (props.isClosing ?
                    `translate(${finalPosition.x}px, ${finalPosition.y}px) scale(0.95)` :
                    `translate(${finalPosition.x}px, ${finalPosition.y}px)`)),
        opacity: isOpening ? 0 : (props.isClosing ? 0 : (isInitialized ? 1 : 0)),
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        border: '4px solid $ui-white-transparent !important'
    };

    return (
        <ReactModal
            isOpen
            className={classNames(styles.modalContent, props.className, {
                [styles.fullScreen]: props.fullScreen,
                [styles.minimized]: isMinimized,
                [styles.maximized]: isMaximized,
                [styles.topMost]: isTopMostModal && !isMinimized
            })}
            contentLabel={props.contentLabel}
            overlayClassName={classNames(styles.modalOverlay, {
                [styles.topMostOverlay]: isTopMostModal && !isMinimized
            })}
            style={{
                content: {
                    ...modalStyle,
                    zIndex: ZIndex
                },
                overlay: {
                    zIndex: ZIndex - 1,
                    backgroundColor: 'transparent'
                }
            }}
            ref={modalRef}
            bodyOpenClassName="ReactModal__Body--open"
            htmlOpenClassName="ReactModal__Html--open"
            ariaHideApp={false}
            onClick={handleModalClick}
        >
            <Box
                dir={props.isRtl ? 'rtl' : 'ltr'}
                direction="column"
                grow={1}
                style={{ height: '100%' }}
                onClick={isMinimized ? handleRestore : undefined}
            >
                <div
                    className={classNames(styles.header, props.headerClassName)}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onDoubleClick={handleDoubleClick}
                    style={{
                        cursor: isDragging ? 'grabbing' : (isMaximized || isMinimized ? 'default' : 'grab'),
                        userSelect: 'none'
                        // 移除 touchAction: 'none' 以允许按钮正常点击
                    }}
                >
                    {props.onHelp ? (
                        <div
                            className={classNames(
                                styles.headerItem,
                                styles.headerItemHelp
                            )}
                        >
                            <Button
                                className={styles.helpButton}
                                iconSrc={helpIcon}
                                onClick={props.onHelp}
                            >
                                <FormattedMessage
                                    defaultMessage="Help"
                                    description="Help button in modal"
                                    id="gui.modal.help"
                                />
                            </Button>
                        </div>
                    ) : null}
                    <div
                        className={classNames(
                            styles.headerItem,
                            styles.headerItemTitle,
                            {
                                [styles.minimizedTitle]: isMinimized
                            }
                        )}
                    >
                        {props.headerImage ? (
                            <img
                                className={styles.headerImage}
                                src={props.headerImage}
                                draggable={false}
                            />
                        ) : null}
                        {props.contentLabel}
                    </div>
                    <div
                        className={classNames(
                            styles.headerItem,
                            styles.headerItemClose
                        )}
                    >
                        {/* 窗口控制按钮组 */}
                        <div className={styles.windowControls}>
                            {!props.fullScreen && (
                                <Button
                                    className={styles.windowControlButton}
                                    onClick={isMinimized ? handleRestore : handleMinimize}
                                    onTouchStart={(e) => {
                                        // 确保按钮点击事件不被拖动事件干扰
                                        e.stopPropagation();
                                    }}
                                    title={isMinimized ? "恢复" : "最小化"}
                                >
                                    <img
                                        src={isMinimized ? restoreIcon : minimizeIcon}
                                        alt=""
                                        className={styles.windowControlIcon}
                                    />
                                </Button>
                            )}
                            {!props.fullScreen && !isMinimized && (
                                <Button
                                    className={styles.windowControlButton}
                                    onClick={handleMaximize}
                                    onTouchStart={(e) => {
                                        // 确保按钮点击事件不被拖动事件干扰
                                        e.stopPropagation();
                                    }}
                                    title={isMaximized ? "恢复" : "最大化"}
                                >
                                    <img
                                        src={isMaximized ? restoreIcon : maximizeIcon}
                                        alt=""
                                        className={styles.windowControlIcon}
                                    />
                                </Button>
                            )}
                            {props.fullScreen ? (
                                <Button
                                    className={styles.backButton}
                                    iconSrc={backIcon}
                                    onClick={props.onRequestClose}
                                    onTouchStart={(e) => {
                                        // 确保按钮点击事件不被拖动事件干扰
                                        e.stopPropagation();
                                    }}
                                >
                                    <FormattedMessage
                                        defaultMessage="Back"
                                        description="Back button in modal"
                                        id="gui.modal.back"
                                    />
                                </Button>
                            ) : props.hideCloseButton ? null : (
                                <CloseButton
                                    size={CloseButton.SIZE_LARGE}
                                    onClick={props.onRequestClose}
                                    onTouchStart={(e) => {
                                        // 确保按钮点击事件不被拖动事件干扰
                                        e.stopPropagation();
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {!isMinimized && (
                    <div
                        className={styles.modalBody}
                        ref={contentRef}
                        style={{
                            height: `calc(100% - 50px)`,
                            overflow: 'auto',
                            boxSizing: 'border-box'
                        }}
                    >
                        {props.children}
                    </div>
                )}

                {/* 拉伸手柄 */}
                {!isMinimized && !isMaximized && !(props.disableResize || props.disableResizeOnly) && (
                    <div
                        className={styles.resizeHandle}
                        onMouseDown={handleResizeMouseDown}
                        onTouchStart={handleResizeTouchStart}
                        style={{
                            touchAction: 'none' // 防止触摸时页面滚动
                        }}
                    />
                )}
            </Box>
        </ReactModal>
    );
};

ModalComponent.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    contentLabel: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
    ]).isRequired,
    fullScreen: PropTypes.bool,
    headerClassName: PropTypes.string,
    headerImage: PropTypes.string,
    isRtl: PropTypes.bool,
    onHelp: PropTypes.func,
    onRequestClose: PropTypes.func,
    disableResize: PropTypes.bool,
    disableResizeOnly: PropTypes.bool,
    hideCloseButton: PropTypes.bool
};

// 添加关闭动画处理
const ModalWithCloseAnimation = (props) => {
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(true);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setShouldRender(false);
            if (props.onRequestClose) {
                props.onRequestClose();
            }
        }, 200);
    }, [props.onRequestClose]);

    if (!shouldRender) {
        return null;
    }

    return <ModalComponent {...props} isClosing={isClosing} onRequestClose={handleClose} />;
};

export default ModalWithCloseAnimation;