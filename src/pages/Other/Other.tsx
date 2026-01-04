import { Body, Button, Content, Icon, List, ListItem, Right, Text, View } from 'native-base';
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Animated } from 'react-native';
import { Actions } from 'react-native-router-flux';
import PageContainer from '../../components/PageContainer';

import { useIsLogin } from '../../hooks/useStore';
import socket from '../../socket';
import action from '../../state/action';
import { getStorageValue, removeStorageValue } from '../../utils/storage';
import appInfo from '../../../app.json';
import Avatar from '../../components/Avatar';
import PrivacyPolicy, { PrivacyPolicyStorageKey } from './PrivacyPolicy';
import { buttonStyles } from '../../utils/styles';
import { useTabSlideIn } from '../../hooks/useTabSlideIn';
import Toast from '../../components/Toast';
import { checkForUpdateAndPrompt } from '../../utils/update';

function getIsNight() {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
}

function Other({ navigation }: any) {
    const { tabAnimatedStyle } = useTabSlideIn(navigation, 2);
    const isLogin = useIsLogin();
    const [isNight, setIsNight] = useState(getIsNight());
    const [showPrivacyPolicy, togglePrivacyPolicy] = useState(false);

    async function getPrivacyPolicyStatus() {
        const privacyPoliceStorageValue = await getStorageValue(PrivacyPolicyStorageKey);
        togglePrivacyPolicy(privacyPoliceStorageValue !== 'true');
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setIsNight(getIsNight());
        }, 1000);

        getPrivacyPolicyStatus();

        return () => {
            clearInterval(timer);
        };
    }, []);

    async function logout() {
        action.logout();
        await removeStorageValue('token');
        Toast.success('您已经退出登录');
        socket.disconnect();
        socket.connect();
    }

    async function login() {
        const privacyPoliceStorageValue = await getStorageValue(PrivacyPolicyStorageKey);
        if (privacyPoliceStorageValue !== 'true') {
            togglePrivacyPolicy(true);
            return;
        }

        Actions.push('login');
    }

    return (
        <PageContainer>
            <Animated.View style={[{ flex: 1 }, tabAnimatedStyle]}>
                <Content>
                    <View style={styles.app}>
                        <Avatar
                            src={
                                isNight
                                    ? require('../../../icon.png')
                                    : require('../../assets/images/wuzeiniang.gif')
                            }
                            size={100}
                        />
                        <Text style={styles.name}>
                            fiora v
                            {appInfo.expo.version}
                        </Text>
                    </View>
                    <List style={styles.list}>
                        <ListItem
                            icon
                            onPress={async () => {
                                // 检查更新：网络请求 + 弹窗提示（安装逻辑先做“可用”，后续可替换为真·静默下载/安装）
                                await checkForUpdateAndPrompt({
                                    currentVersion: appInfo.expo.version,
                                });
                            }}
                        >
                            <Body>
                                <Text style={styles.listItemTitle}>检查更新</Text>
                            </Body>
                            <Right>
                                <Icon active name="arrow-forward" style={styles.listItemArrow} />
                            </Right>
                        </ListItem>
                        <ListItem
                            icon
                            onPress={() => Linking.openURL('https://github.com/jonas-pi/fiora')}
                        >
                            <Body>
                                <Text style={styles.listItemTitle}>源码</Text>
                            </Body>
                            <Right>
                                <Icon active name="arrow-forward" style={styles.listItemArrow} />
                            </Right>
                        </ListItem>
                        <ListItem icon onPress={() => Linking.openURL('https://www.suisuijiang.com')}>
                            <Body>
                                <Text style={styles.listItemTitle}>原作者鸣谢</Text>
                            </Body>
                            <Right>
                                <Icon active name="arrow-forward" style={styles.listItemArrow} />
                            </Right>
                        </ListItem>
                        <ListItem icon onPress={() => Linking.openURL('https://fiora.nasforjonas.xyz')}>
                            <Body>
                                <Text style={styles.listItemTitle}>fiora 网页版</Text>
                            </Body>
                            <Right>
                                <Icon active name="arrow-forward" style={styles.listItemArrow} />
                            </Right>
                        </ListItem>
                    </List>
                </Content>
                {isLogin ? (
                    <Button danger block style={[styles.logoutButton, buttonStyles]} onPress={logout}>
                        <Text>退出登录</Text>
                    </Button>
                ) : (
                    <Button block style={[styles.logoutButton, buttonStyles]} onPress={login}>
                        <Text>登录 / 注册</Text>
                    </Button>
                )}
                <View style={styles.copyrightContainer}>
                    <Text style={styles.copyright}>
                        Copyright© 2015-
                        {new Date().getFullYear()}
                        {' '}
                        碎碎酱 | Fork by jonas-pi
                    </Text>
                </View>
            </Animated.View>
            <PrivacyPolicy visible={showPrivacyPolicy} onClose={() => togglePrivacyPolicy(false)} />
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    logoutButton: {
        marginLeft: 12,
        marginRight: 12,
    },
    app: {
        alignItems: 'center',
        paddingTop: 12,
    },
    name: {
        marginTop: 6,
        color: '#222',
    },
    list: {
        marginTop: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    listItemTitle: {
        color: '#333',
    },
    listItemArrow: {
        color: '#999',
    },
    github: {
        fontSize: 26,
        color: '#000',
    },
    copyrightContainer: {
        marginTop: 12,
        marginBottom: 6,
    },
    copyright: {
        fontSize: 10,
        textAlign: 'center',
        color: '#666',
    },
});

export default Other;
