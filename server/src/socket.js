import { Server } from 'socket.io';
import Message from './models/Message.js';
import ChatRoom from './models/ChatRoom.js';
import geminiService from './services/gemini.js';

// Store online users: Map<userId, { socketId, name, lastSeen }>
const onlineUsers = new Map();

// Store typing status: Map<roomId, Set<userId>>
const typingUsers = new Map();

export const initializeSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || ['http://localhost:5002', 'https://neurotrace-academy2.vercel.app'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        maxHttpBufferSize: 1e7 // 10MB for file uploads
    });

    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id);

        // User comes online
        socket.on('user:online', async ({ userId, userName }) => {
            onlineUsers.set(userId, {
                socketId: socket.id,
                name: userName,
                lastSeen: new Date()
            });

            // Join user's personal room
            socket.join(`user:${userId}`);

            // Join all group rooms user is part of
            const rooms = await ChatRoom.find({
                'participants.userId': userId,
                isActive: true
            });

            rooms.forEach(room => {
                socket.join(`room:${room._id}`);
            });

            // Broadcast updated online users list
            io.emit('users:online', Array.from(onlineUsers.entries()).map(([id, data]) => ({
                id,
                name: data.name,
                lastSeen: data.lastSeen
            })));

            console.log(`✅ ${userName} is online`);
        });

        // Private message
        socket.on('message:private', async ({ senderId, senderName, recipientId, content }) => {
            try {
                const message = new Message({
                    type: 'private',
                    senderId,
                    senderName,
                    recipientId,
                    content,
                    read: false
                });
                await message.save();

                // Send to recipient
                io.to(`user:${recipientId}`).emit('message:received', message);

                // Confirm to sender
                socket.emit('message:sent', message);

                console.log(`💬 Private message: ${senderName} → ${recipientId}`);
            } catch (error) {
                console.error('Private message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Public chat message
        socket.on('message:public', async ({ senderId, senderName, content }) => {
            try {
                const message = new Message({
                    type: 'public',
                    senderId,
                    senderName,
                    content,
                    roomId: null
                });
                await message.save();

                // Broadcast to all
                io.emit('message:public', message);

                console.log(`📢 Public message: ${senderName}`);
            } catch (error) {
                console.error('Public message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Group chat message
        socket.on('message:group', async ({ senderId, senderName, roomId, content, mentions }) => {
            try {
                const message = new Message({
                    type: 'group',
                    senderId,
                    senderName,
                    roomId,
                    content,
                    mentions: mentions || []
                });
                await message.save();

                // Update room's last message
                await ChatRoom.findByIdAndUpdate(roomId, {
                    lastMessage: {
                        content,
                        timestamp: message.timestamp,
                        senderId
                    }
                });

                // Broadcast to room
                io.to(`room:${roomId}`).emit('message:group', message);

                console.log(`👥 Group message: ${senderName} in room ${roomId}`);
            } catch (error) {
                console.error('Group message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // AI bot message
        socket.on('message:ai', async ({ senderId, senderName, roomId, content, userContext }) => {
            try {
                // Save user's message
                const userMessage = new Message({
                    type: 'ai',
                    senderId,
                    senderName,
                    roomId,
                    content
                });
                await userMessage.save();

                // Broadcast user message
                if (roomId) {
                    io.to(`room:${roomId}`).emit('message:ai', userMessage);
                } else {
                    io.emit('message:public', userMessage);
                }

                // Generate AI response
                socket.emit('ai:typing', true);
                const aiResponse = await geminiService.generateResponse(content, userContext);

                // Save AI response
                const aiMessage = new Message({
                    type: 'ai',
                    senderId: 'ai-bot',
                    senderName: 'EEG Assistant 🤖',
                    roomId,
                    content: aiResponse
                });
                await aiMessage.save();

                socket.emit('ai:typing', false);

                // Broadcast AI response
                if (roomId) {
                    io.to(`room:${roomId}`).emit('message:ai', aiMessage);
                } else {
                    io.emit('message:public', aiMessage);
                }

                console.log(`🤖 AI response in ${roomId || 'public'}`);
            } catch (error) {
                console.error('AI message error:', error);
                socket.emit('ai:typing', false);
                socket.emit('error', { message: 'AI assistant unavailable' });
            }
        });

        // Typing indicator
        socket.on('typing:start', ({ userId, roomId, recipientId }) => {
            if (roomId) {
                // Group chat typing
                if (!typingUsers.has(roomId)) {
                    typingUsers.set(roomId, new Set());
                }
                typingUsers.get(roomId).add(userId);
                io.to(`room:${roomId}`).emit('typing:update', {
                    roomId,
                    users: Array.from(typingUsers.get(roomId))
                });
            } else if (recipientId) {
                // Private chat typing
                io.to(`user:${recipientId}`).emit('typing:show', { userId });
            }
        });

        socket.on('typing:stop', ({ userId, roomId, recipientId }) => {
            if (roomId && typingUsers.has(roomId)) {
                typingUsers.get(roomId).delete(userId);
                io.to(`room:${roomId}`).emit('typing:update', {
                    roomId,
                    users: Array.from(typingUsers.get(roomId))
                });
            } else if (recipientId) {
                io.to(`user:${recipientId}`).emit('typing:hide', { userId });
            }
        });

        // Create group
        socket.on('room:create', async ({ creatorId, creatorName, name, description, participants }) => {
            try {
                const room = new ChatRoom({
                    name,
                    description,
                    type: 'group',
                    createdBy: creatorId,
                    participants: [
                        { userId: creatorId, role: 'admin' },
                        ...participants.map(id => ({ userId: id, role: 'member' }))
                    ]
                });
                await room.save();

                // Make all participants join the room
                [creatorId, ...participants].forEach(userId => {
                    const user = onlineUsers.get(userId);
                    if (user) {
                        io.sockets.sockets.get(user.socketId)?.join(`room:${room._id}`);
                    }
                });

                // Notify participants
                io.to(`room:${room._id}`).emit('room:created', room);

                console.log(`🏠 Group created: ${name} by ${creatorName}`);
            } catch (error) {
                console.error('Create room error:', error);
                socket.emit('error', { message: 'Failed to create group' });
            }
        });

        // Mark message as read
        socket.on('message:read', async ({ messageId, userId }) => {
            try {
                await Message.findByIdAndUpdate(messageId, {
                    read: true,
                    $push: {
                        readBy: {
                            userId,
                            readAt: new Date()
                        }
                    }
                });
            } catch (error) {
                console.error('Mark read error:', error);
            }
        });

        // React to message
        socket.on('message:react', async ({ messageId, userId, emoji }) => {
            try {
                const message = await Message.findById(messageId);

                // Remove existing reaction from this user
                message.reactions = message.reactions.filter(
                    r => r.userId.toString() !== userId
                );

                // Add new reaction
                message.reactions.push({ userId, emoji });
                await message.save();

                // Broadcast update
                if (message.type === 'group') {
                    io.to(`room:${message.roomId}`).emit('message:updated', message);
                } else if (message.type === 'private') {
                    io.to(`user:${message.recipientId}`).emit('message:updated', message);
                    io.to(`user:${message.senderId}`).emit('message:updated', message);
                } else {
                    io.emit('message:updated', message);
                }
            } catch (error) {
                console.error('React error:', error);
            }
        });

        // Disconnect
        socket.on('disconnect', () => {
            // Find and remove user
            for (const [userId, data] of onlineUsers.entries()) {
                if (data.socketId === socket.id) {
                    onlineUsers.delete(userId);

                    // Broadcast updated list
                    io.emit('users:online', Array.from(onlineUsers.entries()).map(([id, data]) => ({
                        id,
                        name: data.name,
                        lastSeen: data.lastSeen
                    })));

                    console.log(`👋 ${data.name} disconnected`);
                    break;
                }
            }
        });
    });

    return io;
};
