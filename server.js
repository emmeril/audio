const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// HTTP Server untuk serve HTML
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './sender.html';
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
    }
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// WebSocket Server untuk audio streaming
const wss = new WebSocket.Server({ server });

const clients = new Set();
let sender = null;

wss.on('connection', (ws, req) => {
    console.log('Client connected');
    
    // Tentukan apakah ini sender atau receiver
    ws.isSender = false;
    
    ws.on('message', (data) => {
        // Jika message pertama adalah "sender", tandai sebagai sender
        if (data.toString() === 'sender') {
            ws.isSender = true;
            sender = ws;
            console.log('Sender connected');
            return;
        }
        
        // Jika message pertama adalah "receiver", tandai sebagai receiver
        if (data.toString() === 'receiver') {
            ws.isSender = false;
            clients.add(ws);
            console.log('Receiver connected. Total receivers:', clients.size);
            
            // Kirim ack ke receiver
            ws.send(JSON.stringify({ 
                type: 'connected', 
                message: 'Connected to audio stream' 
            }));
            return;
        }
        
        // Jika ini audio data dari sender, broadcast ke semua receiver
        if (ws === sender && ws.isSender) {
            broadcastToReceivers(data);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        
        if (ws === sender) {
            sender = null;
            console.log('Sender disconnected');
        } else {
            clients.delete(ws);
        }
    });
    
    ws.on('error', (error) => {
        console.log('WebSocket error:', error);
    });
});

function broadcastToReceivers(data) {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🎵 WebSocket: ws://localhost:${PORT}`);
    console.log(`📱 Sender: http://localhost:${PORT}/sender.html`);
    console.log(`🎧 Receiver: http://localhost:${PORT}/receiver.html`);
    console.log('\n📌 INSTRUKSI SINGKAT:');
    console.log('1. Buka sender.html di komputer yang mau dishare audio-nya');
    console.log('2. Klik "Start Sharing" (izinkan microphone/audio capture)');
    console.log('3. Buka receiver.html di komputer lain');
    console.log('4. Langsung bisa denger!');
});