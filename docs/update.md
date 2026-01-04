## 客户端“检查更新/下载安装”功能说明（预留服务端实现）

本文档描述 **服务端需要提供的更新清单协议**，以及客户端当前实现/后续扩展为“自动下载+安装”的路线。

### 1. 更新清单（manifest）接口

- **URL（示例）**：`https://your-domain.com/fiora-app/update/latest.json`
- **方法**：GET
- **缓存**：建议服务端返回 `Cache-Control: no-cache`，或客户端侧加版本参数避免缓存。
- **返回**：JSON

#### 1.1 JSON 字段定义

```json
{
  "version": "1.2.3",
  "build": 12,
  "title": "v1.2.3 更新",
  "notes": "1. 修复若干问题\n2. 优化性能",
  "force": false,
  "minSupportedVersion": "1.1.0",
  "android": {
    "apkUrl": "https://your-domain.com/fiora-app/apk/fiora-1.2.3.apk",
    "sha256": "可选：APK文件的sha256",
    "size": 12345678
  },
  "ios": {
    "appStoreUrl": "https://apps.apple.com/app/idxxxxxxxxx",
    "ipaUrl": "可选：企业签/自分发时使用"
  }
}
```

字段说明：
- **version**：必须。语义化版本号（x.y.z），客户端用它判断是否需要更新。
- **build**：可选。预留给同版本不同构建的区分（例如热修/渠道包）。
- **title**：可选。更新弹窗标题。
- **notes**：可选。更新说明，建议支持 `\n` 换行。
- **force**：可选。是否强制更新。为 `true` 时客户端不提供“稍后”按钮。
- **minSupportedVersion**：可选。最低支持版本（用于强更策略）。客户端后续可扩展：若当前版本 < minSupportedVersion，则强制更新。
- **android.apkUrl**：Android 必须（若希望 Android 可更新）。APK 下载地址。
- **android.sha256 / android.size**：可选。用于客户端校验下载完整性/显示大小。
- **ios.appStoreUrl**：建议提供。iOS 主流做法走 App Store 更新。
- **ios.ipaUrl**：可选。企业签/自分发时使用（实现复杂，需额外原生能力/MDM）。

### 2. 客户端当前实现（已完成）

代码位置：
- `src/utils/update.ts`：检查更新、比较版本、弹窗提示、打开更新链接
- `src/pages/Other/Other.tsx`：新增“检查更新”入口

当前行为：
- 点击“检查更新”会拉取 manifest
- 若有更新：弹窗展示 `title/notes`，点击“立即更新”会打开 `apkUrl/appStoreUrl`
- 若无更新：提示“已经是最新版本”

> 说明：当前版本是“可用的最小实现”，优点是**不需要额外原生改造**，缺点是 Android 可能需要跳转浏览器下载，再由用户手动安装。

### 3. 后续扩展：Android 真·自动下载 + 直接唤起安装（推荐路线）

要做到“下载安装新程序（应用内下载并唤起安装）”，Android 端需要具备：

#### 3.1 下载到本地文件

可选实现方式：
- 使用 `expo-file-system`（若项目是 Expo managed 且可用）
- 或引入 `react-native-file-access` / `rn-fetch-blob`（裸 RN / 需要原生配置）

要求：
- 下载到 App 私有目录（例如 cache / downloads）
- 下载过程中可上报进度（用于 UI 进度条）
- 下载完成后校验 `sha256`（如果服务端提供）

#### 3.2 通过 FileProvider 唤起 APK 安装

关键点：
- Android 7+ 不能直接使用 `file://`，必须通过 `content://` + `FileProvider`
- 需要在 `AndroidManifest.xml` 中配置 `provider`
- 需要提供 `file_paths.xml`
- 需要向安装 Intent 添加 `FLAG_GRANT_READ_URI_PERMISSION`

同时需要处理：
- Android 8+ “允许安装未知应用”权限（引导用户到系统设置打开）

#### 3.3 建议的客户端交互

- 非强更：提示更新 → 下载进度 → 下载完成 → 引导安装（或自动唤起安装）
- 强更：启动即检查 → 若必须更新则阻塞进入主界面，仅允许更新/退出

### 4. iOS 更新建议

主流做法：
- 直接跳转 App Store（`ios.appStoreUrl`）

企业签/自分发（`ipaUrl`）：
- 需要额外的分发体系（MDM/企业证书/manifest.plist），实现与合规成本高，不建议优先做。


