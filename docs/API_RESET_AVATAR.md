# 重置头像功能说明

## 功能概述

移动端应用现在支持将用户头像重置为系统默认头像。当用户发送空字符串给 `changeAvatar` 接口时，服务端会自动将头像重置为默认头像（`/avatar/0.jpg`）。

## 实现方式

### 服务端实现（方案一：支持空字符串重置）

服务端的 `changeAvatar` 接口已支持空字符串重置：

- **接口名称：** `changeAvatar`
- **请求参数：** `{ avatar: "" }` （空字符串表示重置）
- **响应格式：** `{ avatar: "/avatar/0.jpg" }` （返回新的默认头像URL）

### 移动端使用方式

#### 方法一：使用 changeAvatar 函数（推荐）

```typescript
import { changeAvatar } from '../service';
import action from '../state/action';

// 重置头像为默认头像
async function resetAvatar() {
    const newAvatarUrl = await changeAvatar('');
    if (newAvatarUrl) {
        // 更新本地状态
        action.setAvatar(newAvatarUrl);
        console.log('头像已重置为:', newAvatarUrl);
    } else {
        console.error('重置头像失败');
    }
}
```

#### 方法二：直接使用 fetch

```typescript
import fetch from '../utils/fetch';
import action from '../state/action';

async function resetAvatar() {
    const [error, result] = await fetch('changeAvatar', { avatar: '' });
    if (!error && result) {
        action.setAvatar(result.avatar);
        console.log('头像已重置为:', result.avatar);
    } else {
        console.error('重置头像失败:', error);
    }
}
```

## 完整示例

以下是一个完整的组件示例，展示如何实现头像重置功能：

```typescript
import React, { useState } from 'react';
import { Button, View, Text } from 'react-native';
import { changeAvatar } from '../service';
import action from '../state/action';
import { useUser } from '../hooks/useStore';
import Toast from '../components/Toast';

function AvatarSettings() {
    const user = useUser();
    const [isResetting, setIsResetting] = useState(false);

    async function handleResetAvatar() {
        if (isResetting) {
            return;
        }

        setIsResetting(true);
        try {
            const newAvatarUrl = await changeAvatar('');
            if (newAvatarUrl) {
                // 更新本地状态
                action.setAvatar(newAvatarUrl);
                Toast.success('头像已重置为默认头像');
            } else {
                Toast.danger('重置头像失败，请重试');
            }
        } catch (error: any) {
            console.error('重置头像错误:', error);
            Toast.danger(`重置头像失败: ${error.message || '未知错误'}`);
        } finally {
            setIsResetting(false);
        }
    }

    return (
        <View>
            <Text>当前头像: {user.avatar}</Text>
            <Button 
                title={isResetting ? "重置中..." : "重置为默认头像"} 
                onPress={handleResetAvatar}
                disabled={isResetting}
            />
        </View>
    );
}
```

## 技术细节

### 服务端实现

- **文件位置：** `packages/server/src/routes/user.ts`
- **函数：** `changeAvatar`
- **逻辑：**
  1. 检查 `avatar` 参数是否为空字符串或只包含空格
  2. 如果为空，使用 `getDefaultAvatar()` 生成默认头像URL（`/avatar/0.jpg`）
  3. 如果不为空，验证并更新为用户提供的头像URL
  4. 返回新的头像URL

### 移动端实现

- **文件位置：** `src/service.ts`
- **函数：** `changeAvatar(avatar: string): Promise<string | null>`
- **返回值：**
  - 成功：返回新的头像URL字符串（如 `"/avatar/0.jpg"`）
  - 失败：返回 `null`

**代码实现：**
```typescript
/**
 * 修改用户头像
 * @param avatar 新头像链接，空字符串表示重置为默认头像
 * @returns 成功返回新的头像URL，失败返回null
 */
export async function changeAvatar(avatar: string): Promise<string | null> {
    const [error, result] = await fetch('changeAvatar', { avatar });
    if (error) {
        return null;
    }
    // 服务端返回格式：{ avatar: "/avatar/0.jpg" }
    return result?.avatar || null;
}
```

## 注意事项

1. **默认头像路径：** 默认头像固定为 `/avatar/0.jpg`，确保该文件存在于服务器
2. **向后兼容：** 此实现完全向后兼容，不影响现有的头像上传功能
3. **错误处理：** 建议在调用时添加适当的错误处理和用户提示
4. **状态同步：** 重置成功后，记得调用 `action.setAvatar()` 更新本地状态
5. **返回值使用：** 使用服务端返回的新头像URL，而不是传入的空字符串

## 测试建议

1. **测试空字符串重置：**
   ```typescript
   const result = await changeAvatar('');
   console.assert(result === '/avatar/0.jpg', '应该返回默认头像URL');
   ```

2. **测试正常头像更新：**
   ```typescript
   const result = await changeAvatar('https://example.com/avatar.jpg');
   console.assert(result === 'https://example.com/avatar.jpg', '应该返回用户提供的URL');
   ```

3. **测试错误处理：**
   ```typescript
   // 测试网络错误等情况
   try {
       const result = await changeAvatar('');
       if (!result) {
           console.error('重置失败');
       }
   } catch (error) {
       console.error('异常:', error);
   }
   ```

## 更新日志

- 2024-01-03: 实现方案一（支持空字符串重置），服务端和移动端代码已更新
- 2024-XX-XX: 更新移动端 `changeAvatar` 函数，返回头像URL而不是布尔值
