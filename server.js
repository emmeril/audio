const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Perbaikan konfigurasi Socket.io dengan timeout lebih lama
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 120000,     // 2 menit (diperpanjang)
  pingInterval: 30000,     // 30 detik
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  allowUpgrades: true,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8   // 100MB buffer size
});

app.use(cors());
app.use(express.static('public'));

// Data struktur untuk melacak ruangan aktif
const activeRooms = new Map(); // roomId -> { users: Set, hasSharing: boolean, owner: socketId }
const userConnections = new Map(); // socketId -> { roomId, lastPing }

// Helper untuk membersihkan room yang mati
function cleanupStaleRooms() {
  const now = Date.now();
  const staleTimeout = 5 * 60 * 1000; // 5 menit
  
  for (const [roomId, roomData] of activeRooms.entries()) {
    // Jika room kosong, hapus
    if (roomData.users.size === 0) {
      activeRooms.delete(roomId);
      console.log(`🧹 Cleared empty room: ${roomId}`);
      continue;
    }
    
    // Hapus user yang sudah tidak aktif
    let hasInactiveUsers = false;
    for (const userId of roomData.users) {
      const userData = userConnections.get(userId);
      if (userData && now - userData.lastPing > staleTimeout) {
        roomData.users.delete(userId);
        userConnections.delete(userId);
        hasInactiveUsers = true;
        console.log(`🧹 Removed inactive user ${userId} from room ${roomId}`);
      }
    }
    
    // Update room status jika ada perubahan
    if (hasInactiveUsers) {
      if (roomData.users.size === 0) {
        activeRooms.delete(roomId);
      } else {
        // Update owner jika perlu
        if (!roomData.users.has(roomData.owner)) {
          roomData.owner = Array.from(roomData.users)[0];
        }
      }
    }
  }
  
  // Jalankan cleanup setiap 1 menit
  setTimeout(cleanupStaleRooms, 60000);
}

// Jalankan cleanup
setTimeout(cleanupStaleRooms, 60000);

// Helper function untuk broadcast daftar ruangan aktif
function broadcastActiveRooms() {
  const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
    roomId,
    userCount: data.users.size,
    hasSharing: data.hasSharing,
    isActive: true
  }));
  
  // Kirim ke semua connected client
  io.emit('active-rooms-list', roomsList);
}

// Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    serverTime: Date.now(),
    uptime: process.uptime(),
    activeConnections: io.engine.clientsCount,
    activeRooms: Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing,
      owner: data.owner.substring(0, 8) + '...'
    }))
  });
});

// Endpoint untuk statistik koneksi
app.get('/stats', (req, res) => {
  const stats = {
    totalRooms: activeRooms.size,
    totalUsers: Array.from(activeRooms.values()).reduce((sum, room) => sum + room.users.size, 0),
    roomsWithSharing: Array.from(activeRooms.values()).filter(room => room.hasSharing).length,
    serverLoad: process.memoryUsage(),
    connections: io.engine.clientsCount
  };
  res.json(stats);
});

// Socket.io handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id, 'Total:', io.engine.clientsCount);
  
  // Simpan data user
  userConnections.set(socket.id, {
    roomId: null,
    lastPing: Date.now(),
    connectedAt: Date.now()
  });
  
  // Kirim daftar ruangan aktif saat pertama konek
  setTimeout(() => {
    const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing,
      isActive: true
    }));
    socket.emit('active-rooms-list', roomsList);
  }, 100);
  
  // Handle ping/pong untuk keep-alive
  socket.on('ping', (data) => {
    const userData = userConnections.get(socket.id);
    if (userData) {
      userData.lastPing = Date.now();
    }
    socket.emit('pong', { 
      timestamp: Date.now(),
      serverTime: Date.now(),
      clientTime: data?.timestamp || null
    });
  });
  
  // Join room
  socket.on('join-room', (roomId) => {
    try {
      if (!roomId || roomId.trim() === '') {
        socket.emit('error', { message: 'Room ID tidak valid' });
        return;
      }
      
      // Leave existing rooms except self
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room !== socket.roomId) {
          socket.leave(room);
          
          // Update active rooms data jika keluar dari room
          if (activeRooms.has(room)) {
            const roomData = activeRooms.get(room);
            roomData.users.delete(socket.id);
            
            // Update user connections data
            const userData = userConnections.get(socket.id);
            if (userData) {
              userData.roomId = null;
            }
            
            // Hapus room jika kosong
            if (roomData.users.size === 0) {
              activeRooms.delete(room);
            } else if (roomData.owner === socket.id) {
              // Set owner baru ke user pertama
              roomData.owner = Array.from(roomData.users)[0];
              console.log(`👑 New owner for room ${room}: ${roomData.owner}`);
            }
            
            broadcastActiveRooms();
          }
        }
      });
      
      // Join new room
      socket.join(roomId);
      socket.roomId = roomId;
      
      // Update user connections
      const userData = userConnections.get(socket.id);
      if (userData) {
        userData.roomId = roomId;
        userData.lastPing = Date.now();
      }
      
      // Update active rooms data
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, {
          users: new Set([socket.id]),
          hasSharing: false,
          owner: socket.id,
          createdAt: Date.now()
        });
        console.log(`🆕 Room created: ${roomId} by ${socket.id}`);
      } else {
        const roomData = activeRooms.get(roomId);
        roomData.users.add(socket.id);
        
        // Jika room sudah lama tapi kosong, update timestamp
        if (roomData.users.size === 1 && Date.now() - roomData.createdAt > 60000) {
          roomData.createdAt = Date.now();
        }
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
        users: otherClients,
        owner: activeRooms.get(roomId).owner
      });
      
      // Broadcast update active rooms
      broadcastActiveRooms();
      
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room: ' + error.message });
    }
  });
  
  // WebRTC signaling: offer
  socket.on('offer', (data) => {
    console.log(`📤 Offer from ${socket.id} to ${data.to}`);
    if (data.to && data.sdp) {
      socket.to(data.to).emit('offer', {
        sdp: data.sdp,
        from: socket.id,
        room: data.room,
        timestamp: Date.now()
      });
    }
  });
  
  // WebRTC signaling: answer
  socket.on('answer', (data) => {
    console.log(`📥 Answer from ${socket.id} to ${data.to}`);
    if (data.to && data.sdp) {
      socket.to(data.to).emit('answer', {
        sdp: data.sdp,
        from: socket.id,
        room: data.room,
        timestamp: Date.now()
      });
    }
  });
  
  // WebRTC signaling: ice candidate
  socket.on('ice-candidate', (data) => {
    if (data.to && data.candidate) {
      socket.to(data.to).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id,
        room: data.room,
        timestamp: Date.now()
      });
    }
  });
  
  // User is sharing screen
  socket.on('sharing-started', () => {
    if (socket.roomId) {
      console.log(`🎥 User ${socket.id} started sharing in room ${socket.roomId}`);
      
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
      console.log(`🛑 User ${socket.id} stopped sharing in room ${socket.roomId}`);
      
      // Update room status to no sharing
      if (activeRooms.has(socket.roomId)) {
        const roomData = activeRooms.get(socket.roomId);
        roomData.hasSharing = false;
        broadcastActiveRooms();
      }
      
      socket.to(socket.roomId).emit('user-sharing-stopped', socket.id);
    }
  });
  
  // Request active rooms list
  socket.on('get-active-rooms', () => {
    const roomsList = Array.from(activeRooms.entries()).map(([roomId, data]) => ({
      roomId,
      userCount: data.users.size,
      hasSharing: data.hasSharing,
      isActive: true
    }));
    socket.emit('active-rooms-list', roomsList);
  });
  
  // Connection quality test
  socket.on('connection-test', (data) => {
    socket.emit('connection-test-response', {
      clientTime: data.timestamp,
      serverTime: Date.now(),
      latency: Date.now() - data.timestamp,
      socketId: socket.id
    });
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
        
        // Update user connections
        const userData = userConnections.get(socket.id);
        if (userData) {
          userData.roomId = null;
        }
        
        // Hapus room jika kosong
        if (roomData.users.size === 0) {
          activeRooms.delete(roomId);
        } else if (roomData.owner === socket.id) {
          // Set owner baru ke user pertama
          roomData.owner = Array.from(roomData.users)[0];
          console.log(`👑 New owner for room ${roomId}: ${roomData.owner}`);
        }
        
        broadcastActiveRooms();
      }
      
      socket.roomId = null;
    }
  });
  
  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id}, Reason: ${reason}, Total: ${io.engine.clientsCount - 1}`);
    
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
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        } else if (roomData.owner === socket.id) {
          // Set owner baru ke user pertama
          roomData.owner = Array.from(roomData.users)[0];
          console.log(`👑 New owner for room ${roomId}: ${roomData.owner} (previous owner disconnected)`);
        }
        
        broadcastActiveRooms();
      }
      
      socket.to(roomId).emit('user-disconnected', socket.id);
    }
    
    // Hapus dari user connections
    userConnections.delete(socket.id);
  });
  
  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('error-notification', { 
      message: 'Connection error occurred',
      code: error.code || 'UNKNOWN'
    });
  });
});

const PORT = process.env.PORT || 9631;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎉 Screen Share App berjalan di port ${PORT}`);
  console.log(`🌐 Akses aplikasi melalui:`);
  console.log(`   • Local: http://localhost:${PORT}`);
  console.log(`   • Network: http://${getLocalIP()}:${PORT}`);
  console.log(`   • Health: http://localhost:${PORT}/health`);
  console.log(`   • Stats: http://localhost:${PORT}/stats`);
  console.log(`\n📝 Petunjuk:`);
  console.log(`   1. Buka di browser (Chrome/Edge disarankan)`);
  console.log(`   2. Buat atau gabung ruangan dengan ID yang sama`);
  console.log(`   3. Klik "Mulai Bagikan" untuk berbagi layar`);
  console.log(`   4. Fitur baru: Lihat ruangan aktif dan join dengan klik!`);
  console.log(`\n🔧 Konfigurasi:`);
  console.log(`   • Ping Timeout: 120s`);
  console.log(`   • Ping Interval: 30s`);
  console.log(`   • Max Buffer: 100MB`);
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