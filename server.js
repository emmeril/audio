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

// Data struktur untuk melacak ruangan aktif
const activeRooms = new Map(); // roomId -> { users: Set, hasSharing: boolean, owner: socketId }

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeRooms: Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing,
      owner: data.owner
    }))
  });
});

// Helper function untuk broadcast daftar ruangan aktif
function broadcastActiveRooms() {
  const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
    roomId,
    userCount: data.users.size,
    hasSharing: data.hasSharing
  }));
  
  // Kirim ke semua connected client
  io.emit('active-rooms-list', roomsList);
}

// Socket.io handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  // Kirim daftar ruangan aktif saat pertama konek
  setTimeout(() => {
    const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing
    }));
    socket.emit('active-rooms-list', roomsList);
  }, 100);
  
  // Join room
  socket.on('join-room', (roomId) => {
    try {
      // Leave existing rooms except self
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room !== socket.roomId) {
          socket.leave(room);
          
          // Update active rooms data jika keluar dari room
          if (activeRooms.has(room)) {
            const roomData = activeRooms.get(room);
            roomData.users.delete(socket.id);
            
            // Hapus room jika kosong
            if (roomData.users.size === 0) {
              activeRooms.delete(room);
            }
            
            broadcastActiveRooms();
          }
        }
      });
      
      // Join new room
      socket.join(roomId);
      socket.roomId = roomId;
      
      // Update active rooms data
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, {
          users: new Set([socket.id]),
          hasSharing: false,
          owner: socket.id
        });
      } else {
        const roomData = activeRooms.get(roomId);
        roomData.users.add(socket.id);
      }
      
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
      
      // Broadcast update active rooms
      broadcastActiveRooms();
      
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
  
  // User is sharing screen
  socket.on('sharing-started', () => {
    if (socket.roomId) {
      // Update room status to has sharing
      if (activeRooms.has(socket.roomId)) {
        const roomData = activeRooms.get(socket.roomId);
        roomData.hasSharing = true;
        broadcastActiveRooms();
      }
      
      socket.to(socket.roomId).emit('user-sharing-started', socket.id);
    }
  });
  
  // User stopped sharing
  socket.on('sharing-stopped', () => {
    if (socket.roomId) {
      // Update room status to no sharing
      if (activeRooms.has(socket.roomId)) {
        const roomData = activeRooms.get(socket.roomId);
        roomData.hasSharing = false;
        broadcastActiveRooms();
      }
      
      socket.to(socket.roomId).emit('user-sharing-stopped', socket.id);
    }
  });
  
  // Leave room
  socket.on('leave-room', () => {
    if (socket.roomId) {
      const roomId = socket.roomId;
      socket.leave(roomId);
      socket.to(roomId).emit('user-disconnected', socket.id);
      console.log(`🚪 User ${socket.id} left room ${roomId}`);
      
      // Update active rooms data
      if (activeRooms.has(roomId)) {
        const roomData = activeRooms.get(roomId);
        roomData.users.delete(socket.id);
        
        // Hapus room jika kosong
        if (roomData.users.size === 0) {
          activeRooms.delete(roomId);
        } else {
          // Update sharing status jika owner keluar
          if (roomData.owner === socket.id && roomData.users.size > 0) {
            // Set owner baru ke user pertama
            roomData.owner = Array.from(roomData.users)[0];
          }
        }
        
        broadcastActiveRooms();
      }
      
      socket.roomId = null;
    }
  });
  
  // Request active rooms list
  socket.on('get-active-rooms', () => {
    const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing
    }));
    socket.emit('active-rooms-list', roomsList);
  });
  
  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id}, Reason: ${reason}`);
    
    // Cleanup room
    if (socket.roomId) {
      const roomId = socket.roomId;
      
      // Update active rooms data
      if (activeRooms.has(roomId)) {
        const roomData = activeRooms.get(roomId);
        roomData.users.delete(socket.id);
        
        // Hapus room jika kosong
        if (roomData.users.size === 0) {
          activeRooms.delete(roomId);
        } else {
          // Update sharing status jika owner disconnect
          if (roomData.owner === socket.id && roomData.users.size > 0) {
            // Set owner baru ke user pertama
            roomData.owner = Array.from(roomData.users)[0];
          }
        }
        
        broadcastActiveRooms();
      }
      
      socket.to(roomId).emit('user-disconnected', socket.id);
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
  console.log(`   4. Fitur baru: Lihat ruangan aktif dan join dengan klik!`);
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