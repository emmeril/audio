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

// Store YouTube Music sessions
const youtubeSessions = new Map();

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeRooms: Array.from(io.sockets.adapter.rooms.keys()).filter(room => !io.sockets.adapter.rooms.get(room)?.has(room)),
    youtubeSessions: Array.from(youtubeSessions.entries()).map(([roomId, session]) => ({
      roomId,
      hostSocketId: session.hostSocketId,
      playing: session.playing,
      volume: session.volume,
      currentTrack: session.currentTrack
    }))
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
      
      // Send YouTube session info if exists
      if (youtubeSessions.has(roomId)) {
        socket.emit('youtube-session-info', youtubeSessions.get(roomId));
        socket.emit('youtube-broadcast-status', {
          roomId,
          status: {
            hostActive: true,
            hostSocketId: youtubeSessions.get(roomId).hostSocketId,
            hostName: youtubeSessions.get(roomId).hostName || 'Host',
            playing: youtubeSessions.get(roomId).playing,
            volume: youtubeSessions.get(roomId).volume,
            currentTrack: youtubeSessions.get(roomId).currentTrack
          }
        });
      }
      
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
  
  // YouTube Music: Register host
  socket.on('register-youtube-host', (data) => {
    const { roomId, hostSocketId, hostName } = data;
    
    youtubeSessions.set(roomId, {
      hostSocketId: hostSocketId || socket.id,
      hostName: hostName || 'Host',
      playing: false,
      currentTrack: null,
      volume: 50,
      lastActive: Date.now()
    });
    
    // Notify all users in room
    io.to(roomId).emit('youtube-session-info', youtubeSessions.get(roomId));
    io.to(roomId).emit('youtube-broadcast-status', {
      roomId,
      status: {
        hostActive: true,
        hostSocketId: hostSocketId || socket.id,
        hostName: hostName || 'Host',
        playing: false,
        volume: 50,
        currentTrack: null
      }
    });
    
    console.log(`🎵 YouTube Music host registered for room ${roomId}: ${socket.id}`);
  });
  
  // YouTube Music: Unregister host
  socket.on('unregister-youtube-host', (roomId) => {
    if (youtubeSessions.has(roomId)) {
      youtubeSessions.delete(roomId);
      io.to(roomId).emit('youtube-host-disconnected');
      io.to(roomId).emit('youtube-broadcast-status', {
        roomId,
        status: {
          hostActive: false,
          playing: false,
          volume: 50,
          currentTrack: null
        }
      });
      console.log(`🎵 YouTube Music host unregistered for room ${roomId}`);
    }
  });
  
  // YouTube Music: Check host status
  socket.on('check-youtube-host', (roomId) => {
    const hasHost = youtubeSessions.has(roomId);
    
    if (hasHost) {
      const session = youtubeSessions.get(roomId);
      socket.emit('youtube-host-check-response', {
        hasHost: true,
        hostSocketId: session.hostSocketId,
        hostName: session.hostName,
        playing: session.playing,
        volume: session.volume,
        currentTrack: session.currentTrack
      });
      
      // Also send session info
      socket.emit('youtube-session-info', session);
      socket.emit('youtube-broadcast-status', {
        roomId,
        status: {
          hostActive: true,
          hostSocketId: session.hostSocketId,
          hostName: session.hostName,
          playing: session.playing,
          volume: session.volume,
          currentTrack: session.currentTrack
        }
      });
    } else {
      socket.emit('youtube-host-check-response', {
        hasHost: false
      });
      socket.emit('youtube-broadcast-status', {
        roomId,
        status: {
          hostActive: false,
          playing: false,
          volume: 50,
          currentTrack: null
        }
      });
    }
    
    console.log(`🎵 Host check for room ${roomId}: ${hasHost ? 'Has host' : 'No host'}`);
  });
  
  // YouTube Music: Control commands
  socket.on('youtube-music-control', (data) => {
    const { roomId, action, value, from } = data;
    
    console.log(`🎵 YouTube Music control from ${from}:`, action, value);
    
    if (!youtubeSessions.has(roomId)) {
      socket.emit('youtube-control-error', {
        message: 'No active YouTube host in this room'
      });
      socket.emit('youtube-broadcast-status', {
        roomId,
        status: {
          hostActive: false,
          playing: false,
          volume: 50,
          currentTrack: null
        }
      });
      return;
    }
    
    const session = youtubeSessions.get(roomId);
    
    // Update session state
    switch(action) {
      case 'play':
        session.playing = true;
        break;
      case 'pause':
        session.playing = false;
        break;
      case 'volume':
        session.volume = value;
        break;
      case 'playTrack':
        session.currentTrack = value;
        session.playing = true;
        break;
      case 'search':
        session.currentTrack = value;
        break;
      case 'next':
      case 'previous':
        session.playing = true;
        break;
    }
    
    session.lastActive = Date.now();
    
    // Forward command to host
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit('youtube-music-command', {
        action,
        value,
        from
      });
      
      // Broadcast updated status to all users in room
      io.to(roomId).emit('youtube-broadcast-status', {
        roomId,
        status: {
          hostActive: true,
          hostSocketId: session.hostSocketId,
          hostName: session.hostName,
          playing: session.playing,
          volume: session.volume,
          currentTrack: session.currentTrack
        }
      });
      
      // Send status update
      io.to(roomId).emit('youtube-status-update', {
        playing: session.playing,
        volume: session.volume,
        currentTrack: session.currentTrack
      });
      
      console.log(`🎵 YouTube Music control forwarded to host ${session.hostSocketId}`);
    }
  });
  
  // YouTube Music: Broadcast status
  socket.on('broadcast-youtube-status', (data) => {
    const { roomId, status } = data;
    
    if (youtubeSessions.has(roomId)) {
      // Update session
      const session = youtubeSessions.get(roomId);
      Object.assign(session, status);
      session.lastActive = Date.now();
      
      // Broadcast to all users
      io.to(roomId).emit('youtube-broadcast-status', {
        roomId,
        status: {
          ...status,
          hostActive: true
        }
      });
      console.log(`🎵 Broadcast YouTube status to room ${roomId}`);
    }
  });
  
  // YouTube Music: Status update from host
  socket.on('youtube-status-update', (status) => {
    if (socket.roomId && youtubeSessions.has(socket.roomId)) {
      const session = youtubeSessions.get(socket.roomId);
      
      // Update session
      session.playing = status.playing;
      session.volume = status.volume;
      session.currentTrack = status.currentTrack;
      session.lastActive = Date.now();
      
      // Broadcast to all users in room
      io.to(socket.roomId).emit('youtube-status-update', status);
      io.to(socket.roomId).emit('youtube-broadcast-status', {
        roomId: socket.roomId,
        status: {
          hostActive: true,
          hostSocketId: session.hostSocketId,
          hostName: session.hostName,
          playing: session.playing,
          volume: session.volume,
          currentTrack: session.currentTrack
        }
      });
    }
  });
  
  // Cleanup inactive sessions
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, session] of youtubeSessions.entries()) {
      // Remove sessions inactive for 10 minutes
      if (now - session.lastActive > 10 * 60 * 1000) {
        youtubeSessions.delete(roomId);
        io.to(roomId).emit('youtube-host-disconnected');
        io.to(roomId).emit('youtube-broadcast-status', {
          roomId,
          status: {
            hostActive: false,
            playing: false,
            volume: 50,
            currentTrack: null
          }
        });
        console.log(`🎵 Removed inactive YouTube session for room ${roomId}`);
      }
    }
  }, 60000);
  
  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id}, Reason: ${reason}`);
    
    // Cleanup room
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
    
    // Cleanup YouTube sessions
    for (let [roomId, session] of youtubeSessions.entries()) {
      if (session.hostSocketId === socket.id) {
        youtubeSessions.delete(roomId);
        io.to(roomId).emit('youtube-host-disconnected');
        io.to(roomId).emit('youtube-broadcast-status', {
          roomId,
          status: {
            hostActive: false,
            playing: false,
            volume: 50,
            currentTrack: null
          }
        });
        console.log(`🎵 YouTube Music session cleaned up for room ${roomId}`);
      }
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
  console.log(`   4. Aktifkan YouTube Music Remote untuk kontrol bersama`);
  console.log(`\n🎵 Fitur YouTube Music Remote:`);
  console.log(`   • Host: Aktifkan switch YouTube Music`);
  console.log(`   • User lain: Akses panel Music untuk kontrol`);
  console.log(`   • Play/Pause, Volume, Next/Previous, Search`);
  console.log(`   • Auto-reconnect setiap 5 detik\n`);
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