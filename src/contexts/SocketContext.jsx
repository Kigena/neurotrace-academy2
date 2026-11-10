import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import { showNotification, updateDocumentTitle, requestNotificationPermission } from '../utils/notifications';
import chatService from '../services/chatService';

const SocketContext = createContext();

// Hook co-located with its provider (imported app-wide); only affects HMR granularity.
// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const messagesRef = useRef([]);
    const [messagesTrigger, setMessagesTrigger] = useState(0); // Trigger re-renders
    const [isConnected, setIsConnected] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({}); // { chatId: count }
    const [activeChatId, setActiveChatId] = useState(null); // Track which chat is currently open

    // Use a ref for messages to avoid dependency cycles in useEffect listeners if needed, 
    // but functional updates setMessages(prev => ...) are usually sufficient.
    const socketInitialized = useRef(false);

    // Helper to add message and trigger re-render (with duplicate prevention)
    const addMessage = (message) => {
        // Check if message already exists (by _id or temp id)
        const exists = messagesRef.current.some(m =>
            (m._id && message._id && m._id.toString() === message._id.toString()) ||
            (m._id && m._id.toString().startsWith('temp-') && m.content === message.content && m.senderId === message.senderId)
        );

        if (exists) {
            console.log('⚠️ Message already exists, skipping:', message._id);
            return;
        }

        console.log('📨 Adding message to ref:', message);
        messagesRef.current = [...messagesRef.current, message];
        console.log('📊 Total messages in ref:', messagesRef.current.length);
        setMessagesTrigger(prev => {
            const newTrigger = prev + 1;
            console.log('🔔 Triggering re-render:', newTrigger);
            return newTrigger;
        });
    };

    useEffect(() => {
        if (!user || !user.id) {
            console.log('⏸️ Waiting for user to be fully loaded');
            return;
        }

        // Prevent re-initialization if socket is already set up for this user
        if (socketInitialized.current && socket) {
            console.log('✅ Socket already initialized, skipping re-creation');
            return;
        }

        console.log('🔌 Initializing socket for user:', user.id);
        socketInitialized.current = true;

        // Initialize Socket
        // Socket.IO connects to base URL, not the /api endpoint
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5003';
        const socketUrl = apiUrl.replace('/api', ''); // Remove /api suffix for socket connection

        console.log('🔌 Connecting socket to:', socketUrl);

        // The server authenticates the socket from this token and derives the
        // user's identity itself; client-sent user ids are ignored.
        // Polling first, then upgrade to WebSocket: the hosted API sleeps when
        // idle and takes ~30-60 s to wake. An HTTP poll waits out the wake-up,
        // whereas each failed raw WebSocket attempt logs a browser error.
        // Keep retrying with backoff instead of giving up after a few tries.
        const newSocket = io(socketUrl, {
            auth: (cb) => cb({ token: localStorage.getItem('token') }),
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            randomizationFactor: 0.5,
            timeout: 60000
        });
        let failedAttempts = 0;

        newSocket.on('connect', () => {
            console.log(failedAttempts ? `Socket connected after ${failedAttempts} retries` : 'Socket connected');
            failedAttempts = 0;
            setIsConnected(true);
            newSocket.emit('user:online', { userId: user.id, userName: user.name });
        });

        newSocket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            setIsConnected(false);

            // Auto-reconnect for certain disconnect reasons
            if (reason === 'io server disconnect') {
                // Server disconnected, manually reconnect
                console.log('🔄 Server disconnected, attempting reconnect...');
                setTimeout(() => newSocket.connect(), 1000);
            }
        });

        newSocket.on('connect_error', (error) => {
            failedAttempts += 1;
            setIsConnected(false);
            // One line while the server wakes up, then only occasionally.
            if (failedAttempts === 1) console.warn('Realtime server not reachable yet (it may be waking up); retrying…');
            else if (failedAttempts % 10 === 0) console.warn(`Realtime server still unreachable after ${failedAttempts} attempts:`, error.message);
        });

        // Reconnection events are emitted by the Manager (socket.io v4), not the socket.
        newSocket.io.on('reconnect', () => {
            setIsConnected(true);
            // Re-announce user online status
            newSocket.emit('user:online', { userId: user.id, userName: user.name });
        });

        newSocket.on('users:online', (users) => {
            setOnlineUsers(users);
        });

        newSocket.on('message:received', (message) => {
            console.log('message:received event', message);
            addMessage(message);

            // Determine chat ID for this message
            const chatId = message.type === 'private'
                ? message.senderId  // For private messages, use sender's ID
                : 'public';

            // Only increment unread and notify if this chat is not currently active
            if (chatId !== activeChatId) {
                // Increment unread count
                setUnreadCounts(prev => ({
                    ...prev,
                    [chatId]: (prev[chatId] || 0) + 1
                }));

                // Show browser notification
                const title = message.type === 'private'
                    ? `${message.senderName}`
                    : 'Community room';

                showNotification(
                    title,
                    message.content.substring(0, 100),
                    () => {
                        // Focus window and open chat when notification clicked
                        window.focus();
                        // You can add logic here to switch to this chat
                    }
                );
            }
        });

        newSocket.on('message:public', (message) => {
            console.log('message:public event', message);
            addMessage(message);
        });

        newSocket.on('message:group', (message) => {
            console.log('message:group event', message);
            addMessage(message);
        });

        // Confirmation of own message sent (if not optimistically added)
        newSocket.on('message:sent', (message) => {
            console.log('message:sent event', message);
            // Replace optimistic message with server-confirmed one
            const tempIndex = messagesRef.current.findIndex(m =>
                m._id && m._id.toString().startsWith('temp-') &&
                m.content === message.content &&
                m.senderId === message.senderId
            );

            if (tempIndex !== -1) {
                // Replace temp message with real one
                messagesRef.current[tempIndex] = message;
                setMessagesTrigger(prev => prev + 1);
                console.log('✅ Replaced temp message with server-confirmed message');
            } else if (!messagesRef.current.some(m => m._id === message._id)) {
                // Only add if not already present
                addMessage(message);
            }
        });

        setSocket(newSocket);

        // Cleanup
        return () => {
            console.log('🔌 Socket cleanup - closing connection');
            newSocket.close();
        };
    }, [user?.id]); // Only re-run if user ID changes, not the entire user object

    // --- Actions ---

    const sendPrivateMessage = (recipientId, content, attachments = []) => {
        if (!socket) return;

        console.log('📤 sendPrivateMessage called', { recipientId, content, attachments });

        const msgData = {
            type: 'private',
            senderId: user.id,
            senderName: user.name,
            recipientId,
            content,
            attachments: attachments || [],
            timestamp: new Date(),
            _id: `temp-${Date.now()}` // Temporary ID for optimistic update
        };

        // Optimistic update - add message immediately for sender
        console.log('📤 Sending private message (optimistic):', msgData);
        addMessage(msgData);

        socket.emit('message:private', msgData);
    };

    const sendPublicMessage = (content, attachments = []) => {
        console.log('sendPublicMessage called', { socket: !!socket, content, attachments, user });
        if (!socket) {
            console.error('Socket not connected!');
            return;
        }
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            content,
            attachments: attachments || []
        };
        console.log('Emitting message:public', msgData);
        socket.emit('message:public', msgData);
    };

    const sendGroupMessage = (roomId, content, attachments = []) => {
        if (!socket) return;
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            roomId,
            content,
            attachments: attachments || []
        };
        console.log('Emitting message:group', msgData);
        socket.emit('message:group', msgData);
    };

    // Load message history from database
    const loadMessageHistory = async (chatType, chatId) => {
        if (!user) return;

        try {
            console.log(`📚 Loading message history for ${chatType} chat:`, chatId);
            let messages = [];

            if (chatType === 'private') {
                messages = await chatService.getPrivateMessages(user.id, chatId);
            } else if (chatType === 'public') {
                messages = await chatService.getPublicMessages();
            }

            console.log(`✅ Loaded ${messages.length} messages from database`);

            // Replace messages in ref (don't append, replace)
            messagesRef.current = messages;
            setMessagesTrigger(prev => prev + 1);
        } catch (error) {
            console.error('Failed to load message history:', error);
        }
    };

    // Mark messages as read for a specific chat
    const markAsRead = (chatId) => {
        console.log('📖 Marking chat as read:', chatId);
        setActiveChatId(chatId);
        setUnreadCounts(prev => {
            const updated = { ...prev };
            delete updated[chatId];
            return updated;
        });

        // Update document title
        const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) - (unreadCounts[chatId] || 0);
        updateDocumentTitle(totalUnread);
    };

    // Request notification permission on mount
    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // Update document title when unread counts change
    useEffect(() => {
        const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
        updateDocumentTitle(totalUnread);
    }, [unreadCounts]);

    // Create reactive messages value that updates when messagesTrigger changes
    // IMPORTANT: Return a NEW array copy so React detects the change
    const messages = React.useMemo(() => [...messagesRef.current], [messagesTrigger]);

    // Memoize context value to ensure it updates when messages change
    const contextValue = React.useMemo(() => ({
        socket,
        messages,
        onlineUsers,
        isConnected,
        unreadCounts,
        markAsRead,
        loadMessageHistory,
        sendPrivateMessage,
        sendPublicMessage,
        sendGroupMessage
    }), [socket, messages, onlineUsers, isConnected, unreadCounts, sendPrivateMessage, sendPublicMessage, sendGroupMessage]);

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};
