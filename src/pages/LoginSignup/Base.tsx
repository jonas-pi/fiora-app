import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { Form, Label, Button, View } from 'native-base';
import { Actions } from 'react-native-router-flux';

import PageContainer from '../../components/PageContainer';
import { buttonStyles, inputStyles } from '../../utils/styles';

type Props = {
    buttonText: string;
    jumpText: string;
    jumpPage: string;
    onSubmit: (username: string, password: string) => void;
};

export default function Base({ buttonText, jumpText, jumpPage, onSubmit }: Props) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isUsernameFocused, setIsUsernameFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const $username = useRef<TextInput>();
    const $password = useRef<TextInput>();

    function handlePress() {
        $username.current!.blur();
        $password.current!.blur();
        onSubmit(username, password);
    }

    function handleJump() {
        if (Actions[jumpPage]) {
            Actions.replace(jumpPage);
        } else {
            Alert.alert(`跳转 ${jumpPage} 失败`);
        }
    }
    return (
        <PageContainer>
            <View style={styles.container}>
                <Form>
                    <Label style={styles.label}>用户名</Label>
                    <TextInput
                        style={[styles.input, inputStyles]}
                        // @ts-ignore
                        ref={$username}
                        clearButtonMode="while-editing"
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCompleteType="username"
                        // 只有当输入框没有焦点且内容为空时才显示提示文字
                        placeholder={isUsernameFocused || username ? '' : '请输入用户名'}
                        placeholderTextColor="rgba(0, 0, 0, 0.3)"
                        onFocus={() => setIsUsernameFocused(true)}
                        onBlur={() => setIsUsernameFocused(false)}
                    />
                    <Label style={styles.label}>密码</Label>
                    <TextInput
                        style={[styles.input, inputStyles]}
                        // @ts-ignore
                        ref={$password}
                        secureTextEntry
                        clearButtonMode="while-editing"
                        onChangeText={setPassword}
                        autoCapitalize="none"
                        autoCompleteType="password"
                        // 只有当输入框没有焦点且内容为空时才显示提示文字
                        placeholder={isPasswordFocused || password ? '' : '请输入密码'}
                        placeholderTextColor="rgba(0, 0, 0, 0.3)"
                        onFocus={() => setIsPasswordFocused(true)}
                        onBlur={() => setIsPasswordFocused(false)}
                    />
                </Form>
                <Button primary block style={[styles.button, buttonStyles]} onPress={handlePress}>
                    <Text style={styles.buttonText}>{buttonText}</Text>
                </Button>
                <Button transparent style={[styles.signup, buttonStyles]} onPress={handleJump}>
                    <Text style={styles.signupText}>{jumpText}</Text>
                </Button>
            </View>
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 20,
    },
    button: {
        marginTop: 18,
    },
    buttonText: {
        fontSize: 18,
        color: '#fafafa',
    },
    signup: {
        alignSelf: 'flex-end',
    },
    signupText: {
        color: '#2a7bf6',
        fontSize: 14,
    },
    label: {
        marginBottom: 8,
    },
    input: {
        height: 48,
        fontSize: 16,
        marginBottom: 12,
    },
});
