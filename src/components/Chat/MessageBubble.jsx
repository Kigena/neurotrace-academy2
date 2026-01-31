import React from 'react';

const MessageBubble = ({ message, isOwn, isSequence }) => {
    console.log('💬 MessageBubble component rendering:', {
        message,
        isOwn,
        isSequence,
        hasMessage: !!message,
        hasContent: !!message?.content,
        content: message?.content
    });

    const formatTime = (timestamp) => {
        try {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    console.log('💬 About to return JSX');

    return (
        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${isSequence ? 'mt-1' : 'mt-4'}`}>
            <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Sender Name */}
                {!isOwn && !isSequence && (
                    <span className="text-xs text-textSecondary ml-2 mb-1">{message.senderName || 'User'}</span>
                )}

                {/* Message Bubble */}
                <div className={`px-4 py-2 rounded-2xl break-words ${isOwn
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-surface border border-border text-gray-900 dark:text-gray-100 rounded-bl-none'
                    }`}>
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                            {message.attachments.map((file, idx) => (
                                <div key={idx} className="bg-black/10 rounded p-1">
                                    {file.type === 'image' ? (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                                            <img src={file.url} alt="attachment" className="max-w-full rounded h-auto max-h-60 object-contain" />
                                        </a>
                                    ) : (
                                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 hover:bg-black/5 rounded">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <span className="text-sm underline truncate">{file.filename}</span>
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Message Text */}
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Timestamp */}
                    <div className={`text-[10px] flex items-center gap-1 mt-1 ${isOwn ? 'justify-end text-white/70' : 'text-textSecondary'
                        }`}>
                        <span>{formatTime(message.timestamp || message.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
