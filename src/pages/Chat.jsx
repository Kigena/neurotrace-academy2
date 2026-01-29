import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatActiveWindow';
import { Navigate } from 'react-router-dom';

const Chat = () => {
    const { user } = useAuth();
    const { onlineUsers, socket } = useSocket();
    const [activeChat, setActiveChat] = useState({ type: 'public', id: 'public', name: 'Public Chat' });
    const [showSidebar, setShowSidebar] = useState(true); // For mobile responsiveness

    if (!user) {
        return <Navigate to="/login" />;
    }

    const handleChatSelect = (chat) => {
        setActiveChat(chat);
        // On mobile, hide sidebar after selection
        if (window.innerWidth < 768) {
            setShowSidebar(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
            {/* Sidebar - conditionally hidden on mobile */}
            <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-col border-r border-border bg-surface shrink-0 transition-all duration-300`}>
                <ChatSidebar
                    activeChat={activeChat}
                    onChatSelect={handleChatSelect}
                    onlineUsers={onlineUsers}
                />
            </div>

            {/* Main Chat Window */}
            <div className={`flex-1 flex flex-col min-w-0 ${!showSidebar ? 'flex' : 'hidden md:flex'}`}>
                <ChatWindow
                    activeChat={activeChat}
                    onBack={() => setShowSidebar(true)}
                />
            </div>
        </div>
    );
};

export default Chat;
