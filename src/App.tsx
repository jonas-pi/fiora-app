import React from 'react';
import { StyleSheet, View, Animated, Dimensions, Easing } from 'react-native';
import { Scene, Router, Stack, Tabs, Lightbox } from 'react-native-router-flux';
import { Icon, Root } from 'native-base';
import { enableScreens } from 'react-native-screens';

import { connect } from 'react-redux';
import ChatList from './pages/ChatList/ChatList';
import Chat from './pages/Chat/Chat';
import Login from './pages/LoginSignup/Login';
import Signup from './pages/LoginSignup/Signup';

import Loading from './components/Loading';
import Other from './pages/Other/Other';
import Contacts from './pages/Contacts/Contacts';
import Notification from './components/Nofitication';
import { State, User } from './types/redux';
import SelfInfo from './pages/ChatList/SelfInfo';
import ChatBackButton from './pages/Chat/ChatBackButton';
import GroupProfile from './pages/GroupProfile/GroupProfile';
import ChatRightButton from './pages/Chat/ChatRightButton';
import UserInfo from './pages/UserInfo/UserInfo';
import ChatListRightButton from './pages/ChatList/ChatListRightButton';
import SearchResult from './pages/SearchResult/SearchResult';
import GroupInfo from './pages/GroupInfo/GroupInfo';
import BackButton from './components/BackButton';
import SelfSettings from './pages/SelfSettings/SelfSettings';
import AnimatedTabIcon from './components/AnimatedTabIcon';
import { ToastHost } from './components/Toast';

type Props = {
    title: string;
    primaryColor: string;
    isLogin: boolean;
};

// 启用 native screens，可显著改善页面切换/侧滑返回的流畅度
enableScreens();

// 全局页面切换动画：从哪儿来回哪儿去的轻微缩放 + 淡入
// react-native-router-flux(v4) 底层是 react-navigation stack 的 transitionConfig
const transitionConfig = () => ({
    transitionSpec: {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        timing: Animated.timing,
        // @ts-ignore react-navigation v4 supports this in many builds
        useNativeDriver: true,
    },
    screenInterpolator: (sceneProps: any) => {
        const { position, scene } = sceneProps;
        const index = scene.index;
        const { width: W, height: H } = Dimensions.get('window');
        const centerX = W / 2;
        const centerY = H / 2;

        // originX/originY 由触发跳转的点击位置传入（pageX/pageY）
        const originX = scene?.route?.params?.originX ?? centerX;
        const originY = scene?.route?.params?.originY ?? centerY;

        // 减小缩放幅度，降低 GPU 压力，提升流畅度
        const startScale = 0.93;
        const scale = position.interpolate({
            inputRange: [index - 1, index],
            outputRange: [startScale, 1],
            extrapolate: 'clamp',
        });
        const opacity = position.interpolate({
            inputRange: [index - 1, index],
            outputRange: [0.15, 1],
            extrapolate: 'clamp',
        });

        // 让“从哪儿来回哪儿去”：打开时从点击点放大，返回时缩回到点击点
        // 近似做法：在 startScale 时，通过平移让视觉中心偏向 origin
        const startTranslateX = (originX - centerX) * (1 - startScale);
        const startTranslateY = (originY - centerY) * (1 - startScale);
        const translateX = position.interpolate({
            inputRange: [index - 1, index],
            outputRange: [startTranslateX, 0],
            extrapolate: 'clamp',
        });
        const translateY = position.interpolate({
            inputRange: [index - 1, index],
            outputRange: [startTranslateY, 0],
            extrapolate: 'clamp',
        });

        return {
            opacity,
            transform: [{ translateX }, { translateY }, { scale }],
        };
    },
});

function App({ title, primaryColor, isLogin }: Props) {
    const primaryColor10 = `rgba(${primaryColor}, 1)`;
    const primaryColor8 = `rgba(${primaryColor}, 0.8)`;

    const sceneCommonProps = {
        hideNavBar: false,
        navigationBarStyle: {
            backgroundColor: primaryColor10,
            borderBottomWidth: 0,
        },
        navBarButtonColor: "#f9f9f9",
        renderLeftButton: () => <BackButton />
    }

    return (
        <View style={styles.container}>
            <Root>
                <Router>
                    <Stack
                        hideNavBar
                        transitionConfig={transitionConfig}
                        // 避免转场时卡片背景透明导致“闪一下”
                        cardStyle={{ backgroundColor: 'rgba(241, 241, 241, 1)' }}
                    >
                        <Lightbox>
                            <Tabs
                                key="tabs"
                                hideNavBar
                                tabBarStyle={{ backgroundColor: primaryColor8, borderTopWidth: 0 }}
                                showLabel={false}
                            >
                                <Scene
                                    key="chatlist"
                                    navBarButtonColor="transparent"
                                    component={ChatList}
                                    initial
                                    hideNavBar={!isLogin}
                                    icon={({ focused }) => (
                                        <AnimatedTabIcon
                                            name="chatbubble-ellipses-outline"
                                            focused={!!focused}
                                        />
                                    )}
                                    renderLeftButton={() => <SelfInfo />}
                                    renderRightButton={() => <ChatListRightButton />}
                                    navigationBarStyle={{
                                        backgroundColor: primaryColor10,
                                        borderBottomWidth: 0,
                                    }}
                                />
                                <Scene
                                    key="contacts"
                                    component={Contacts}
                                    hideNavBar={!isLogin}
                                    title=""
                                    // 强制不渲染标题，避免出现类似 "_contacts" 的默认 title
                                    renderTitle={() => null}
                                    renderLeftButton={() => <SelfInfo />}
                                    renderRightButton={() => <ChatListRightButton />}
                                    navigationBarStyle={{
                                        backgroundColor: primaryColor10,
                                        borderBottomWidth: 0,
                                    }}
                                    icon={({ focused }) => (
                                        <AnimatedTabIcon name="people-outline" focused={!!focused} />
                                    )}
                                />
                                <Scene
                                    key="other"
                                    component={Other}
                                    hideNavBar
                                    title="其它"
                                    icon={({ focused }) => (
                                        <AnimatedTabIcon name="aperture-outline" focused={!!focused} />
                                    )}
                                />
                            </Tabs>
                        </Lightbox>
                        <Scene
                            key="chat"
                            component={Chat}
                            title="聊天"
                            getTitle={title}
                            hideNavBar={false}
                            navigationBarStyle={{
                                backgroundColor: primaryColor10,
                                borderBottomWidth: 0,
                            }}
                            navBarButtonColor="#f9f9f9"
                            renderLeftButton={() => <ChatBackButton />}
                            renderRightButton={() => <ChatRightButton />}
                        />
                        <Scene
                            key="login"
                            component={Login}
                            title="登录"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="signup"
                            component={Signup}
                            title="注册"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="groupProfile"
                            component={GroupProfile}
                            title="群组资料"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="userInfo"
                            component={UserInfo}
                            title="个人信息"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="groupInfo"
                            component={GroupInfo}
                            title="群组信息"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="searchResult"
                            component={SearchResult}
                            title="搜索结果"
                            {...sceneCommonProps}
                        />
                        <Scene
                            key="selfSettings"
                            component={SelfSettings}
                            title="个人设置"
                            {...sceneCommonProps}
                        />
                    </Stack>
                </Router>
            </Root>

            <Loading />
            <Notification />
            {/* 全局提示条：自研 ToastHost（完全规避 native-base Toast 的 Android 白条问题） */}
            <ToastHost />
        </View>
    );
}

export default connect((state: State) => ({
    primaryColor: state.ui.primaryColor,
    isLogin: !!(state.user as User)?._id,
}))(App);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f1f1',
    },
});
