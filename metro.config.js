// Metro bundler 配置文件
// 用于 Expo SDK 42，使用 Node.js 16 LTS
const { getDefaultConfig } = require('expo/metro-config');

// 获取默认配置
const config = getDefaultConfig(__dirname);

// 确保所有必需的配置项都存在
config.transformer = {
    ...config.transformer,
    // 明确指定 babel transformer 路径
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
    // 确保启用 Babel RC 查找
    enableBabelRCLookup: true,
    enableBabelRuntime: true,
};

// 确保 resolver 配置正确
config.resolver = {
    ...config.resolver,
    sourceExts: config.resolver.sourceExts || ['jsx', 'js', 'ts', 'tsx', 'json'],
};

module.exports = config;

