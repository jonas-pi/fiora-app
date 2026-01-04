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
    Image,
} from 'react-native';
import { Button, ActionSheet } from 'native-base';
import { Actions } from 'react-native-router-flux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import action from '../../state/action';
import fetch from '../../utils/fetch';
import { isiOS } from '../../utils/platform';
import expressions from '../../utils/expressions';
import Toast from '../../components/Toast';
import { referer } from '../../utils/constant';
import { StickerItem, loadStickers, saveStickers, validateSticker } from '../../utils/stickers';

import Expression from '../../components/Expression';
import { useIsLogin, useStore, useUser } from '../../hooks/useStore';
import { Message } from '../../types/redux';
import uploadFileWithProgress from '../../utils/uploadFileWithProgress';

const { width: ScreenWidth } = Dimensions.get('window');
const ExpressionSize = (ScreenWidth - 16) / 10;
// 表情包（Sticker）比默认小表情更大一些：更接近“微信表情包”尺寸
const StickerSize = (ScreenWidth - 16) / 5;

type Props = {
    onHeightChange: () => void;
    onMenuStateChange?: (hasMenuOpen: boolean) => void; // 通知父组件菜单状态变化
    closeAllMenusRef?: React.MutableRefObject<(() => void) | undefined>; // 父组件通过 ref 获取关闭函数
    draftApiRef?: React.MutableRefObject<InputDraftApi | undefined>; // 父组件通过 ref 获取/设置输入框草稿
};

export type InputDraftApi = {
    /** 获取当前输入框草稿文本 */
    getText: () => string;
    /** 设置草稿文本（用于撤回后编辑/引用） */
    setText: (text: string) => void;
    /** 聚焦输入框 */
    focus: () => void;
};

export default function Input({ onHeightChange, onMenuStateChange, closeAllMenusRef, draftApiRef }: Props) {
    const isLogin = useIsLogin();
    const user = useUser();
    const { focus } = useStore();

    const [message, setMessage] = useState('');
    const [showExpressionMenu, setShowExpressionMenu] = useState(false); // 显示表情二级菜单
    const [expressionType, setExpressionType] = useState<'default' | 'sticker' | 'search'>('default'); // 表情类型
    const [showMoreMenu, setShowMoreMenu] = useState(false); // 显示加号二级菜单
    const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
    const [isUploading, setIsUploading] = useState(false); // 添加上传状态锁
    const [isUploadingSticker, setIsUploadingSticker] = useState(false); // 表情包上传锁（避免重复上传）
    const [isVoiceMode, setIsVoiceMode] = useState(false); // 语音模式（待实现）
    const [inputHeight, setInputHeight] = useState(40); // 输入框高度，默认40（一行）
    const [contentHeight, setContentHeight] = useState(0); // 内容实际高度，用于判断是否需要滚动
    const [stickers, setStickers] = useState<StickerItem[]>([]); // 我的表情包列表（本地持久化）

    const $input = useRef<TextInput>();
    // 保存最新 message，供 draftApiRef.getText 读取
    const $messageRef = useRef('');
    // 记录“单行时 contentSize.height 的基准值”，用于兼容不同平台对 contentSize 是否包含 padding 的差异
    const $singleLineContentHeight = useRef<number | null>(null);
    // 部分输入法在按一次“换行/回车”时会触发两次换行（产生 \n\n）
    // 这里用 onKeyPress 做标记，在 onChangeText 中做一次性“去重”
    const $pendingSingleEnter = useRef(false);
    // 防止“发送按钮”短时间内触发多次（某些机型/触摸事件可能触发重复点击）
    const $sendingLock = useRef(false);

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

    // 同步 message 到 ref，避免外部读取到旧值
    useEffect(() => {
        $messageRef.current = message;
    }, [message]);

    /**
     * 加载本地表情包列表（先做本机持久化）
     * - 不依赖服务端接口，避免后端未实现导致报错
     * - 表情包文件本身会通过 uploadFile 上传到服务端/对象存储
     */
    useEffect(() => {
        let isMounted = true;
        async function load() {
            if (!isLogin || !user?._id) {
                return;
            }
            const list = await loadStickers(user._id);
            if (isMounted) {
                setStickers(list);
            }
        }
        load();
        return () => {
            isMounted = false;
        };
    }, [isLogin, user?._id]);

    function setInputText(text = '') {
        // iossetNativeProps无效, 解决办法参考:https://github.com/facebook/react-native/issues/18272
        if (isiOS) {
            $input.current!.setNativeProps({ text: text || ' ' });
        }
        setTimeout(() => {
            $input.current!.setNativeProps({ text: text || '' });
        });
    }

    // 暴露给父组件：读取/写入草稿、聚焦
    useEffect(() => {
        if (!draftApiRef) {
            return;
        }

        draftApiRef.current = {
            getText: () => $messageRef.current,
            setText: (text: string) => {
                // 先更新 state，再同步到原生输入框（尤其是 iOS 的 setNativeProps workaround）
                setMessage(text);
                setInputText(text);
                // 光标移动到末尾
                const end = text.length;
                setCursorPosition({ start: end, end });
                // 高度变化后滚动到底部
                setTimeout(() => {
                    onHeightChange();
                }, 50);
            },
            focus: () => {
                setTimeout(() => {
                    $input.current?.focus();
                }, 0);
            },
        };

        return () => {
            if (draftApiRef) {
                draftApiRef.current = undefined;
            }
        };
    }, [draftApiRef, onHeightChange]);

    /**
     * 构建一条“本地发送中”的消息对象（用于先插入列表，再走发送/上传流程）
     * 之所以单独封装，是为了在上传进度回调里能拿到一个完整的 Message，满足 action.updateSelfMessage 的类型要求
     */
    function createSelfMessage(type: string, content: string): Message {
        const createTime = Date.now();
        const _id = focus + createTime;
        const newMessage: Message = {
            _id,
            type,
            content,
            createTime,
            from: {
                _id: user._id,
                username: user.username,
                avatar: user.avatar,
                tag: user.tag,
            },
            to: '',
            loading: true,
            // 图片和文件消息初始进度为 0，其它直接 100
            percent: type === 'image' || type === 'file' ? 0 : 100,
        };
        return newMessage;
    }

    function addSelfMessage(type: string, content: string) {
        const newMessage = createSelfMessage(type, content);
        action.addLinkmanMessage(focus, newMessage);
        return newMessage._id;
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

    async function handleSubmit() {
        // 只要还有可见字符就允许发送（保留换行/空格等格式），但全空白不发
        if (!message || message.trim() === '') {
            return;
        }
        // 防重复发送
        if ($sendingLock.current) {
            return;
        }
        $sendingLock.current = true;

        const content = message; // 先捕获内容，避免清空后丢失
        const id = addSelfMessage('text', content);

        // 立即清空输入框（体验更好）
        setMessage('');
        setInputText();

        try {
            await sendMessage(id, 'text', content);
        } finally {
            // 给一点点缓冲，避免极快连点导致再次触发
            setTimeout(() => {
                $sendingLock.current = false;
            }, 300);
        }
    }

    function handleSelectionChange(event: any) {
        const { start, end } = event.nativeEvent.selection;
        setCursorPosition({ start, end });
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
                Toast.warning('正在上传图片，请稍候...');
                return;
            }
            
            setIsUploading(true);
            const localMessage = createSelfMessage(
                'image',
                `${result.uri}?width=${result.width}&height=${result.height}`,
            );
            action.addLinkmanMessage(focus, localMessage);
            const id = localMessage._id;
            const key = `ImageMessage/${user._id}_${Date.now()}`;
            try {
                const imageUrl = await uploadFileWithProgress(
                    result.base64 as string,
                    key,
                    (progress) => {
                        // 更新上传进度
                        action.updateSelfMessage(focus, id, {
                            ...localMessage,
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
                Toast.danger('上传图片失败');
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
                Toast.warning('正在上传图片，请稍候...');
                return;
            }
            
            setIsUploading(true);
            const localMessage = createSelfMessage(
                'image',
                `${result.uri}?width=${result.width}&height=${result.height}`,
            );
            action.addLinkmanMessage(focus, localMessage);
            const id = localMessage._id;
            const key = `ImageMessage/${user._id}_${Date.now()}`;
            try {
                const imageUrl = await uploadFileWithProgress(
                    result.base64 as string,
                    key,
                    (progress) => {
                        // 更新上传进度
                        action.updateSelfMessage(focus, id, {
                            ...localMessage,
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
                Toast.danger('上传图片失败');
            } finally {
                setIsUploading(false);
            }
        }
    }

    /**
     * 表情包：添加（从相册选择 -> 校验大小/类型 -> 上传 -> 写入本地列表）
     * 仅允许图片和 GIF，且会限制大小，避免对服务器/用户流量造成压力。
     */
    async function handleAddSticker() {
        if (isUploadingSticker) {
            Toast.warning('正在上传表情包，请稍候...');
            return;
        }

        // 申请相册权限
        const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (currentPermission.accessPrivileges === 'none') {
            if (currentPermission.canAskAgain) {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permission.accessPrivileges === 'none') {
                    Toast.warning('需要相册权限才能添加表情包');
                    return;
                }
            } else {
                Toast.warning('需要相册权限才能添加表情包');
                return;
            }
        }

        // 选择图片（包含 gif）
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            quality: 1,
        });

        if (result.cancelled || !result.base64) {
            return;
        }

        // 校验类型/大小
        const check = validateSticker({ uri: result.uri, base64: result.base64 });
        if (!check.ok) {
            Toast.warning(check.reason);
            return;
        }

        setIsUploadingSticker(true);
        try {
            Toast.show('正在上传表情包…', 'warning');
            const key = `Sticker/${user._id}_${Date.now()}`;
            const url = await uploadFileWithProgress(result.base64 as string, key);

            const newSticker: StickerItem = {
                id: `${user._id}_${Date.now()}`,
                url,
                mime: check.mime,
                width: (result as any).width,
                height: (result as any).height,
                createdAt: Date.now(),
            };

            // 新表情包插到最前面（紧随“添加”按钮之后）
            const next = [newSticker, ...stickers];
            setStickers(next);
            await saveStickers(user._id, next);

            Toast.success('表情包已添加');
        } catch (error: any) {
            Toast.danger(`表情包上传失败: ${error?.message || error}`);
        } finally {
            setIsUploadingSticker(false);
        }
    }

    /**
     * 点击表情包直接发送（与微信体验类似：点一下就发出去）
     * 为了兼容现有服务端/消息渲染，这里复用 image 消息类型。
     */
    async function handleSendSticker(sticker: StickerItem) {
        try {
            const w = sticker.width || 200;
            const h = sticker.height || 200;
            const content = `${sticker.url}?width=${w}&height=${h}`;
            const id = addSelfMessage('image', content);
            await sendMessage(id, 'image', content);
        } catch (e: any) {
            Toast.danger(`发送表情包失败: ${e?.message || e}`);
        }
    }

    /**
     * 长按删除表情包（本地删除 + 持久化）
     * 说明：目前“表情包列表”是本机 AsyncStorage；后续接入服务端接口时，这里可同时调用 deleteUserSticker。
     */
    function handleDeleteSticker(sticker: StickerItem) {
        ActionSheet.show(
            {
                options: ['删除表情包', '取消'],
                cancelButtonIndex: 1,
                destructiveButtonIndex: 0,
                title: '表情包操作',
            },
            async (buttonIndex: number) => {
                if (buttonIndex !== 0) {
                    return;
                }
                try {
                    const next = stickers.filter((s) => s.id !== sticker.id);
                    setStickers(next);
                    await saveStickers(user._id, next);
                    Toast.success('已删除');
                } catch (e: any) {
                    Toast.danger(`删除失败: ${e?.message || e}`);
                }
            },
        );
    }

    // 处理输入框内容大小变化，动态调整高度
    // 主流做法：使用 contentSize.height 驱动高度，并做“单行基准校准”，避免不同平台出现“永远多一行”的偏差
    function handleContentSizeChange(event: any) {
        const { height } = event.nativeEvent.contentSize;
        
        // 如果没有内容，保持默认高度
        if (!message || message.trim() === '') {
            if (inputHeight !== 40) {
                setInputHeight(40);
                setContentHeight(0);
            }
            return;
        }

        const minHeight = 40; // 1行（与样式保持一致）
        const maxHeight = 200; // 9行

        // 记录首次“非空”时的 contentSize.height 作为单行基准
        // - 有的系统返回 20（只算文本行高）
        // - 有的系统返回 40（包含 padding 后的整体高度）
        if ($singleLineContentHeight.current == null && height > 0) {
            $singleLineContentHeight.current = height;
        }

        const singleLineContentHeight = $singleLineContentHeight.current ?? height;
        // 计算需要补偿的高度（如果单行 contentSize 不包含 padding，则补偿 20；如果已包含，则补偿 0）
        const paddingCompensation = Math.max(0, minHeight - singleLineContentHeight);

        const desiredContentHeight = height + paddingCompensation;
        setContentHeight(desiredContentHeight);

        const nextHeight = Math.max(minHeight, Math.min(desiredContentHeight, maxHeight));

        if (Math.abs(nextHeight - inputHeight) > 1) {
            setInputHeight(nextHeight);
            setTimeout(() => {
                onHeightChange();
            }, 50);
        }
    }

    function handleChangeText(value: string) {
        // 修复：部分输入法按一次“换行”会插入两个换行符（\n\n）
        // 仅在检测到本次是 Enter 触发的情况下做去重，避免影响粘贴等场景
        if ($pendingSingleEnter.current) {
            $pendingSingleEnter.current = false;

            // 通过 diff 找到本次插入的片段
            const prev = message;
            const next = value;
            let start = 0;
            while (start < prev.length && start < next.length && prev[start] === next[start]) {
                start++;
            }
            let endPrev = prev.length - 1;
            let endNext = next.length - 1;
            while (endPrev >= start && endNext >= start && prev[endPrev] === next[endNext]) {
                endPrev--;
                endNext--;
            }
            const inserted = next.slice(start, endNext + 1);
            const deleted = prev.slice(start, endPrev + 1);

            // 仅处理“只插入了 \n\n 且没有删除”的情况
            if (deleted.length === 0 && inserted === '\n\n') {
                const fixed = next.slice(0, start) + '\n' + next.slice(endNext + 1);
                setMessage(fixed);
            } else {
                setMessage(value);
            }
        } else {
            setMessage(value);
        }
        // 如果内容为空，重置高度为默认值
        if (!value || value.trim() === '') {
            if (inputHeight !== 40) {
                setInputHeight(40);
                setContentHeight(0);
            }
        }
    }

    function insertExpression(e: string) {
        const expression = `#(${e})`;
        const newValue = `${message.substring(
            0,
            cursorPosition.start,
        )}${expression}${message.substring(cursorPosition.end, message.length)}`;
        // 更新草稿
        setMessage(newValue);
        // 同步到原生输入框（尤其 iOS）
        setInputText(newValue);
        setCursorPosition({
            start: cursorPosition.start + expression.length,
            end: cursorPosition.start + expression.length,
        });
    }

    // 处理语音按钮点击（待实现）
    function handleVoiceButton() {
        // TODO: 实现语音功能
        Toast.warning('语音功能待实现');
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
                            style={styles.inputWrapper}
                        >
                            <TextInput
                                // @ts-ignore
                                ref={$input}
                                style={[styles.input, { height: inputHeight, maxHeight: 200 }]} // 最大高度：200 (9行)
                                placeholder="随便聊点啥吧"
                                onChangeText={handleChangeText}
                                onContentSizeChange={handleContentSizeChange}
                                onKeyPress={(e) => {
                                    // 标记一次 Enter（换行）键，用于 onChangeText 去重 \n\n
                                    if (e?.nativeEvent?.key === 'Enter') {
                                        $pendingSingleEnter.current = true;
                                    }
                                }}
                                autoCapitalize="none"
                                blurOnSubmit={false}
                                maxLength={2048}
                                // 多行输入时，回车应插入换行，而不是触发发送
                                // 发送通过右侧“发送”按钮触发
                                returnKeyType="default"
                                enablesReturnKeyAutomatically
                                underlineColorAndroid="transparent"
                                onSelectionChange={handleSelectionChange}
                                onFocus={handleFocus}
                                value={message}
                                multiline={true} // 启用多行输入
                                scrollEnabled={contentHeight > 200} // 只有当内容实际高度超过9行（200px）时才启用滚动
                                textAlignVertical="top" // Android 上文本从顶部开始
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

                            {/* 有内容时显示“发送”，否则显示“加号” */}
                            {message.trim() ? (
                                <TouchableOpacity
                                    style={styles.sendButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        handleSubmit();
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.sendButtonText}>发送</Text>
                                </TouchableOpacity>
                            ) : (
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
                            )}
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
                                                // 按产品要求：选择表情后不要自动收起菜单
                                                // 用户可能连续选择多个表情
                                            }}
                                            style={styles.expressionPreviewItem}
                                        >
                                            <Expression index={i} size={30} />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            ) : expressionType === 'sticker' ? (
                                // 表情包：我的表情包（第一个为“添加”按钮）
                                <ScrollView
                                    style={styles.expressionScrollView}
                                    // 与默认表情保持一致：使用 ScrollView + flexWrap 网格，超出固定高度则竖向滚动
                                    contentContainerStyle={[styles.expressionPreviewContainer, styles.stickerContainer]}
                                    showsVerticalScrollIndicator={true}
                                >
                                    {/* 第一个格子：添加表情包 */}
                                    <TouchableOpacity
                                        style={styles.stickerAddItem}
                                        activeOpacity={0.8}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleAddSticker();
                                        }}
                                    >
                                        <Ionicons name="ios-add" size={28} color="#2a7bf6" />
                                        <Text style={styles.stickerAddText}>添加</Text>
                                    </TouchableOpacity>

                                    {/* 已添加的表情包列表 */}
                                    {stickers.map((s) => (
                                        <TouchableOpacity
                                            key={s.id}
                                            style={styles.stickerItem}
                                            activeOpacity={0.85}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleSendSticker(s);
                                                // 选择表情包后不自动收起菜单，方便连续发送
                                            }}
                                            onLongPress={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSticker(s);
                                            }}
                                            delayLongPress={350}
                                        >
                                            <Image
                                                // RN Image：直接显示远端图片/gif，不走 OSS 处理参数，避免 gif 动画丢失
                                                source={{
                                                    uri: s.url,
                                                    cache: 'force-cache',
                                                    headers: {
                                                        Referer: referer,
                                                    },
                                                }}
                                                // TS 这里会把 StyleSheet 的 style 推断成 ViewStyle|TextStyle|ImageStyle 的联合类型
                                                // Image 组件需要 ImageStyle，因此做一次类型断言（不影响运行时）
                                                style={styles.stickerImage as any}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
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
        // 输入框高度增加时，左右按钮应始终贴底对齐（处于最底部一行的垂直居中）
        alignItems: 'flex-end',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'android' ? 4 : 8, // Android 上减小底部内边距，使键盘间距更自然
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
    inputWrapper: {
        flex: 1,
        position: 'relative',
    },
    input: {
        width: '100%', // 使用 width 而不是 flex，避免高度被限制
        minHeight: 40, // 最小高度
        paddingTop: 10, // 上内边距
        paddingBottom: 10, // 下内边距
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        borderRadius: 20,
        fontSize: 16,
        lineHeight: 20, // 行高
        color: '#000',
    },
    cursor: {
        width: 1,
        height: 20,
        backgroundColor: '#000',
        marginLeft: 1,
        marginRight: 1,
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
        borderRadius: 18,
        backgroundColor: '#2a7bf6',
        alignItems: 'center',
        justifyContent: 'center',
        // 让按钮在底部行内垂直居中
        marginBottom: 2,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
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
    /**
     * 表情包网格容器
     * - 使用 flexWrap 自动换行
     * - padding 让整体更像“面板”
     */
    stickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 4,
    },
    /**
     * 表情包项：比默认表情更大，更接近微信的“表情包”触感
     */
    stickerItem: {
        width: StickerSize,
        height: StickerSize,
        padding: 6,
    },
    stickerImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    /**
     * “添加表情包”占位按钮（正方形）
     */
    stickerAddItem: {
        width: StickerSize,
        height: StickerSize,
        borderRadius: 10,
        margin: 6,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderWidth: 1,
        borderColor: 'rgba(42,123,246,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stickerAddText: {
        marginTop: 6,
        fontSize: 12,
        color: '#2a7bf6',
        fontWeight: '600',
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
