import React from 'react';
import { View, PixelRatio } from 'react-native';

import Image from './Image';
import uri from '../assets/images/baidu.png';

type Props = {
    size: number;
    index: number;
    style?: any;
};

export default function Expression({ size, index, style }: Props) {
    /**
     * 表情图是“雪碧图”（一整张竖向拼接的图），通过裁剪显示其中一格。
     * 常见问题：在不同设备像素比下，尺寸/偏移出现小数像素，导致边缘采样到相邻表情（看到“其他表情的一部分”）。
     * 解决：对尺寸/偏移做像素对齐，并用 transform 替代 marginTop。
     */
    const s = PixelRatio.roundToNearestPixel(size);
    const spriteHeight = PixelRatio.roundToNearestPixel((s * 3200) / 64); // 原图 64x3200，按宽度等比缩放
    const offsetY = PixelRatio.roundToNearestPixel(s * index);

    return (
        <View style={[{ width: s, height: s, overflow: 'hidden' }, style]}>
            <Image
                src={uri}
                width={s}
                height={spriteHeight}
                resizeMode="stretch"
                style={{
                    transform: [{ translateY: -offsetY }],
                }}
            />
        </View>
    );
}
