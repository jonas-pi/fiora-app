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
    Vibration,
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
import { useTabSlideIn } from '../../hooks/useTabSlideIn';

/**
 * 联系人页面组件
 * 展示所有好友关系
 */
// 分类类型
type FilterType = 'all' | 'online' | 'offline';

export default function Contacts({ navigation }: any) {
    const { tabAnimatedStyle } = useTabSlideIn(navigation, 1);
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
    function handleContactPress(friend: Friend, event?: any) {
        const originX = event?.nativeEvent?.pageX;
        const originY = event?.nativeEvent?.pageY;
        action.setFocus(friend._id);
        Actions.push('chat', { title: formatLinkmanName(friend), originX, originY });

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
            <Animated.View style={[{ flex: 1 }, tabAnimatedStyle]}>
                {/* 分类栏 */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={closeAllSwipes}
                    style={styles.filterWrapper}
                >
                    {/* 外层阴影容器：Android 用实色 + elevation，避免半透明圆角出现白条 */}
                    <View style={styles.filterShadow}>
                        <View style={styles.filterContainer}>
                            <TouchableOpacity
                                style={[styles.filterItem, filter === 'all' && styles.filterItemActive]}
                                onPress={() => {
                                    closeAllSwipes();
                                    if (filter !== 'all') {
                                        Vibration.vibrate(8);
                                    }
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
                                    if (filter !== 'online') {
                                        Vibration.vibrate(8);
                                    }
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
                                    if (filter !== 'offline') {
                                        Vibration.vibrate(8);
                                    }
                                    setFilter('offline');
                                }}
                            >
                                <Text style={[styles.filterText, filter === 'offline' && styles.filterTextActive]}>
                                    离线
                                </Text>
                            </TouchableOpacity>
                        </View>
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
            </Animated.View>
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
    /**
     * 筛选条阴影容器：
     * - iOS: shadow*
     * - Android: elevation（必须配合不透明背景，否则易出现白色条纹/块）
     */
    filterShadow: {
        borderRadius: BORDER_RADIUS.input,
        backgroundColor: '#fff',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.32,
                shadowRadius: 14,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    filterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderRadius: BORDER_RADIUS.input, // 对齐聊天列表顶部圆角搜索框
        overflow: 'hidden',
        height: 42, // 对齐聊天列表顶部圆角搜索框高度
        padding: 4,
        alignItems: 'center',
    },
    filterItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 0,
        paddingHorizontal: 12,
        // “滑块”圆角：做成胶囊形
        borderRadius: 999,
        height: '100%',
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
    const isClosingRef = useRef(false); // 防止 closeSwipeMenu 被多次触发导致循环
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

    // 左滑操作区宽度（与按钮容器宽度保持一致）
    const SWIPE_WIDTH = 240;

    /**
     * 统一收尾逻辑：用 stopAnimation 获取真实位置，避免“松手后只露出部分按钮”的 BUG
     * 同时使用 timing + cubic easing，让动画更顺滑，避免弹簧二段感
     */
    function finalizeSwipe(vx: number) {
        // 更容易触发“完全滑出”
        const swipeThreshold = -SWIPE_WIDTH * 0.3;
        const velocityThreshold = -0.5;

        translateX.stopAnimation((currentValue: number) => {
            const shouldOpen = currentValue < swipeThreshold || vx < velocityThreshold;
            const toValue = shouldOpen ? -SWIPE_WIDTH : 0;

            currentOffset.current = toValue;
            if (shouldOpen) {
                onSwipeOpen();
            }

            // 用“带初速度的无回弹弹簧”承接松手瞬间速度，避免“两段式”速度突变
            Animated.spring(translateX, {
                toValue,
                useNativeDriver: true,
                velocity: vx,
                overshootClamping: true,
                tension: 80,
                friction: 12,
                restDisplacementThreshold: 0.5,
                restSpeedThreshold: 0.5,
            }).start(() => {
                if (!shouldOpen && isMountedRef.current) {
                    onSwipeClose();
                }
            });
        });
    }
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                return false;
            },
            onStartShouldSetPanResponderCapture: () => {
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
                return Math.abs(gestureState.dx) > 1 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                // 在捕获阶段也检查，确保能捕获到手势
                // 如果自己的菜单已打开，且是点击（移动距离很小），不拦截
                if (isOpen && Math.abs(gestureState.dx) < 3 && Math.abs(gestureState.dy) < 3) {
                    return false;
                }
                // 即使其他菜单已打开，也要响应滑动
                return Math.abs(gestureState.dx) > 1 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
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
                // 直接以当前偏移开始拖拽（不使用 setOffset/flattenOffset，避免快滑“二段式”）
                translateX.stopAnimation();
                backgroundColorOpacity.stopAnimation();
                translateX.setValue(currentOffset.current);
            },
            onPanResponderMove: (_, gestureState) => {
                // 只允许向左滑动（负值），且不超过操作按钮宽度
                const newValue = Math.max(-SWIPE_WIDTH, Math.min(0, currentOffset.current + gestureState.dx));
                translateX.setValue(newValue);
            },
            onPanResponderTerminate: (_, gestureState) => {
                // 手势被中断也走同一套收尾逻辑（更稳）
                finalizeSwipe(gestureState?.vx ?? 0);
            },
            onPanResponderRelease: (_, gestureState) => {
                finalizeSwipe(gestureState?.vx ?? 0);
            },
        }),
    ).current;

    // 关闭滑动菜单
    function closeSwipeMenu() {
        // 重要：closeSwipeMenu 是“外部要求关闭”的语义（例如滑第二条时关闭第一条），必须强制收回
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
                                    onPress(friend, e);
                                }
                            }, 300);
                        } else if (hasAnyMenuOpen) {
                            // 如果有其他菜单打开，先关闭所有菜单，然后跳转
                            onAnyContactPress();
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    onPress(friend, e);
                                }
                            }, 300);
                        } else {
                            // 没有菜单打开，正常跳转
                            onPress(friend, e);
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

