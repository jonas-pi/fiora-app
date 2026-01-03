# 构建说明

## 当前问题

项目使用 Expo SDK 42，与 Node.js 24 存在兼容性问题，导致 Metro bundler 的 `transformFile` 错误。

## 解决方案

### 方案 1：使用 Node.js 16 LTS（强烈推荐）

1. **下载并安装 Node.js 16 LTS**
   - 访问：https://nodejs.org/en/download/
   - 下载 Windows 安装包（16.x LTS 版本）
   - 安装后重启终端

2. **验证版本**
   ```powershell
   node --version
   # 应该显示 v16.x.x
   ```

3. **重新安装依赖并启动**
   ```powershell
   npm install
   npm start -- --clear
   ```

### 方案 2：使用 nvm-windows 管理 Node.js 版本

1. **安装 nvm-windows**
   - 下载：https://github.com/coreybutler/nvm-windows/releases
   - 安装 nvm-setup.exe

2. **安装并使用 Node.js 16**
   ```powershell
   nvm install 16.20.2
   nvm use 16.20.2
   ```

3. **重新安装依赖**
   ```powershell
   npm install
   npm start -- --clear
   ```

### 方案 3：临时使用当前 Node.js（不推荐）

如果无法切换 Node.js 版本，可以尝试：

1. 使用提供的 `start-dev.bat` 脚本启动
2. 或者手动设置环境变量：
   ```powershell
   $env:NODE_OPTIONS="--no-experimental-fetch --no-warnings"
   npm start -- --clear
   ```

## 服务器域名配置

服务器域名已更新为：`https://fiora.nasforjonas.xyz`

配置文件：
- `src/socket.ts` - Socket.IO 连接
- `src/utils/constant.ts` - HTTP Referer
- `src/utils/uploadFile.ts` - 文件 URL 处理

## 构建 APK

### 使用 EAS Build（推荐）

1. 登录 Expo 账户：
   ```powershell
   npx eas-cli login
   ```

2. 构建 APK：
   ```powershell
   npx eas-cli build --platform android --profile preview
   ```

### 本地构建

1. 安装 Android Studio
2. 生成原生项目：
   ```powershell
   npx expo prebuild
   ```
3. 在 Android Studio 中打开 `android` 文件夹并构建

## 常见问题

### Metro bundler 错误

如果遇到 `transformFile` 错误，最可靠的解决方案是切换到 Node.js 16。

### 端口被占用

```powershell
# 查找占用 19000 端口的进程
netstat -ano | findstr ":19000"

# 结束进程（替换 PID 为实际进程ID）
taskkill /PID <PID> /F
```

### 清理缓存

```powershell
# 清理所有缓存
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
npm start -- --clear --reset-cache
```

