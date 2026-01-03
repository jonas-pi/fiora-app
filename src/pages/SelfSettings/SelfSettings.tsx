import { Button, Content, Form, Input, Item, Label, Text, View } from 'native-base';
import Toast from '../../components/Toast';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Platform, Clipboard } from 'react-native';
import { Actions } from 'react-native-router-flux';
import * as ImagePicker from 'expo-image-picker';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { useUser } from '../../hooks/useStore';
import action from '../../state/action';
import { changeAvatar, changeUsername, changePassword } from '../../service';
import uploadFileWithProgress from '../../utils/uploadFileWithProgress';
import BackButton from '../../components/BackButton';
import fetch from '../../utils/fetch';
import { buttonStyles, smallButtonStyles, BORDER_RADIUS } from '../../utils/styles';

function SelfSettings() {
    const user = useUser();
    const [username, setUsername] = useState(user.username || '');
    const [avatar, setAvatar] = useState(user.avatar || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingAvatar, setIsResettingAvatar] = useState(false);
    // 输入框焦点状态，用于控制 placeholder 显示
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    async function handleSelectAvatar() {
        if (isUploadingAvatar) {
            return;
        }

        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (currentPermission.accessPrivileges === 'none') {
            if (currentPermission.canAskAgain) {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permission.accessPrivileges === 'none') {
                    Toast.warning('需要相册权限才能修改头像');
                    return;
                }
            } else {
                Toast.warning('需要相册权限才能修改头像');
                return;
            }
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.8,
            allowsEditing: true,
            aspect: [1, 1], // 正方形头像
        });

        if (!result.cancelled && result.base64) {
            setIsUploadingAvatar(true);
            try {
                const key = `Avatar/${user._id}_${Date.now()}`;
                const imageUrl = await uploadFileWithProgress(
                    result.base64 as string,
                    key,
                );
                setAvatar(imageUrl);
                Toast.success('头像上传成功');
            } catch (error: any) {
                Toast.danger(`上传头像失败: ${error.message}`);
            } finally {
                setIsUploadingAvatar(false);
            }
        }
    }

    /**
     * 重新获取默认头像
     * 发送空字符串给服务端，服务端会自动重置为默认头像（/avatar/0.jpg）
     */
    /**
     * 复制用户ID到剪贴板
     */
    /**
     * 复制用户ID到剪贴板
     */
    function handleCopyUserId() {
        if (user._id) {
            try {
                // 使用 React Native 的 Clipboard API 复制ID
                Clipboard.setString(user._id);
                Toast.success('✓ 已复制');
            } catch (error: any) {
                console.error('复制ID失败:', error);
                Toast.danger('复制失败');
            }
        }
    }

    async function handleResetAvatar() {
        if (isResettingAvatar || isUploadingAvatar) {
            return;
        }

        setIsResettingAvatar(true);
        try {
            // 发送空字符串，服务端会自动重置为默认头像
            const newAvatarUrl = await changeAvatar('');
            if (newAvatarUrl) {
                // 更新本地状态
                setAvatar(newAvatarUrl);
                action.setAvatar(newAvatarUrl);
                Toast.success('已重置为默认头像');
            } else {
                Toast.danger('重置头像失败，请重试');
            }
        } catch (error: any) {
            console.error('重置头像异常:', error);
            Toast.danger(`重置头像失败: ${error.message || '未知错误'}`);
        } finally {
            setIsResettingAvatar(false);
        }
    }

    async function handleSave() {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        try {
            let avatarChanged = false;
            let usernameChanged = false;
            let passwordChanged = false;

            // 保存头像
            if (avatar !== user.avatar) {
                const newAvatarUrl = await changeAvatar(avatar);
                if (newAvatarUrl) {
                    // 使用服务端返回的新头像URL（可能和上传的URL不同）
                    setAvatar(newAvatarUrl);
                    action.setAvatar(newAvatarUrl);
                    avatarChanged = true;
                } else {
                    Toast.danger('修改头像失败');
                    setIsSaving(false);
                    return;
                }
            }

            // 保存用户名
            if (username !== user.username && username.trim()) {
                const success = await changeUsername(username.trim());
                if (success) {
                    action.updateUserProperty('username', username.trim());
                    usernameChanged = true;
                } else {
                    Toast.danger('修改昵称失败');
                    setIsSaving(false);
                    return;
                }
            }

            // 保存密码
            if (oldPassword || newPassword || confirmPassword) {
                if (!oldPassword) {
                    Toast.danger('请输入旧密码');
                    setIsSaving(false);
                    return;
                }
                if (!newPassword) {
                    Toast.danger('请输入新密码');
                    setIsSaving(false);
                    return;
                }
                if (newPassword !== confirmPassword) {
                    Toast.danger('两次输入的新密码不一致');
                    setIsSaving(false);
                    return;
                }
                if (newPassword.length < 6) {
                    Toast.danger('新密码长度至少为6位');
                    setIsSaving(false);
                    return;
                }
                const success = await changePassword(oldPassword, newPassword);
                if (success) {
                    passwordChanged = true;
                    // 清空密码输入框
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                } else {
                    Toast.danger('修改密码失败，请检查旧密码是否正确');
                    setIsSaving(false);
                    return;
                }
            }

            if (avatarChanged || usernameChanged || passwordChanged) {
                Toast.success('保存成功');
                Actions.pop();
            } else {
                Toast.warning('没有修改');
            }
        } catch (error: any) {
            Toast.danger(`保存失败: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <PageContainer>
            <Content>
                <View style={styles.container}>
                    <View style={styles.avatarContainer}>
                        <TouchableOpacity onPress={handleSelectAvatar} disabled={isUploadingAvatar}>
                            <Avatar src={avatar} size={100} />
                            {isUploadingAvatar && (
                                <View style={styles.uploadingOverlay}>
                                    <Text style={styles.uploadingText}>上传中...</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.avatarHint}>点击头像修改</Text>
                        <Button
                            small
                            style={[styles.resetButton, smallButtonStyles]}
                            onPress={handleResetAvatar}
                            disabled={isResettingAvatar || isUploadingAvatar}
                        >
                            <Text style={styles.resetButtonText}>
                                {isResettingAvatar ? '重置中...' : '重新获取默认头像'}
                            </Text>
                        </Button>
                    </View>

                    <Form style={styles.form}>
                        {/* 显示用户ID（只读，点击可复制） */}
                        <View style={styles.formItemContainer}>
                            <View style={styles.labelInputContainer}>
                                <Label style={styles.label}>用户ID</Label>
                                <TouchableOpacity
                                    onPress={handleCopyUserId}
                                    activeOpacity={0.7}
                                    style={styles.inputTouchable}
                                >
                                    <Input
                                        value={user._id || ''}
                                        editable={false}
                                        style={[styles.input, styles.readonlyInput]}
                                        pointerEvents="none"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View style={styles.formItemContainer}>
                            <View style={styles.labelInputContainer}>
                                <Label style={styles.label}>昵称</Label>
                                <Input
                                    value={username}
                                    onChangeText={setUsername}
                                    maxLength={20}
                                    placeholder={focusedInput === 'username' ? '' : '请输入昵称'}
                                    style={styles.input}
                                    onFocus={() => setFocusedInput('username')}
                                    onBlur={() => setFocusedInput(null)}
                                />
                            </View>
                        </View>
                        {/* 修改密码 */}
                        <View style={styles.formItemContainer}>
                            <View style={styles.labelInputContainer}>
                                <Label style={styles.label}>旧密码</Label>
                                <Input
                                    value={oldPassword}
                                    onChangeText={setOldPassword}
                                    secureTextEntry
                                    placeholder={focusedInput === 'oldPassword' ? '' : (oldPassword ? '' : '请输入旧密码')}
                                    style={styles.input}
                                    onFocus={() => setFocusedInput('oldPassword')}
                                    onBlur={() => {
                                        setFocusedInput(null);
                                    }}
                                />
                            </View>
                        </View>
                        <View style={styles.formItemContainer}>
                            <View style={styles.labelInputContainer}>
                                <Label style={styles.label}>新密码</Label>
                                <Input
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry
                                    placeholder={focusedInput === 'newPassword' ? '' : (newPassword ? '' : '请输入新密码（至少6位）')}
                                    style={styles.input}
                                    onFocus={() => setFocusedInput('newPassword')}
                                    onBlur={() => {
                                        setFocusedInput(null);
                                    }}
                                />
                            </View>
                        </View>
                        <View style={styles.formItemContainer}>
                            <View style={styles.labelInputContainer}>
                                <Label style={styles.label}>确认密码</Label>
                                <Input
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    placeholder={focusedInput === 'confirmPassword' ? '' : (confirmPassword ? '' : '请再次输入新密码')}
                                    style={styles.input}
                                    onFocus={() => setFocusedInput('confirmPassword')}
                                    onBlur={() => {
                                        setFocusedInput(null);
                                    }}
                                />
                            </View>
                        </View>
                    </Form>
                </View>
            </Content>
            <Button
                primary
                block
                style={[styles.saveButton, buttonStyles]}
                onPress={handleSave}
                disabled={isSaving || isUploadingAvatar}
            >
                <Text>保存</Text>
            </Button>
        </PageContainer>
    );
}

export default SelfSettings;

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        paddingBottom: 20,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    avatarHint: {
        marginTop: 10,
        color: '#666',
        fontSize: 14,
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadingText: {
        color: 'white',
        fontSize: 12,
    },
    form: {
        paddingLeft: 16,
        paddingRight: 16,
    },
    formItem: {
        marginBottom: 16,
        borderBottomWidth: 0, // 去掉默认的下边框
    },
    formItemContainer: {
        marginBottom: 16,
        paddingLeft: 16,
        paddingRight: 16,
    },
    labelInputContainer: {
        flexDirection: 'row', // 横向排列标签和输入框
        alignItems: 'center', // 垂直居中对齐
        justifyContent: 'center', // 水平居中
    },
    label: {
        width: 70, // 固定标签宽度，确保对齐（稍微增加以适应更大字号）
        fontSize: 16, // 从 14 增加到 16，增大字号
        color: '#666',
        marginRight: 12, // 标签和输入框之间的间距
        textAlign: 'center', // 文本居中
        fontWeight: '500', // 中等字重，更清晰
    },
    input: {
        backgroundColor: '#FFFFFF', // 白色背景，更显眼
        borderRadius: BORDER_RADIUS.input, // 使用统一的圆角（16px）
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.15)', // 淡灰色边框，增强可见性
        paddingHorizontal: 12,
        paddingVertical: 0, // 改为0，使用 height 和 textAlignVertical 控制垂直居中
        height: 42, // 从 48 减少到 42，与标签字号更协调
        color: '#000', // 文本颜色
        textAlign: 'center', // 文本水平居中
        textAlignVertical: 'center', // 文本垂直居中（Android）
        includeFontPadding: false, // Android 去除字体额外内边距
        fontSize: 15, // 稍微增大输入框文字字号，与标签更协调
    },
    // 只读输入框样式（用于显示用户ID）
    readonlyInput: {
        backgroundColor: '#F5F5F5', // 浅灰色背景，表示只读
        color: '#666', // 灰色文字，表示不可编辑
    },
    // 可点击的输入框容器样式
    inputTouchable: {
        flex: 1, // 占据剩余空间
    },
    saveButton: {
        marginLeft: 12,
        marginRight: 12,
        marginBottom: 12,
    },
    resetButton: {
        marginTop: 15,
        alignSelf: 'center',
        backgroundColor: '#4A90E2', // 蓝色背景，和保存按钮一样
    },
    resetButtonText: {
        color: '#FFFFFF', // 白色文本
        fontSize: 14,
        fontWeight: '600', // 加粗字重
    },
});

