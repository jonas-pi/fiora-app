import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Pressable } from 'react-native';
import Triangle from '@react-native-toolkit/triangle';

import { Actions } from 'react-native-router-flux';
import Time from '../../utils/time';
import Avatar from '../../components/Avatar';
import { Message as MessageType } from '../../types/redux';
import SystemMessage from './SystemMessage';
import ImageMessage from './ImageMessage';
import TextMessage from './TextMessage';
import { getRandomColor } from '../../utils/getRandomColor';
import InviteMessage from './InviteMessage';
import { useFocus, useSelfId, useTheme } from '../../hooks/useStore';
import { deleteMessage } from '../../service';
import action from '../../state/action';

const { width: ScreenWidth } = Dimensions.get('window');

type Props = {
    message: MessageType;
    isSelf: boolean;
    shouldScroll: boolean;
    scrollToEnd: () => void;
    openImageViewer: (imageUrl: string) => void;
    onEditDraft: (text: string) => void;
    onQuoteDraft: (quoteText: string) => void;
};

function Message({
    message,
    isSelf,
    shouldScroll,
    scrollToEnd,
    openImageViewer,
    onEditDraft,
    onQuoteDraft,
}: Props) {
    const { primaryColor8 } = useTheme();
    const self = useSelfId();
    const focus = useFocus();
    const $lastTapAt = useRef(0);

    useEffect(() => {
        if (shouldScroll) {
            scrollToEnd();
        }
    }, []);

    /**
     * 撤回消息（不再长按弹窗，按产品要求改为“双击触发”）
     */
    async function revokeMessage() {
        const isSuccess = await deleteMessage(message._id);
        if (isSuccess) {
            action.deleteLinkmanMessage(focus, message._id);
        }
        return isSuccess;
    }

    /**
     * 生成“引用文本”（插入到输入框）
     * - 先用纯文本方案，最小侵入
     * - 后续如果要做 UI 引用卡片，可再升级格式
     */
    function buildQuoteText(): string {
        const name = message.from.username || message.from._id;
        const time = formatTime();
        let content = '';
        if (message.type === 'text') {
            content = message.content;
        } else if (message.type === 'image') {
            content = '[图片]';
        } else {
            content = `[${message.type}]`;
        }
        // 引用格式：头部 + 原文（多行用 > 引用块）
        const quoted = String(content)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n');
        return `引用 ${name}（${time}）：\n${quoted}\n`;
    }

    /**
     * 气泡双击交互：
     * - 自己消息：撤回；文本消息额外回填输入框进行重新编辑
     * - 他人消息：引用到输入框
     */
    async function handleBubbleDoublePress() {
        if (message.type === 'system') {
            return;
        }
        if (isSelf || message.from._id === self) {
            const ok = await revokeMessage();
            if (ok && message.type === 'text') {
                onEditDraft(message.content);
            }
        } else {
            onQuoteDraft(buildQuoteText());
        }
    }

    function handleBubblePress() {
        const now = Date.now();
        const gap = now - $lastTapAt.current;
        $lastTapAt.current = now;
        // 280ms 以内视为双击
        if (gap > 0 && gap < 280) {
            handleBubbleDoublePress();
        }
    }

    function formatTime() {
        const createTime = new Date(message.createTime);
        const nowTime = new Date();
        if (Time.isToday(nowTime, createTime)) {
            return Time.getHourMinute(createTime);
        }
        if (Time.isYesterday(nowTime, createTime)) {
            return `昨天 ${Time.getHourMinute(createTime)}`;
        }
        if (Time.isSameYear(nowTime, createTime)) {
            return `${Time.getMonthDate(createTime)} ${Time.getHourMinute(createTime)}`;
        }
        return `${Time.getYearMonthDate(createTime)} ${Time.getHourMinute(createTime)}`;
    }

    function handleClickAvatar() {
        Actions.push('userInfo', { user: message.from });
    }

    function renderContent() {
        switch (message.type) {
            case 'text': {
                return <TextMessage message={message} isSelf={isSelf} />;
            }
            case 'image': {
                return (
                    <ImageMessage
                        message={message}
                        openImageViewer={openImageViewer}
                    />
                );
            }
            case 'system': {
                return <SystemMessage message={message} />;
            }
            case 'inviteV2': {
                return <InviteMessage message={message} isSelf={isSelf} />;
            }
            case 'file':
            case 'code': {
                return (
                    <Text style={{ color: isSelf ? 'white' : '#666' }}>
                        暂未支持的消息类型[
                        {message.type}
                        ], 请在Web端查看
                    </Text>
                );
            }
            default:
                return <Text style={{ color: isSelf ? 'white' : '#666' }}>不支持的消息类型</Text>;
        }
    }

    return (
        <View style={[styles.container, isSelf && styles.containerSelf]}>
            {isSelf ? (
                <Avatar src={message.from.avatar} size={44} />
            ) : (
                <TouchableOpacity onPress={handleClickAvatar}>
                    <Avatar src={message.from.avatar} size={44} />
                </TouchableOpacity>
            )}
            <View style={[styles.info, isSelf && styles.infoSelf]}>
                <View style={[styles.nickTime, isSelf && styles.nickTimeSelf]}>
                    {!!message.from.tag && (
                        <View
                            style={[
                                styles.tag,
                                { backgroundColor: getRandomColor(message.from.tag) },
                            ]}
                        >
                            <Text style={styles.tagText}>{message.from.tag}</Text>
                        </View>
                    )}
                    <Text style={[styles.nick, isSelf ? styles.nickSelf : styles.nickOther]}>
                        {message.from.username}
                    </Text>
                    <Text style={[styles.time, isSelf && styles.timeSelf]}>{formatTime()}</Text>
                </View>
                {/* 按产品要求：撤回不再长按，改为“双击气泡”触发 */}
                <Pressable onPress={handleBubblePress}>
                    <View
                        style={[
                            styles.content,
                            { backgroundColor: isSelf ? primaryColor8 : 'white' },
                        ]}
                    >
                        {renderContent()}
                    </View>
                </Pressable>
                <View
                    style={[styles.triangle, isSelf ? styles.triangleSelf : styles.triangleOther]}
                >
                    <Triangle
                        type="isosceles"
                        mode={isSelf ? 'right' : 'left'}
                        base={10}
                        height={5}
                        color={isSelf ? primaryColor8 : 'white'}
                    />
                </View>
            </View>
        </View>
    );
}

export default React.memo(Message);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginBottom: 6,
        paddingLeft: 8,
        paddingRight: 8,
    },
    containerSelf: {
        flexDirection: 'row-reverse',
    },
    info: {
        position: 'relative',
        marginLeft: 8,
        marginRight: 8,
        maxWidth: ScreenWidth - 120,
        alignItems: 'flex-start',
    },
    infoSelf: {
        alignItems: 'flex-end',
    },
    nickTime: {
        flexDirection: 'row',
    },
    nickTimeSelf: {
        flexDirection: 'row-reverse',
    },
    nick: {
        fontSize: 13,
        color: '#333',
    },
    nickSelf: {
        marginRight: 4,
    },
    nickOther: {
        marginLeft: 4,
    },
    time: {
        fontSize: 12,
        color: '#666',
        marginLeft: 4,
    },
    timeSelf: {
        marginRight: 4,
    },
    content: {
        marginTop: 3,
        borderRadius: 6,
        padding: 5,
        paddingLeft: 8,
        paddingRight: 8,
        backgroundColor: 'white',
        minHeight: 26,
        minWidth: 20,
        marginBottom: 6,
    },
    triangle: {
        position: 'absolute',
        top: 25,
    },
    triangleSelf: {
        right: -5,
    },
    triangleOther: {
        left: -5,
    },
    tag: {
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3,
        paddingRight: 3,
        borderRadius: 3,
    },
    tagText: {
        fontSize: 11,
        color: 'white',
    },
});
