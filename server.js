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
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users
const rooms = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('⚡ New client connected:', socket.id);

  // Create or join a room
  socket.on('join-room', (roomId, userType) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        host: null,
        listeners: new Set(),
        isStreaming: false,
        hostSocketId: null,
        createdAt: Date.now()
      });
    }
    
    const room = rooms.get(roomId);
    
    if (userType === 'host') {
      room.host = socket.id;
      room.hostSocketId = socket.id;
      console.log(`👑 Host ${socket.id} created room ${roomId}`);
      
      socket.emit('room-joined', {
        roomId: roomId,
        userType: 'host',
        isHost: true
      });
      
    } else if (userType === 'listener') {
      room.listeners.add(socket.id);
      console.log(`👂 Listener ${socket.id} joined room ${roomId}`);
      
      socket.emit('room-joined', {
        roomId: roomId,
        userType: 'listener',
        hostId: room.host,
        isStreaming: room.isStreaming
      });
      
      // Notify host about new listener
      if (room.host) {
        io.to(room.host).emit('new-listener', {
          listenerId: socket.id,
          roomId: roomId
        });
      }
    }
  });

  // Host started streaming
  socket.on('host-started-streaming', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      room.isStreaming = true;
      room.startedAt = Date.now();
      console.log(`🎬 Host started streaming in room ${roomId}`);
      
      // Notify all listeners that host is streaming
      io.to(roomId).emit('host-streaming-started', {
        hostId: socket.id,
        roomId: roomId
      });
      
      // Broadcast to everyone that a new stream is available
      io.emit('streaming-room-added', {
        roomId: roomId,
        hostId: socket.id,
        listenersCount: room.listeners.size,
        startedAt: room.startedAt
      });
    }
  });

  // Host stopped streaming
  socket.on('host-stopped-streaming', (roomId) => {
    const room = rooms.get(roomId);
    if (room && room.host === socket.id) {
      room.isStreaming = false;
      console.log(`🛑 Host stopped streaming in room ${roomId}`);
      
      // Notify all listeners
      io.to(roomId).emit('host-streaming-stopped', {
        hostId: socket.id,
        roomId: roomId
      });
      
      // Broadcast that stream ended
      io.emit('streaming-room-removed', {
        roomId: roomId
      });
    }
  });

  // Get room status
  socket.on('get-room-status', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      socket.emit('room-status', {
        roomId: roomId,
        hostId: room.host,
        isStreaming: room.isStreaming,
        listenersCount: room.listeners.size,
        listeners: Array.from(room.listeners)
      });
    } else {
      socket.emit('room-status', {
        roomId: roomId,
        error: 'Room not found'
      });
    }
  });

  // Handle SDP offer from sender
  socket.on('sdp-offer', (data) => {
    const { roomId, offer, to } = data;
    console.log(`📤 Sending SDP offer from ${socket.id} to ${to}`);
    socket.to(to).emit('sdp-offer', { 
      offer: offer,
      senderId: socket.id,
      roomId: roomId 
    });
  });

  // Handle SDP answer from receiver
  socket.on('sdp-answer', (data) => {
    const { roomId, answer, to } = data;
    console.log(`📥 Sending SDP answer to ${to}`);
    socket.to(to).emit('sdp-answer', { 
      answer: answer,
      roomId: roomId
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { roomId, candidate, to } = data;
    socket.to(to).emit('ice-candidate', { 
      candidate: candidate,
      roomId: roomId
    });
  });

  // Request connection from listener
  socket.on('request-connection', (data) => {
    const { roomId, listenerId } = data;
    const room = rooms.get(roomId);
    
    if (room && room.host) {
      console.log(`🔗 ${listenerId} requesting connection from host ${room.host}`);
      io.to(room.host).emit('connection-requested', {
        listenerId: listenerId,
        roomId: roomId
      });
    }
  });

  // Get active streaming rooms
  socket.on('get-active-streams', () => {
    const activeRooms = [];
    
    for (const [roomId, room] of rooms.entries()) {
      if (room.host && room.isStreaming) {
        activeRooms.push({
          roomId: roomId,
          hostId: room.host,
          isStreaming: room.isStreaming,
          listenersCount: room.listeners.size,
          startedAt: room.startedAt || Date.now(),
          createdAt: room.createdAt
        });
      }
    }
    
    socket.emit('active-streams-list', {
      activeRooms: activeRooms,
      totalActive: activeRooms.length
    });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    
    // Clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.host === socket.id) {
        // Notify all listeners that host disconnected
        io.to(roomId).emit('host-disconnected', {
          roomId: roomId,
          hostId: socket.id
        });
        
        // Broadcast that stream ended
        if (room.isStreaming) {
          io.emit('streaming-room-removed', {
            roomId: roomId
          });
        }
        
        // Clean up room
        rooms.delete(roomId);
        console.log(`🗑️  Room ${roomId} deleted (host disconnected)`);
        break;
        
      } else if (room.listeners.has(socket.id)) {
        room.listeners.delete(socket.id);
        
        // Notify host about listener leaving
        if (room.host) {
          io.to(room.host).emit('listener-left', {
            listenerId: socket.id,
            roomId: roomId
          });
        }
        
        console.log(`👋 Listener ${socket.id} removed from room ${roomId}`);
      }
    }
  });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/sender', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sender.html'));
});

app.get('/receiver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'receiver.html'));
});

app.get('/api/room/:roomId/status', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms.get(roomId);
  
  if (room) {
    res.json({
      exists: true,
      hostId: room.host,
      isStreaming: room.isStreaming,
      listenersCount: room.listeners.size,
      startedAt: room.startedAt,
      createdAt: room.createdAt
    });
  } else {
    res.json({
      exists: false
    });
  }
});

// New endpoint: Get active streaming rooms
app.get('/api/rooms/active', (req, res) => {
  const activeRooms = [];
  
  for (const [roomId, room] of rooms.entries()) {
    if (room.host && room.isStreaming) {
      activeRooms.push({
        roomId: roomId,
        hostId: room.host,
        isStreaming: room.isStreaming,
        listenersCount: room.listeners.size,
        startedAt: room.startedAt || Date.now(),
        createdAt: room.createdAt
      });
    }
  }
  
  res.json({
    success: true,
    activeRooms: activeRooms,
    totalActive: activeRooms.length
  });
});

// New endpoint: Get server statistics
app.get('/api/stats', (req, res) => {
  const totalRooms = rooms.size;
  let totalListeners = 0;
  let activeStreams = 0;
  
  for (const [_, room] of rooms.entries()) {
    totalListeners += room.listeners.size;
    if (room.isStreaming) {
      activeStreams++;
    }
  }
  
  res.json({
    success: true,
    stats: {
      totalRooms: totalRooms,
      totalListeners: totalListeners,
      activeStreams: activeStreams,
      serverUptime: process.uptime()
    }
  });
});

const PORT = process.env.PORT || 9631;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`📱 Sender: http://localhost:${PORT}/sender`);
  console.log(`🎧 Receiver: http://localhost:${PORT}/receiver`);
});