import { getStorageValue, setStorageValue } from './storage';

/**
 * 自定义表情包（Sticker）数据结构
 * - url: 上传到对象存储/服务器后的可访问地址
 * - mime: 仅允许 image/*（主要是 png/jpg/jpeg/webp/gif）
 * - width/height: 用于聊天里展示时保持比例（可选，但建议存）
 */
export type StickerItem = {
    id: string;
    url: string;
    mime: string;
    width?: number;
    height?: number;
    createdAt: number;
};

/**
 * 客户端本地存储 Key
 * 注意：目前先做“本机持久化”，不依赖服务端额外接口，避免后端未上线时报错。
 * 后续服务端实现后，可以把 load/save 换成 fetch('getUserStickers') / fetch('setUserStickers') 做跨端同步。
 */
function getStickerStorageKey(userId: string) {
    return `stickers:${userId}`;
}

export async function loadStickers(userId: string): Promise<StickerItem[]> {
    try {
        const raw = await getStorageValue(getStickerStorageKey(userId));
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        // 简单数据清洗，避免旧数据导致崩溃
        return parsed
            .filter((x) => x && typeof x === 'object' && typeof x.url === 'string')
            .map((x) => ({
                id: String(x.id || x.url),
                url: String(x.url),
                mime: String(x.mime || 'image/*'),
                width: typeof x.width === 'number' ? x.width : undefined,
                height: typeof x.height === 'number' ? x.height : undefined,
                createdAt: typeof x.createdAt === 'number' ? x.createdAt : Date.now(),
            })) as StickerItem[];
    } catch {
        return [];
    }
}

export async function saveStickers(userId: string, stickers: StickerItem[]) {
    await setStorageValue(getStickerStorageKey(userId), JSON.stringify(stickers));
}

/**
 * base64 大小估算（字节）
 * base64 每 4 字符表示 3 字节，末尾可能有 '=' padding。
 */
export function estimateBase64Bytes(base64: string) {
    const len = base64.length;
    if (!len) return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((len * 3) / 4) - padding;
}

export type StickerValidateResult =
    | { ok: true; mime: string; kind: 'gif' | 'image' }
    | { ok: false; reason: string };

/**
 * 表情包校验：仅允许图片/ gif，并限制大小
 * 建议值（可按实际需求调整）：
 * - 静态图：<= 2MB
 * - GIF：<= 5MB
 */
// 大小限制（按需求调整）
// - 图片：18MB
// - GIF：20MB
export const MAX_STICKER_IMAGE_BYTES = 18 * 1024 * 1024;
export const MAX_STICKER_GIF_BYTES = 20 * 1024 * 1024;

export function validateSticker(params: {
    uri: string;
    base64: string;
}): StickerValidateResult {
    const uri = (params.uri || '').toLowerCase();
    const bytes = estimateBase64Bytes(params.base64 || '');

    // 用文件后缀做最直观的类型限制（Expo ImagePicker 目前不直接返回 mime）
    const isGif = uri.endsWith('.gif');
    const isPng = uri.endsWith('.png');
    const isJpg = uri.endsWith('.jpg') || uri.endsWith('.jpeg');
    const isWebp = uri.endsWith('.webp');

    if (!(isGif || isPng || isJpg || isWebp)) {
        return { ok: false, reason: '仅支持 png/jpg/jpeg/webp/gif 格式' };
    }

    if (isGif) {
        if (bytes > MAX_STICKER_GIF_BYTES) {
            return { ok: false, reason: `GIF 过大（最大 ${(MAX_STICKER_GIF_BYTES / 1024 / 1024).toFixed(0)}MB）` };
        }
        return { ok: true, kind: 'gif', mime: 'image/gif' };
    }

    if (bytes > MAX_STICKER_IMAGE_BYTES) {
        return { ok: false, reason: `图片过大（最大 ${(MAX_STICKER_IMAGE_BYTES / 1024 / 1024).toFixed(0)}MB）` };
    }

    // mime 仅用于元数据记录
    const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
    return { ok: true, kind: 'image', mime };
}


