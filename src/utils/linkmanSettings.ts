/**
 * 联系人设置持久化工具
 * 用于保存和加载联系人的自定义设置（特别关心、备注、置顶等）
 */
import { getStorageValue, setStorageValue, removeStorageValue } from './storage';

const STORAGE_KEY_PREFIX = 'linkman_settings_';

/**
 * 获取联系人设置
 * @param linkmanId 联系人ID
 */
export async function getLinkmanSettings(linkmanId: string): Promise<{
    isFavorite?: boolean;
    remark?: string;
    isTop?: boolean;
} | null> {
    try {
        const data = await getStorageValue(`${STORAGE_KEY_PREFIX}${linkmanId}`);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('获取联系人设置失败:', error);
    }
    return null;
}

/**
 * 保存联系人设置
 * @param linkmanId 联系人ID
 * @param settings 设置对象
 */
export async function saveLinkmanSettings(
    linkmanId: string,
    settings: {
        isFavorite?: boolean;
        remark?: string;
        isTop?: boolean;
    },
): Promise<void> {
    try {
        // 合并现有设置
        const existing = await getLinkmanSettings(linkmanId);
        const merged = { ...existing, ...settings };
        
        // 移除 undefined 值
        Object.keys(merged).forEach((key) => {
            if (merged[key as keyof typeof merged] === undefined) {
                delete merged[key as keyof typeof merged];
            }
        });
        
        await setStorageValue(`${STORAGE_KEY_PREFIX}${linkmanId}`, JSON.stringify(merged));
    } catch (error) {
        console.error('保存联系人设置失败:', error);
    }
}

/**
 * 删除联系人设置
 * @param linkmanId 联系人ID
 */
export async function removeLinkmanSettings(linkmanId: string): Promise<void> {
    try {
        await removeStorageValue(`${STORAGE_KEY_PREFIX}${linkmanId}`);
    } catch (error) {
        console.error('删除联系人设置失败:', error);
    }
}

/**
 * 批量加载所有联系人设置
 */
export async function loadAllLinkmanSettings(): Promise<Record<string, {
    isFavorite?: boolean;
    remark?: string;
    isTop?: boolean;
}>> {
    try {
        // AsyncStorage 不支持直接获取所有 key，需要维护一个索引
        // 这里简化处理，在设置时维护一个索引列表
        const indexData = await getStorageValue(`${STORAGE_KEY_PREFIX}index`);
        if (!indexData) {
            return {};
        }
        
        const linkmanIds: string[] = JSON.parse(indexData);
        const settings: Record<string, any> = {};
        
        // 并行加载所有设置
        await Promise.all(
            linkmanIds.map(async (id) => {
                const setting = await getLinkmanSettings(id);
                if (setting) {
                    settings[id] = setting;
                }
            }),
        );
        
        return settings;
    } catch (error) {
        console.error('批量加载联系人设置失败:', error);
        return {};
    }
}

/**
 * 更新设置索引
 * @param linkmanId 联系人ID
 * @param add 是否添加（true）或删除（false）
 */
async function updateSettingsIndex(linkmanId: string, add: boolean): Promise<void> {
    try {
        const indexData = await getStorageValue(`${STORAGE_KEY_PREFIX}index`);
        let linkmanIds: string[] = indexData ? JSON.parse(indexData) : [];
        
        if (add) {
            if (!linkmanIds.includes(linkmanId)) {
                linkmanIds.push(linkmanId);
            }
        } else {
            linkmanIds = linkmanIds.filter((id) => id !== linkmanId);
        }
        
        await setStorageValue(`${STORAGE_KEY_PREFIX}index`, JSON.stringify(linkmanIds));
    } catch (error) {
        console.error('更新设置索引失败:', error);
    }
}

/**
 * 保存联系人设置（带索引更新）
 */
export async function saveLinkmanSettingsWithIndex(
    linkmanId: string,
    settings: {
        isFavorite?: boolean;
        remark?: string;
        isTop?: boolean;
    },
): Promise<void> {
    await saveLinkmanSettings(linkmanId, settings);
    await updateSettingsIndex(linkmanId, true);
}

/**
 * 删除联系人设置（带索引更新）
 */
export async function removeLinkmanSettingsWithIndex(linkmanId: string): Promise<void> {
    await removeLinkmanSettings(linkmanId);
    await updateSettingsIndex(linkmanId, false);
}

