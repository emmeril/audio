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
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true
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
    activeRooms: Array.from(io.sockets.adapter.rooms.keys()).filter(room => !io.sockets.adapter.rooms.get(room)?.has(room)),
    version: '2.1.0-audio-stabilized'
  });
});

// Audio quality monitoring endpoint
app.get('/stats', (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys())
    .filter(room => !io.sockets.adapter.rooms.get(room)?.has(room))
    .map(room => ({
      roomId: room,
      userCount: io.sockets.adapter.rooms.get(room)?.size || 0,
      users: Array.from(io.sockets.adapter.rooms.get(room) || [])
    }));
  
  res.json({
    server: 'Screen Share Audio Stabilized',
    uptime: process.uptime(),
    totalConnections: io.engine.clientsCount,
    rooms: rooms,
    memory: process.memoryUsage()
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
    
    // Log audio information
    if (data.sdp.sdp && data.sdp.sdp.includes('audio')) {
      console.log(`🔊 Audio included in offer from ${socket.id}`);
      
      // Extract audio bandwidth
      const audioMatch = data.sdp.sdp.match(/b=AS:(\d+)/);
      if (audioMatch) {
        console.log(`🎚️ Audio bandwidth: ${audioMatch[1]} kbps`);
      }
      
      // Check for OPUS codec
      if (data.sdp.sdp.includes('opus')) {
        console.log(`🎵 OPUS codec detected in offer from ${socket.id}`);
      }
    }
    
    socket.to(data.to).emit('offer', {
      sdp: data.sdp,
      from: socket.id,
      room: data.room
    });
  });
  
  // WebRTC signaling: answer
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id} to ${data.to}`);
    
    // Log audio information
    if (data.sdp.sdp && data.sdp.sdp.includes('audio')) {
      console.log(`🔊 Audio included in answer from ${socket.id}`);
    }
    
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
      console.log(`📹 User ${socket.id} started sharing in room ${socket.roomId}`);
    }
  });
  
  // User stopped sharing
  socket.on('sharing-stopped', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-sharing-stopped', socket.id);
      console.log(`📹 User ${socket.id} stopped sharing in room ${socket.roomId}`);
    }
  });
  
  // Audio status update
  socket.on('audio-status', (data) => {
    console.log(`🎵 User ${socket.id} audio status: ${data.status}, volume: ${data.volume}, quality: ${data.quality}`);
  });
  
  // Audio volume update
  socket.on('audio-volume', (data) => {
    socket.to(socket.roomId).emit('remote-audio-volume', {
      userId: socket.id,
      volume: data.volume
    });
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
  console.log(`\n🎉 Screen Share App (Audio Stabilized) berjalan di port ${PORT}`);
  console.log(`🌐 Akses aplikasi melalui:`);
  console.log(`   • Local: http://localhost:${PORT}`);
  console.log(`   • Network: http://${getLocalIP()}:${PORT}`);
  console.log(`   • Stats: http://localhost:${PORT}/stats`);
  console.log(`\n📝 Fitur Audio Stabilized:`);
  console.log(`   • Volume stabil dengan compressor`);
  console.log(`   • Kontrol volume individual`);
  console.log(`   • Normalisasi audio otomatis`);
  console.log(`   • Monitoring kualitas real-time`);
  console.log(`\n🔧 Petunjuk:`);
  console.log(`   1. Gunakan Chrome untuk kualitas audio terbaik`);
  console.log(`   2. Atur volume sistem ke 70-80%`);
  console.log(`   3. Gunakan headset untuk mengurangi echo`);
  console.log(`   4. Koneksi internet stabil (min 2Mbps upload)`);
  console.log(`   5. Atur volume di kontrol aplikasi, bukan di sistem\n`);
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  io.close(() => {
    console.log('✅ Socket.IO server closed');
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  });
});