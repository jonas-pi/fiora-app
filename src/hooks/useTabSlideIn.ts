import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { getLastTabIndex, setLastTabIndex } from '../utils/tabSlide';

/**
 * Bottom Tabs 场景切换“滑动进入”动画（RNRF 底部 Tabs 默认不会滑动切换页面）。
 * 约定 tabIndex: chatlist=0, contacts=1, other=2
 */
export function useTabSlideIn(navigation: any, tabIndex: number) {
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    const width = useMemo(() => Dimensions.get('window').width, []);

    useEffect(() => {
        if (!navigation?.addListener) {
            return;
        }

        const onFocus = () => {
            const prev = getLastTabIndex();
            setLastTabIndex(tabIndex);

            if (prev == null || prev === tabIndex) {
                translateX.setValue(0);
                opacity.setValue(1);
                return;
            }

            const direction = tabIndex > prev ? 1 : -1;
            // 右边进入（去右侧 tab）/左边进入（回左侧 tab）
            translateX.setValue(direction === 1 ? width : -width);
            opacity.setValue(0.98);

            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        };

        const sub = navigation.addListener('didFocus', onFocus);
        return () => {
            if (sub?.remove) {
                sub.remove();
            } else if (typeof sub === 'function') {
                sub();
            }
        };
    }, [navigation, opacity, tabIndex, translateX, width]);

    return { tabAnimatedStyle: { transform: [{ translateX }], opacity } };
}


