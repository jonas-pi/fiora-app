import React, { useRef, useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    Text,
    Dimensions,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    Platform,
    ScrollView,
    Keyboard,
    Pressable,
} from 'react-native';
import { Button, ActionSheet } from 'native-base';
import { Actions } from 'react-native-router-flux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import action from '../../state/action';
import fetch from '../../utils/fetch';
import { isiOS } from '../../utils/platform';
import expressions from '../../utils/expressions';
import { Toast } from 'native-base';

import Expression from '../../components/Expression';
import { useIsLogin, useStore, useUser } from '../../hooks/useStore';
import { Message } from '../../types/redux';
import uploadFileWithProgress from '../../utils/uploadFileWithProgress';

const { width: ScreenWidth } = Dimensions.get('window');
const ExpressionSize = (ScreenWidth - 16) / 10;

type Props = {
    onHeightChange: () => void;
    onMenuStateChange?: (hasMenuOpen: boolean) => void; // 通知父组件菜单状态变化
    closeAllMenusRef?: React.MutableRefObject<(() => void) | undefined>; // 父组件通过 ref 获取关闭函数
};

export default function Input({ onHeightChange, onMenuStateChange, closeAllMenusRef }: Props) {
    const isLogin = useIsLogin();
    const user = useUser();
    const { focus } = useStore();

    const [message, setMessage] = useState('');
    const [showExpressionMenu, setShowExpressionMenu] = useState(false); // 显示表情二级菜单
    const [expressionType, setExpressionType] = useState<'default' | 'sticker' | 'search'>('default'); // 表情类型
    const [showMoreMenu, setShowMoreMenu] = useState(false); // 显示加号二级菜单
    const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
    const [isUploading, setIsUploading] = useState(false); // 添加上传状态锁
    const [isVoiceMode, setIsVoiceMode] = useState(false); // 语音模式（待实现）

    const $input = useRef<TextInput>();

    // 监听键盘显示/隐藏事件，自动调整消息位置
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                // 键盘显示时，延迟调用以确保布局完成
                setTimeout(() => {
                    onHeightChange();
                }, 100);
            },
        );
        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                // 键盘隐藏时，延迟调用以确保布局完成
                setTimeout(() => {
                    onHeightChange();
                }, 100);
            },
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, [onHeightChange]);

    function setInputText(text = '') {
        // iossetNativeProps无效, 解决办法参考:https://github.com/facebook/react-native/issues/18272
        if (isiOS) {
            $input.current!.setNativeProps({ text: text || ' ' });
        }
        setTimeout(() => {
            $input.current!.setNativeProps({ text: text || '' });
        });
    }

    function addSelfMessage(type: string, content: string) {
        const _id = focus + Date.now();
        const newMessage: Message = {
            _id,
            type,
            content,
            createTime: Date.now(),
            from: {
                _id: user._id,
                username: user.username,
                avatar: user.avatar,
                tag: user.tag,
            },
            to: '',
            loading: true,
        };

        // 图片和文件消息初始进度为 0
        if (type === 'image' || type === 'file') {
            newMessage.percent = 0;
        } else {
            newMessage.percent = 100;
        }
        action.addLinkmanMessage(focus, newMessage);

        return _id;
    }

    async function sendMessage(localId: string, type: string, content: string) {
        const [err, res] = await fetch('sendMessage', {
            to: focus,
            type,
            content,
        });
        if (!err) {
            res.loading = false;
            action.updateSelfMessage(focus, localId, res);
        }
    }

    function handleSubmit() {
        if (message === '') {
            return;
        }

        const id = addSelfMessage('text', message);
        sendMessage(id, 'text', message);

        setMessage('');
        setInputText();
    }

    function handleSelectionChange(event: any) {
        const { start, end } = event.nativeEvent.selection;
        setCursorPosition({
            start,
            end,
        });
    }

    function handleFocus() {
        // 输入框聚焦时关闭菜单
        const wasMenuOpen = showExpressionMenu || showMoreMenu;
        setShowExpressionMenu(false);
        setShowMoreMenu(false);
        // 如果菜单之前是打开的，通知父组件调整消息位置
        if (wasMenuOpen) {
            setTimeout(() => {
                onHeightChange(); // 通知父组件调整消息位置
            }, 100);
        }
    }

    // 处理表情按钮点击，显示二级菜单（tab 样式）或关闭菜单并聚焦输入框
    function handleExpressionButton() {
        if (showExpressionMenu) {
            // 如果菜单已打开，关闭菜单并聚焦输入框
            setShowExpressionMenu(false);
            // 延迟调用，等待菜单关闭动画完成
            setTimeout(() => {
                onHeightChange(); // 通知父组件调整消息位置
                $input.current?.focus();
            }, 100);
        } else {
            // 如果菜单未打开，打开菜单
            $input.current!.blur();
            // 关闭其他菜单（加号菜单）
            if (showMoreMenu) {
                setShowMoreMenu(false);
            }
            setShowExpressionMenu(true);
            setExpressionType('default'); // 默认选中第一个 tab
            // 延迟调用，等待菜单打开动画完成
            setTimeout(() => {
                onHeightChange(); // 通知父组件调整消息位置
            }, 100);
        }
    }

    // 切换表情类型 tab
    function switchExpressionType(type: 'default' | 'sticker' | 'search') {
        setExpressionType(type);
    }

    async function handleClickImage() {
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (currentPermission.accessPrivileges === 'none') {
            if (currentPermission.canAskAgain) {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permission.accessPrivileges === 'none') {
                    return;
                }
            } else {
                return;
            }
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.8, // 压缩质量，减少文件大小
        });

        if (!result.cancelled && result.base64) {
            // 防止并发上传
            if (isUploading) {
                Toast.show({ text: '正在上传图片，请稍候...', type: 'warning' });
                return;
            }
            
            setIsUploading(true);
            const id = addSelfMessage(
                'image',
                `${result.uri}?width=${result.width}&height=${result.height}`,
            );
            const key = `ImageMessage/${user._id}_${Date.now()}`;
            try {
                const imageUrl = await uploadFileWithProgress(
                    result.base64 as string,
                    key,
                    (progress) => {
                        // 更新上传进度
                        action.updateSelfMessage(focus, id, {
                            percent: progress,
                        });
                    },
                );
                // 上传成功后发送消息
                const [err, res] = await fetch('sendMessage', {
                    to: focus,
                    type: 'image',
                    content: `${imageUrl}?width=${result.width}&height=${result.height}`,
                });
                if (!err) {
                    res.loading = false;
                    res.percent = 100;
                    action.updateSelfMessage(focus, id, res);
                }
            } catch (error: any) {
                // 上传失败，删除本地消息
                action.deleteLinkmanMessage(focus, id);
                Toast.show({ text: '上传图片失败', type: 'danger' });
            } finally {
                setIsUploading(false);
            }
        }
    }

    async function handleClickCamera() {
        const currentPermission = await ImagePicker.getCameraPermissionsAsync();
        if (currentPermission.status === 'undetermined') {
            if (currentPermission.canAskAgain) {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (permission.status === 'undetermined') {
                    return;
                }
            } else {
                return;
            }
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 0.8, // 压缩质量，减少文件大小
        });

        if (!result.cancelled && result.base64) {
            // 防止并发上传
            if (isUploading) {
                Toast.show({ text: '正在上传图片，请稍候...', type: 'warning' });
                return;
            }
            
            setIsUploading(true);
            const id = addSelfMessage(
                'image',
                `${result.uri}?width=${result.width}&height=${result.height}`,
            );
            const key = `ImageMessage/${user._id}_${Date.now()}`;
            try {
                const imageUrl = await uploadFileWithProgress(
                    result.base64 as string,
                    key,
                    (progress) => {
                        // 更新上传进度
                        action.updateSelfMessage(focus, id, {
                            percent: progress,
                        });
                    },
                );
                // 上传成功后发送消息
                const [err, res] = await fetch('sendMessage', {
                    to: focus,
                    type: 'image',
                    content: `${imageUrl}?width=${result.width}&height=${result.height}`,
                });
                if (!err) {
                    res.loading = false;
                    res.percent = 100;
                    action.updateSelfMessage(focus, id, res);
                }
            } catch (error: any) {
                // 上传失败，删除本地消息
                action.deleteLinkmanMessage(focus, id);
                Toast.show({ text: '上传图片失败', type: 'danger' });
            } finally {
                setIsUploading(false);
            }
        }
    }

    function handleChangeText(value: string) {
        setMessage(value);
    }

    function insertExpression(e: string) {
        const expression = `#(${e})`;
        const newValue = `${message.substring(
            0,
            cursorPosition.start,
        )}${expression}${message.substring(cursorPosition.end, message.length)}`;
        setMessage(newValue);
        setCursorPosition({
            start: cursorPosition.start + expression.length,
            end: cursorPosition.start + expression.length,
        });
        setInputText(newValue);
    }

    // 处理语音按钮点击（待实现）
    function handleVoiceButton() {
        // TODO: 实现语音功能
        Toast.show({ text: '语音功能待实现', type: 'warning' });
    }

    // 处理二级菜单按钮点击（方块布局）
    function handleMoreMenu() {
        $input.current!.blur();
        // 关闭其他菜单（表情菜单）
        if (showExpressionMenu) {
            setShowExpressionMenu(false);
        }
        setShowMoreMenu(true);
        // 延迟调用，等待菜单打开动画完成
        setTimeout(() => {
            onHeightChange(); // 通知父组件调整消息位置
        }, 100);
    }

    // 关闭加号菜单
    function closeMoreMenu() {
        setShowMoreMenu(false);
        // 延迟调用，等待菜单关闭动画完成
        setTimeout(() => {
            onHeightChange(); // 通知父组件调整消息位置
        }, 100);
    }

    // 关闭所有二级菜单
    function closeAllMenus() {
        const wasAnyMenuOpen = showExpressionMenu || showMoreMenu;
        setShowExpressionMenu(false);
        setShowMoreMenu(false);
        // 如果有菜单打开，通知父组件调整消息位置
        if (wasAnyMenuOpen) {
            setTimeout(() => {
                onHeightChange();
            }, 100);
        }
        // 通知父组件菜单状态变化
        if (onMenuStateChange) {
            onMenuStateChange(false);
        }
    }

    // 监听菜单状态变化，通知父组件
    useEffect(() => {
        if (onMenuStateChange) {
            onMenuStateChange(showExpressionMenu || showMoreMenu);
        }
    }, [showExpressionMenu, showMoreMenu, onMenuStateChange]);

    // 将关闭函数暴露给父组件
    useEffect(() => {
        if (closeAllMenusRef) {
            closeAllMenusRef.current = closeAllMenus;
        }
        return () => {
            if (closeAllMenusRef) {
                closeAllMenusRef.current = undefined;
            }
        };
    }, [closeAllMenusRef]);

    return (
        <SafeAreaView 
            style={styles.safeView}
            pointerEvents="box-none"
        >
            <View 
                style={styles.container}
                pointerEvents="box-none"
            >
                {isLogin ? (
                    <View 
                        style={styles.inputContainer}
                        pointerEvents="box-none"
                    >
                        {/* 左侧：语音按钮 */}
                        <TouchableOpacity
                            style={styles.voiceButton}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleVoiceButton();
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="ios-mic" size={24} color="#999" />
                        </TouchableOpacity>
                        
                        {/* 中间：输入框 */}
                        <View 
                            style={{ flex: 1 }}
                            onStartShouldSetResponder={() => true}
                            onResponderTerminationRequest={() => false}
                        >
                            <TextInput
                                // @ts-ignore
                                ref={$input}
                                style={styles.input}
                                placeholder="随便聊点啥吧, 不要无意义刷屏~~"
                                onChangeText={handleChangeText}
                                onSubmitEditing={handleSubmit}
                                autoCapitalize="none"
                                blurOnSubmit={false}
                                maxLength={2048}
                                returnKeyType="send"
                                enablesReturnKeyAutomatically
                                underlineColorAndroid="transparent"
                                onSelectionChange={handleSelectionChange}
                                onFocus={handleFocus}
                                value={message}
                            />
                        </View>
                        
                        {/* 右侧：表情按钮和二级菜单按钮 */}
                        <View style={styles.rightButtons}>
                            <TouchableOpacity
                                style={styles.rightButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleExpressionButton();
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons 
                                    name={showExpressionMenu ? "ios-close-circle" : "ios-happy"} 
                                    size={24} 
                                    color="#999" 
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.rightButton}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleMoreMenu();
                                }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="ios-add-circle-outline" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <Button block style={styles.button} onPress={Actions.login}>
                        <Text style={styles.buttonText}>登录 / 注册, 参与聊天</Text>
                    </Button>
                )}

                {/* 表情二级菜单 - Tab 样式，与输入框同一层级，显示在输入框下方 */}
                {isLogin && showExpressionMenu && (
                    <Pressable
                        style={styles.expressionMenuContent}
                        onPress={(e) => {
                            // 阻止事件冒泡到覆盖层
                            e.stopPropagation();
                        }}
                        pointerEvents="box-none"
                    >
                        {/* Tab 选项栏 */}
                        <View style={styles.expressionTabBar}>
                            <TouchableOpacity
                                style={[
                                    styles.expressionTab,
                                    expressionType === 'default' && styles.expressionTabActive,
                                ]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    switchExpressionType('default');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.expressionTabText,
                                        expressionType === 'default' && styles.expressionTabTextActive,
                                    ]}
                                >
                                    默认表情
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.expressionTab,
                                    expressionType === 'sticker' && styles.expressionTabActive,
                                ]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    switchExpressionType('sticker');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.expressionTabText,
                                        expressionType === 'sticker' && styles.expressionTabTextActive,
                                    ]}
                                >
                                    表情包
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.expressionTab,
                                    expressionType === 'search' && styles.expressionTabActive,
                                ]}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    switchExpressionType('search');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.expressionTabText,
                                        expressionType === 'search' && styles.expressionTabTextActive,
                                    ]}
                                >
                                    搜表情
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 内容窗口 - 统一高度 */}
                        <View style={styles.expressionContentWindow}>
                            {expressionType === 'default' ? (
                                // 默认表情 - 显示所有表情，支持滚动
                                <ScrollView
                                    style={styles.expressionScrollView}
                                    contentContainerStyle={styles.expressionPreviewContainer}
                                    showsVerticalScrollIndicator={true}
                                >
                                    {expressions.default.map((e, i) => (
                                        <TouchableOpacity
                                            key={e}
                                            onPress={(event) => {
                                                event.stopPropagation();
                                                insertExpression(e);
                                                setShowExpressionMenu(false);
                                                // 关闭菜单后通知父组件调整消息位置
                                                setTimeout(() => {
                                                    onHeightChange();
                                                }, 100);
                                            }}
                                            style={styles.expressionPreviewItem}
                                        >
                                            <Expression index={i} size={30} />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : expressionType === 'sticker' ? (
                                // 表情包（待实现）
                                <View style={styles.placeholderContainer}>
                                    <Text style={styles.placeholderText}>表情包功能待实现</Text>
                                </View>
                            ) : (
                                // 搜表情（待实现）
                                <View style={styles.placeholderContainer}>
                                    <Text style={styles.placeholderText}>搜表情功能待实现</Text>
                                </View>
                            )}
                        </View>
                    </Pressable>
                )}

                {/* 加号二级菜单 - 方块布局，与输入框同一层级 */}
                {isLogin && showMoreMenu && (
                    <Pressable
                        style={styles.moreMenuContent}
                        onPress={(e) => {
                            // 阻止事件冒泡到覆盖层
                            e.stopPropagation();
                        }}
                        pointerEvents="box-none"
                    >
                        {/* 方块布局的功能按钮 */}
                        <View style={styles.moreMenuGrid}>
                            <TouchableOpacity
                                style={styles.moreMenuItem}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    closeMoreMenu();
                                    handleClickImage();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.moreMenuItemIcon}>
                                    <Ionicons name="ios-image" size={32} color="#2a7bf6" />
                                </View>
                                <Text style={styles.moreMenuItemText}>相册</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.moreMenuItem}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    closeMoreMenu();
                                    handleClickCamera();
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={styles.moreMenuItemIcon}>
                                    <Ionicons name="ios-camera" size={32} color="#2a7bf6" />
                                </View>
                                <Text style={styles.moreMenuItemText}>拍照</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                )}

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeView: {
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    container: {
        paddingTop: 4,
        position: 'relative', // 为绝对定位的子元素提供定位上下文
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        paddingVertical: 8,
        zIndex: 1001, // 确保输入框在覆盖层和菜单上方
        elevation: 1001, // Android 阴影层级
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // 确保输入框背景可见
    },
    voiceButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    input: {
        flex: 1,
        height: 40,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        borderRadius: 20, // 更现代的圆角，类似聊天气泡
    },
    rightButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    rightButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    sendButton: {
        width: 50,
        height: 36,
        marginLeft: 8,
        paddingLeft: 10,
    },
    button: {
        height: 40,
        marginTop: 4,
        marginLeft: 10,
        marginRight: 10,
        marginBottom: 8,
        borderRadius: 12, // 添加圆角
        overflow: 'hidden', // 确保圆角生效
    },
    buttonText: {
        color: 'white',
    },
    iconContainer: {
        height: 40,
    },
    icon: {
        transform: [
            {
                // @ts-ignore
                translate: [0, -3],
            },
        ],
    },


    cancelButton: {
        borderTopWidth: 1,
        borderTopColor: '#e6e6e6',
    },
    cancelButtonText: {
        color: '#666',
    },

    placeholderContainer: {
        flex: 1,
        height: '100%', // 确保占满整个内容窗口高度
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        fontSize: 16,
        color: '#999',
    },
    // 表情二级菜单样式 - 与输入框同一层级
    expressionMenuContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 12,
        paddingBottom: 12,
        maxHeight: 400,
        zIndex: 999, // 确保菜单在覆盖层上方
        elevation: 999, // Android 阴影层级
        // 阴影效果
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    expressionTabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
        paddingHorizontal: 16,
    },
    expressionTab: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginRight: 8,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    expressionTabActive: {
        borderBottomColor: '#2a7bf6',
    },
    expressionTabText: {
        fontSize: 14,
        color: '#666',
    },
    expressionTabTextActive: {
        color: '#2a7bf6',
        fontWeight: '600',
    },
    expressionContentWindow: {
        height: 200, // 固定高度，与其他tab保持一致
        padding: 12,
        paddingTop: 8,
    },
    expressionScrollView: {
        flex: 1,
    },
    expressionPreviewContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    expressionPreviewItem: {
        width: (ScreenWidth - 48) / 8, // 8列布局
        height: (ScreenWidth - 48) / 8,
        alignItems: 'center',
        justifyContent: 'center',
        margin: 4,
    },
    expressionPreviewMore: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expressionPreviewMoreText: {
        fontSize: 12,
        color: '#999',
    },
    // 加号二级菜单样式 - 与输入框同一层级
    moreMenuContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        zIndex: 999, // 确保菜单在覆盖层上方
        elevation: 999, // Android 阴影层级
        // 阴影效果
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    moreMenuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    moreMenuItem: {
        width: (ScreenWidth - 80) / 4, // 4列布局
        alignItems: 'center',
        marginBottom: 20,
    },
    moreMenuItemIcon: {
        width: 60,
        height: 60,
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    moreMenuItemText: {
        fontSize: 12,
        color: '#333',
    },
});
