import React, { useState, useRef } from 'react';
import apiService from '../../services/apiService';

const MessageInput = ({ onSend }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [file, setFile] = useState(null);
    const fileInputRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((!message.trim() && !file) || isSending) return;

        setIsSending(true);
        try {
            let attachments = [];

            // Handle file upload first if present
            if (file) {
                const formData = new FormData();
                formData.append('file', file);

                // You'll need to add this upload method to apiService or fetch directly
                // Assuming direct fetch for now based on previous route setup
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5003'}/api/chat/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    attachments.push(data); // { url, filename, type, ... }
                }
            }

            await onSend(message, attachments);
            setMessage('');
            setFile(null);
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 relative">
            {/* File Preview */}
            {file && (
                <div className="flex items-center gap-2 bg-background p-2 rounded-md border border-border w-fit">
                    <div className="p-2 bg-primary/10 rounded">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </div>
                    <span className="text-sm truncate max-w-[200px] text-text">{file.name}</span>
                    <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="p-1 hover:bg-surface rounded-full text-textSecondary hover:text-error"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            <div className="flex gap-2 items-center">
                {/* File Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-textSecondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />

                {/* Text Input */}
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-text focus:outline-none focus:border-primary transition-colors"
                />

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={isSending || (!message.trim() && !file)}
                    className="p-3 bg-primary text-white rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                </button>
            </div>
        </form>
    );
};

export default MessageInput;
