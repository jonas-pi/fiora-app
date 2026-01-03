/**
 * 统一的样式常量
 * 用于保持应用内所有组件样式的一致性
 */

// 圆角半径常量
export const BORDER_RADIUS = {
    // 按钮圆角
    button: 12,
    // 输入框圆角
    input: 12,
    // 小按钮圆角
    smallButton: 8,
    // 卡片圆角
    card: 16,
    // 头像圆角（圆形）
    avatar: 999,
};

// 统一的按钮样式
export const buttonStyles = {
    borderRadius: BORDER_RADIUS.button,
    overflow: 'hidden' as const, // 确保圆角生效
};

// 统一的输入框样式
export const inputStyles = {
    borderRadius: BORDER_RADIUS.input,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 10,
};

// 统一的小按钮样式
export const smallButtonStyles = {
    borderRadius: BORDER_RADIUS.smallButton,
    overflow: 'hidden' as const,
};

