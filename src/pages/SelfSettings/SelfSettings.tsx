import { Button, Content, Form, Input, Item, Label, Text, View } from 'native-base';
import Toast from '../../components/Toast';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Actions } from 'react-native-router-flux';
import * as ImagePicker from 'expo-image-picker';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { useUser } from '../../hooks/useStore';
import action from '../../state/action';
import { changeAvatar, changeUsername } from '../../service';
import uploadFileWithProgress from '../../utils/uploadFileWithProgress';
import BackButton from '../../components/BackButton';
import fetch from '../../utils/fetch';
import { buttonStyles, smallButtonStyles } from '../../utils/styles';

function SelfSettings() {
    const user = useUser();
    const [username, setUsername] = useState(user.username || '');
    const [avatar, setAvatar] = useState(user.avatar || '');
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingAvatar, setIsResettingAvatar] = useState(false);

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

            if (avatarChanged || usernameChanged) {
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
                        <Item floatingLabel style={styles.formItem}>
                            <Label>昵称</Label>
                            <Input
                                value={username}
                                onChangeText={setUsername}
                                maxLength={20}
                                placeholder="请输入昵称"
                                style={styles.input}
                            />
                        </Item>
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
    },
    input: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        paddingHorizontal: 12,
        paddingVertical: 10,
        height: 48,
    },
    saveButton: {
        marginLeft: 12,
        marginRight: 12,
        marginBottom: 12,
    },
    resetButton: {
        marginTop: 15,
        alignSelf: 'center',
        backgroundColor: '#f0f0f0',
    },
    resetButtonText: {
        color: '#666',
        fontSize: 14,
    },
});

