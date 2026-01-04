import { View, Icon, Text } from 'native-base';
import React, { useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    Platform,
    Modal,
    TextInput,
    Animated,
    Easing,
    Dimensions,
    ScrollView,
    Vibration,
} from 'react-native';
import { Actions } from 'react-native-router-flux';
import { createGroup, search } from '../../service';
import action from '../../state/action';
import { BORDER_RADIUS } from '../../utils/styles';
import Avatar from '../../components/Avatar';

// 使用自定义 Modal 替代 Dialog，完全控制样式
function ChatListRightButton() {
    const [showQuickMenu, setShowQuickMenu] = useState(false); // “添加好友/创建群组”二级菜单
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false); // 复用原来的创建群组卡片
    const [showAddFriendDialog, setShowAddFriendDialog] = useState(false); // 添加好友卡片
    const [groupName, updateGroupName] = useState('');
    const [isGroupNameFocused, setIsGroupNameFocused] = useState(false);
    const [friendKeywords, setFriendKeywords] = useState('');
    const [isFriendKeywordsFocused, setIsFriendKeywordsFocused] = useState(false);
    const [friendSearchResult, setFriendSearchResult] = useState<{ users: any[]; groups: any[] }>({
        users: [],
        groups: [],
    });
    const rotate = useRef(new Animated.Value(0)).current;
    const lastPressOriginRef = useRef<{ originX?: number; originY?: number }>({});

    const windowWidth = useMemo(() => Dimensions.get('window').width, []);

    function handleCloseCreateGroupDialog() {
        updateGroupName('');
        setShowCreateGroupDialog(false);
    }

    async function handleCreateGroup() {
        const group = await createGroup(groupName);
        if (group) {
            action.addLinkman({
                ...group,
                type: 'group',
                unread: 1,
                messages: [],
            });
            action.setFocus(group._id);
            handleCloseCreateGroupDialog();
            Actions.push('chat', {
                title: group.name,
                originX: lastPressOriginRef.current.originX,
                originY: lastPressOriginRef.current.originY,
            });
        }
    }

    function handleCloseAddFriendDialog() {
        setFriendKeywords('');
        setFriendSearchResult({ users: [], groups: [] });
        setShowAddFriendDialog(false);
    }

    async function handleSearchFriend() {
        const keywords = friendKeywords.trim();
        if (!keywords) {
            setFriendSearchResult({ users: [], groups: [] });
            return;
        }
        const result = await search(keywords);
        setFriendSearchResult(result || { users: [], groups: [] });
    }

    function playRotateFeedback() {
        rotate.stopAnimation();
        rotate.setValue(0);
        Animated.sequence([
            Animated.timing(rotate, {
                toValue: 1,
                duration: 160,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(rotate, {
                toValue: 0,
                duration: 140,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }

    return (
        <>
            <TouchableOpacity
                onPress={(e) => {
                    lastPressOriginRef.current = {
                        originX: e?.nativeEvent?.pageX,
                        originY: e?.nativeEvent?.pageY,
                    };
                    playRotateFeedback();
                    // 轻震动反馈：与筛选条保持一致
                    Vibration.vibrate(8);
                    setShowQuickMenu(true);
                }}
            >
                <View style={styles.container}>
                    <Animated.View
                        style={{
                            transform: [
                                {
                                    rotate: rotate.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0deg', '90deg'],
                                    }),
                                },
                            ],
                        }}
                    >
                        <Icon name="add-outline" style={styles.icon} />
                    </Animated.View>
                </View>
            </TouchableOpacity>

            {/* 1) 右上角“就地弹出”的二级菜单 */}
            <Modal
                visible={showQuickMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQuickMenu(false)}
            >
                <TouchableOpacity
                    style={styles.quickMenuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowQuickMenu(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={(evt) => evt.stopPropagation()}
                        style={[
                            styles.quickMenuPanel,
                            (() => {
                                const originX = lastPressOriginRef.current.originX ?? windowWidth - 20;
                                const originY = lastPressOriginRef.current.originY ?? 60;
                                const panelWidth = 160;
                                const left = Math.max(12, Math.min(windowWidth - panelWidth - 12, originX - panelWidth + 10));
                                const top = originY + 10;
                                return { left, top, width: panelWidth };
                            })(),
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.quickMenuItem}
                            activeOpacity={0.75}
                            onPress={() => {
                                setShowQuickMenu(false);
                                setShowAddFriendDialog(true);
                            }}
                        >
                            <Text style={styles.quickMenuText}>添加好友</Text>
                        </TouchableOpacity>
                        <View style={styles.quickMenuDivider} />
                        <TouchableOpacity
                            style={styles.quickMenuItem}
                            activeOpacity={0.75}
                            onPress={() => {
                                setShowQuickMenu(false);
                                setShowCreateGroupDialog(true);
                            }}
                        >
                            <Text style={styles.quickMenuText}>创建群组</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 2) 添加好友卡片：支持昵称搜索用户 */}
            <Modal
                visible={showAddFriendDialog}
                transparent
                animationType="fade"
                onRequestClose={handleCloseAddFriendDialog}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={handleCloseAddFriendDialog}
                >
                    <TouchableOpacity
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={styles.dialogTitle}>添加好友</Text>
                        <Text style={styles.dialogDescription}>根据昵称搜索用户</Text>
                        <View style={styles.searchRow}>
                            <TextInput
                                value={friendKeywords}
                                onChangeText={setFriendKeywords}
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={[styles.dialogInput, styles.searchInput]}
                                placeholder={isFriendKeywordsFocused ? '' : '输入昵称关键字'}
                                placeholderTextColor="rgba(0, 0, 0, 0.3)"
                                onFocus={() => setIsFriendKeywordsFocused(true)}
                                onBlur={() => setIsFriendKeywordsFocused(false)}
                                returnKeyType="search"
                                onSubmitEditing={handleSearchFriend}
                            />
                            <TouchableOpacity
                                onPress={handleSearchFriend}
                                style={styles.searchButton}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.searchButtonText}>搜索</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.searchResultList}>
                            {(friendSearchResult.users || []).map((user) => (
                                <TouchableOpacity
                                    key={user._id}
                                    style={styles.userRow}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        // 复用现有用户详情页（里面已有“添加好友”逻辑）
                                        handleCloseAddFriendDialog();
                                        Actions.push('userInfo', {
                                            user,
                                            originX: lastPressOriginRef.current.originX,
                                            originY: lastPressOriginRef.current.originY,
                                        });
                                    }}
                                >
                                    <Avatar src={user.avatar} size={36} />
                                    <Text style={styles.userName}>{user.username}</Text>
                                </TouchableOpacity>
                            ))}
                            {(friendSearchResult.users || []).length === 0 && friendKeywords.trim() ? (
                                <Text style={styles.emptyHint}>未找到用户</Text>
                            ) : null}
                        </ScrollView>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                onPress={handleCloseAddFriendDialog}
                                style={styles.cancelButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>关闭</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 3) 创建群组卡片：沿用原来的实现（只是不再由“加号”直接打开） */}
            <Modal
                visible={showCreateGroupDialog}
                transparent
                animationType="fade"
                onRequestClose={handleCloseCreateGroupDialog}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={handleCloseCreateGroupDialog}
                >
                    <TouchableOpacity 
                        style={styles.modalContent}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* 标题 */}
                        <Text style={styles.dialogTitle}>创建群组</Text>
                        {/* 描述 */}
                        <Text style={styles.dialogDescription}>请输入群组名</Text>
                        {/* 输入框 */}
                        <TextInput
                            value={groupName}
                            onChangeText={updateGroupName}
                            autoCapitalize="none"
                            autoFocus
                            autoCorrect={false}
                            style={styles.dialogInput}
                            placeholder={isGroupNameFocused ? '' : '请输入群组名'}
                            placeholderTextColor="rgba(0, 0, 0, 0.3)"
                            onFocus={() => setIsGroupNameFocused(true)}
                            onBlur={() => setIsGroupNameFocused(false)}
                        />
                        {/* 按钮容器 */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity 
                                onPress={handleCloseCreateGroupDialog}
                                style={styles.cancelButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleCreateGroup}
                                style={styles.createButton}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.createButtonText}>创建</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

export default ChatListRightButton;

const styles = StyleSheet.create({
    container: {
        width: 44,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        color: 'white',
        fontSize: 32,
    },
    // 二级菜单遮罩层：覆盖全屏，但菜单面板“就地”显示
    quickMenuOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    quickMenuPanel: {
        position: 'absolute',
        backgroundColor: '#fff',
        borderRadius: BORDER_RADIUS.card,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.10)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.28,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    quickMenuItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    quickMenuText: {
        color: '#222',
        fontSize: 14,
        fontWeight: '500',
    },
    quickMenuDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    // Modal 遮罩层样式
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色遮罩
        justifyContent: 'center', // 垂直居中
        alignItems: 'center', // 水平居中
    },
    // Modal 内容容器样式（完全去除毛玻璃效果，使用纯白色背景）
    modalContent: {
        width: '85%', // 宽度为屏幕的 85%
        maxWidth: 400, // 最大宽度限制
        backgroundColor: '#FFFFFF', // 完全去除毛玻璃效果，使用纯白色背景（确保不透明）
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
        borderRadius: BORDER_RADIUS.input, // 使用统一的输入框圆角（12px）
        paddingHorizontal: 12, // 左右内边距
        paddingVertical: 10, // 上下内边距
        fontSize: 16,
        color: '#000', // 文本颜色
        marginBottom: 20, // 下边距
    },
    // “添加好友”搜索行
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        marginBottom: 0,
    },
    searchButton: {
        marginLeft: 10,
        backgroundColor: '#2a7bf6',
        borderRadius: BORDER_RADIUS.button,
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    searchResultList: {
        marginTop: 14,
        maxHeight: 260,
    },
    userRow: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    userName: {
        marginLeft: 10,
        color: '#222',
        fontSize: 15,
    },
    emptyHint: {
        marginTop: 10,
        color: '#888',
        fontSize: 13,
        textAlign: 'center',
    },
    // 按钮容器样式
    buttonContainer: {
        flexDirection: 'row', // 横向排列按钮
        justifyContent: 'space-between', // 按钮之间分布
        alignItems: 'center', // 垂直居中
        marginTop: 5, // 上边距
    },
    // 取消按钮样式（红色背景，去掉透明效果）
    cancelButton: {
        flex: 1, // 按钮占据可用空间
        backgroundColor: '#E53E3E', // 红色背景，完全去除透明效果
        borderRadius: BORDER_RADIUS.button, // 使用统一的按钮圆角
        overflow: 'hidden', // 确保圆角生效
        paddingVertical: 12, // 按钮内边距
        paddingHorizontal: 20, // 按钮内边距
        marginRight: 8, // 右侧外边距（与创建按钮之间的间距）
        alignItems: 'center', // 文本居中
        justifyContent: 'center', // 文本居中
        minHeight: 44, // 最小高度，确保按钮可点击区域足够大
        // 阴影效果
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
    // 取消按钮文本样式
    cancelButtonText: {
        color: '#FFFFFF', // 白色文本
        fontSize: 16,
        fontWeight: '600', // 加粗字重
    },
    // 创建按钮样式（带全局渐变效果）
    createButton: {
        flex: 1, // 按钮占据可用空间
        // 使用渐变背景色（从蓝色到紫色，通过阴影和光晕模拟渐变效果）
        backgroundColor: '#4A90E2', // 主色调（蓝色），作为渐变起始色
        borderRadius: BORDER_RADIUS.button, // 使用统一的按钮圆角
        overflow: 'hidden', // 确保圆角生效
        paddingVertical: 12, // 按钮内边距
        paddingHorizontal: 20, // 按钮内边距
        marginLeft: 8, // 左侧外边距（与取消按钮之间的间距）
        alignItems: 'center', // 文本居中
        justifyContent: 'center', // 文本居中
        minHeight: 44, // 最小高度，确保按钮可点击区域足够大
        // 使用多层阴影和光晕模拟全局渐变效果
        // 通过不同颜色的阴影层叠，创建从蓝色到紫色的渐变感
        ...Platform.select({
            ios: {
                shadowColor: '#6B46C1', // 使用紫色作为阴影色，与蓝色背景形成渐变
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5, // 增强阴影透明度，模拟渐变扩散效果
                shadowRadius: 12, // 增加光晕范围，创建全局渐变效果
            },
            android: {
                elevation: 8, // 增强 Android 阴影，提升渐变感
            },
        }),
    },
    // 创建按钮文本样式
    createButtonText: {
        color: '#FFFFFF', // 白色文本
        fontSize: 16,
        fontWeight: '600', // 加粗字重
    },
});
