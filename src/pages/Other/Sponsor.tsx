import { View, Text } from 'native-base';
import React from 'react';
import { StyleSheet } from 'react-native';
import Dialog from 'react-native-dialog';

type Props = {
    visible: boolean;
    onClose: () => void;
    onOK: () => void;
};

function Sponsor({ visible, onClose, onOK }: Props) {
    return (
        <Dialog.Container visible={visible}>
            <Dialog.Title>赞助</Dialog.Title>
            <Dialog.Description>
                如果你觉得这个聊天室还不错的话, 希望能赞助一下~~
            </Dialog.Description>
            <View style={styles.tipContainer}>
                <Text style={styles.tip}>请在转账备注中填写您的 fiora 账号</Text>
            </View>
            <Dialog.Button label="关闭" onPress={onClose} />
            <Dialog.Button label="赞助" onPress={onOK} />
        </Dialog.Container>
    );
}

export default Sponsor;

const styles = StyleSheet.create({
    tipContainer: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        alignItems: 'center',
    },
    tip: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
});
