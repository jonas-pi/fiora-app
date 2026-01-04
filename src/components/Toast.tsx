import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

export type ToastType = 'success' | 'warning' | 'danger';

type ToastPayload = {
    message: string;
    type: ToastType;
    duration?: number;
};

/**
 * 说明：
 * - 以前使用 native-base Toast.show，在 Android 上容易出现“白色长条/白块”渲染伪影（圆角 + 阴影 + 透明叠加时更明显）
 * - 这里改成纯 RN 实现：ToastHost 挂在 App 根节点，Toast API 通过模块内回调触发显示
 * - 优点：样式完全可控，且可彻底规避 native-base 的 Android 渲染问题
 */

let toastHandler: ((payload: ToastPayload) => void) | null = null;

function setToastHandler(handler: ((payload: ToastPayload) => void) | null) {
    toastHandler = handler;
}

function emitToast(payload: ToastPayload) {
    if (toastHandler) {
        toastHandler(payload);
    } else {
        // App 尚未挂载 ToastHost 时，降级到 console，避免静默丢消息
        // eslint-disable-next-line no-console
        console.log(`[Toast][${payload.type}] ${payload.message}`);
    }
}

const ToastApi = {
    /**
     * 更主流的“提示信息条”：
     * - 位置：顶部安全区内（不遮挡底部输入/导航）
     * - 形态：窄宽悬浮 Snackbar
     * - Android：避免使用 native-base Toast，从根源规避白条伪影
     */
    show(message: string, type: ToastType = 'success', duration = 1800) {
        emitToast({ message, type, duration });
    },
    success(message: string) {
        emitToast({ message, type: 'success' });
    },
    warning(message: string) {
        emitToast({ message, type: 'warning' });
    },
    danger(message: string) {
        emitToast({ message, type: 'danger' });
    },
};

export default ToastApi;

/**
 * ToastHost：必须挂在 App 根节点（例如 App.tsx），用于实际渲染 Toast UI
 */
export function ToastHost() {
    const [payload, setPayload] = useState<ToastPayload | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-10)).current;
    const scale = useRef(new Animated.Value(0.985)).current; // 轻微缩放：更“浮”更现代
    const hideTimerRef = useRef<any>(null);

    const topOffset = useMemo(() => {
        // iOS 的安全区由系统处理，这里只额外加一点间距
        // Android 用 statusBarHeight 做兜底，避免压在状态栏下面
        return (Platform.OS === 'android' ? Constants.statusBarHeight : 0) + 10;
    }, []);

    useEffect(() => {
        setToastHandler((next) => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            setPayload(next);
            opacity.stopAnimation();
            translateY.stopAnimation();
            scale.stopAnimation();
            opacity.setValue(0);
            translateY.setValue(-10);
            scale.setValue(0.985);

            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 140,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();

            const duration = next.duration ?? 1800;
            hideTimerRef.current = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 140,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -10,
                        duration: 160,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 0.985,
                        duration: 160,
                        useNativeDriver: true,
                    }),
                ]).start(({ finished }) => {
                    if (finished) {
                        setPayload(null);
                    }
                });
            }, duration);
        });

        return () => {
            setToastHandler(null);
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
    }, [opacity, scale, translateY]);

    if (!payload) {
        return null;
    }

    const accentColor =
        payload.type === 'success'
            ? '#2a7bf6'
            : payload.type === 'warning'
              ? '#f0ad4e'
              : '#d9534f';

    return (
        <View pointerEvents="box-none" style={styles.host}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.toast,
                    { marginTop: topOffset, borderLeftColor: accentColor },
                    { opacity, transform: [{ translateY }, { scale }] },
                ]}
            >
                {/* 顶部高光层：纯色不透明的前提下，用一层极淡高光做“质感” */}
                <View pointerEvents="none" style={styles.sheen} />
                <Text style={styles.text} numberOfLines={3}>
                    {payload.message}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    host: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        elevation: 99999,
        alignItems: 'center',
    },
    toast: {
        width: '92%',
        maxWidth: 420,
        // 浅色系：保持纯色不透明，依然彻底规避 Android 透明叠加伪影
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderLeftWidth: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.08)',
        // iOS：shadow；Android：现在我们用不透明底色，elevation 可安全启用，视觉更“浮”
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.12,
                shadowRadius: 18,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    sheen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 18,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        // 浅色卡片的“顶端质感层”：用极淡的暗部替代高光，更可见也更克制
        backgroundColor: 'rgba(0,0,0,0.025)',
    },
    text: {
        color: '#222',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 18,
    },
});
