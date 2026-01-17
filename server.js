const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store rooms and connections
const rooms = new Map();
const connections = new Map();

// Socket.io events
io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);
  
  // Create new room
  socket.on('create-room', (roomData) => {
    const roomId = roomData.roomId || generateRoomId();
    const username = roomData.username || 'Host';
    
    rooms.set(roomId, {
      host: socket.id,
      hostName: username,
      listeners: [],
      createdAt: new Date(),
      isStreaming: false
    });
    
    connections.set(socket.id, { roomId, role: 'host' });
    socket.join(roomId);
    
    console.log(`🚪 Room created: ${roomId} by ${socket.id}`);
    
    socket.emit('room-created', {
      roomId,
      hostName: username,
      message: 'Room created successfully'
    });
  });
  
  // Join existing room
  socket.on('join-room', (roomData) => {
    const { roomId, username } = roomData;
    
    if (!rooms.has(roomId)) {
      socket.emit('room-error', {
        message: 'Room not found'
      });
      return;
    }
    
    const room = rooms.get(roomId);
    
    // Add to listeners
    room.listeners.push({
      id: socket.id,
      name: username || 'Listener',
      joinedAt: new Date()
    });
    
    connections.set(socket.id, { roomId, role: 'listener' });
    socket.join(roomId);
    
    console.log(`👥 User ${socket.id} joined room ${roomId}`);
    
    // Notify host about new listener
    io.to(room.host).emit('listener-joined', {
      listenerId: socket.id,
      listenerName: username || 'Listener',
      totalListeners: room.listeners.length
    });
    
    // Send room info to listener
    socket.emit('room-joined', {
      roomId,
      hostName: room.hostName,
      totalListeners: room.listeners.length,
      isStreaming: room.isStreaming
    });
    
    // Send existing listeners to new listener
    const listenerList = room.listeners.map(l => ({
      id: l.id,
      name: l.name
    }));
    
    socket.emit('listener-list', listenerList);
  });
  
  // WebRTC Signaling - Offer
  socket.on('webrtc-offer', (data) => {
    const { to, offer, roomId } = data;
    console.log(`📤 Offer from ${socket.id} to ${to}`);
    socket.to(to).emit('webrtc-offer', {
      from: socket.id,
      offer: offer
    });
  });
  
  // WebRTC Signaling - Answer
  socket.on('webrtc-answer', (data) => {
    const { to, answer } = data;
    console.log(`📥 Answer from ${socket.id} to ${to}`);
    socket.to(to).emit('webrtc-answer', {
      from: socket.id,
      answer: answer
    });
  });
  
  // WebRTC Signaling - ICE Candidate
  socket.on('ice-candidate', (data) => {
    const { to, candidate } = data;
    socket.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate: candidate
    });
  });
  
  // Start streaming
  socket.on('start-streaming', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.host === socket.id) {
        room.isStreaming = true;
        console.log(`🎬 Streaming started in room ${roomId}`);
        
        // Notify all listeners
        io.to(roomId).emit('stream-started', {
          hostId: socket.id,
          timestamp: new Date()
        });
      }
    }
  });
  
  // Stop streaming
  socket.on('stop-streaming', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.host === socket.id) {
        room.isStreaming = false;
        console.log(`⏹️ Streaming stopped in room ${roomId}`);
        
        // Notify all listeners
        io.to(roomId).emit('stream-stopped');
      }
    }
  });
  
  // Chat message
  socket.on('send-message', (data) => {
    const { roomId, message, sender } = data;
    const timestamp = new Date().toLocaleTimeString();
    
    io.to(roomId).emit('new-message', {
      sender,
      message,
      timestamp,
      isHost: socket.id === rooms.get(roomId)?.host
    });
  });
  
  // Update user info
  socket.on('update-user', (data) => {
    const { roomId, username } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      
      if (room.host === socket.id) {
        room.hostName = username;
      } else {
        const listenerIndex = room.listeners.findIndex(l => l.id === socket.id);
        if (listenerIndex !== -1) {
          room.listeners[listenerIndex].name = username;
        }
      }
      
      io.to(roomId).emit('user-updated', {
        userId: socket.id,
        username
      });
    }
  });
  
  // Get room info
  socket.on('get-room-info', (roomId) => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      socket.emit('room-info', {
        roomId,
        hostName: room.hostName,
        totalListeners: room.listeners.length,
        isStreaming: room.isStreaming,
        createdAt: room.createdAt
      });
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    const connection = connections.get(socket.id);
    if (connection) {
      const { roomId, role } = connection;
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        
        if (role === 'host') {
          // Host disconnected - close room
          console.log(`🔒 Room ${roomId} closed (host disconnected)`);
          io.to(roomId).emit('host-disconnected');
          rooms.delete(roomId);
        } else {
          // Listener disconnected
          room.listeners = room.listeners.filter(l => l.id !== socket.id);
          
          // Notify host
          io.to(room.host).emit('listener-left', {
            listenerId: socket.id,
            totalListeners: room.listeners.length
          });
          
          // Notify other listeners
          socket.to(roomId).emit('listener-list-updated', {
            totalListeners: room.listeners.length
          });
        }
      }
      
      connections.delete(socket.id);
    }
  });
});

// Helper function to generate room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// API Routes
app.get('/api/rooms', (req, res) => {
  const roomsArray = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    hostName: room.hostName,
    totalListeners: room.listeners.length,
    isStreaming: room.isStreaming,
    createdAt: room.createdAt
  }));
  
  res.json({
    success: true,
    totalRooms: roomsArray.length,
    rooms: roomsArray
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  if (!rooms.has(roomId)) {
    return res.status(404).json({
      success: false,
      message: 'Room not found'
    });
  }
  
  const room = rooms.get(roomId);
  
  res.json({
    success: true,
    room: {
      roomId,
      hostName: room.hostName,
      totalListeners: room.listeners.length,
      isStreaming: room.isStreaming,
      createdAt: room.createdAt,
      listeners: room.listeners.map(l => ({
        id: l.id,
        name: l.name,
        joinedAt: l.joinedAt
      }))
    }
  });
});

// Serve main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sender', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});

app.get('/receiver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

// Start server
const PORT = process.env.PORT || 9631;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});