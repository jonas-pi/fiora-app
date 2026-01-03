@echo off
REM 启动 Expo 开发服务器
REM 使用兼容模式运行，以解决 Node.js 24 兼容性问题

echo 正在启动 Expo 开发服务器...
echo 注意：如果遇到错误，建议使用 Node.js 16 LTS 版本

REM 设置 Node.js 选项以增加兼容性
set NODE_OPTIONS=--no-experimental-fetch --no-warnings

REM 清理缓存并启动
call npm start -- --clear --reset-cache

pause

