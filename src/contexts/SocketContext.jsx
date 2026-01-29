import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);

    // Use a ref for messages to avoid dependency cycles in useEffect listeners if needed, 
    // but functional updates setMessages(prev => ...) are usually sufficient.

    useEffect(() => {
        if (!user) return;

        // Initialize Socket
        // Use environment variable or default to window.location.origin for production if served together, 
        // or the specific backend URL.
        const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const newSocket = io(socketUrl, {
            query: { userId: user.id },
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            setIsConnected(true);
            newSocket.emit('user:online', { userId: user.id, userName: user.name });
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        newSocket.on('users:online', (users) => {
            setOnlineUsers(users);
        });

        newSocket.on('message:received', (message) => {
            setMessages(prev => [...prev, message]);
            // Optional: Play sound
        });

        newSocket.on('message:public', (message) => {
            setMessages(prev => [...prev, message]);
        });

        newSocket.on('message:group', (message) => {
            setMessages(prev => [...prev, message]);
        });

        newSocket.on('message:ai', (message) => {
            setMessages(prev => [...prev, message]);
        });

        // Confirmation of own message sent (if not optimistically added)
        newSocket.on('message:sent', (message) => {
            // Check if already added (if we do optimistic UI)
            // For now, simple append if not duplicate check
            setMessages(prev => {
                if (prev.some(m => m._id === message._id)) return prev;
                return [...prev, message];
            });
        });

        setSocket(newSocket);

        // Cleanup
        return () => {
            newSocket.close();
        };
    }, [user]);

    // --- Actions ---

    const sendPrivateMessage = (recipientId, content, attachments = []) => {
        if (!socket) return;
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            recipientId,
            content,
            attachments
        };
        // Optimistic update could happen here
        socket.emit('message:private', msgData);
    };

    const sendPublicMessage = (content, attachments = []) => {
        if (!socket) return;
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            content,
            attachments
        };
        socket.emit('message:public', msgData);
    };

    const sendGroupMessage = (roomId, content, attachments = []) => {
        if (!socket) return;
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            roomId,
            content,
            attachments
        };
        socket.emit('message:group', msgData);
    };

    return (
        <SocketContext.Provider value={{
            socket,
            onlineUsers,
            messages,
            isConnected,
            sendPrivateMessage,
            sendPublicMessage,
            sendGroupMessage,
            sendAiMessage,
            setMessages // Allow initial history load to populate this
        }}>
            {children}
        </SocketContext.Provider>
    );
};
