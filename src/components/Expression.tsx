import React from 'react';
import { View } from 'react-native';

import Image from './Image';
import uri from '../assets/images/baidu.png';

type Props = {
    size: number;
    index: number;
    style?: any;
};

export default function Expression({ size, index, style }: Props) {
    // 从 style 中提取宽度和高度，如果未指定则使用 size
    const containerWidth = (style && (style as any).width) ?? size;
    const containerHeight = (style && (style as any).height) ?? size;
    
    // 图片使用容器的高度来计算，保持原始比例
    const imageHeight = (containerHeight * 3200) / 64;
    const imageWidth = containerHeight; // 表情图片是正方形的
    
    return (
        <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
            <Image
                src={uri}
                width={imageWidth}
                height={imageHeight}
                style={{ 
                    marginTop: -containerHeight * index,
                    // 如果容器宽度小于图片宽度，需要调整图片位置
                    marginLeft: containerWidth < imageWidth ? (containerWidth - imageWidth) / 2 : 0,
                }}
            />
        </View>
    );
}
