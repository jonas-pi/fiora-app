import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Header, Item, Icon, Input } from 'native-base';
import { Actions } from 'react-native-router-flux';
import Linkman from './Linkman';
import { useLinkmans } from '../../hooks/useStore';
import { Linkman as LinkmanType } from '../../types/redux';
import PageContainer from '../../components/PageContainer';
import { search } from '../../service';
import { isiOS } from '../../utils/platform';
import { BORDER_RADIUS } from '../../utils/styles';

export default function ChatList() {
    const [searchKeywords, updateSearchKeywords] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const linkmans = useLinkmans();

    async function handleSearch() {
        const result = await search(searchKeywords);
        updateSearchKeywords('');
        Actions.push('searchResult', result);
    }

    function renderLinkman(linkman: LinkmanType) {
        const { _id: linkmanId, unread, messages, createTime } = linkman;
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

        let time = new Date(createTime);
        let preview = '暂无消息';
        if (lastMessage) {
            time = new Date(lastMessage.createTime);
            preview =
                lastMessage.type === 'text' ? `${lastMessage.content}` : `[${lastMessage.type}]`;
            if (linkman.type === 'group') {
                preview = `${lastMessage.from.username}: ${preview}`;
            }
        }
        return (
            <Linkman
                key={linkmanId}
                id={linkmanId}
                name={linkman.name}
                avatar={linkman.avatar}
                preview={preview}
                time={time}
                unread={unread}
                linkman={linkman}
                lastMessageId={lastMessage ? lastMessage._id : ''}
            />
        );
    }

    return (
        <PageContainer>
            <Header searchBar rounded noShadow style={styles.searchContainer}>
                <Item style={styles.searchItem}>
                    <Icon name="ios-search" style={styles.searchIcon} />
                    <Input
                        style={styles.searchText}
                        placeholder={isSearchFocused ? '' : '搜索群组/用户'}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        value={searchKeywords}
                        onChangeText={updateSearchKeywords}
                        onSubmitEditing={handleSearch}
                        placeholderTextColor="rgba(0, 0, 0, 0.4)"
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                    />
                </Item>
            </Header>
            <ScrollView style={styles.messageList}>
                {linkmans && linkmans.map((linkman) => renderLinkman(linkman))}
            </ScrollView>
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    messageList: {},
    searchContainer: {
        marginTop: isiOS ? 0 : 5,
        backgroundColor: 'transparent',
        height: 42,
        borderBottomWidth: 0,
        paddingLeft: 12, // 左右对称的内边距
        paddingRight: 12, // 左右对称的内边距
    },
    searchItem: {
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: BORDER_RADIUS.input, // 添加圆角（16px）
        overflow: 'hidden', // 确保圆角生效
        paddingLeft: 12, // 左边内边距（为图标留空间）
        paddingRight: 12, // 右边内边距
        flex: 1, // 占据可用空间，自动居中
        justifyContent: 'center', // 垂直居中
        alignItems: 'center', // 水平居中
        flexDirection: 'row', // 横向排列图标和输入框
    },
    searchIcon: {
        color: '#555',
        marginRight: 8, // 图标和输入框之间的间距
        width: 20, // 固定图标宽度
    },
    searchText: {
        fontSize: 14,
        flex: 1, // 占据剩余空间
        textAlign: 'center', // 文字居中
        paddingLeft: 0, // 去除左边距
        paddingRight: 20, // 右边距补偿图标宽度，使文字视觉居中
    },
});
