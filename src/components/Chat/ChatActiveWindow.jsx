import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatActiveWindow = ({ activeChat, onBack }) => {
    const { user } = useAuth();
    const { messages, sendPublicMessage, sendPrivateMessage, sendAiMessage } = useSocket();
    const [localMessages, setLocalMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    // Filter messages for current chat
    useEffect(() => {
        console.log('🔍 ChatActiveWindow: Filtering messages', {
            totalMessages: messages?.length,
            activeChat: activeChat?.type,
            messagesArray: messages
        });

        if (!activeChat || !messages) {
            setLocalMessages([]);
            return;
        }

        const filtered = messages.filter(msg => {
            if (activeChat.type === 'public') {
                return msg.type === 'public' || !msg.type;
            } else if (activeChat.type === 'private') {
                return msg.type === 'private' && (
                    (msg.senderId === user.id && msg.recipientId === activeChat.id) ||
                    (msg.senderId === activeChat.id && msg.recipientId === user.id)
                );
            } else if (activeChat.type === 'ai') {
                return msg.type === 'ai' && (msg.senderId === user.id || msg.senderId === 'ai-bot');
            }
            return false;
        });

        console.log('✅ Filtered messages:', filtered.length, filtered);
        setLocalMessages(filtered);
    }, [messages, activeChat, user.id]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [localMessages]);

    const handleSendMessage = async (content, attachments = []) => {
        if (activeChat.type === 'public') {
            await sendPublicMessage(content, attachments);
        } else if (activeChat.type === 'ai') {
            await sendAiMessage(content, attachments);
        } else {
            await sendPrivateMessage(activeChat.id, content, attachments);
        }
    };

    if (!activeChat) {
        return (
            <div className="flex-1 flex items-center justify-center text-textSecondary">
                <p>Select a chat to start messaging</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border bg-surface px-4 flex items-center gap-3 shadow-sm">
                <button
                    onClick={onBack}
                    className="md:hidden p-2 -ml-2 text-textSecondary hover:text-text"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="relative">
                    {activeChat.type === 'public' ? (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">#</div>
                    ) : activeChat.type === 'ai' ? (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">AI</div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                            {activeChat.name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="font-bold text-text">{activeChat.name}</h2>
                    <p className="text-xs text-textSecondary">
                        {activeChat.type === 'public' ? 'Public Room' :
                            activeChat.type === 'ai' ? 'Powered by Gemini 2.5' :
                                activeChat.isOnline ? 'Active now' : 'Offline'}
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-textSecondary opacity-50">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    localMessages.map((msg, idx) => {
                        const isSequence = idx > 0 && localMessages[idx - 1].senderId === msg.senderId;
                        const isOwn = msg.senderId === user.id;
                        return (
                            <div
                                key={msg._id || idx}
                                style={{
                                    display: 'flex',
                                    width: '100%',
                                    justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                    marginTop: isSequence ? '4px' : '16px'
                                }}
                            >
                                <div style={{
                                    maxWidth: '70%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isOwn ? 'flex-end' : 'flex-start'
                                }}>
                                    {!isOwn && !isSequence && (
                                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px', marginBottom: '4px' }}>
                                            {msg.senderName || 'User'}
                                        </span>
                                    )}
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: '16px',
                                        background: isOwn ? '#4F46E5' : '#F3F4F6',
                                        color: isOwn ? 'white' : '#111827',
                                        wordBreak: 'break-word'
                                    }}>
                                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                        <div style={{
                                            fontSize: '10px',
                                            marginTop: '4px',
                                            opacity: 0.7
                                        }}>
                                            {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )
                }

                {/* Typing Indicator */}
                {isTyping && activeChat.type === 'ai' && (
                    <div className="flex w-full justify-start mt-4">
                        <div className="px-4 py-3 rounded-2xl bg-surface border border-border text-text rounded-bl-none flex items-center gap-1">
                            <span className="w-2 h-2 bg-textSecondary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-textSecondary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-textSecondary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-border bg-surface p-4">
                <MessageInput onSend={handleSendMessage} />
            </div>
        </div>
    );
};

export default ChatActiveWindow;
