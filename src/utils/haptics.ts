import { Platform, Vibration } from 'react-native';

/**
 * 轻触反馈（最轻）
 *
 * 为什么不用 Vibration.vibrate(8) 直接做？
 * - 部分安卓机型/系统会忽略极短的 vibration（看起来像“震动没了”）
 * - Expo 推荐使用 expo-haptics 来实现更稳定、更接近 iOS/Android 主流交互的触感反馈
 *
 * 这里做了“可选依赖”：
 * - 若安装了 expo-haptics：优先用 Haptics.impactAsync(Light)
 * - 否则降级到 Vibration（并把时长做得稍微长一点，避免被系统吞掉）
 */
export async function hapticLight() {
    try {
        // 动态 require，避免在极端情况下依赖缺失导致崩溃
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        const Haptics = require('expo-haptics') as typeof import('expo-haptics');
        if (Haptics?.impactAsync && Haptics?.ImpactFeedbackStyle) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            return;
        }
    } catch {
        // ignore
    }

    // fallback：Vibration
    // 安卓上给到 20ms 更容易被感知/不被吞
    const duration = Platform.OS === 'android' ? 20 : 10;
    Vibration.vibrate(duration);
}


