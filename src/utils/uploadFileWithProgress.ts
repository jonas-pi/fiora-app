import { getStorageValue } from './storage';
import { referer } from './constant';
import Toast from '../components/Toast';

/**
 * 使用 HTTP POST 上传文件，支持进度回调
 * @param base64Data base64 编码的字符串（纯 base64，不包含 data URI 前缀）
 * @param fileName 文件名，格式：ImageMessage/{userId}_{timestamp} 或 FileMessage/{userId}_{timestamp}.{ext}
 * @param onProgress 进度回调函数，progress 范围 0-100
 * @returns 返回文件 URL
 */
export default async function uploadFileWithProgress(
    base64Data: string,
    fileName: string,
    onProgress?: (progress: number) => void,
): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            // 清理 base64 数据（与服务端处理逻辑保持一致）
            let cleanBase64 = base64Data;
            
            // 1. 移除 data URI 前缀（如果存在）
            // 例如：data:image/png;base64,iVBORw0KG... -> iVBORw0KG...
            if (cleanBase64.includes(',')) {
                cleanBase64 = cleanBase64.split(',')[1];
            }
            
            // 2. 去除所有空白字符（空格、换行符等）
            cleanBase64 = cleanBase64.replace(/\s/g, '');
            
            // 3. 验证 base64 数据不为空
            if (!cleanBase64 || cleanBase64.length === 0) {
                throw new Error('图片数据为空');
            }
            
            // 4. 验证 base64 格式（与服务端验证保持一致）
            // 只允许：A-Z, a-z, 0-9, +, /, = 字符
            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            if (!base64Regex.test(cleanBase64)) {
                throw new Error('图片数据格式不正确：包含无效字符');
            }
            
            // 5. 验证 base64 字符串长度是 4 的倍数（base64 编码要求）
            // 注意：允许末尾有 1-2 个 = 填充字符
            const paddingLength = (cleanBase64.match(/=+$/) || [''])[0].length;
            if (paddingLength > 2) {
                throw new Error('图片数据格式不正确：填充字符过多');
            }
            
            // 检查大小（10MB 限制）
            const maxBase64Size = 10 * 1024 * 1024;
            if (cleanBase64.length > maxBase64Size) {
                throw new Error('图片太大，请选择较小的图片（建议小于 7MB）');
            }
            
            // 获取服务器地址
            // 优先从本地存储读取，其次使用默认值
            const serverHost = 'https://fiora.nasforjonas.xyz';
            const uploadUrl = `${serverHost}/api/upload`;
            
            // 创建 FormData
            // 在 React Native 中，FormData.append 接受字符串
            const formData = new FormData();
            formData.append('file', cleanBase64);
            formData.append('fileName', fileName);
            formData.append('isBase64', 'true');
            
            // 创建 XMLHttpRequest
            const xhr = new XMLHttpRequest();
            
            // 监听上传进度
            if (onProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        onProgress(progress);
                    }
                });
            }
            
            // 监听完成
            xhr.addEventListener('load', () => {
                try {
                    // 记录响应信息用于调试
                    const responseText = xhr.responseText;
                    console.log('Upload response status:', xhr.status);
                    console.log('Upload response text:', responseText.substring(0, 200));
                    
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(responseText);
                            if (response.error) {
                                const errorMessage = `上传失败: ${response.error}`;
                                console.error('Upload error:', errorMessage);
                                Toast.danger(errorMessage);
                                reject(new Error(errorMessage));
                            } else if (response.url) {
                                console.log('Upload success, URL:', response.url);
                                resolve(response.url);
                            } else {
                                const errorMessage = '服务器未返回文件URL';
                                console.error('Upload error:', errorMessage, response);
                                Toast.danger(errorMessage);
                                reject(new Error(errorMessage));
                            }
                        } catch (parseError: any) {
                            const errorMessage = `解析响应失败: ${parseError.message}`;
                            console.error('Parse error:', errorMessage, responseText);
                            Toast.danger(errorMessage);
                            reject(new Error(errorMessage));
                        }
                    } else {
                        // 尝试解析错误响应
                        let errorMessage = `上传失败: HTTP ${xhr.status}`;
                        try {
                            const errorResponse = JSON.parse(responseText);
                            if (errorResponse.error) {
                                errorMessage = `上传失败: ${errorResponse.error}`;
                            }
                        } catch (e) {
                            // 忽略解析错误，使用默认错误信息
                        }
                        console.error('Upload HTTP error:', xhr.status, responseText);
                        Toast.danger(errorMessage);
                        reject(new Error(errorMessage));
                    }
                } catch (error: any) {
                    console.error('Upload load handler error:', error);
                    const errorMessage = `处理响应失败: ${error.message}`;
                    Toast.danger(errorMessage);
                    reject(new Error(errorMessage));
                }
            });
            
            // 监听错误
            xhr.addEventListener('error', (event) => {
                console.error('Upload network error:', event);
                const errorMessage = '网络错误，请检查网络连接';
                Toast.danger(errorMessage);
                reject(new Error(errorMessage));
            });
            
            // 监听超时
            xhr.addEventListener('timeout', () => {
                console.error('Upload timeout');
                const errorMessage = '上传超时，请重试';
                Toast.danger(errorMessage);
                reject(new Error(errorMessage));
            });
            
            // 监听中止
            xhr.addEventListener('abort', () => {
                console.error('Upload aborted');
                const errorMessage = '上传已取消';
                Toast.danger(errorMessage);
                reject(new Error(errorMessage));
            });
            
            // 设置超时（60秒）
            xhr.timeout = 60000;
            
            // 发送请求
            xhr.open('POST', uploadUrl);
            
            // 注意：不要手动设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
            // xhr.setRequestHeader('Content-Type', 'multipart/form-data'); // 不要设置这个
            
            xhr.setRequestHeader('Referer', referer);
            
            // 获取 token 并添加到请求头
            getStorageValue('token').then((token) => {
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }
                console.log('Sending upload request to:', uploadUrl);
                console.log('File name:', fileName);
                console.log('Base64 length:', cleanBase64.length);
                xhr.send(formData);
            }).catch((error) => {
                console.error('Token error:', error);
                // 如果没有 token，直接发送
                console.log('Sending upload request without token to:', uploadUrl);
                xhr.send(formData);
            });
        } catch (error: any) {
            const errorMessage = error.message || '上传文件失败';
            Toast.danger(errorMessage);
            reject(new Error(errorMessage));
        }
    });
}

