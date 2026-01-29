import React, { useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

const ChatSidebar = ({ activeChat, onChatSelect, onlineUsers = [] }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('dms'); // 'dms', 'groups'
    const [searchTerm, setSearchTerm] = useState('');

    // Filter users based on search
    const filteredUsers = onlineUsers.filter(u =>
        u.id !== user.id &&
        u.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-surface border-r border-border">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <h2 className="text-xl font-bold text-text mb-4">Messages</h2>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text focus:outline-none focus:border-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Navigation Tabs (optional, can be simplified) */}
            <div className="flex p-2 gap-2 border-b border-border">
                <button
                    onClick={() => onChatSelect({ type: 'public', id: 'public', name: 'Public Chat' })}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeChat.id === 'public'
                        ? 'bg-primary/10 text-primary'
                        : 'text-textSecondary hover:bg-background'
                        }`}
                >
                    Public
                </button>
                <div className="w-[1px] bg-border my-1"></div>
                <button
                    onClick={() => setActiveTab('dms')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'dms' && activeChat.id !== 'public'
                        ? 'bg-primary/10 text-primary'
                        : 'text-textSecondary hover:bg-background'
                        }`}
                >
                    Users ({filteredUsers.length})
                </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto">
                {/* Public Chat Item */}
                <div
                    onClick={() => onChatSelect({ type: 'public', id: 'public', name: 'Public Chat' })}
                    className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-background transition-colors ${activeChat.id === 'public' ? 'bg-primary/5 border-l-4 border-primary' : ''
                        }`}
                >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        #
                    </div>
                    <div>
                        <h3 className="font-semibold text-text">Public Chat</h3>
                        <p className="text-xs text-textSecondary">Global room for all users</p>
                    </div>
                </div>

                <div className="px-4 py-2 text-xs font-semibold text-textSecondary uppercase tracking-wider mt-4">
                    Assistant
                </div>

                <div
                    onClick={() => onChatSelect({ type: 'ai', id: 'ai-bot', name: 'NeuroTrace AI', isOnline: true })}
                    className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-background transition-colors ${activeChat.id === 'ai-bot' ? 'bg-primary/5 border-l-4 border-primary' : ''
                        }`}
                >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                        AI
                    </div>
                    <div>
                        <h3 className="font-semibold text-text">NeuroTrace AI</h3>
                        <p className="text-xs text-textSecondary">Always here to help</p>
                    </div>
                </div>

                <div className="px-4 py-2 text-xs font-semibold text-textSecondary uppercase tracking-wider mt-4">
                    Online Users
                </div>

                {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-textSecondary text-sm">
                        No users found
                    </div>
                ) : (
                    filteredUsers.map(u => (
                        <div
                            key={u.id}
                            onClick={() => onChatSelect({ type: 'private', id: u.id, name: u.name, isOnline: true })}
                            className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-background transition-colors ${activeChat.id === u.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                                }`}
                        >
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-surface"></span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-text truncate">{u.name}</h3>
                                <p className="text-xs text-textSecondary truncate">Online</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;
