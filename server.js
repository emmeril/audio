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

// Store connected users
const rooms = new Map();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create or join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        host: socket.id,
        listeners: []
      });
    }
    
    const room = rooms.get(roomId);
    if (socket.id !== room.host) {
      room.listeners.push(socket.id);
    }
    
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.emit('room-joined', roomId);
  });

  // Handle SDP offer from sender
  socket.on('sdp-offer', (data) => {
    const { roomId, offer } = data;
    socket.to(roomId).emit('sdp-offer', { offer, senderId: socket.id });
  });

  // Handle SDP answer from receiver
  socket.on('sdp-answer', (data) => {
    const { roomId, answer, to } = data;
    socket.to(to).emit('sdp-answer', { answer });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { roomId, candidate, to } = data;
    socket.to(to).emit('ice-candidate', { candidate });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.host === socket.id) {
        // Notify all listeners that host disconnected
        io.to(roomId).emit('host-disconnected');
        rooms.delete(roomId);
        break;
      } else {
        const listenerIndex = room.listeners.indexOf(socket.id);
        if (listenerIndex > -1) {
          room.listeners.splice(listenerIndex, 1);
        }
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});