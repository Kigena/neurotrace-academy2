import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

const ChatActiveWindow = ({ activeChat, onBack }) => {
    const { user } = useAuth();
    const { socket, messages, sendPrivateMessage, sendPublicMessage, sendAiMessage } = useSocket();
    const messagesEndRef = useRef(null);
    const [localMessages, setLocalMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);

    // Initial typing listener
    useEffect(() => {
        if (!socket) return;

        const handleAiTyping = (status) => {
            if (activeChat.type === 'ai') {
                setIsTyping(status);
            }
        };

        socket.on('ai:typing', handleAiTyping);
        return () => socket.off('ai:typing', handleAiTyping);
    }, [socket, activeChat]);

    // Filter messages for current chat
    useEffect(() => {
        if (!activeChat) return;

        const chatMessages = messages.filter(msg => {
            if (activeChat.type === 'public') {
                return msg.type === 'public' || !msg.type; // Backward compat
            } else if (activeChat.type === 'private') {
                return (msg.type === 'private' && (
                    (msg.senderId === user.id && msg.recipientId === activeChat.id) ||
                    (msg.senderId === activeChat.id && msg.recipientId === user.id)
                ));
            } else if (activeChat.type === 'ai') {
                // Filter for AI messages for this user
                return msg.type === 'ai' && (msg.senderId === user.id || msg.senderId === 'ai-bot');
            }
            return false;
        });

        setLocalMessages(chatMessages);
    }, [messages, activeChat, user.id]);

    // Scroll to bottom
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

    if (!activeChat) return <div className="flex-1 bg-background"></div>;

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header */}
            <div className="h-16 border-b border-border bg-surface px-4 flex items-center gap-3 shadow-sm z-10">
                <button
                    onClick={onBack}
                    className="md:hidden p-2 -ml-2 text-textSecondary hover:text-text"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="relative">
                    {activeChat.type === 'public' ? (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">#</div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                            {activeChat.name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="font-bold text-text">{activeChat.name}</h2>
                    <p className="text-xs text-textSecondary">
                        {activeChat.type === 'public'
                            ? 'Public Room'
                            : activeChat.type === 'ai'
                                ? 'Powered by Gemini 2.5'
                                : activeChat.isOnline ? 'Active now' : ''}
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {localMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-textSecondary opacity-50">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        </div>
                        <p>No messages yet. Say hello!</p>
                    </div>
                ) : (
                    localMessages.map((msg, idx) => {
                        // Check if previous message was from same sender to group visually
                        const isSequence = idx > 0 && localMessages[idx - 1].senderId === msg.senderId;
                        return (
                            <MessageBubble
                                key={msg._id || idx}
                                message={msg}
                                isOwn={msg.senderId === user.id}
                                isSequence={isSequence}
                            />
                        );
                    })
                )}
                    })
                )}

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
            <div className="p-4 bg-surface border-t border-border">
                <MessageInput onSend={handleSendMessage} />
            </div>
        </div>
    );
};

export default ChatActiveWindow;
