import React from 'react';
import { Image as BaseImage, ImageSourcePropType } from 'react-native';
import { getOSSFileUrl } from '../utils/uploadFile';
import { referer } from '../utils/constant';

type Props = {
    src: string;
    width?: string | number;
    height?: string | number;
    style?: any;
};

export default function Image({ src, width = '100%', height = '100%', style }: Props) {
    // @ts-ignore
    let source: ImageSourcePropType = src;
    if (typeof src === 'string') {
        // 处理图片 URL，保留 width 和 height 参数
        // src 格式可能是：/ImageMessage/xxx.jpg?width=100&height=200
        let uri = getOSSFileUrl(src, `image/quality,q_80`);
        if (width !== '100%' && height !== '100%') {
            // 如果指定了宽高，使用缩略图
            uri = getOSSFileUrl(
                src,
                `image/resize,w_${Math.ceil(width as number)},h_${Math.ceil(
                    height as number,
                )}/quality,q_80`,
            );
        }
        
        // 确保 URI 是完整的 URL
        if (uri && !uri.startsWith('http://') && !uri.startsWith('https://')) {
            if (uri.startsWith('//')) {
                uri = `https:${uri}`;
            } else if (uri.startsWith('/')) {
                uri = `https://fiora.nasforjonas.xyz${uri}`;
            }
        }
        
        source = {
            uri: uri as string,
            cache: 'force-cache',
            headers: {
                Referer: referer,
            },
        };
    }
    return <BaseImage source={source} style={[style, { width, height }]} />;
}
