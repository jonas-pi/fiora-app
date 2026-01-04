import React, { useEffect, useRef } from 'react';
import { Animated, Vibration } from 'react-native';
import { Icon } from 'native-base';

type Props = {
    name: string;
    focused: boolean;
    size?: number;
    activeColor?: string;
    inactiveColor?: string;
};

/**
 * Tab 图标轻反馈：切换到该 Tab 时，轻微缩放一下再回弹
 * 注：react-native-router-flux 的 icon 回调拿不到 onPress，只能在 focused 变化时触发
 */
export default function AnimatedTabIcon({
    name,
    focused,
    size = 24,
    activeColor = 'white',
    inactiveColor = '#bbb',
}: Props) {
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!focused) {
            return;
        }
        // 轻震动反馈：与筛选条保持一致（只能在 focused 变化时触发）
        Vibration.vibrate(8);
        scale.stopAnimation();
        Animated.sequence([
            Animated.timing(scale, {
                toValue: 1.22,
                duration: 110,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 140,
                friction: 9,
                overshootClamping: true,
            }),
        ]).start();
    }, [focused, scale]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Icon
                name={name}
                style={{
                    fontSize: size,
                    color: focused ? activeColor : inactiveColor,
                }}
            />
        </Animated.View>
    );
}


