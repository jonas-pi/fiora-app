import fetch from './fetch';
import Toast from '../components/Toast';

/**
 * 上传文件
 * 使用 Socket.IO 上传文件（与服务端保持一致）
 * @param blob 文件blob数据或base64字符串
 * @param fileName 文件名
 * @param isBase64 是否为base64格式
 */
export default async function uploadFile(
    blob: Blob | string,
    fileName: string,
    isBase64 = false,
): Promise<string> {
    try {
        // 处理 base64 数据
        let base64Data: string;
        if (typeof blob === 'string') {
            base64Data = blob;
        } else {
            base64Data = String(blob);
        }
        
        // 移除 data URI 前缀（如果有），只保留纯 base64 数据
        // 例如：data:image/jpeg;base64,/9j/4AAQ... -> /9j/4AAQ...
        if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
        }
        
        // 清理 base64 数据：移除所有空白字符（空格、换行等）
        // 确保 base64 字符串是连续的，符合标准格式
        base64Data = base64Data.replace(/\s/g, '');
        
        // 验证 base64 数据不为空
        if (!base64Data || base64Data.length === 0) {
            throw new Error('图片数据为空');
        }
        
        // 验证 base64 格式（只包含 base64 字符：A-Z, a-z, 0-9, +, /, =）
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(base64Data)) {
            throw new Error('图片数据格式不正确');
        }
        
        // 检查 base64 数据大小（大约 10MB 限制，避免 Socket.IO 传输问题）
        // base64 编码后大小约为原文件的 4/3，所以 10MB base64 约等于 7.5MB 原图
        const maxBase64Size = 10 * 1024 * 1024; // 10MB
        if (base64Data.length > maxBase64Size) {
            throw new Error('图片太大，请选择较小的图片（建议小于 7MB）');
        }
        
        // 构建上传数据，严格按照服务端接口规范
        // 移动端格式：{ file: string (base64), fileName: string, isBase64: true }
        // 注意：file 必须是纯 base64 字符串，不包含任何前缀或换行符
        const uploadData: any = {
            file: base64Data, // 纯 base64 字符串，已清理空白字符
            fileName,
            isBase64: true, // 移动端必须为 true
        };

        // 使用 Socket.IO 上传文件
        const [uploadErr, result] = await fetch('uploadFile', uploadData, { toast: false });
        
        if (uploadErr) {
            const errorMessage = `上传图片失败: ${uploadErr}`;
            Toast.danger(errorMessage);
            throw new Error(errorMessage);
        }

        if (!result || !result.url) {
            const errorMessage = '服务器未返回文件URL';
            Toast.danger(errorMessage);
            throw new Error(errorMessage);
        }

        return result.url;
    } catch (error: any) {
        const errorMessage = error.message || '上传图片失败';
        if (!error.message) {
            Toast.danger(errorMessage);
        }
        throw error;
    }
}

export function getOSSFileUrl(url: string | number = '', process = '') {
    if (typeof url === 'number') {
        return url;
    }
    
    // 分离图片 URL 和尺寸参数（width, height）
    // message.content 格式：/ImageMessage/xxx.jpg?width=100&height=200
    const urlParts = url.split('?');
    const rawUrl = urlParts[0] || '';
    const sizeParams = urlParts[1] || ''; // width=100&height=200
    
    // 构建完整的图片 URL
    let fullUrl = '';
    if (/^\/\/cdn.suisuijiang.com/.test(rawUrl)) {
        // 旧 CDN 地址
        fullUrl = `https:${rawUrl}`;
        if (process) {
            fullUrl += `?x-oss-process=${process}`;
            if (sizeParams) {
                fullUrl += `&${sizeParams}`;
            }
        } else if (sizeParams) {
            fullUrl += `?${sizeParams}`;
        }
    } else if (rawUrl.startsWith('//')) {
        // 双斜杠开头的 URL
        fullUrl = `https:${rawUrl}`;
        if (sizeParams) {
            fullUrl += `?${sizeParams}`;
        }
    } else if (rawUrl.startsWith('/')) {
        // 相对路径转换为完整URL
        fullUrl = `https://fiora.nasforjonas.xyz${rawUrl}`;
        if (sizeParams) {
            fullUrl += `?${sizeParams}`;
        }
    } else if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        // 已经是完整 URL
        fullUrl = rawUrl;
        if (sizeParams) {
            fullUrl += `?${sizeParams}`;
        }
    } else {
        // 其他情况，直接返回
        fullUrl = url;
    }
    
    // 如果有 OSS 处理参数，需要插入到 URL 中
    if (process && fullUrl.includes('?')) {
        // 如果已经有查询参数，插入 OSS 处理参数
        fullUrl = fullUrl.replace('?', `?x-oss-process=${process}&`);
    } else if (process) {
        // 如果没有查询参数，添加 OSS 处理参数
        fullUrl += `?x-oss-process=${process}`;
    }
    
    return fullUrl;
}
