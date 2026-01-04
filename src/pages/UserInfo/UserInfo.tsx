import React, { useState } from 'react';
import { Button, Text, View } from 'native-base';
import { StyleSheet, Modal, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Actions } from 'react-native-router-flux';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { useFocusLinkman, useIsAdmin, useLinkmans, useSelfId } from '../../hooks/useStore';
import { Linkman } from '../../types/redux';
import action from '../../state/action';
import {
    addFriend,
    deleteFriend,
    getLinkmanHistoryMessages,
    sealUser,
    sealUserOnlineIp,
} from '../../service';
import getFriendId from '../../utils/getFriendId';
import Toast from '../../components/Toast';
import { buttonStyles, BORDER_RADIUS } from '../../utils/styles';

type Props = {
    user: {
        _id: string;
        avatar: string;
        tag: string;
        username: string;
    };
};

function UserInfo({ user }: Props) {
    const { _id, avatar, username } = user;
    const linkmans = useLinkmans();
    const friend = linkmans.find((linkman) => linkman._id.includes(_id)) as Linkman;
    const isFriend = friend && friend.type === 'friend';
    const isAdmin = useIsAdmin();
    const currentLinkman = useFocusLinkman() as Linkman;
    const self = useSelfId();
    const [showRemarkDialog, setShowRemarkDialog] = useState(false);
    const [remarkInput, setRemarkInput] = useState('');
    const [isRemarkInputFocused, setIsRemarkInputFocused] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    function handleSendMessage() {
        action.setFocus(friend._id);
        if (currentLinkman._id === friend._id) {
            Actions.pop();
        } else {
            Actions.popTo('_chatlist');
            Actions.push('chat', { title: friend.name });
        }
    }

    // 处理删除好友
    function handleDeleteFriend() {
        setShowDeleteDialog(true);
    }

    // 确认删除好友
    async function handleConfirmDelete() {
        const isSuccess = await deleteFriend(_id);
        if (isSuccess) {
            action.removeLinkman(friend._id);
            if (currentLinkman._id === friend._id) {
                Actions.popTo('_chatlist');
            } else {
                Actions.pop();
            }
        }
        setShowDeleteDialog(false);
    }

    // 处理设置备注
    function handleSetRemark() {
        const currentRemark = (friend as any)?.remark || '';
        setRemarkInput(currentRemark);
        setShowRemarkDialog(true);
    }

    // 确认设置备注
    function handleConfirmRemark() {
        if (friend) {
            action.updateFriendProperty(friend._id, 'remark', remarkInput.trim());
            Toast.success(remarkInput.trim() ? '备注设置成功' : '备注已清除');
        }
        setShowRemarkDialog(false);
        setRemarkInput('');
    }

    async function handleAddFriend() {
        const newLinkman = await addFriend(_id);
        const friendId = getFriendId(_id, self);
        if (newLinkman) {
            if (friend) {
                action.updateFriendProperty(friend._id, 'type', 'friend');
                const messages = await getLinkmanHistoryMessages(
                    friend._id,
                    friend.messages.length,
                );
                action.addLinkmanHistoryMessages(friend._id, messages);
            } else {
                action.addLinkman({
                    ...newLinkman,
                    _id: friendId,
                    name: username,
                    type: 'friend',
                    unread: 0,
                    messages: [],
                    from: self,
                    to: {
                        _id,
                        avatar,
                        username,
                    },
                });
                const messages = await getLinkmanHistoryMessages(friendId, 0);
                action.addLinkmanHistoryMessages(friendId, messages);
            }
            action.setFocus(friendId);

            if (currentLinkman._id === friend?._id) {
                Actions.pop();
            } else {
                Actions.popTo('_chatlist');
                Actions.push('chat', { title: newLinkman.username });
            }
        }
    }

    async function handleSealUser() {
        const isSuccess = await sealUser(username);
        if (isSuccess) {
            Toast.success('封禁用户成功');
        }
    }

    async function handleSealIp() {
        const isSuccess = await sealUserOnlineIp(_id);
        if (isSuccess) {
            Toast.success('封禁用户当前ip成功');
        }
    }

    // 获取显示名称（优先显示备注，其次显示用户名）
    const displayName = (friend as any)?.remark || username;

    return (
        <PageContainer>
            <View style={styles.container}>
                <View style={styles.userContainer}>
                    <Avatar src={avatar} size={88} />
                    <Text style={styles.nick}>{displayName}</Text>
                    {displayName !== username && (
                        <Text style={styles.originalName}>{username}</Text>
                    )}
                </View>
                <View style={styles.buttonContainer}>
                    {isFriend ? (
                        <>
                            <Button primary block style={[styles.button, buttonStyles]} onPress={handleSendMessage}>
                                <Text>发送消息</Text>
                            </Button>
                            <Button
                                primary
                                block
                                style={[styles.button, buttonStyles]}
                                onPress={handleSetRemark}
                            >
                                <Text>设置备注</Text>
                            </Button>
                            <Button
                                primary
                                block
                                danger
                                style={[styles.button, buttonStyles]}
                                onPress={handleDeleteFriend}
                            >
                                <Text>删除好友</Text>
                            </Button>
                        </>
                    ) : (
                        <Button primary block style={[styles.button, buttonStyles]} onPress={handleAddFriend}>
                            <Text>加为好友</Text>
                        </Button>
                    )}
                    {isAdmin && (
                        <>
                            <Button
                                primary
                                block
                                danger
                                style={[styles.button, buttonStyles]}
                                onPress={handleSealUser}
                            >
                                <Text>封禁用户</Text>
                            </Button>
                            <Button
                                primary
                                block
                                danger
                                style={[styles.button, buttonStyles]}
                                onPress={handleSealIp}
                            >
                                <Text>封禁 ip</Text>
                            </Button>
                        </>
                    )}
                </View>
            </View>

            {/* 设置备注对话框 */}
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
                        <Text style={styles.dialogTitle}>设置备注</Text>
                        <Text style={styles.dialogDescription}>请输入备注名称</Text>
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
                        <View style={styles.buttonContainerModal}>
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

            {/* 删除确认对话框 */}
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
                        <Text style={styles.dialogTitle}>确认删除</Text>
                        <Text style={styles.dialogDescription}>确定要删除好友 {displayName} 吗？</Text>
                        <View style={styles.buttonContainerModal}>
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
        </PageContainer>
    );
}

export default UserInfo;

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        paddingLeft: 16,
        paddingRight: 16,
    },
    userContainer: {
        alignItems: 'center',
    },
    nick: {
        color: '#333',
        marginTop: 6,
        fontSize: 20,
        fontWeight: '600',
    },
    originalName: {
        color: '#888',
        marginTop: 4,
        fontSize: 14,
    },
    buttonContainer: {
        marginTop: 20,
    },
    // 对话框按钮容器样式
    buttonContainerModal: {
        flexDirection: 'row', // 横向排列按钮
        justifyContent: 'space-between', // 按钮之间分布
        alignItems: 'center', // 垂直居中
        marginTop: 5, // 上边距
    },
    button: {
        marginBottom: 12,
    },
    // Modal 遮罩层样式
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Modal 内容容器样式（统一设计语言）
    modalContent: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: BORDER_RADIUS.card,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        padding: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    // 对话框标题样式
    dialogTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000',
        marginBottom: 8,
    },
    // 对话框描述样式
    dialogDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    // 对话框输入框样式
    dialogInput: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.15)',
        borderRadius: BORDER_RADIUS.input,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000',
        marginBottom: 20,
    },
    // 取消按钮样式（非危险操作，使用灰色）
    cancelButton: {
        flex: 1,
        backgroundColor: '#999999', // 灰色背景（非危险操作）
        borderRadius: BORDER_RADIUS.button,
        overflow: 'hidden',
        paddingVertical: 10, // 减小上下内边距
        paddingHorizontal: 16, // 减小左右内边距
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40, // 减小最小高度
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
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // 确定按钮样式
    confirmButton: {
        flex: 1,
        backgroundColor: '#4A90E2',
        borderRadius: BORDER_RADIUS.button,
        overflow: 'hidden',
        paddingVertical: 10, // 减小上下内边距
        paddingHorizontal: 16, // 减小左右内边距
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40, // 减小最小高度
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
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // 删除确认按钮样式（红色背景）
    deleteConfirmButton: {
        flex: 1,
        backgroundColor: '#E53E3E',
        borderRadius: BORDER_RADIUS.button,
        overflow: 'hidden',
        paddingVertical: 10, // 减小上下内边距
        paddingHorizontal: 16, // 减小左右内边距
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40, // 减小最小高度
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
