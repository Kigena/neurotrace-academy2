import React from 'react';
import { format } from 'date-fns'; // You might need to install date-fns or use native Date

const MessageBubble = ({ message, isOwn, isSequence }) => {
    // Helper to format time
    const formatTime = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    return (
        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${isSequence ? 'mt-1' : 'mt-4'}`}>
            <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Sender Name (only if not own and not sequence) */}
                {!isOwn && !isSequence && (
                    <span className="text-xs text-textSecondary ml-2 mb-1">{message.senderName || 'User'}</span>
                )}

                {/* Bubble */}
                <div
                    className={`px-4 py-2 rounded-2xl break-words relative group ${isOwn
                            ? 'bg-primary text-white rounded-br-none'
                            : 'bg-surface border border-border text-text rounded-bl-none'
                        }`}
                >
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                            {message.attachments.map((file, idx) => (
                                <div key={idx} className="bg-black/10 rounded p-1 overflow-hidden">
                                    {file.type === 'image' ? (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                                            <img src={file.url} alt="attachment" className="max-w-full rounded h-auto max-h-60 object-contain" />
                                        </a>
                                    ) : (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 hover:bg-black/5 transition-colors rounded">
                                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                            <span className="text-sm underline truncate">{file.filename}</span>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Timestamp & Status */}
                    <div className={`text-[10px] flex items-center gap-1 mt-1 opacity-70 ${isOwn ? 'justify-end text-white/90' : 'text-textSecondary'}`}>
                        <span>{formatTime(message.timestamp || message.createdAt)}</span>
                        {isOwn && (
                            <span>
                                {message.read ? (
                                    <span className="text-blue-200">✓✓</span>
                                ) : (
                                    <span>✓</span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
