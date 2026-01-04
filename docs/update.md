## 客户端“检查更新/下载安装”功能说明（预留服务端实现）

本文档描述 **服务端需要提供的更新清单协议**，以及客户端当前实现/后续扩展为“自动下载+安装”的路线。

### 1. 更新清单（manifest）接口（服务端必须提供）

- **URL（固定）**：`https://fiora.nasforjonas.xyz/fiora-app/update/latest.json`
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
- **android.apkUrl**：Android 必须（若希望 Android 可更新）。APK 下载直链地址（HTTPS）。
- **android.sha256 / android.size**：可选。用于客户端校验下载完整性/显示大小。
- **ios.appStoreUrl**：建议提供。iOS 主流做法走 App Store 更新。
- **ios.ipaUrl**：可选。企业签/自分发时使用（实现复杂，需额外原生能力/MDM）。

---

### 1.2 服务端应该如何实现（详细落地）

本节给出一个“能上线”的推荐实现方案（**最少工作量 + 可扩展**），服务端按此实现即可配合客户端工作。

#### 1.2.1 总体架构（推荐）

- **更新清单（manifest）**：一个静态 JSON 文件（`latest.json`），可部署在：
  - Nginx/静态服务器
  - 对象存储（OSS/S3/MinIO）+ CDN
  - 你现有的后端（返回 JSON）
- **安装包（Android APK）**：存放在对象存储或静态服务器上，通过 CDN 分发
- **iOS**：主流走 App Store（仅提供 `appStoreUrl`），不建议自分发 ipa（合规/成本高）

这样做的好处：
- 清单更新是“改一个 JSON”，不需要改客户端
- APK 走 CDN，带宽/并发压力很低
- 支持灰度/强更/回滚

#### 1.2.2 推荐的文件/URL 目录结构

以域名 `your-domain.com` 为例：

- **manifest**
  - `https://your-domain.com/fiora-app/update/latest.json`（客户端固定拉取这个）
  - `https://your-domain.com/fiora-app/update/history/1.2.3.json`（可选：保留历史版本）
- **apk**
  - `https://your-domain.com/fiora-app/apk/fiora-1.2.3.apk`
  - `https://your-domain.com/fiora-app/apk/fiora-1.2.3.apk.sha256`（可选：校验文件）

> 关键要求：`android.apkUrl` 必须是能被手机直接下载的 **HTTP/HTTPS 直链**（不要需要登录态/复杂跳转）。

#### 1.2.3 Manifest 生成流程（建议用 CI 自动化）

每次发版（Android）建议流程：

1) **构建 APK**
- 通过你当前构建方式产出 `fiora-<version>.apk`

2) **计算校验信息**
- `sha256`（强烈建议提供，后续客户端可做完整性校验）
- `size`（字节，便于显示下载大小）

3) **上传 APK 到存储**
- 上传到对象存储/服务器目录，得到 `apkUrl`

4) **生成并发布 `latest.json`**
- 把 `version / notes / force / android.apkUrl / sha256 / size` 写入 JSON
- 覆盖更新 `latest.json`

> 这样做可以让更新发布变成“原子操作”：只要 `latest.json` 更新了，客户端下一次检查就会生效。

#### 1.2.4 缓存与响应头（非常关键）

因为客户端会频繁拉取 `latest.json`，建议：

- `latest.json`：
  - `Cache-Control: no-cache, no-store, must-revalidate`
  - `Content-Type: application/json; charset=utf-8`
- APK 文件：
  - `Cache-Control: public, max-age=31536000, immutable`（因为文件名带版本号）
  - 支持 `Accept-Ranges: bytes`（可断点续传，体验更好）

如果你用 CDN：
- `latest.json` 走“不缓存/短缓存”，APK 走“长缓存”

#### 1.2.5 强更策略（force / minSupportedVersion）

推荐你在服务端实现两层策略：

- **force=true**：当前版本必须更新（客户端不显示“稍后”）
- **minSupportedVersion**：最低支持版本
  - 当客户端版本 < minSupportedVersion：服务端把 `force=true`，并给出清晰的 `notes`

举例：
- 如果你发现某个版本有严重 bug，可把 `minSupportedVersion` 提高到修复版，让旧版本必须更新。

#### 1.2.6 灰度发布（推荐，后续可加）

当用户量大时，建议做灰度，避免新包出问题全量炸：

- 方法 A（最简单）：在服务端维护两套清单
  - `latest.json`（稳定全量）
  - `beta.json`（灰度）
  - 客户端通过“渠道/开关”决定拉哪个（后续可扩展）

- 方法 B（服务端动态）：清单接口变成动态接口
  - `GET /fiora-app/update/latest.json?channel=stable|beta&uid=xxx`
  - 服务端按 uid hash 让一部分人命中 beta

当前客户端实现是固定 URL（静态 JSON）。如果要灰度，建议后续把 `DEFAULT_UPDATE_MANIFEST_URL` 替换为带 query 的接口即可。

#### 1.2.7 安全建议（强烈建议做）

- APK 必须来自你信任的域名（HTTPS）
- 提供 `sha256` 并在客户端下载后校验（后续实现）
- 服务端限制清单写入权限（只有 CI/管理员可更新）
- 建议对 `latest.json` 做签名（可选，防 CDN 污染/劫持）：
  - 例如加 `signature` 字段，客户端用内置公钥验签（后续再做）

#### 1.2.8 服务端参考实现（Node/Express 示例）

> 如果你不想写接口，直接用静态托管 `latest.json` 也可以。下面仅供“后端接口”方案参考。

```js
// server.js (示例)
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// latest.json 的路径（你可以用对象存储替代）
const latestPath = path.join(__dirname, 'public', 'fiora-app', 'update', 'latest.json');

app.get('/fiora-app/update/latest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(fs.readFileSync(latestPath, 'utf8'));
});

// 静态托管 APK（也可交给 Nginx/CDN）
app.use('/fiora-app/apk', express.static(path.join(__dirname, 'public', 'fiora-app', 'apk'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

app.listen(3000, () => console.log('Update server on :3000'));
```

#### 1.2.9 Nginx 静态托管示例（可直接用）

```nginx
location /fiora-app/update/latest.json {
  add_header Content-Type application/json;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
  try_files $uri =404;
}

location /fiora-app/apk/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  try_files $uri =404;
}
```

### 2. 客户端当前实现（已完成）

代码位置：
- `src/utils/update.ts`：检查更新、比较版本、弹窗提示、打开更新链接
- `src/pages/Other/Other.tsx`：新增“检查更新”入口

当前行为：
- 点击“检查更新”会拉取 manifest
- 若有更新：弹窗展示 `title/notes`，点击“立即更新”会打开 `apkUrl/appStoreUrl`
- 若无更新：提示“已经是最新版本”
 - 强更：`force=true` 或 `currentVersion < minSupportedVersion` 时，不提供“稍后”按钮

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


