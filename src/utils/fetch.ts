import Toast from '../components/Toast';
import socket from '../socket';

export default function fetch<T = any>(
    event: string,
    data: any = {},
    { toast = true, timeout = 30000 } = {},
): Promise<[string | null, T | null]> {
    return new Promise((resolve) => {
        // 设置超时，避免长时间等待
        // 文件上传需要更长的超时时间
        const timeoutMs = event === 'uploadFile' ? 60000 : timeout; // 上传文件60秒，其他30秒
        
        const timeoutId = setTimeout(() => {
            const errorMsg = `请求超时: ${event}`;
            if (toast) {
                Toast.danger(errorMsg);
            }
            resolve([errorMsg, null]);
        }, timeoutMs);

        socket.emit(event, data, (res: any) => {
            clearTimeout(timeoutId);
            
            if (typeof res === 'string') {
                if (toast) {
                    Toast.danger(res);
                }
                resolve([res, null]);
            } else if (res && typeof res === 'object') {
                resolve([null, res]);
            } else {
                // 处理意外的响应格式
                const errorMsg = `意外的响应格式: ${event}`;
                if (toast) {
                    Toast.danger(errorMsg);
                }
                resolve([errorMsg, null]);
            }
        });
    });
}
