import React, { useState, useRef } from 'react';
import apiService from '../../services/apiService';

const MessageInput = ({ onSend }) => {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [file, setFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null); // For image preview
    const fileInputRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('handleSubmit called', { message, file, isSending });

        if ((!message.trim() && !file) || isSending) {
            console.log('Validation failed - empty message or already sending');
            return;
        }

        setIsSending(true);
        try {
            let attachments = [];

            // Upload file if present
            if (file) {
                console.log('📎 Uploading file:', file.name);
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const uploadResponse = await apiService.post('/chat/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });

                    console.log('✅ File uploaded:', uploadResponse);
                    attachments = [uploadResponse];
                } catch (uploadError) {
                    console.error('❌ File upload failed:', uploadError);
                    // Continue sending message even if file upload fails
                }
            }

            console.log('Calling onSend with message and attachments:', { message, attachments });
            await onSend(message, attachments);
            console.log('onSend completed successfully');
            setMessage('');
            setFile(null);
            setFilePreview(null); // Clear preview
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            // Generate preview for images
            if (selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFilePreview(reader.result);
                };
                reader.readAsDataURL(selectedFile);
            } else {
                setFilePreview(null); // No preview for non-images
            }
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // Reset file input
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-2">
            {/* File Preview - Outside container, compact */}
            {file && (
                <div className="bg-slate-100 border border-slate-300 rounded-lg p-2 flex items-center gap-2 max-h-[80px] overflow-hidden">
                    {filePreview ? (
                        <img
                            src={filePreview}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded border border-slate-300 flex-shrink-0"
                        />
                    ) : (
                        <div className="w-12 h-12 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 font-medium truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1.5 hover:bg-red-100 rounded-full text-slate-500 hover:text-red-600 transition-colors flex-shrink-0"
                        title="Remove file"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Input Row */}
            <div className="flex gap-2 items-end">
                {/* File Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0 border border-slate-300"
                    title="Attach file"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                />

                {/* Text Input */}
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    placeholder={file ? "Add a caption (optional)..." : "Type a message..."}
                    className="min-w-0 flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
                    disabled={isSending}
                />

                {/* Send Button - Large and Prominent */}
                <button
                    type="submit"
                    disabled={isSending || (!message.trim() && !file)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 font-medium flex-shrink-0"
                    title="Send message"
                >
                    {isSending ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="text-sm">Sending...</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm">Send</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default MessageInput;
