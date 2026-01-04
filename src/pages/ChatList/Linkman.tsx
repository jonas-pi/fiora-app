import React, { useState, useRef, useEffect } from 'react';
import {
    Text,
    StyleSheet,
    View,
    TouchableOpacity,
    Animated,
    PanResponder,
    Alert,
} from 'react-native';
import { Actions } from 'react-native-router-flux';

import Time from '../../utils/time';
import action from '../../state/action';

import Avatar from '../../components/Avatar';
import { Linkman as LinkmanType } from '../../types/redux';
import { formatLinkmanName } from '../../utils/linkman';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';

type Props = {
    id: string;
    name: string;
    avatar: string;
    preview: string;
    time: Date;
    unread: number;
    lastMessageId: string;
    linkman: LinkmanType;
    isOpen: boolean;
    onSwipeOpen: () => void;
    onSwipeClose: () => void;
    registerCloseFunction: (closeFn: () => void) => void;
    onAnyLinkmanPress: () => void;
    hasAnyMenuOpen: boolean;
    openSwipeId: string | null;
    closeSwipeRefs: React.MutableRefObject<{ [key: string]: () => void }>;
};

export default function Linkman({
    id,
    name,
    avatar,
    preview,
    time,
    unread,
    lastMessageId,
    linkman,
    isOpen,
    onSwipeOpen,
    onSwipeClose,
    registerCloseFunction,
    onAnyLinkmanPress,
    hasAnyMenuOpen,
    openSwipeId,
    closeSwipeRefs,
}: Props) {
    const translateX = useRef(new Animated.Value(0)).current;
    const currentOffset = useRef(0);
    const isMountedRef = useRef(true); // 组件挂载状态

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                return false;
            },
            onStartShouldSetPanResponderCapture: () => {
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                return false;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                if (isOpen && Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
                    return false;
                }
                return Math.abs(gestureState.dx) > 3 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                if (isOpen && Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
                    return false;
                }
                return Math.abs(gestureState.dx) > 3 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: () => {
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                translateX.setOffset(currentOffset.current);
                translateX.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                const newValue = Math.max(-240, Math.min(0, gestureState.dx));
                translateX.setValue(newValue);
            },
            onPanResponderRelease: (_, gestureState) => {
                const finalValue = currentOffset.current + gestureState.dx;
                translateX.flattenOffset();

                const swipeThreshold = -120;
                const minSwipeDistance = 5;
                const velocityThreshold = -0.5;

                if (Math.abs(gestureState.dx) < minSwipeDistance) {
                    currentOffset.current = 0;
                    translateX.stopAnimation();
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }).start(() => {
                        onSwipeClose();
                    });
                    return;
                }

                const shouldOpen = finalValue < swipeThreshold || gestureState.vx < velocityThreshold;

                if (shouldOpen) {
                    // 在动画开始前就调用 onSwipeOpen，确保立即关闭其他菜单
                    onSwipeOpen();
                    currentOffset.current = -240;
                    translateX.stopAnimation();
                    Animated.spring(translateX, {
                        toValue: -240,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }).start();
                } else {
                    currentOffset.current = 0;
                    translateX.stopAnimation();
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }).start(() => {
                        onSwipeClose();
                    });
                }
            },
            onPanResponderTerminate: () => {
                closeSwipeMenu();
            },
        }),
    ).current;

    // 关闭滑动菜单
    function closeSwipeMenu() {
        if (currentOffset.current === -240) {
            currentOffset.current = 0;
            translateX.flattenOffset();
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 40,
                friction: 8,
                velocity: 0,
            }).start((finished) => {
                if (finished && isMountedRef.current) {
                    translateX.setValue(0);
                }
                if (isMountedRef.current) {
                    onSwipeClose();
                }
            });
            return;
        }

        translateX.stopAnimation((currentValue) => {
            translateX.flattenOffset();
            const actualValue = currentOffset.current + (currentValue || 0);
            const swipeThreshold = -120;

            if (actualValue < swipeThreshold && actualValue > -240) {
                // 在动画开始前就调用 onSwipeOpen，确保立即关闭其他菜单
                onSwipeOpen();
                currentOffset.current = -240;
                Animated.spring(translateX, {
                    toValue: -240,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 8,
                    velocity: 0,
                }).start();
            } else {
                currentOffset.current = 0;
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 8,
                    velocity: 0,
                }).start((finished) => {
                    if (finished && isMountedRef.current) {
                        translateX.setValue(0);
                    }
                    if (isMountedRef.current) {
                        onSwipeClose();
                    }
                });
            }
        });
    }

    // 注册关闭函数
    useEffect(() => {
        isMountedRef.current = true;
        registerCloseFunction(closeSwipeMenu);
        return () => {
            isMountedRef.current = false;
            if (closeSwipeRefs.current) {
                delete closeSwipeRefs.current[id];
            }
        };
    }, [registerCloseFunction, id]);

    // 监听外部关闭请求
    useEffect(() => {
        if (!isOpen && currentOffset.current !== 0 && isMountedRef.current) {
            closeSwipeMenu();
        }
    }, [isOpen]);

    // 处理置顶
    function handleToggleTop() {
        const currentTop = (linkman as any).isTop || false;
        action.updateLinkmanProperty(id, 'isTop', !currentTop);
        Toast.success(!currentTop ? '已置顶' : '已取消置顶');
        closeSwipeMenu();
    }

    // 处理标记已读/未读
    function handleToggleRead() {
        if (unread > 0) {
            // 标记为已读
            action.updateLinkmanProperty(id, 'unread', 0);
            Toast.success('已标记为已读');
        } else {
            // 标记为未读
            action.updateLinkmanProperty(id, 'unread', 1);
            Toast.success('已标记为未读');
        }
        closeSwipeMenu();
    }

    // 处理删除（直接删除，不需要确认）
    function handleDelete() {
        action.removeLinkman(id);
        Toast.success('已删除会话');
        closeSwipeMenu();
    }

    function formatTime() {
        const nowTime = new Date();
        if (Time.isToday(nowTime, time)) {
            return Time.getHourMinute(time);
        }
        if (Time.isYesterday(nowTime, time)) {
            return '昨天';
        }
        if (Time.isSameYear(nowTime, time)) {
            return Time.getMonthDate(time);
        }
        return Time.getYearMonthDate(time);
    }

    function handlePress() {
        if (isOpen) {
            closeSwipeMenu();
            setTimeout(() => {
                if (isMountedRef.current) {
                    action.setFocus(id);
                    Actions.chat({ title: formatLinkmanName(linkman) });
                    if (id && lastMessageId) {
                        fetch('updateHistory', { linkmanId: id, messageId: lastMessageId });
                    }
                }
            }, 300);
        } else if (hasAnyMenuOpen) {
            onAnyLinkmanPress();
            setTimeout(() => {
                if (isMountedRef.current) {
                    action.setFocus(id);
                    Actions.chat({ title: formatLinkmanName(linkman) });
                    if (id && lastMessageId) {
                        fetch('updateHistory', { linkmanId: id, messageId: lastMessageId });
                    }
                }
            }, 300);
        } else {
            action.setFocus(id);
            Actions.chat({ title: formatLinkmanName(linkman) });
            if (id && lastMessageId) {
                fetch('updateHistory', { linkmanId: id, messageId: lastMessageId });
            }
        }
    }

    const isTop = (linkman as any).isTop || false;

    return (
        <View style={styles.swipeableContainer}>
            {/* 操作按钮区域 */}
            <Animated.View
                style={[
                    styles.actionButtonsContainer,
                    {
                        transform: [
                            {
                                translateX: translateX.interpolate({
                                    inputRange: [-240, 0],
                                    outputRange: [0, 240],
                                    extrapolate: 'clamp',
                                }) as any,
                            },
                        ],
                    },
                ]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={[styles.actionButton, styles.topButton]}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleToggleTop();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>{isTop ? '取消置顶' : '置顶'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.readButton]}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleToggleRead();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>{unread > 0 ? '标记已读' : '标记未读'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={(e) => {
                        e.stopPropagation();
                        handleDelete();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>删除</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* 联系人项（可滑动） */}
            <Animated.View
                style={[
                    styles.linkmanItemWrapper,
                    {
                        transform: [{ translateX }],
                    },
                ]}
                {...panResponder.panHandlers}
            >
                <TouchableOpacity
                    onPressIn={() => {
                        // 在手指刚触碰到时，如果其他菜单已打开，立即关闭它们
                        if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                            const closeFn = closeSwipeRefs.current[openSwipeId];
                            if (closeFn) {
                                closeFn();
                            }
                        }
                    }}
                    onPress={(e) => {
                        // 阻止事件冒泡，防止触发覆盖层的 closeAllSwipes
                        e.stopPropagation();
                        handlePress();
                    }}
                    style={styles.container}
                    activeOpacity={0.7}
                >
                    <Avatar src={avatar} size={50} />
                    <View style={styles.content}>
                        <View style={styles.nickTime}>
                            <View style={styles.nickContainer}>
                                {isTop && <Text style={styles.topIcon}>📌</Text>}
                                {/* 显示特别关心标记（如果是好友） */}
                                {linkman.type === 'friend' && (linkman as any).isFavorite && (
                                    <Text style={styles.favoriteIcon}>⭐</Text>
                                )}
                                <Text style={styles.nick}>{name}</Text>
                            </View>
                            <Text style={styles.time}>{formatTime()}</Text>
                        </View>
                        <View style={styles.previewUnread}>
                            <Text style={styles.preview} numberOfLines={1}>
                                {preview}
                            </Text>
                            {unread > 0 ? (
                                <View style={styles.unread}>
                                    <Text style={styles.unreadText}>{unread > 99 ? '99' : unread}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    swipeableContainer: {
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1000,
        elevation: 1000,
    },
    actionButtonsContainer: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        width: 240,
        backgroundColor: 'transparent',
    },
    actionButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    topButton: {
        backgroundColor: '#ff9800',
    },
    readButton: {
        backgroundColor: '#2196f3',
    },
    deleteButton: {
        backgroundColor: '#f44336',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    linkmanItemWrapper: {
        backgroundColor: 'transparent',
    },
    container: {
        flexDirection: 'row',
        height: 70,
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
    },
    content: {
        flex: 1,
        marginLeft: 8,
    },
    nickTime: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    nickContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    topIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    favoriteIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    nick: {
        fontSize: 16,
        color: '#333',
    },
    time: {
        fontSize: 14,
        color: '#888',
    },
    previewUnread: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    preview: {
        flex: 1,
        fontSize: 14,
        color: '#666',
    },
    unread: {
        backgroundColor: '#2a7bf6',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 5,
    },
    unreadText: {
        fontSize: 10,
        color: 'white',
    },
});
