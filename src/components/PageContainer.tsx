import { View } from 'native-base';
import React from 'react';
import { ImageBackground, SafeAreaView, StyleSheet, Platform } from 'react-native';

type Props = {
    children: any;
    disableSafeAreaView?: boolean;
};

function PageContainer({ children, disableSafeAreaView = false }: Props) {
    return (
        <ImageBackground
            source={require('../assets/images/background-cool.jpg')}
            style={styles.backgroundImage}
            // Android 上 blur 对转场/滑动非常吃性能，容易导致动画卡顿
            blurRadius={Platform.OS === 'ios' ? 10 : 0}
        >
            <View style={styles.children}>
                {disableSafeAreaView ? (
                    children
                ) : (
                    <SafeAreaView style={[styles.container]}>{children}</SafeAreaView>
                )}
            </View>
        </ImageBackground>
    );
}

export default PageContainer;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backgroundImage: {
        flex: 1,
        resizeMode: 'cover',
        // 转场/冷启动时先给一个纯色兜底，避免白色闪屏
        backgroundColor: '#f1f1f1',
    },
    children: {
        flex: 1,
        // 避免半透明导致转场时露出白底（常见“白闪”）
        backgroundColor: '#f1f1f1',
    },
});
