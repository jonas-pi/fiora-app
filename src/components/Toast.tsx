import { Toast } from 'native-base';

export default {
    success(message: string) {
        Toast.show({
            text: message,
            type: 'success',
            position: 'top',
            duration: 2000, // 显示时长2秒
            buttonText: '✓', // 添加成功图标
            textStyle: {
                textAlign: 'center', // 文字居中
            },
            style: {
                borderRadius: 12, // 圆角
                paddingHorizontal: 20, // 内边距
                paddingVertical: 12, // 内边距
            },
        });
    },
    warning(message: string) {
        Toast.show({
            text: message,
            type: 'warning',
            position: 'top',
            duration: 2000, // 显示时长2秒
            textStyle: {
                textAlign: 'center', // 文字居中
            },
            style: {
                borderRadius: 12, // 圆角
                paddingHorizontal: 20, // 内边距
                paddingVertical: 12, // 内边距
            },
        });
    },
    danger(message: string) {
        Toast.show({
            text: message,
            type: 'danger',
            position: 'top',
            duration: 2000, // 显示时长2秒
            textStyle: {
                textAlign: 'center', // 文字居中
            },
            style: {
                borderRadius: 12, // 圆角
                paddingHorizontal: 20, // 内边距
                paddingVertical: 12, // 内边距
            },
        });
    },
};
