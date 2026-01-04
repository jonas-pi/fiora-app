import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, RefreshControl, View, TouchableOpacity, Animated, Platform } from 'react-native';

import { Header, Item, Icon, Input } from 'native-base';
import { Actions } from 'react-native-router-flux';
import Linkman from './Linkman';
import { useLinkmans } from '../../hooks/useStore';
import { Linkman as LinkmanType } from '../../types/redux';
import PageContainer from '../../components/PageContainer';
import { search } from '../../service';
import { isiOS } from '../../utils/platform';
import { BORDER_RADIUS } from '../../utils/styles';
import fetch from '../../utils/fetch';
import action from '../../state/action';
import { useTabSlideIn } from '../../hooks/useTabSlideIn';

export default function ChatList({ navigation }: any) {
    const { tabAnimatedStyle } = useTabSlideIn(navigation, 0);
    const [searchKeywords, updateSearchKeywords] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [openSwipeId, setOpenSwipeId] = useState<string | null>(null); // 当前打开的滑动项ID
    const closeSwipeRefs = useRef<{ [key: string]: () => void }>({}); // 存储每个项的关闭函数
    const isMountedRef = useRef(true); // 组件挂载状态
    const linkmans = useLinkmans();

    async function handleSearch() {
        const result = await search(searchKeywords);
        updateSearchKeywords('');
        Actions.push('searchResult', result);
    }

    /**
     * 关闭所有打开的滑动菜单
     */
    function closeAllSwipes() {
        if (!openSwipeId) {
            return;
        }
        const currentOpenId = openSwipeId;
        setOpenSwipeId(null);
        const closeFn = closeSwipeRefs.current[currentOpenId];
        if (closeFn) {
            try {
                closeFn();
            } catch (error) {
                console.error('关闭滑动菜单失败:', error);
            }
        }
        setTimeout(() => {
            if (closeSwipeRefs.current[currentOpenId]) {
                delete closeSwipeRefs.current[currentOpenId];
            }
        }, 300);
    }

    /**
     * 下拉刷新处理函数
     * 刷新聊天列表的最新消息
     */
    async function handleRefresh() {
        closeAllSwipes(); // 刷新时先关闭所有打开的菜单
        setRefreshing(true);
        try {
            // 从当前的 linkmans 中获取所有联系人的 ID
            // 这样可以同时支持登录和游客模式
            const linkmanIds = linkmans.map((linkman) => linkman._id);
            
            if (linkmanIds.length > 0) {
                const [err, linkmansData] = await fetch('getLinkmansLastMessagesV2', {
                    linkmans: linkmanIds,
                });
                if (!err && linkmansData) {
                    action.setLinkmansLastMessages(linkmansData);
                }
            }
        } catch (error) {
            console.error('刷新聊天列表失败:', error);
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
     * 处理滑动项打开
     */
    function handleSwipeOpen(linkmanId: string) {
        if (openSwipeId && openSwipeId !== linkmanId && closeSwipeRefs.current[openSwipeId]) {
            closeSwipeRefs.current[openSwipeId]();
        }
        setOpenSwipeId(linkmanId);
    }

    /**
     * 处理滑动项关闭
     */
    function handleSwipeClose(linkmanId: string) {
        if (openSwipeId === linkmanId) {
            setOpenSwipeId(null);
        }
    }

    /**
     * 注册关闭函数
     */
    function registerCloseFunction(linkmanId: string, closeFn: () => void) {
        closeSwipeRefs.current[linkmanId] = closeFn;
    }

    // 组件挂载/卸载管理
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    function renderLinkman(linkman: LinkmanType) {
        const { _id: linkmanId, unread, messages, createTime } = linkman;
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        let time = new Date(createTime);
        let preview = '暂无消息';
        if (lastMessage) {
            time = new Date(lastMessage.createTime);
            preview =
                lastMessage.type === 'text' ? `${lastMessage.content}` : `[${lastMessage.type}]`;
            if (linkman.type === 'group') {
                preview = `${lastMessage.from.username}: ${preview}`;
            }
        }
        return (
            <Linkman
                key={linkmanId}
                id={linkmanId}
                name={linkman.name}
                avatar={linkman.avatar}
                preview={preview}
                time={time}
                unread={unread}
                linkman={linkman}
                lastMessageId={lastMessage ? lastMessage._id : ''}
                isOpen={openSwipeId === linkmanId}
                onSwipeOpen={() => handleSwipeOpen(linkmanId)}
                onSwipeClose={() => handleSwipeClose(linkmanId)}
                registerCloseFunction={(closeFn) => registerCloseFunction(linkmanId, closeFn)}
                onAnyLinkmanPress={closeAllSwipes}
                hasAnyMenuOpen={!!openSwipeId}
                openSwipeId={openSwipeId}
                closeSwipeRefs={closeSwipeRefs}
            />
        );
    }

    return (
        <PageContainer>
            <Animated.View style={[{ flex: 1 }, tabAnimatedStyle]}>
                {/* 搜索栏 - 点击时关闭菜单 */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={closeAllSwipes}
                    style={styles.searchWrapper}
                >
                    <Header searchBar rounded noShadow style={styles.searchContainer}>
                        {/* 外层阴影容器：Android 用实色 + elevation，避免半透明圆角出现白条 */}
                        <View style={styles.searchShadow}>
                            <Item style={styles.searchItem}>
                                <Icon name="ios-search" style={styles.searchIcon} />
                                <Input
                                    style={styles.searchText}
                                    placeholder={isSearchFocused ? '' : '搜索群组/用户'}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    value={searchKeywords}
                                    onChangeText={updateSearchKeywords}
                                    onSubmitEditing={handleSearch}
                                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                                    onFocus={() => {
                                        setIsSearchFocused(true);
                                        closeAllSwipes(); // 聚焦时也关闭菜单
                                    }}
                                    onBlur={() => setIsSearchFocused(false)}
                                />
                            </Item>
                        </View>
                    </Header>
                </TouchableOpacity>
                <ScrollView
                    style={styles.messageList}
                    onScrollBeginDrag={closeAllSwipes}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            // iOS 和 Android 的刷新颜色配置
                            tintColor="#2a7bf6"
                            colors={['#2a7bf6']}
                            // 刷新提示文字（Android）
                            title="下拉刷新"
                            titleColor="#2a7bf6"
                        />
                    }
                >
                    {linkmans && linkmans.map((linkman) => renderLinkman(linkman))}
                    {/* 当有菜单打开时，在列表底部添加一个透明的点击区域，用于关闭菜单（只会命中空白处，不覆盖条目） */}
                    {openSwipeId && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={closeAllSwipes}
                            style={styles.closeArea}
                        />
                    )}
                </ScrollView>
            </Animated.View>
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    searchWrapper: {
        // 搜索栏包装器，用于点击关闭菜单
    },
    messageList: {},
    // 关闭菜单的点击区域（当菜单打开时显示在列表底部）
    closeArea: {
        height: 1000, // 足够大的高度，覆盖整个可见空白区域
        backgroundColor: 'transparent',
    },
    searchContainer: {
        marginTop: isiOS ? 0 : 5,
        backgroundColor: 'transparent',
        height: 42,
        borderBottomWidth: 0,
        paddingLeft: 12, // 左右对称的内边距
        paddingRight: 12, // 左右对称的内边距
    },
    /**
     * 搜索框阴影容器：
     * - iOS: 使用 shadow*
     * - Android: 使用 elevation（必须配合不透明背景，否则易出现白色条纹/块）
     */
    searchShadow: {
        flex: 1,
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
    searchItem: {
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderRadius: BORDER_RADIUS.input, // 添加圆角（16px）
        overflow: 'hidden', // 确保圆角生效
        paddingLeft: 12, // 左边内边距（为图标留空间）
        paddingRight: 12, // 右边内边距
        flex: 1, // 占据可用空间，自动居中
        justifyContent: 'center', // 垂直居中
        alignItems: 'center', // 水平居中
        flexDirection: 'row', // 横向排列图标和输入框
    },
    searchIcon: {
        color: '#555',
        marginRight: 8, // 图标和输入框之间的间距
        width: 20, // 固定图标宽度
    },
    searchText: {
        fontSize: 14,
        flex: 1, // 占据剩余空间
        textAlign: 'center', // 文字居中
        paddingLeft: 0, // 去除左边距
        paddingRight: 20, // 右边距补偿图标宽度，使文字视觉居中
        backgroundColor: 'transparent', // 防止 NativeBase Input 默认白底露出来
    },
});
