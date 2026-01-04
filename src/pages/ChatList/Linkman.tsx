import React, { useState, useRef, useEffect } from 'react';
import {
    Text,
    StyleSheet,
    View,
    TouchableOpacity,
    Animated,
    PanResponder,
    Alert,
    Easing,
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
    // 动画常量：与 Contacts 统一，减少“弹簧二段感”
    const SWIPE_WIDTH = 240;
    const isClosingRef = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                return false;
            },
            onStartShouldSetPanResponderCapture: () => {
                return false;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // 降低阈值，尽早捕获水平手势，避免“先滑出一点再接管”的两段式体验
                if (isOpen && Math.abs(gestureState.dx) < 1 && Math.abs(gestureState.dy) < 1) {
                    return false;
                }
                return Math.abs(gestureState.dx) > 1 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                if (isOpen && Math.abs(gestureState.dx) < 1 && Math.abs(gestureState.dy) < 1) {
                    return false;
                }
                return Math.abs(gestureState.dx) > 1 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: () => {
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                // 直接以当前偏移开始拖拽（不使用 setOffset/flattenOffset，避免快滑时“二段式”）
                translateX.stopAnimation();
                translateX.setValue(currentOffset.current);
            },
            onPanResponderMove: (_, gestureState) => {
                const newValue = Math.max(-SWIPE_WIDTH, Math.min(0, currentOffset.current + gestureState.dx));
                translateX.setValue(newValue);
            },
            onPanResponderRelease: (_, gestureState) => {
                // 更容易触发“完全滑出”
                const swipeThreshold = -SWIPE_WIDTH * 0.3;
                const velocityThreshold = -0.5;

                // 用 stopAnimation 拿到真实位置（比 gestureState.dx 更可靠，避免松手后只露出一部分）
                translateX.stopAnimation((currentValue: number) => {
                    const finalValue = currentValue;
                    const shouldOpen = finalValue < swipeThreshold || gestureState.vx < velocityThreshold;
                    const toValue = shouldOpen ? -SWIPE_WIDTH : 0;

                    // 先更新 offset 记录
                    currentOffset.current = toValue;

                    if (shouldOpen) {
                        onSwipeOpen();
                    }

                    // 用“带初速度的无回弹弹簧”承接松手瞬间速度，避免“两段式”速度突变
                    Animated.spring(translateX, {
                        toValue,
                        useNativeDriver: true,
                        velocity: gestureState.vx,
                        overshootClamping: true,
                        tension: 80,
                        friction: 12,
                        restDisplacementThreshold: 0.5,
                        restSpeedThreshold: 0.5,
                    }).start(() => {
                        if (!shouldOpen) {
                            onSwipeClose();
                        }
                    });
                });
            },
            onPanResponderTerminate: () => {
                closeSwipeMenu();
            },
        }),
    ).current;

    // 关闭滑动菜单
    function closeSwipeMenu() {
        // closeSwipeMenu 的语义是“强制收回”（例如滑动另一个条目时关闭当前条目）
        if (isClosingRef.current) {
            return;
        }
        isClosingRef.current = true;

        translateX.stopAnimation(() => {
            currentOffset.current = 0;
            Animated.timing(translateX, {
                toValue: 0,
                duration: 160,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start(() => {
                isClosingRef.current = false;
                if (isMountedRef.current) {
                    onSwipeClose();
                }
            });
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
                // 性能优化：滑动动画更顺滑
                renderToHardwareTextureAndroid
                shouldRasterizeIOS
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
        // 过高的 zIndex/elevation 在 Android 上容易导致合成层抖动、出现“卡一下”
        zIndex: 1,
        elevation: 1,
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
        // 聊天列表分隔线：对齐好友列表的行间分隔效果
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
