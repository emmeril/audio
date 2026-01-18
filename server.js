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
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.static('public'));

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeRooms: Array.from(io.sockets.adapter.rooms.keys()).filter(room => !io.sockets.adapter.rooms.get(room)?.has(room))
  });
});

// Debug endpoint
app.get('/debug', (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys())
    .filter(room => !io.sockets.adapter.rooms.get(room)?.has(room))
    .map(room => ({
      roomId: room,
      users: Array.from(io.sockets.adapter.rooms.get(room) || []),
      size: io.sockets.adapter.rooms.get(room)?.size || 0
    }));
  
  res.json({
    rooms,
    totalConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Socket.io handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // Join room
  socket.on('join-room', (roomId) => {
    try {
      // Leave existing rooms except self
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room !== socket.roomId) {
          socket.leave(room);
        }
      });
      
      // Join new room
      socket.join(roomId);
      socket.roomId = roomId;
      
      // Notify others in room
      const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
      const otherClients = Array.from(clientsInRoom || []).filter(id => id !== socket.id);
      
      otherClients.forEach(clientId => {
        socket.to(clientId).emit('user-connected', socket.id);
      });
      
      // Send user count
      const userCount = clientsInRoom ? clientsInRoom.size : 0;
      console.log(`🚪 User ${socket.id} joined room ${roomId}. Total users: ${userCount}`);
      
      socket.emit('room-joined', { 
        roomId, 
        userCount,
        users: otherClients 
      });
      
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
  
  // WebRTC signaling: offer
  socket.on('offer', (data) => {
    console.log(`📤 Offer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('offer', {
      sdp: data.sdp,
      from: socket.id,
      room: data.room
    });
  });
  
  // WebRTC signaling: answer
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('answer', {
      sdp: data.sdp,
      from: socket.id,
      room: data.room
    });
  });
  
  // WebRTC signaling: ice candidate
  socket.on('ice-candidate', (data) => {
    socket.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id,
      room: data.room
    });
  });
  
  // Leave room
  socket.on('leave-room', () => {
    if (socket.roomId) {
      const roomId = socket.roomId;
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', socket.id);
      console.log(`🚪 User ${socket.id} left room ${roomId}`);
      socket.roomId = null;
    }
  });
  
  // User is sharing screen
  socket.on('sharing-started', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-sharing-started', socket.id);
    }
  });
  
  // User stopped sharing
  socket.on('sharing-stopped', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-sharing-stopped', socket.id);
    }
  });
  
  // Audio quality changed
  socket.on('audio-quality-changed', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-audio-quality-changed', {
        userId: socket.id,
        quality: data.quality
      });
    }
  });
  
  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id}, Reason: ${reason}`);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
  
  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 9631;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎉 Screen Share App berjalan di port ${PORT}`);
  console.log(`🌐 Akses aplikasi melalui:`);
  console.log(`   • Local: http://localhost:${PORT}`);
  console.log(`   • Network: http://${getLocalIP()}:${PORT}`);
  console.log(`\n📝 Petunjuk:`);
  console.log(`   1. Buka di browser (Chrome/Edge disarankan)`);
  console.log(`   2. Buat atau gabung ruangan dengan ID yang sama`);
  console.log(`   3. Klik "Mulai Bagikan" untuk berbagi layar`);
  console.log(`   4. Audio sistem dapat diaktifkan/dinonaktifkan\n`);
});

// Helper function to get local IP
function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}