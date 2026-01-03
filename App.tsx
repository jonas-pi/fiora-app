/* eslint-disable react/jsx-props-no-spreading */
import React from 'react';
import { Provider } from 'react-redux';
import { LogBox } from 'react-native';
import App from './src/App';
import store from './src/state/store';

// 忽略来自第三方库的警告和错误
// 1. native-base 的 Roboto 字体警告（在 Expo 中会自动处理）
// 2. react-native-router-flux 的导航选项弃用警告
// 3. react-native-dialog 的 prop type 警告（已修复，但保留以防万一）
// 4. 重复 key 警告（已在 reducer 和组件中修复，但保留以防万一）
// 5. react-native-router-flux 的 tabStyle prop type 警告（第三方库问题）
// 6. react-native-router-flux 的 transitionConfig 弃用警告（第三方库问题）
LogBox.ignoreLogs([
    'fontFamily "Roboto_medium" is not a system font',
    "Deprecation in 'navigationOptions': 'header: null'",
    'header: null',
    "Invalid prop 'children' of type array supplied to 'DialogDescription'",
    'Encountered two children with the same key',
    "Invalid prop 'tabStyle' of type array supplied to 'DefaultTabBar'",
    'Failed prop type: Invalid prop tabStyle',
    "Failed prop type: Invalid prop tabStyle of type array",
    'tabStyle',
    "Deprecation in 'createStackNavigator'",
    "transitionConfig' is removed in favor of the new animation APIs",
]);

export default function Main(props: any) {
    return (
        <Provider store={store}>
            <App {...props} />
        </Provider>
    );
};
