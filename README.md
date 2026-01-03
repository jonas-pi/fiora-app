# Fiora-App

Fiora 移动端应用，基于 [Expo](https://expo.io/) 和 [React Native](https://reactnative.dev/) 开发，支持 Android 和 iOS 平台。

Fiora 是一个在线聊天室应用，这是其移动端实现。更多信息请访问 [Fiora 官网](https://fiora.suisuijiang.com/)。

## 📱 功能特性

- 💬 实时聊天功能（支持文本、图片消息）
- 👥 群组聊天和私聊
- 🔍 用户和群组搜索
- 📸 图片选择和上传
- 🔔 消息通知
- 👤 用户资料管理
- 🎨 现代化 UI 设计
- 🌐 支持中文本地化

## 🛠 技术栈

- **框架**: React Native 0.63.4
- **开发工具**: Expo SDK 42
- **语言**: TypeScript
- **状态管理**: Redux
- **路由**: React Native Router Flux
- **UI 组件**: Native Base
- **实时通信**: Socket.IO Client
- **图片处理**: Expo Image Picker
- **存储**: AsyncStorage

## 📋 环境要求

### 必需环境

- **Node.js**: 16.x LTS（强烈推荐，Expo SDK 42 与 Node.js 24+ 存在兼容性问题）
- **npm** 或 **yarn**: 包管理器
- **Expo CLI**: 全局安装

### 可选环境（用于本地构建）

- **Android Studio**: 用于 Android 本地构建
- **Xcode**: 用于 iOS 本地构建（仅 macOS）

## 🚀 快速开始

### 1. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 2. 启动开发服务器

```bash
# 使用 npm
npm start

# 或使用 yarn
yarn start
```

### 3. 运行应用

启动后，根据控制台提示：

- **Android**: 按 `a` 键在 Android 模拟器或设备上运行
- **iOS**: 按 `i` 键在 iOS 模拟器上运行（仅 macOS）
- **扫描二维码**: 使用 Expo Go 应用扫描二维码在真实设备上运行

## 📦 项目结构

```
fiora-app/
├── android/                 # Android 原生代码
│   ├── app/                 # Android 应用模块
│   └── Android-Image-Cropper/ # 本地图片裁剪模块
├── src/                     # 源代码目录
│   ├── components/          # 可复用组件
│   ├── pages/              # 页面组件
│   │   ├── Chat/           # 聊天页面
│   │   ├── ChatList/       # 聊天列表
│   │   ├── LoginSignup/    # 登录注册
│   │   ├── SelfSettings/   # 个人设置
│   │   └── ...
│   ├── state/              # Redux 状态管理
│   ├── utils/              # 工具函数
│   └── types/              # TypeScript 类型定义
├── app.json                # Expo 配置文件
├── package.json            # 项目依赖配置
└── README.md              # 项目说明文档
```

## 🔧 开发指南

### 可用脚本

```bash
# 启动开发服务器
npm start

# 运行 Android 应用
npm run android

# 运行 iOS 应用（仅 macOS）
npm run ios

# 类型检查
npm run ts-check

# 代码检查
npm run lint

# 运行测试
npm test
```

### 代码规范

项目使用 ESLint 进行代码检查，遵循 Airbnb 规范。在提交代码前请运行：

```bash
npm run lint
```

### 服务器配置

默认服务器地址：`https://fiora.nasforjonas.xyz`

相关配置文件：
- `src/socket.ts` - Socket.IO 连接配置
- `src/utils/constant.ts` - HTTP Referer 配置
- `src/utils/uploadFile.ts` - 文件上传 URL 处理

## 🏗 构建应用

### Android APK 构建

#### 方法 1: 本地构建（推荐）

1. **确保已安装 Android Studio 和 Android SDK**

2. **进入 android 目录并构建**:
   ```bash
   cd android
   ./gradlew assembleRelease  # Linux/macOS
   # 或
   gradlew.bat assembleRelease  # Windows
   ```

3. **APK 文件位置**:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

#### 方法 2: 使用 EAS Build

1. **登录 Expo 账户**:
   ```bash
   npx eas-cli login
   ```

2. **构建 APK**:
   ```bash
   npx eas-cli build --platform android --profile preview
   ```

### iOS 构建

iOS 应用需要通过 TestFlight 或 App Store 分发。请联系项目维护者获取访问权限。

## ⚠️ 常见问题

### Node.js 版本兼容性

**问题**: Expo SDK 42 与 Node.js 24+ 存在兼容性问题，可能导致 Metro bundler 的 `transformFile` 错误。

**解决方案**:

1. **使用 Node.js 16 LTS**（强烈推荐）:
   ```bash
   # 使用 nvm 切换版本
   nvm install 16.20.2
   nvm use 16.20.2
   ```

2. **临时解决方案**（不推荐）:
   ```bash
   # Windows PowerShell
   $env:NODE_OPTIONS="--no-experimental-fetch --no-warnings"
   npm start -- --clear
   ```

### 端口被占用

如果 19000 端口被占用：

```powershell
# Windows: 查找占用端口的进程
netstat -ano | findstr ":19000"

# 结束进程（替换 <PID> 为实际进程ID）
taskkill /PID <PID> /F
```

### 清理缓存

如果遇到构建或运行问题，尝试清理缓存：

```bash
# 清理 Expo 缓存
rm -rf .expo
rm -rf node_modules/.cache

# 重新启动并清理缓存
npm start -- --clear --reset-cache
```

### Android 构建依赖问题

如果遇到 `android-image-cropper` 依赖问题，项目已集成本地模块解决。确保：

1. `android/Android-Image-Cropper` 目录存在
2. `android/settings.gradle` 中已配置本地模块
3. 运行 `git submodule update --init` 确保子模块已初始化

## 📥 下载应用

### Android

- **APK 下载链接**: [https://cdn.suisuijiang.com/fiora.apk](https://cdn.suisuijiang.com/fiora.apk)
- **二维码**:

![Android APK QR Code](https://cdn.suisuijiang.com/fiora/img/android-apk.21accdc3.png)

### iOS

iOS 应用正在提交 App Store 审核。您可以通过 TestFlight 安装未审核版本。请联系 **碎碎酱** 或发送邮件至 <yinxinmac@icloud.com>，并附上您的 Apple ID。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 📚 相关资源

- [Expo 文档](https://docs.expo.io/)
- [React Native 文档](https://reactnative.dev/docs/getting-started)
- [Fiora 官网](https://fiora.suisuijiang.com/)
- [构建说明文档](README-BUILD.md)

## 👥 维护者

- 碎碎酱

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 邮箱: yinxinmac@icloud.com
- GitHub Issues: [提交 Issue](https://github.com/your-repo/fiora-app/issues)

---

**注意**: 本项目使用 Expo SDK 42，建议使用 Node.js 16 LTS 版本以获得最佳兼容性。
