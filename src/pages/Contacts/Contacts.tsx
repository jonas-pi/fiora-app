import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    RefreshControl,
    Animated,
    PanResponder,
    Alert,
    Dimensions,
    Modal,
    TextInput,
    Platform,
    Pressable,
    Easing,
} from 'react-native';
import { Actions } from 'react-native-router-flux';

import { useLinkmans, useIsLogin, useSelfId } from '../../hooks/useStore';
import { Linkman, Friend } from '../../types/redux';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import action from '../../state/action';
import { formatLinkmanName } from '../../utils/linkman';
import fetch from '../../utils/fetch';
import { getUserOnlineStatus, deleteFriend } from '../../service';
import Toast from '../../components/Toast';
import { BORDER_RADIUS } from '../../utils/styles';

/**
 * 联系人页面组件
 * 展示所有好友关系
 */
// 分类类型
type FilterType = 'all' | 'online' | 'offline';

export default function Contacts() {
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all'); // 默认显示"全部"
    const [openSwipeId, setOpenSwipeId] = useState<string | null>(null); // 当前打开的滑动项ID
    const linkmans = useLinkmans();
    const isLogin = useIsLogin();
    const self = useSelfId();
    const closeSwipeRefs = useRef<{ [key: string]: () => void }>({}); // 存储每个项的关闭函数

    // 筛选出所有好友（type === 'friend'）
    const allFriends = useMemo(() => {
        return linkmans.filter((linkman) => linkman.type === 'friend') as Friend[];
    }, [linkmans]);

    // 根据分类筛选好友
    const friends = useMemo(() => {
        if (filter === 'all') {
            return allFriends;
        } else if (filter === 'online') {
            return allFriends.filter((friend) => friend.isOnline === true);
        } else if (filter === 'offline') {
            return allFriends.filter((friend) => friend.isOnline === false);
        }
        return allFriends;
    }, [allFriends, filter]);

    /**
     * 获取所有好友的在线状态
     */
    useEffect(() => {
        if (!isLogin || allFriends.length === 0) {
            return;
        }

        let isCancelled = false; // 用于取消异步操作

        // 为每个好友获取在线状态
        allFriends.forEach(async (friend) => {
            // 优先使用 friend.to._id 获取对方的用户ID（这是最可靠的方式）
            // 如果 friend.to._id 不存在，则从 friend._id 中提取（移除自己的ID）作为后备方案
            const userId = friend.to?._id || friend._id.replace(self, '');
            if (userId && userId !== self && !isCancelled) {
                try {
                    const isOnline = await getUserOnlineStatus(userId);
                    // 更新好友的在线状态（检查组件是否仍然挂载）
                    if (!isCancelled && isMountedRef.current) {
                        action.updateFriendProperty(friend._id, 'isOnline', isOnline);
                    }
                } catch (error) {
                    if (!isCancelled) {
                        console.error(`获取好友 ${friend.name} 的在线状态失败:`, error);
                    }
                }
            }
        });

        // 清理函数：标记为已取消
        return () => {
            isCancelled = true;
        };
    }, [allFriends, isLogin, self]);

    /**
     * 页面失去焦点时关闭所有打开的菜单
     * 当用户切换到其他页面时，确保菜单被关闭
     */
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        // 组件卸载时关闭所有菜单
        return () => {
            isMountedRef.current = false;
            closeAllSwipes();
        };
    }, []);

    /**
     * 下拉刷新处理函数
     * 刷新联系人列表的最新消息和在线状态
     */
    async function handleRefresh() {
        // 刷新时先关闭所有打开的菜单
        closeAllSwipes();
        setRefreshing(true);
        try {
            // 从当前的 linkmans 中获取所有联系人的 ID
            const linkmanIds = linkmans.map((linkman) => linkman._id);
            
            if (linkmanIds.length > 0) {
                const [err, linkmansData] = await fetch('getLinkmansLastMessagesV2', {
                    linkmans: linkmanIds,
                });
                if (!err && linkmansData) {
                    action.setLinkmansLastMessages(linkmansData);
                }
            }

            // 刷新所有好友的在线状态
            if (isLogin && allFriends.length > 0) {
                allFriends.forEach(async (friend) => {
                    // 优先使用 friend.to._id 获取对方的用户ID
                    const userId = friend.to?._id || friend._id.replace(self, '');
                    if (userId && userId !== self) {
                        try {
                            const isOnline = await getUserOnlineStatus(userId);
                            action.updateFriendProperty(friend._id, 'isOnline', isOnline);
                        } catch (error) {
                            console.error(`刷新好友 ${friend.name} 的在线状态失败:`, error);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('刷新联系人列表失败:', error);
        } finally {
            // 延迟一下再结束刷新，让用户看到刷新动画
            setTimeout(() => {
                if (isMountedRef.current) {
                    setRefreshing(false);
                }
            }, 500);
        }
    }

    /**
     * 处理点击联系人
     * 跳转到聊天页面并更新历史记录
     */
    function handleContactPress(friend: Friend) {
        action.setFocus(friend._id);
        Actions.chat({ title: formatLinkmanName(friend) });

        // 如果有最后一条消息，更新历史记录
        const lastMessage = friend.messages.length > 0 ? friend.messages[friend.messages.length - 1] : null;
        if (friend._id && lastMessage) {
            fetch('updateHistory', { linkmanId: friend._id, messageId: lastMessage._id });
        }
    }

    /**
     * 关闭所有打开的滑动菜单
     * 注意：只关闭指定的菜单，不影响其他正在滑动的菜单
     */
    function closeAllSwipes() {
        // 如果没有打开的菜单，直接返回
        if (!openSwipeId) {
            return;
        }
        
        // 先重置状态，防止重复调用
        const currentOpenId = openSwipeId;
        setOpenSwipeId(null);
        
        // 只关闭当前打开的菜单，不影响其他菜单
        const closeFn = closeSwipeRefs.current[currentOpenId];
        if (closeFn) {
            try {
                closeFn();
            } catch (error) {
                console.error('关闭滑动菜单失败:', error);
            }
        }
        
        // 延迟清空引用，确保动画能执行
        setTimeout(() => {
            // 只删除已关闭的菜单引用，保留其他菜单的引用
            if (isMountedRef.current && closeSwipeRefs.current[currentOpenId]) {
                delete closeSwipeRefs.current[currentOpenId];
            }
        }, 300);
    }

    /**
     * 处理滑动项打开
     */
    function handleSwipeOpen(friendId: string) {
        // 如果打开了新的项，先关闭之前的项
        if (openSwipeId && openSwipeId !== friendId && closeSwipeRefs.current[openSwipeId]) {
            closeSwipeRefs.current[openSwipeId]();
        }
        setOpenSwipeId(friendId);
    }

    /**
     * 处理滑动项关闭
     */
    function handleSwipeClose(friendId: string) {
        if (openSwipeId === friendId) {
            setOpenSwipeId(null);
        }
    }

    /**
     * 注册关闭函数
     */
    function registerCloseFunction(friendId: string, closeFn: () => void) {
        closeSwipeRefs.current[friendId] = closeFn;
    }

    /**
     * 渲染联系人列表项（可滑动）
     */
    function renderContact(friend: Friend) {
        return (
            <SwipeableContactItem
                key={friend._id}
                friend={friend}
                onPress={handleContactPress}
                isOpen={openSwipeId === friend._id}
                onSwipeOpen={() => handleSwipeOpen(friend._id)}
                onSwipeClose={() => handleSwipeClose(friend._id)}
                registerCloseFunction={(closeFn) => registerCloseFunction(friend._id, closeFn)}
                // 传递关闭所有菜单的函数，用于点击其他联系人项时关闭菜单
                onAnyContactPress={closeAllSwipes}
                hasAnyMenuOpen={!!openSwipeId}
                openSwipeId={openSwipeId}
                closeSwipeRefs={closeSwipeRefs}
            />
        );
    }

    return (
        <PageContainer>
            {/* 分类栏 */}
            <TouchableOpacity
                activeOpacity={1}
                onPress={closeAllSwipes}
                style={styles.filterWrapper}
            >
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterItem, filter === 'all' && styles.filterItemActive]}
                        onPress={() => {
                            closeAllSwipes();
                            setFilter('all');
                        }}
                    >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                            全部
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterItem, filter === 'online' && styles.filterItemActive]}
                        onPress={() => {
                            closeAllSwipes();
                            setFilter('online');
                        }}
                    >
                        <Text style={[styles.filterText, filter === 'online' && styles.filterTextActive]}>
                            在线
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterItem, filter === 'offline' && styles.filterItemActive]}
                        onPress={() => {
                            closeAllSwipes();
                            setFilter('offline');
                        }}
                    >
                        <Text style={[styles.filterText, filter === 'offline' && styles.filterTextActive]}>
                            离线
                        </Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
            <View style={styles.scrollViewWrapper}>
                <ScrollView
                    style={styles.container}
                    onScrollBeginDrag={() => {
                        closeAllSwipes();
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor="#2a7bf6"
                            colors={['#2a7bf6']}
                            title="下拉刷新"
                            titleColor="#2a7bf6"
                        />
                    }
                >
                    {!isLogin ? (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={closeAllSwipes}
                            style={styles.emptyContainer}
                        >
                            <Text style={styles.emptyText}>请先登录以查看联系人</Text>
                        </TouchableOpacity>
                    ) : friends.length === 0 ? (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={closeAllSwipes}
                            style={styles.emptyContainer}
                        >
                            <Text style={styles.emptyText}>
                                {filter === 'all' ? '暂无联系人' : filter === 'online' ? '暂无在线联系人' : '暂无离线联系人'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            {friends.map((friend) => renderContact(friend))}
                            {/* 当有菜单打开时，在列表底部添加一个透明的点击区域，用于关闭菜单 */}
                            {openSwipeId && (
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={closeAllSwipes}
                                    style={styles.closeArea}
                                />
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
            {/* 当有菜单打开时，添加一个覆盖层来处理点击空白区域 - 放在最外层 */}
            {/* 注意：覆盖层使用 pointerEvents="box-none"，让子元素可以接收触摸事件 */}
            {openSwipeId && (
                <Pressable
                    onPress={closeAllSwipes}
                    style={styles.overlay}
                    pointerEvents="box-none"
                >
                    <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
                </Pressable>
            )}
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    scrollViewWrapper: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    // 分类栏样式
    filterWrapper: {
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 8,
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 8,
        padding: 4,
    },
    filterItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    filterItemActive: {
        backgroundColor: '#2a7bf6',
    },
    filterText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    // 可滑动容器
    swipeableContainer: {
        position: 'relative',
        overflow: 'hidden',
        zIndex: 1000, // 提高 zIndex，确保手势能正确响应，高于覆盖层
        elevation: 1000, // Android 阴影层级，确保在手势响应时高于覆盖层
    },
    // 操作按钮容器（背景）
    actionButtonsContainer: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        width: 240,
        backgroundColor: 'transparent', // 去掉白色背景
    },
    // 操作按钮
    actionButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    favoriteButton: {
        backgroundColor: '#ff9800',
    },
    remarkButton: {
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
    // 联系人项包装器（可滑动）
    contactItemWrapper: {
        position: 'relative',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        // 保持透明以显示页面背景
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    favoriteIcon: {
        fontSize: 14,
        marginLeft: 4,
    },
    contactInfo: {
        flex: 1,
        marginLeft: 12,
    },
    contactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    contactName: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    onlineIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ccc',
        marginLeft: 8,
    },
    online: {
        backgroundColor: '#4caf50',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    unreadBadge: {
        backgroundColor: '#2a7bf6',
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    unreadText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    // 关闭菜单的点击区域（当菜单打开时显示在列表底部）
    closeArea: {
        height: 1000, // 足够大的高度，覆盖整个可见区域
        backgroundColor: 'transparent',
    },
    // 覆盖层，用于处理点击空白区域关闭菜单
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 999, // 确保在最上层，可以捕获所有点击
        elevation: 999, // Android 阴影层级，确保在最上层
        // 注意：使用 pointerEvents="box-none" 让子元素可以接收触摸事件
        // 但这里我们需要捕获点击，所以不使用 box-none
    },
    // Modal 遮罩层样式
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色遮罩
        justifyContent: 'center', // 垂直居中
        alignItems: 'center', // 水平居中
    },
    // Modal 内容容器样式（统一设计语言）
    modalContent: {
        width: '85%', // 宽度为屏幕的 85%
        maxWidth: 400, // 最大宽度限制
        backgroundColor: '#FFFFFF', // 纯白色背景
        borderRadius: BORDER_RADIUS.card, // 使用统一的卡片圆角
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)', // 淡灰色边框
        padding: 24, // 内边距
        // 增强的 iOS 阴影/光晕效果
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35, // 增强阴影透明度
                shadowRadius: 16, // 增加光晕范围
            },
            android: {
                elevation: 12, // 增强 Android 阴影
            },
        }),
    },
    // 对话框标题样式
    dialogTitle: {
        fontSize: 20,
        fontWeight: '600', // 加粗字重
        color: '#000',
        marginBottom: 8, // 下边距
    },
    // 对话框描述样式
    dialogDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16, // 下边距
    },
    // 对话框输入框样式（使用统一圆角）
    dialogInput: {
        backgroundColor: 'transparent', // 透明背景，避免白色矩形
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.15)', // 淡灰色边框，增强可见性
        borderRadius: BORDER_RADIUS.input, // 使用统一的输入框圆角
        paddingHorizontal: 12, // 左右内边距
        paddingVertical: 10, // 上下内边距
        fontSize: 16,
        color: '#000', // 文本颜色
        marginBottom: 20, // 下边距
    },
    // 按钮容器样式
    buttonContainer: {
        flexDirection: 'row', // 横向排列按钮
        justifyContent: 'space-between', // 按钮之间分布
        alignItems: 'center', // 垂直居中
        marginTop: 5, // 上边距
    },
    // 取消按钮样式（非危险操作，使用灰色）
    cancelButton: {
        flex: 1, // 按钮占据可用空间
        backgroundColor: '#999999', // 灰色背景（非危险操作）
        borderRadius: BORDER_RADIUS.button, // 使用统一的按钮圆角
        overflow: 'hidden', // 确保圆角生效
        paddingVertical: 12, // 按钮内边距
        paddingHorizontal: 20, // 按钮内边距
        marginRight: 8, // 右侧外边距（与确定按钮之间的间距）
        alignItems: 'center', // 文本居中
        justifyContent: 'center', // 文本居中
        minHeight: 44, // 最小高度，确保按钮可点击区域足够大
        // 阴影效果
        ...Platform.select({
            ios: {
                shadowColor: '#999999',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    // 取消按钮文本样式
    cancelButtonText: {
        color: '#FFFFFF', // 白色文本
        fontSize: 16,
        fontWeight: '600', // 加粗字重
    },
    // 确定按钮样式
    confirmButton: {
        flex: 1, // 按钮占据可用空间
        backgroundColor: '#4A90E2', // 蓝色背景
        borderRadius: BORDER_RADIUS.button, // 使用统一的按钮圆角
        overflow: 'hidden', // 确保圆角生效
        paddingVertical: 12, // 按钮内边距
        paddingHorizontal: 20, // 按钮内边距
        marginLeft: 8, // 左侧外边距（与取消按钮之间的间距）
        alignItems: 'center', // 文本居中
        justifyContent: 'center', // 文本居中
        minHeight: 44, // 最小高度，确保按钮可点击区域足够大
        // 阴影效果
        ...Platform.select({
            ios: {
                shadowColor: '#4A90E2',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    // 确定按钮文本样式
    confirmButtonText: {
        color: '#FFFFFF', // 白色文本
        fontSize: 16,
        fontWeight: '600', // 加粗字重
    },
    // 删除确认按钮样式（红色背景）
    deleteConfirmButton: {
        flex: 1,
        backgroundColor: '#E53E3E', // 红色背景
        borderRadius: BORDER_RADIUS.button,
        overflow: 'hidden',
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        ...Platform.select({
            ios: {
                shadowColor: '#E53E3E',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    // 删除确认按钮文本样式
    deleteConfirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

/**
 * 可滑动的联系人项组件
 */
type SwipeableContactItemProps = {
    friend: Friend;
    onPress: (friend: Friend) => void;
    isOpen: boolean;
    onSwipeOpen: () => void;
    onSwipeClose: () => void;
    registerCloseFunction: (closeFn: () => void) => void;
    onAnyContactPress: () => void; // 点击任何联系人项时调用（用于关闭其他打开的菜单）
    hasAnyMenuOpen: boolean; // 是否有任何菜单打开
    openSwipeId: string | null; // 当前打开的菜单ID
    closeSwipeRefs: React.MutableRefObject<{ [key: string]: () => void }>; // 关闭函数引用
};

function SwipeableContactItem({
    friend,
    onPress,
    isOpen,
    onSwipeOpen,
    onSwipeClose,
    registerCloseFunction,
    onAnyContactPress,
    hasAnyMenuOpen,
    openSwipeId,
    closeSwipeRefs,
}: SwipeableContactItemProps) {
    const self = useSelfId();
    const translateX = useRef(new Animated.Value(0)).current;
    const backgroundColorOpacity = useRef(new Animated.Value(0)).current; // 背景色透明度动画值
    const currentOffset = useRef(0);
    const isMountedRef = useRef(true); // 组件挂载状态
    const [showRemarkDialog, setShowRemarkDialog] = useState(false);
    const [remarkInput, setRemarkInput] = useState('');
    const [isRemarkInputFocused, setIsRemarkInputFocused] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false); // 删除确认对话框
    
    // 监听 translateX 的变化，同步更新背景色透明度
    useEffect(() => {
        const listenerId = translateX.addListener(({ value }) => {
            // translateX 从 -240 到 0，映射到透明度从 0.8 到 0
            const opacity = Math.max(0, Math.min(0.8, Math.abs(value) / 240 * 0.8));
            backgroundColorOpacity.setValue(opacity);
        });
        return () => {
            translateX.removeListener(listenerId);
        };
    }, []);
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                // 在手指刚触碰到时，如果其他菜单已打开，立即关闭它们
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    // 直接调用关闭函数，立即启动关闭动画
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                return false;
            },
            onStartShouldSetPanResponderCapture: () => {
                // 在捕获阶段也检查，确保能立即关闭其他菜单
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                return false;
            },
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // 如果自己的菜单已打开，且是点击（移动距离很小），不拦截，让点击事件传递
                if (isOpen && Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
                    return false;
                }
                // 只响应水平滑动，进一步降低阈值以确保能捕获所有滑动
                // 只要水平滑动距离大于垂直滑动距离，就响应（降低到 3px）
                // 注意：即使其他菜单已打开，也要响应滑动，以便关闭其他菜单并打开当前菜单
                return Math.abs(gestureState.dx) > 3 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                // 在捕获阶段也检查，确保能捕获到手势
                // 如果自己的菜单已打开，且是点击（移动距离很小），不拦截
                if (isOpen && Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
                    return false;
                }
                // 即使其他菜单已打开，也要响应滑动
                return Math.abs(gestureState.dx) > 3 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: () => {
                // 如果其他菜单已打开，立即关闭它们（但不中断当前手势）
                if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                    // 直接调用关闭函数，不会中断当前手势
                    const closeFn = closeSwipeRefs.current[openSwipeId];
                    if (closeFn) {
                        closeFn();
                    }
                }
                // 开始滑动时，使用当前偏移量
                translateX.setOffset(currentOffset.current);
                translateX.setValue(0);
            },
            onPanResponderMove: (_, gestureState) => {
                // 只允许向左滑动（负值），且不超过操作按钮宽度
                const newValue = Math.max(-240, Math.min(0, gestureState.dx));
                translateX.setValue(newValue);
                // 同步更新背景色透明度：translateX 从 -240 到 0，映射到透明度从 0.8 到 0
                const opacity = Math.max(0, Math.min(0.8, Math.abs(newValue) / 240 * 0.8));
                backgroundColorOpacity.setValue(opacity);
            },
            onPanResponderTerminate: (_, gestureState) => {
                // 手势被中断时，也要执行释放逻辑
                // 在 flattenOffset 之前获取当前值
                const finalValue = currentOffset.current + gestureState.dx;
                translateX.flattenOffset();
                
                const swipeThreshold = -120;
                const minSwipeDistance = 5; // 最小滑动距离，小于此值直接收回
                const velocityThreshold = -0.5;
                
                if (Math.abs(gestureState.dx) < minSwipeDistance) {
                    currentOffset.current = 0;
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0,
                            useNativeDriver: false,
                            tension: 40,
                            friction: 8,
                            velocity: 0,
                        }),
                    ]).start(() => {
                        if (isMountedRef.current) {
                            onSwipeClose();
                        }
                    });
                } else if (finalValue < swipeThreshold || gestureState.vx < velocityThreshold) {
                    currentOffset.current = -240;
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: -240,
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0.8,
                            useNativeDriver: false,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                    ]).start(() => {
                        if (isMountedRef.current) {
                            onSwipeOpen();
                        }
                    });
                } else {
                    currentOffset.current = 0;
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0,
                            useNativeDriver: false,
                            tension: 40,
                            friction: 8,
                            velocity: 0,
                        }),
                    ]).start(() => {
                        if (isMountedRef.current) {
                            onSwipeClose();
                        }
                    });
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                // 在 flattenOffset 之前获取当前值
                // 由于我们在 onPanResponderGrant 中设置了 offset，当前值 = offset + gestureState.dx
                const finalValue = currentOffset.current + gestureState.dx;
                
                const swipeThreshold = -120; // 滑动距离阈值（滑动超过一半，即 -240 的一半）
                const minSwipeDistance = 5; // 最小滑动距离，小于此值直接收回（使用绝对值，降低阈值以识别更小的滑动）
                const velocityThreshold = -0.5; // 滑动速度阈值（负值表示向左滑动）
                
                // 先 flattenOffset，确保值正确
                translateX.flattenOffset();
                
                // 如果滑动距离很小（无论向左还是向右），直接收回
                if (Math.abs(gestureState.dx) < minSwipeDistance) {
                    currentOffset.current = 0;
                    // 停止所有正在进行的动画
                    translateX.stopAnimation();
                    backgroundColorOpacity.stopAnimation();
                    // 立即执行收回动画
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0,
                            useNativeDriver: false,
                            tension: 40,
                            friction: 8,
                            velocity: 0,
                        }),
                    ]).start((finished) => {
                        if (finished && isMountedRef.current) {
                            translateX.setValue(0);
                            backgroundColorOpacity.setValue(0);
                        }
                        if (isMountedRef.current) {
                            onSwipeClose();
                        }
                    });
                    return;
                }
                
                // 考虑滑动速度和距离，判断是展开还是关闭
                // 如果滑动速度很快（向左），或者滑动距离超过阈值，展开
                const shouldOpen = finalValue < swipeThreshold || gestureState.vx < velocityThreshold;
                
                if (shouldOpen) {
                    // 滑动超过阈值或速度很快，完成滑动，显示操作按钮
                    currentOffset.current = -240;
                    // 停止所有正在进行的动画
                    translateX.stopAnimation();
                    backgroundColorOpacity.stopAnimation();
                    // 立即执行展开动画
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: -240, // 操作按钮区域宽度
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0.8, // 背景色透明度
                            useNativeDriver: false, // backgroundColor 不支持原生驱动
                            tension: 40,
                            friction: 8,
                            velocity: 0,
                        }),
                    ]).start((finished) => {
                        if (finished && isMountedRef.current) {
                            translateX.setValue(-240);
                            backgroundColorOpacity.setValue(0.8);
                        }
                        if (isMountedRef.current) {
                            onSwipeOpen();
                        }
                    });
                } else {
                    // 滑动未超过阈值且速度不够，恢复原状
                    currentOffset.current = 0;
                    // 停止所有正在进行的动画
                    translateX.stopAnimation();
                    backgroundColorOpacity.stopAnimation();
                    // 立即执行收回动画
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0,
                            useNativeDriver: true,
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                        Animated.spring(backgroundColorOpacity, {
                            toValue: 0,
                            useNativeDriver: false, // backgroundColor 不支持原生驱动
                            tension: 40, // 降低 tension，让动画更平滑
                            friction: 8, // 增加 friction，减少弹跳效果
                            velocity: 0, // 初始速度为0，避免突然启动
                        }),
                    ]).start((finished) => {
                        if (finished && isMountedRef.current) {
                            translateX.setValue(0);
                            backgroundColorOpacity.setValue(0);
                        }
                        if (isMountedRef.current) {
                            onSwipeClose();
                        }
                    });
                }
            },
        }),
    ).current;

    // 关闭滑动菜单
    function closeSwipeMenu() {
        // 如果菜单已经完全打开，直接收回
        if (currentOffset.current === -240) {
            currentOffset.current = 0;
            translateX.flattenOffset();
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 8,
                    velocity: 0,
                }),
                Animated.spring(backgroundColorOpacity, {
                    toValue: 0,
                    useNativeDriver: false,
                    tension: 40,
                    friction: 8,
                    velocity: 0,
                }),
            ]).start((finished) => {
                if (finished && isMountedRef.current) {
                    translateX.setValue(0);
                    backgroundColorOpacity.setValue(0);
                }
                if (isMountedRef.current) {
                    onSwipeClose();
                }
            });
            return;
        }
        
        // 停止所有正在进行的动画，并获取当前值
        translateX.stopAnimation((currentValue) => {
            // 确保 offset 被 flatten
            translateX.flattenOffset();
            
            // 获取实际的当前值（考虑 offset）
            // 如果 currentValue 是 null 或 undefined，使用 currentOffset
            const actualValue = currentOffset.current + (currentValue || 0);
            const swipeThreshold = -120; // 滑动阈值（滑动超过一半，即 -240 的一半）
            
            // 根据当前滑动位置判断是展开还是收回
            if (actualValue < swipeThreshold && actualValue > -240) {
                // 如果已经滑动超过阈值但未完全打开，继续展开到完全打开
                currentOffset.current = -240;
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: -240,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }),
                    Animated.spring(backgroundColorOpacity, {
                        toValue: 0.8,
                        useNativeDriver: false,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }),
                ]).start(() => {
                    if (isMountedRef.current) {
                        onSwipeOpen();
                    }
                });
            } else {
                // 如果未超过阈值或已经超过完全打开的位置，收回
                currentOffset.current = 0;
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }),
                    Animated.spring(backgroundColorOpacity, {
                        toValue: 0,
                        useNativeDriver: false,
                        tension: 40,
                        friction: 8,
                        velocity: 0,
                    }),
                ]).start((finished) => {
                    if (finished && isMountedRef.current) {
                        translateX.setValue(0);
                        backgroundColorOpacity.setValue(0);
                    }
                    if (isMountedRef.current) {
                        onSwipeClose();
                    }
                });
            }
        });
        
        // 同时停止背景色透明度动画
        backgroundColorOpacity.stopAnimation();
    }

    // 注册关闭函数，供父组件调用
    useEffect(() => {
        isMountedRef.current = true;
        registerCloseFunction(closeSwipeMenu);
        return () => {
            isMountedRef.current = false;
            if (closeSwipeRefs.current) {
                delete closeSwipeRefs.current[friend._id];
            }
        };
    }, [registerCloseFunction, friend._id]);

    // 监听外部关闭请求
    useEffect(() => {
        if (!isOpen && currentOffset.current !== 0) {
            closeSwipeMenu();
        }
    }, [isOpen]);

    // 处理特别关心切换
    function handleToggleFavorite() {
        const currentFavorite = (friend as any).isFavorite || false;
        action.updateFriendProperty(friend._id, 'isFavorite', !currentFavorite);
        Toast.success(!currentFavorite ? '已设为特别关心' : '已取消特别关心');
        closeSwipeMenu();
    }

    // 处理设置备注
    function handleSetRemark() {
        const currentRemark = (friend as any).remark || '';
        setRemarkInput(currentRemark);
        setShowRemarkDialog(true);
        closeSwipeMenu();
    }

    // 确认设置备注
    function handleConfirmRemark() {
        action.updateFriendProperty(friend._id, 'remark', remarkInput.trim());
        Toast.success(remarkInput.trim() ? '备注设置成功' : '备注已清除');
        setShowRemarkDialog(false);
        setRemarkInput('');
    }

    // 处理移除好友
    function handleRemoveFriend() {
        setShowDeleteDialog(true);
        closeSwipeMenu();
    }

    // 确认删除好友
    async function handleConfirmDelete() {
        const userId = friend.to?._id || friend._id.replace(self, '');
        if (userId) {
            const isSuccess = await deleteFriend(userId);
            if (isSuccess) {
                action.removeLinkman(friend._id);
                Toast.success('已删除好友');
            } else {
                Toast.danger('删除好友失败');
            }
        }
        setShowDeleteDialog(false);
    }

    // 获取最后一条消息
    const lastMessage = friend.messages.length > 0 ? friend.messages[friend.messages.length - 1] : null;
    // 获取显示名称（优先显示备注，其次显示原名称）
    const displayName = (friend as any).remark || friend.name;
    // 获取特别关心状态
    const isFavorite = (friend as any).isFavorite || false;

    return (
        <View style={styles.swipeableContainer}>
            {/* 操作按钮区域（背景）- 跟随滑动位置移动，像火车一样 */}
            {/* 注意：整个容器需要更高的 zIndex，确保手势能正确响应，即使有覆盖层 */}
            <Animated.View 
                style={[
                    styles.actionButtonsContainer,
                    {
                        // 按钮跟随滑动位置移动：translateX 从 0 到 -240，按钮从右侧（240）移动到可见位置（0）
                        transform: [
                            {
                                translateX: translateX.interpolate({
                                    inputRange: [-240, 0],
                                    outputRange: [0, 240], // 当联系人向左滑动时，按钮从右侧（240）移动到可见位置（0）
                                    extrapolate: 'clamp',
                                }) as any,
                            },
                        ],
                    },
                ]}
                pointerEvents={isOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity
                    style={[styles.actionButton, styles.favoriteButton]}
                    onPress={(e) => {
                        e.stopPropagation(); // 阻止事件冒泡，防止触发外层的 closeAllSwipes
                        handleToggleFavorite();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>{isFavorite ? '取消关心' : '特别关心'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.remarkButton]}
                    onPress={(e) => {
                        e.stopPropagation(); // 阻止事件冒泡
                        handleSetRemark();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>设置备注</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={(e) => {
                        e.stopPropagation(); // 阻止事件冒泡
                        handleRemoveFriend();
                    }}
                    disabled={!isOpen}
                >
                    <Text style={styles.actionButtonText}>移除好友</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* 联系人项（可滑动） */}
            <Animated.View
                style={[
                    styles.contactItemWrapper,
                    {
                        transform: [{ translateX }],
                    },
                ]}
                {...panResponder.panHandlers}
            >
                {/* 背景色层，根据滑动程度动态变化 - 已移除，因为按钮会跟随滑动 */}
                <TouchableOpacity
                    onPressIn={() => {
                        // 在手指刚触碰到时，如果其他菜单已打开，立即关闭它们
                        if (hasAnyMenuOpen && !isOpen && openSwipeId) {
                            // 直接调用关闭函数，立即启动关闭动画
                            const closeFn = closeSwipeRefs.current[openSwipeId];
                            if (closeFn) {
                                closeFn();
                            } else {
                                // 如果关闭函数不存在，使用 onAnyContactPress 作为后备
                                onAnyContactPress();
                            }
                        }
                    }}
                    onPress={(e) => {
                        // 阻止事件冒泡，防止触发覆盖层的 closeAllSwipes
                        e.stopPropagation();
                        // 如果自己的菜单已打开，先关闭菜单，然后跳转（不吞掉点击）
                        if (isOpen) {
                            closeSwipeMenu();
                            // 延迟执行跳转，确保菜单关闭动画完成后再跳转
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    onPress(friend);
                                }
                            }, 300);
                        } else if (hasAnyMenuOpen) {
                            // 如果有其他菜单打开，先关闭所有菜单，然后跳转
                            onAnyContactPress();
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    onPress(friend);
                                }
                            }, 300);
                        } else {
                            // 没有菜单打开，正常跳转
                            onPress(friend);
                        }
                    }}
                    style={styles.contactItem}
                    activeOpacity={0.7}
                >
                    <Avatar src={friend.avatar} size={50} />
                    <View style={styles.contactInfo}>
                        <View style={styles.contactHeader}>
                            <Text style={styles.contactName}>{displayName}</Text>
                            {isFavorite && <Text style={styles.favoriteIcon}>⭐</Text>}
                            {friend.isOnline !== undefined && (
                                <View style={[styles.onlineIndicator, friend.isOnline && styles.online]} />
                            )}
                        </View>
                        {lastMessage && (
                            <Text style={styles.lastMessage} numberOfLines={1}>
                                {lastMessage.type === 'text' ? lastMessage.content : `[${lastMessage.type}]`}
                            </Text>
                        )}
                    </View>
                    {friend.unread > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{friend.unread > 99 ? '99+' : friend.unread}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* 设置备注对话框 - 使用自定义 Modal 统一设计语言 */}
            <Modal
                visible={showRemarkDialog}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRemarkDialog(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowRemarkDialog(false)}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* 标题 */}
                        <Text style={styles.dialogTitle}>设置备注</Text>
                        {/* 描述 */}
                        <Text style={styles.dialogDescription}>请输入备注名称</Text>
                        {/* 输入框 */}
                        <TextInput
                            value={remarkInput}
                            onChangeText={setRemarkInput}
                            autoCapitalize="none"
                            autoFocus
                            autoCorrect={false}
                            style={styles.dialogInput}
                            placeholder={isRemarkInputFocused ? '' : '请输入备注名称'}
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            onFocus={() => setIsRemarkInputFocused(true)}
                            onBlur={() => setIsRemarkInputFocused(false)}
                        />
                        {/* 按钮容器 */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                onPress={() => setShowRemarkDialog(false)}
                                style={styles.cancelButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmRemark}
                                style={styles.confirmButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.confirmButtonText}>确定</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 删除确认对话框 - 使用自定义 Modal 统一设计语言 */}
            <Modal
                visible={showDeleteDialog}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteDialog(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDeleteDialog(false)}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* 标题 */}
                        <Text style={styles.dialogTitle}>确认删除</Text>
                        {/* 描述 */}
                        <Text style={styles.dialogDescription}>确定要删除好友 {displayName} 吗？</Text>
                        {/* 按钮容器 */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                onPress={() => setShowDeleteDialog(false)}
                                style={styles.cancelButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmDelete}
                                style={styles.deleteConfirmButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.deleteConfirmButtonText}>删除</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

