## 表情包（Sticker）功能说明（客户端 + 服务端预留）

目标体验：类似微信“表情包”
- 用户可上传自己的表情包（图片/GIF）
- 在聊天输入框的“表情包”Tab 中展示
- 点击表情包即可发送
- 长按表情包可删除
- 第一个格子为“添加表情包”的正方形按钮

---

### 1. 客户端当前实现（已落地）

涉及文件：
- `src/pages/Chat/Input.tsx`
  - “表情包”Tab UI + 添加按钮 + 点击发送
  - 长按删除表情包（本机列表删除 + 持久化）
  - 限制上传类型/大小（只允许图片/gif）
- `src/utils/stickers.ts`
  - 表情包结构定义、校验、AsyncStorage 本地持久化

#### 1.1 存储位置（当前版本）

当前版本采用“两段式”：
1) **表情包文件本体**：上传到服务器/对象存储（复用现有 `uploadFileWithProgress` → `uploadFile` 事件）  
2) **表情包列表（元数据）**：本机 `AsyncStorage` 持久化（Key: `stickers:{userId}`）

这样做的原因：
- 服务端还没做“表情包列表管理”接口时，客户端也能跑通
- 不会因为服务端缺接口导致崩溃

后续服务端实现完成后，可以把“表情包列表”从本机改为服务端存储，实现多端同步（见第 2 节）。

#### 1.2 上传限制（客户端）

代码在 `src/utils/stickers.ts`：
- 仅允许：`png/jpg/jpeg/webp/gif`
- 大小限制（可调整）：
  - 静态图：<= 18MB
  - GIF：<= 20MB

---

### 2. 服务端推荐实现（详细）

#### 2.1 表情包放在哪里？

主流方案：
- **文件本体**：对象存储（OSS/S3/MinIO）+ CDN
- **元数据**：数据库（MySQL/PostgreSQL/MongoDB 均可）

推荐原因：
- 对象存储按量计费、便宜且可扩展
- CDN 能减少带宽压力，提高加载速度

#### 2.2 服务器压力大不大？

取决于三件事：**用户量、单用户表情包数量、单个文件大小**。

如果按“合理限额”控制，压力通常可控：
- 建议配置：
  - 单文件：静态 <= 18MB，GIF <= 20MB（客户端已限制）
  - 单用户最大数量：例如 200 个
  - 单用户总容量：例如 200MB
- 再加上 CDN 缓存命中率，回源压力会更小。

#### 2.3 数据结构（建议）

表：`stickers`
- `id` (PK)
- `userId` (索引)
- `url` / `objectKey`
- `mime` (`image/png` / `image/jpeg` / `image/webp` / `image/gif`)
- `width` / `height`（可选）
- `size`（字节）
- `sha256`（可选，用于去重）
- `createdAt` / `updatedAt`
- `isDeleted`（软删除）

#### 2.4 接口（socket 事件）建议

项目当前通过 `socket.emit(event, data, cb)` 通讯（见 `src/utils/fetch.ts`），因此建议用事件形式：

1) `getUserStickers`
- 入参：`{ }`（根据 token 识别当前用户）
- 返回：`{ stickers: StickerItem[] }`

2) `addUserSticker`
- 入参：
  - `{ url, mime, width?, height?, size?, sha256? }`
- 返回：
  - `{ sticker: StickerItem }`（包含服务端生成的 id）

3) `deleteUserSticker`
- 入参：`{ stickerId }`
- 返回：`{ success: true }`

> 说明：文件上传可继续复用现有 `uploadFile`（或新增专门的 `uploadSticker`），关键是服务端要把“表情包列表”落库，供多端同步。

#### 2.5 鉴权/安全（必须做）

- 鉴权：所有接口都必须校验 token，拿到 userId
- 文件类型限制：
  - 检查 mime + 文件 magic header（不要只靠后缀）
- 大小限制：
  - 服务端再次校验大小（客户端限制不能当安全措施）
- 频率限制：
  - 例如每分钟最多上传 10 个
- 恶意内容处理（可选）：
  - 图片鉴黄/敏感识别（看业务需求）

#### 2.6 去重与清理（推荐）

- 去重：
  - 上传后计算 `sha256`，同用户已存在则直接复用，避免重复占用空间
- 清理：
  - 软删除后延迟（如 7 天）再物理删除对象存储文件
  - 当用户超出容量/数量上限时拒绝新增

---

### 3. 客户端与服务端对接后的升级路线

当服务端实现了第 2.4 的接口后：
- 客户端启动/打开表情包 Tab 时：
  - 拉取 `getUserStickers` 同步列表
- 添加表情包时：
  - 先上传文件拿到 `url`
  - 再调用 `addUserSticker` 落库
  - 客户端本地可做缓存，但以服务端返回为准
- 删除表情包（后续可加）：
  - 调用 `deleteUserSticker`
  - 客户端列表移除


