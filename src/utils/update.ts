import { Alert, Linking, Platform } from 'react-native';
import Toast from '../components/Toast';

/**
 * 服务端更新清单（manifest）协议：详见 docs/update.md
 */
export type UpdateManifest = {
    version: string; // 例如 "1.2.3"
    build?: number; // 预留：同版本下的构建号
    title?: string; // 可选：例如 "v1.2.3 更新"
    notes?: string; // 可选：更新说明（支持多行）
    force?: boolean; // 是否强制更新
    minSupportedVersion?: string; // 最低可用版本（低于则必须更新）
    android?: {
        apkUrl: string; // 安卓 APK 下载地址
        sha256?: string; // 可选：完整性校验（后续可做）
        size?: number; // 可选：文件大小（字节）
    };
    ios?: {
        appStoreUrl?: string; // iOS 建议走商店
        ipaUrl?: string; // 预留：企业签/自分发
    };
};

// 这里先用占位域名，后续服务端上线后替换即可
export const DEFAULT_UPDATE_MANIFEST_URL = 'https://your-domain.com/fiora-app/update/latest.json';

/**
 * 语义化版本比较
 * @returns a>b => 1, a=b => 0, a<b => -1
 */
export function compareSemver(a: string, b: string) {
    const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
    const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i += 1) {
        const va = pa[i] ?? 0;
        const vb = pb[i] ?? 0;
        if (va > vb) return 1;
        if (va < vb) return -1;
    }
    return 0;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' },
            signal: controller.signal as any,
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as any;
    } finally {
        clearTimeout(timer);
    }
}

export async function checkForUpdate(params: {
    currentVersion: string;
    manifestUrl?: string;
}): Promise<{ hasUpdate: boolean; manifest?: UpdateManifest }> {
    const manifestUrl = params.manifestUrl || DEFAULT_UPDATE_MANIFEST_URL;
    const manifest = (await fetchJsonWithTimeout(manifestUrl)) as UpdateManifest;
    if (!manifest?.version) {
        throw new Error('无效的更新清单：缺少 version');
    }

    const hasUpdate = compareSemver(manifest.version, params.currentVersion) > 0;
    return { hasUpdate, manifest };
}

/**
 * 检查更新并提示用户
 * 说明：当前实现为“可用的最小版本”（打开下载链接/商店链接）
 * 后续若要做到“应用内下载 + 直接唤起安装”，请按 docs/update.md 的 Android 方案补齐原生能力。
 */
export async function checkForUpdateAndPrompt(params: {
    currentVersion: string;
    manifestUrl?: string;
}) {
    try {
        Toast.show('正在检查更新…', 'warning');
        const { hasUpdate, manifest } = await checkForUpdate(params);
        if (!hasUpdate || !manifest) {
            Toast.success('已经是最新版本');
            return;
        }

        const title = manifest.title || `发现新版本 ${manifest.version}`;
        const notes = manifest.notes || '是否立即更新？';

        const isAndroid = Platform.OS === 'android';
        const isIOS = Platform.OS === 'ios';

        const androidUrl = manifest.android?.apkUrl;
        const iosUrl = manifest.ios?.appStoreUrl || manifest.ios?.ipaUrl;

        const updateUrl = isAndroid ? androidUrl : isIOS ? iosUrl : undefined;

        const buttons: any[] = [];
        if (!manifest.force) {
            buttons.push({ text: '稍后', style: 'cancel' });
        }
        buttons.push({
            text: '立即更新',
            onPress: async () => {
                if (!updateUrl) {
                    Toast.danger('服务端未提供该平台的更新地址');
                    return;
                }
                try {
                    await Linking.openURL(updateUrl);
                } catch (e: any) {
                    Toast.danger(`打开更新地址失败: ${e?.message || e}`);
                }
            },
        });

        Alert.alert(title, notes, buttons, { cancelable: !manifest.force });
    } catch (e: any) {
        Toast.danger(`检查更新失败: ${e?.message || e}`);
    }
}


