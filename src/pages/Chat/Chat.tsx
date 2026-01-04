import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, ScrollView, Dimensions, Pressable, View, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Actions } from 'react-native-router-flux';

import { isiOS } from '../../utils/platform';

import MessageList from './MessageList';
import Input from './Input';
import PageContainer from '../../components/PageContainer';
import { Friend, Group, Linkman } from '../../types/redux';
import { useFocusLinkman, useIsLogin, useSelfId, useStore } from '../../hooks/useStore';
import {
    getDefaultGroupOnlineMembers,
    getGroupOnlineMembers,
    getUserOnlineStatus,
} from '../../service';
import action from '../../state/action';
import { formatLinkmanName } from '../../utils/linkman';
import fetch from '../../utils/fetch';

let lastMessageIdCache = '';

const keyboardOffset = (() => {
    const { width, height } = Dimensions.get('window');
    const screenRatio = height / width;
    if (screenRatio === 667 / 375) {
        // iPhone 6 / 7 / 8
        return 64;
    }
    if (screenRatio === 736 / 414) {
        // iPhone 6 / 7 / 8 PLUS
        return 64;
    }
    if (screenRatio === 812 / 375) {
        // iPhone X / 12mini
        return 86;
    }
    if (screenRatio === 896 / 414) {
        // iPhone Xr / 11 / 11 Pro Max
        return 86;
    }
    if (screenRatio === 844 / 390) {
        // iPhone 12 / 12 Prop
        return 64;
    }
    if (screenRatio === 926 / 428) {
        // iPhone 12 Pro Max
        return 64;
    }
    // Android 上减小偏移量，使键盘与输入框的间距更自然
    return Platform.OS === 'android' ? 0 : Constants.statusBarHeight + 44;
})();

export default function Chat() {
    const isLogin = useIsLogin();
    const self = useSelfId();
    const { focus } = useStore();
    const linkman = useFocusLinkman();
    const $messageList = useRef<ScrollView>();
    const [hasMenuOpen, setHasMenuOpen] = useState(false); // 菜单是否打开
    const closeAllMenusRef = useRef<(() => void) | undefined>(); // 关闭菜单的函数引用

    async function fetchGroupOnlineMembers() {
        let onlineMembers: Group['members'] = [];
        if (isLogin) {
            onlineMembers = await getGroupOnlineMembers(focus);
        } else {
            onlineMembers = await getDefaultGroupOnlineMembers();
        }
        if (onlineMembers) {
            action.updateGroupProperty(focus, 'members', onlineMembers);
        }
    }
    async function fetchUserOnlineStatus() {
        const isOnline = await getUserOnlineStatus(focus.replace(self, ''));
        action.updateFriendProperty(focus, 'isOnline', isOnline);
    }
    useEffect(() => {
        if (!linkman || !isLogin) {
            return;
        }
        const request = linkman.type === 'group' ? fetchGroupOnlineMembers : fetchUserOnlineStatus;
        request();
        const timer = setInterval(() => request(), 1000 * 60);
        return () => clearInterval(timer);
    }, [focus, isLogin]);

    useEffect(() => {
        if (Actions.currentScene !== 'chat') {
            return;
        }
        Actions.refresh({
            title: formatLinkmanName(linkman as Linkman),
        });
    }, [(linkman as Group).members, (linkman as Friend).isOnline]);

    async function intervalUpdateHistory() {
        if (isLogin && linkman) {
            if (linkman.messages.length > 0) {
                const lastMessageId = linkman.messages[linkman.messages.length - 1]._id;
                if (lastMessageId !== lastMessageIdCache) {
                    lastMessageIdCache = lastMessageId;
                    await fetch('updateHistory', { linkmanId: focus, messageId: lastMessageId });
                }
            }
        }
    }
    useEffect(() => {
        const timer = setInterval(intervalUpdateHistory, 1000 * 5);
        return () => clearInterval(timer);
    }, [focus]);

    function scrollToEnd(time = 0) {
        if (time > 200) {
            return;
        }
        if ($messageList.current) {
            $messageList.current!.scrollToEnd({ animated: false });
        }

        setTimeout(() => {
            scrollToEnd(time + 50);
        }, 50);
    }

    function handleInputHeightChange() {
        if ($messageList.current) {
            scrollToEnd();
        }
    }

    // 处理菜单状态变化
    function handleMenuStateChange(hasMenuOpen: boolean) {
        setHasMenuOpen(hasMenuOpen);
    }

    // 关闭所有菜单
    function handleCloseAllMenus() {
        if (closeAllMenusRef.current) {
            closeAllMenusRef.current();
        }
    }

    return (
        <PageContainer disableSafeAreaView>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={keyboardOffset}
                enabled={Platform.OS === 'ios'}
            >
                {/* 
                // @ts-ignore */}
                <MessageList $scrollView={$messageList} />
                {/* 当有菜单打开时，添加覆盖层来处理点击聊天记录区域关闭菜单 */}
                {/* 覆盖层使用 pointerEvents="box-none"，让子元素（Input 和菜单）可以接收触摸事件 */}
                {hasMenuOpen && (
                    <Pressable
                        onPress={handleCloseAllMenus}
                        style={styles.menuOverlay}
                        pointerEvents="box-none"
                    >
                        <View style={StyleSheet.absoluteFill} pointerEvents="auto" />
                    </Pressable>
                )}
                <Input 
                    onHeightChange={handleInputHeightChange}
                    onMenuStateChange={handleMenuStateChange}
                    closeAllMenusRef={closeAllMenusRef}
                />
            </KeyboardAvoidingView>
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative', // 为绝对定位的覆盖层提供定位上下文
    },
    // 菜单覆盖层，用于处理点击聊天记录区域关闭菜单
    // 只覆盖 MessageList 区域，不覆盖 Input 区域（Input 在覆盖层之后渲染，zIndex 更高）
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 998, // 在消息列表上方，但低于菜单和输入框
        elevation: 998, // Android 阴影层级
    },
});
