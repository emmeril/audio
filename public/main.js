function app() {
    return {
        // State aplikasi
        roomId: '',
        isConnected: false,
        isInRoom: false,
        isSharing: false,
        shareAudio: true,
        usersInRoom: 1,
        remoteVideos: [],
        socketId: null,
        mobileMenuActive: 'video',
        
        // State untuk daftar ruangan aktif
        activeRooms: [],
        showActiveRooms: false,
        
        // State fullscreen
        localVideoFullscreen: false,
        remoteVideoFullscreen: false,
        isFullscreenMode: false,
        currentFullscreenVideo: null,
        
        // State koneksi
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        isReconnecting: false,
        lastPingTime: 0,
        latency: 0,
        connectionStats: {
            totalDisconnects: 0,
            lastDisconnectTime: null,
            successfulReconnects: 0
        },
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Konfigurasi WebRTC yang lebih stabil
configuration: {
    iceServers: [
        // Default STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
        
        // Additional STUN servers from the provided list
        { urls: 'stun:stun.nextcloud.com:443' },
        { urls: 'stun:stun.bethesda.net:3478' },
        { urls: 'stun:stun.kanojo.de:3478' },
        { urls: 'stun:stun.mixvoip.com:3478' },
        { urls: 'stun:stun.pure-ip.com:3478' },
        { urls: 'stun:stun.signalwire.com:3478' },
        { urls: 'stun:stun.voztovoice.org:3478' },
        { urls: 'stun:stun.axialys.net:3478' },
        { urls: 'stun:stun.healthtap.com:3478' },
        { urls: 'stun:stun.voipgate.com:3478' },
        { urls: 'stun:stun.thinkrosystem.com:3478' },
        { urls: 'stun:stun.siplogin.de:3478' },
        { urls: 'stun:stun.skydrone.aero:3478' },
        { urls: 'stun:stun.godatenow.com:3478' },
        { urls: 'stun:stun.voipia.net:3478' },
        { urls: 'stun:stun.verbo.be:3478' },
        { urls: 'stun:stun.romaaeterna.nl:3478' },
        { urls: 'stun:stun.tula.nu:3478' },
        { urls: 'stun:stun.siptrunk.com:3478' },
        { urls: 'stun:stun.romancecompass.com:3478' },
        { urls: 'stun:stun.linuxtrent.it:3478' },
        { urls: 'stun:stun.engineeredarts.co.uk:3478' },
        { urls: 'stun:stun.lovense.com:3478' },
        { urls: 'stun:stun.alpirsbacher.de:3478' },
        { urls: 'stun:stun.myspeciality.com:3478' },
        { urls: 'stun:stun.genymotion.com:3478' },
        { urls: 'stun:stun.oncloud7.ch:3478' },
        { urls: 'stun:stun.annatel.net:3478' },
        { urls: 'stun:stun.uabrides.com:3478' },
        { urls: 'stun:stun.technosens.fr:3478' },
        { urls: 'stun:stun.files.fm:3478' },
        { urls: 'stun:stun.sip.us:3478' },
        { urls: 'stun:stun.framasoft.org:3478' },
        { urls: 'stun:stun.fitauto.ru:3478' },
        { urls: 'stun:stun.frozenmountain.com:3478' },
        { urls: 'stun:stun.bridesbay.com:3478' },
        { urls: 'stun:stun.business-isp.nl:3478' },
        { urls: 'stun:stun.telnyx.com:3478' },
        { urls: 'stun:stun.f.haeder.net:3478' },
        { urls: 'stun:stun.baltmannsweiler.de:3478' },
        { urls: 'stun:stun.ncic.com:3478' },
        { urls: 'stun:stun.cellmail.com:3478' },
        { urls: 'stun:stun.vavadating.com:3478' },
        { urls: 'stun:stun.zentauron.de:3478' },
        { urls: 'stun:stun.antisip.com:3478' },
        { urls: 'stun:stun.ru-brides.com:3478' },
        { urls: 'stun:stun.voip.blackberry.com:3478' },
        { urls: 'stun:stun.ipfire.org:3478' },
        { urls: 'stun:stun.nextcloud.com:3478' },
        { urls: 'stun:stun.root-1.de:3478' },
        { urls: 'stun:stun.yesdates.com:3478' },
        { urls: 'stun:stun.freeswitch.org:3478' },
        { urls: 'stun:stun.geesthacht.de:3478' },
        { urls: 'stun:stun.acronis.com:3478' },
        { urls: 'stun:stun.poetamatusel.org:3478' },
        { urls: 'stun:stun.bcs2005.net:3478' },
        { urls: 'stun:stun.ringostat.com:3478' },
        { urls: 'stun:stun.flashdance.cx:3478' },
        { urls: 'stun:stun.3deluxe.de:3478' },
        { urls: 'stun:stun.m-online.net:3478' },
        { urls: 'stun:stun.stochastix.de:3478' },
        { urls: 'stun:stun.finsterwalder.com:3478' },
        { urls: 'stun:stun.radiojar.com:3478' },
        { urls: 'stun:stun.sonetel.net:3478' },
        { urls: 'stun:stun.fmo.de:3478' },
        { urls: 'stun:stun.graftlab.com:3478' },
        { urls: 'stun:stun.sonetel.com:3478' },
        { urls: 'stun:stun.hot-chilli.net:3478' },
        { urls: 'stun:stun.sipthor.net:3478' },
        { urls: 'stun:stun.moonlight-stream.org:3478' },
        { urls: 'stun:stun.bitburger.de:3478' },
        { urls: 'stun:stun.peethultra.be:3478' },
        { urls: 'stun:stun.atagverwarming.nl:3478' },
        { urls: 'stun:stun.telviva.com:3478' },
        { urls: 'stun:stun.ukh.de:3478' },
        { urls: 'stun:stun.threema.ch:3478' },
        { urls: 'stun:stun.vomessen.de:3478' },
        { urls: 'stun:stun.cope.es:3478' },
        { urls: 'stun:stun.diallog.com:3478' },
        { urls: 'stun:stun.ttmath.org:3478' },
        { urls: 'stun:stun.meetwife.com:3478' },
        { urls: 'stun:stun.kaseya.com:3478' }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan',
    encodedInsertableStreams: false
},
        
        // Inisialisasi
        init() {
            this.generateRoomId();
            this.initializeSocket();
            this.setupMobileFeatures();
            this.setupFullscreenListeners();
            this.startConnectionMonitor();
            
            // Minta daftar ruangan aktif setiap 15 detik
            setInterval(() => {
                if (this.socket && this.isConnected) {
                    this.socket.emit('get-active-rooms');
                }
            }, 15000);
        },
        
        // Setup fitur mobile
        setupMobileFeatures() {
            this.isMobile = window.innerWidth < 1024;
            
            window.addEventListener('resize', () => {
                this.isMobile = window.innerWidth < 1024;
                if (this.isFullscreenMode) {
                    this.handleFullscreenResize();
                }
            });
            
            // Cegah zoom pada input di iOS
            document.addEventListener('touchstart', function(event) {
                if (event.touches.length > 1) {
                    event.preventDefault();
                }
            }, { passive: false });
            
            let lastTouchEnd = 0;
            document.addEventListener('touchend', function(event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
        },
        
        // Setup listener untuk fullscreen
        setupFullscreenListeners() {
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
        },
        
        // Handle perubahan state fullscreen
        handleFullscreenChange() {
            const isFullscreen = document.fullscreenElement || 
                                document.webkitFullscreenElement || 
                                document.mozFullScreenElement || 
                                document.msFullscreenElement;
            
            this.isFullscreenMode = !!isFullscreen;
            
            if (!isFullscreen) {
                this.localVideoFullscreen = false;
                this.remoteVideoFullscreen = false;
                this.currentFullscreenVideo = null;
                
                const backdrop = document.getElementById('fullscreenBackdrop');
                const closeBtn = document.getElementById('fullscreenCloseBtn');
                if (backdrop) backdrop.classList.remove('active');
                if (closeBtn) closeBtn.classList.remove('active');
                
                document.querySelectorAll('.sharing-video-container.fullscreen-mode').forEach(el => {
                    el.classList.remove('fullscreen-mode');
                    const video = el.querySelector('video');
                    if (video) this.resetVideoStyles(video);
                });
                
                window.removeEventListener('resize', this.handleFullscreenResize.bind(this));
            } else {
                const fullscreenElement = isFullscreen;
                if (fullscreenElement.classList.contains('sharing-video-container')) {
                    setTimeout(() => {
                        this.adjustVideoForFullscreen(fullscreenElement);
                    }, 100);
                }
                window.addEventListener('resize', this.handleFullscreenResize.bind(this));
            }
        },
        
        // Handle resize saat fullscreen
        handleFullscreenResize() {
            if (!this.isFullscreenMode) return;
            
            document.querySelectorAll('.sharing-video-container.fullscreen-mode').forEach(element => {
                this.adjustVideoForFullscreen(element);
            });
        },
        
        // Reset video styles
        resetVideoStyles(video) {
            video.style.cssText = '';
            video.className = 'w-full h-full object-contain';
        },
        
        // Toggle fullscreen untuk video tertentu
        toggleFullscreen(videoType) {
            if (videoType === 'local' && this.isSharing) {
                this.toggleLocalVideoFullscreen();
            } else if (videoType.startsWith('remote-')) {
                const userId = videoType.replace('remote-', '');
                this.toggleRemoteVideoFullscreen(userId);
            }
        },
        
        // Toggle fullscreen untuk video lokal
        toggleLocalVideoFullscreen() {
            const videoContainer = this.$refs.localVideo?.closest('.sharing-video-container');
            if (!videoContainer) return;
            
            if (!this.localVideoFullscreen) {
                this.enterFullscreen(videoContainer, 'local');
                this.localVideoFullscreen = true;
                this.showNotification('Video lokal masuk mode fullscreen', 'info');
            } else {
                this.exitFullscreen();
                this.localVideoFullscreen = false;
            }
        },
        
        // Toggle fullscreen untuk video remote tertentu
        toggleRemoteVideoFullscreen(userId) {
            const videoId = `remoteVideo-${userId}`;
            const videoElement = document.getElementById(videoId);
            if (!videoElement) return;
            
            const videoContainer = videoElement.closest('.sharing-video-container');
            if (!videoContainer) return;
            
            if (!this.remoteVideoFullscreen || this.currentFullscreenVideo !== userId) {
                this.enterFullscreen(videoContainer, `remote-${userId}`);
                this.remoteVideoFullscreen = true;
                this.currentFullscreenVideo = userId;
                this.showNotification(`Video pengguna ${userId.substring(0, 6)} masuk mode fullscreen`, 'info');
            } else {
                this.exitFullscreen();
                this.remoteVideoFullscreen = false;
                this.currentFullscreenVideo = null;
            }
        },
        
        // Toggle fullscreen untuk semua video remote
        toggleRemoteFullscreen() {
            if (this.remoteVideos.length === 0) return;
            
            if (this.isFullscreenMode && this.remoteVideoFullscreen) {
                this.exitFullscreen();
                this.remoteVideoFullscreen = false;
                return;
            }
            
            const firstVideo = this.remoteVideos[0];
            if (firstVideo) {
                this.toggleRemoteVideoFullscreen(firstVideo.userId);
            }
        },
        
        // Toggle fullscreen untuk semua video
        toggleAllFullscreen() {
            if (this.isFullscreenMode) {
                this.exitFullscreen();
                return;
            }
            
            if (this.isSharing) {
                this.toggleLocalVideoFullscreen();
            } else if (this.remoteVideos.length > 0) {
                this.toggleRemoteFullscreen();
            }
        },
        
        // Masuk ke mode fullscreen
        enterFullscreen(element, videoType) {
            const backdrop = document.getElementById('fullscreenBackdrop');
            const closeBtn = document.getElementById('fullscreenCloseBtn');
            if (backdrop) backdrop.classList.add('active');
            if (closeBtn) closeBtn.classList.add('active');
            
            element.classList.add('fullscreen-mode');
            
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            } else {
                this.isFullscreenMode = true;
                this.currentFullscreenVideo = videoType;
                setTimeout(() => {
                    this.adjustVideoForFullscreen(element);
                }, 100);
            }
            
            window.addEventListener('resize', this.handleFullscreenResize.bind(this));
        },
        
        // Menyesuaikan video untuk fullscreen
        adjustVideoForFullscreen(element) {
            const video = element.querySelector('video');
            if (!video) return;
            
            const containerWidth = element.clientWidth || window.innerWidth;
            const containerHeight = element.clientHeight || window.innerHeight;
            
            this.resetVideoStyles(video);
            
            video.style.objectFit = 'contain';
            video.style.backgroundColor = '#000';
            video.style.display = 'block';
            video.style.margin = 'auto';
            
            if (video.videoWidth && video.videoHeight) {
                const videoAspectRatio = video.videoWidth / video.videoHeight;
                const containerAspectRatio = containerWidth / containerHeight;
                
                if (videoAspectRatio > containerAspectRatio) {
                    video.style.width = '100%';
                    video.style.height = 'auto';
                    video.style.maxHeight = '100%';
                } else {
                    video.style.width = 'auto';
                    video.style.height = '100%';
                    video.style.maxWidth = '100%';
                }
            } else {
                video.style.width = '100%';
                video.style.height = '100%';
                video.style.objectFit = 'contain';
            }
            
            video.style.position = 'absolute';
            video.style.top = '50%';
            video.style.left = '50%';
            video.style.transform = 'translate(-50%, -50%)';
        },
        
        // Keluar dari mode fullscreen
        exitFullscreen() {
            const backdrop = document.getElementById('fullscreenBackdrop');
            const closeBtn = document.getElementById('fullscreenCloseBtn');
            if (backdrop) backdrop.classList.remove('active');
            if (closeBtn) closeBtn.classList.remove('active');
            
            document.querySelectorAll('.sharing-video-container.fullscreen-mode').forEach(el => {
                el.classList.remove('fullscreen-mode');
                const video = el.querySelector('video');
                if (video) this.resetVideoStyles(video);
            });
            
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            this.isFullscreenMode = false;
            this.localVideoFullscreen = false;
            this.remoteVideoFullscreen = false;
            this.currentFullscreenVideo = null;
            
            window.removeEventListener('resize', this.handleFullscreenResize.bind(this));
        },
        
        // Generate Room ID
        generateRoomId() {
            if (!this.isInRoom) {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let id = '';
                for (let i = 0; i < 6; i++) {
                    id += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                this.roomId = id;
                this.showNotification(`ID Ruangan dibuat: ${id}`, 'info');
            }
        },
        
        // Method baru: Bergabung ke ruangan aktif
        joinActiveRoom(roomId) {
            if (this.isInRoom) {
                if (confirm(`Anda sudah berada di ruangan ${this.roomId}. Pindah ke ruangan ${roomId}?`)) {
                    this.leaveRoom();
                    setTimeout(() => {
                        this.roomId = roomId;
                        this.joinRoom();
                        this.showActiveRooms = false;
                    }, 500);
                }
            } else {
                this.roomId = roomId;
                this.joinRoom();
                this.showActiveRooms = false;
            }
        },
        
        // Method baru: Toggle panel ruangan aktif
        toggleActiveRoomsPanel() {
            this.showActiveRooms = !this.showActiveRooms;
            if (this.showActiveRooms && this.socket) {
                this.socket.emit('get-active-rooms');
            }
        },
        
        // Method baru: Refresh daftar ruangan aktif
        refreshActiveRooms() {
            if (this.socket) {
                this.socket.emit('get-active-rooms');
                this.showNotification('Menyegarkan daftar ruangan...', 'info');
            }
        },
        
        // Toggle Audio
        toggleAudio() {
            if (this.isSharing) {
                this.showNotification('Restart screen sharing untuk menerapkan perubahan audio', 'info');
            }
        },
        
        // Inisialisasi Socket.io dengan reconnection yang lebih baik
        initializeSocket() {
            this.socket = io(window.location.origin, {
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                transports: ['websocket', 'polling'],
                forceNew: true,
                randomizationFactor: 0.5
            });
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.socketId = this.socket.id;
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                this.showNotification('Terhubung ke server', 'success');
                
                // Minta daftar ruangan aktif
                this.socket.emit('get-active-rooms');
                
                // Rejoin room jika sebelumnya sudah join
                if (this.roomId && this.isInRoom) {
                    setTimeout(() => {
                        this.socket.emit('join-room', this.roomId);
                    }, 1000);
                }
            });
            
            this.socket.on('disconnect', (reason) => {
                this.isConnected = false;
                this.connectionStats.totalDisconnects++;
                this.connectionStats.lastDisconnectTime = Date.now();
                
                if (reason === 'io server disconnect' || reason === 'transport close') {
                    this.showNotification('Terputus dari server. Mencoba menyambung kembali...', 'error');
                    this.socket.connect();
                }
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('⚠️ Koneksi error:', error);
                this.isReconnecting = true;
                this.reconnectAttempts++;
                
                if (this.reconnectAttempts > 5) {
                    this.showNotification('Gagal terhubung ke server. Silakan refresh halaman.', 'error');
                } else {
                    this.showNotification(`Menyambung kembali... (${this.reconnectAttempts})`, 'warning');
                }
            });
            
            this.socket.on('reconnect', (attemptNumber) => {
                this.isConnected = true;
                this.isReconnecting = false;
                this.connectionStats.successfulReconnects++;
                this.showNotification(`Koneksi dipulihkan setelah ${attemptNumber} percobaan`, 'success');
            });
            
            this.socket.on('reconnect_attempt', (attemptNumber) => {
                console.log(`🔄 Reconnection attempt ${attemptNumber}`);
            });
            
            this.socket.on('reconnect_failed', () => {
                this.showNotification('Gagal menyambung kembali. Silakan refresh halaman.', 'error');
            });
            
            this.socket.on('pong', (data) => {
                this.latency = Date.now() - data.clientTime;
                this.lastPingTime = Date.now();
            });
            
            this.socket.on('room-joined', (data) => {
                this.isInRoom = true;
                this.usersInRoom = data.userCount;
                this.showNotification(`Bergabung ke ruangan ${data.roomId}`, 'success');
                
                if (window.innerWidth < 1024) {
                    this.mobileMenuActive = 'video';
                }
                
                data.users.forEach(userId => {
                    this.createPeerConnection(userId, true);
                });
            });
            
            this.socket.on('user-connected', (userId) => {
                this.usersInRoom++;
                this.showNotification('Pengguna baru bergabung', 'info');
                this.createPeerConnection(userId, true);
            });
            
            this.socket.on('user-disconnected', (userId) => {
                this.usersInRoom = Math.max(1, this.usersInRoom - 1);
                this.closePeerConnection(userId);
                this.showNotification('Pengguna keluar dari ruangan', 'info');
            });
            
            this.socket.on('active-rooms-list', (rooms) => {
                this.activeRooms = rooms
                    .filter(room => room.userCount > 0 && room.roomId !== this.roomId)
                    .sort((a, b) => {
                        if (a.hasSharing && !b.hasSharing) return -1;
                        if (!a.hasSharing && b.hasSharing) return 1;
                        return b.userCount - a.userCount;
                    });
            });
            
            this.socket.on('offer', async (data) => {
                await this.handleOffer(data);
            });
            
            this.socket.on('answer', async (data) => {
                await this.handleAnswer(data);
            });
            
            this.socket.on('ice-candidate', async (data) => {
                await this.handleIceCandidate(data);
            });
            
            this.socket.on('user-sharing-started', (userId) => {
                this.showNotification('Pengguna lain mulai berbagi layar', 'info');
            });
            
            this.socket.on('user-sharing-stopped', (userId) => {
                this.showNotification('Pengguna lain berhenti berbagi layar', 'info');
            });
            
            this.socket.on('error-notification', (data) => {
                this.showNotification(`Error: ${data.message}`, 'error');
            });
        },
        
        // Start connection monitor
        startConnectionMonitor() {
            // Ping server setiap 20 detik
            setInterval(() => {
                if (this.socket && this.socket.connected) {
                    this.socket.emit('ping', { timestamp: Date.now() });
                }
            }, 20000);
            
            // Test connection quality setiap 30 detik
            setInterval(() => {
                if (this.socket && this.socket.connected) {
                    this.socket.emit('connection-test', { timestamp: Date.now() });
                }
            }, 30000);
            
            // Monitor WebRTC connections
            setInterval(() => {
                this.monitorWebRTCConnections();
            }, 15000);
        },
        
        // Monitor WebRTC connections
        monitorWebRTCConnections() {
            Object.entries(this.peerConnections).forEach(([userId, pc]) => {
                if (pc) {
                    const state = pc.iceConnectionState;
                    if (state === 'disconnected' || state === 'failed') {
                        console.log(`⚠️ WebRTC connection to ${userId} is ${state}`);
                        
                        // Attempt to recover
                        if (this.localStream) {
                            setTimeout(() => {
                                if (pc.iceConnectionState !== 'connected' && 
                                    pc.iceConnectionState !== 'checking') {
                                    this.createOffer(userId, pc);
                                }
                            }, 2000);
                        }
                    }
                }
            });
        },
        
        // Bergabung ke ruangan
        joinRoom() {
            if (this.roomId && !this.isInRoom && this.socket) {
                this.socket.emit('join-room', this.roomId);
                this.isInRoom = true;
                this.showActiveRooms = false;
                this.showNotification(`Bergabung ke ruangan ${this.roomId}`, 'success');
            }
        },
        
        // Keluar dari ruangan
        leaveRoom() {
            if (this.isInRoom) {
                this.stopScreenShare();
                
                Object.keys(this.peerConnections).forEach(userId => {
                    this.closePeerConnection(userId);
                });
                
                if (this.socket) {
                    this.socket.emit('leave-room');
                }
                
                this.isInRoom = false;
                this.usersInRoom = 1;
                this.remoteVideos = [];
                this.showNotification('Keluar dari ruangan', 'info');
            }
        },
        
        // Mulai berbagi layar dengan optimasi
        async startScreenShare() {
            try {
                // Konfigurasi display media dengan optimasi
                const displayOptions = {
                    video: {
                        cursor: "always",
                        displaySurface: "monitor",
                        frameRate: { ideal: 15, max: 30 }, // Lower frame rate for stability
                        width: { ideal: 1280, max: 1920 }, // Lower resolution
                        height: { ideal: 720, max: 1080 },
                        logicalSurface: true
                    }
                };
                
                // Tambahkan audio jika diaktifkan
                if (this.shareAudio) {
                    displayOptions.audio = {
                        autoGainControl: false,
                        noiseSuppression: false,
                        echoCancellation: false,
                        channelCount: 1, // Mono lebih stabil
                        sampleRate: 24000, // Lower sample rate
                        volume: 0.8
                    };
                }
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Optimasi video track
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    await videoTrack.applyConstraints({
                        frameRate: 15,
                        width: 1280,
                        height: 720
                    }).catch(e => console.warn('Video constraints error:', e));
                    
                    videoTrack.onended = () => {
                        this.stopScreenShare();
                    };
                }
                
                // Optimasi audio track jika ada
                if (this.shareAudio) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        try {
                            await audioTrack.applyConstraints({
                                autoGainControl: false,
                                noiseSuppression: false,
                                echoCancellation: false
                            });
                        } catch (e) {
                            console.warn('Audio constraints error:', e);
                        }
                    }
                }
                
                // Tampilkan video lokal
                const localVideo = this.$refs.localVideo;
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    this.isSharing = true;
                    this.showNotification('Berbagi layar dimulai', 'success');
                    
                    localVideo.volume = 1.0;
                    
                    if (window.innerWidth < 1024) {
                        this.mobileMenuActive = 'video';
                    }
                    
                    if (this.socket) {
                        this.socket.emit('sharing-started');
                    }
                }
                
                // Kirim stream ke semua peer
                this.sendStreamToAllPeers();
                
            } catch (error) {
                console.error('❌ Error starting screen share:', error);
                let errorMessage = 'Gagal memulai berbagi layar. ';
                
                if (error.name === 'NotAllowedError') {
                    errorMessage = 'Izin berbagi layar ditolak. Silakan coba lagi dan berikan izin.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage = 'Tidak ada layar atau jendela yang tersedia untuk dibagikan.';
                } else if (error.name === 'NotReadableError') {
                    errorMessage = 'Tidak dapat membaca layar. Mungkin aplikasi lain sedang menggunakan kamera/layar.';
                } else {
                    errorMessage += error.message;
                }
                
                this.showNotification(errorMessage, 'error');
            }
        },
        
        // Berhenti berbagi layar
        stopScreenShare() {
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.localStream = null;
            }
            
            const localVideo = this.$refs.localVideo;
            if (localVideo) {
                localVideo.srcObject = null;
            }
            
            this.isSharing = false;
            
            Object.values(this.peerConnections).forEach(pc => {
                if (pc) {
                    const senders = pc.getSenders();
                    senders.forEach(sender => {
                        if (sender.track) {
                            pc.removeTrack(sender);
                        }
                    });
                }
            });
            
            if (this.socket) {
                this.socket.emit('sharing-stopped');
            }
            this.showNotification('Berbagi layar dihentikan', 'info');
        },
        
        // Buat Peer Connection yang lebih stabil
        createPeerConnection(userId, isInitiator = false) {
            if (this.peerConnections[userId]) {
                // Coba restart jika connection bermasalah
                const currentState = this.peerConnections[userId].iceConnectionState;
                if (currentState === 'disconnected' || currentState === 'failed') {
                    this.closePeerConnection(userId);
                } else {
                    return this.peerConnections[userId];
                }
            }
            
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            // Tambahkan local stream jika ada
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // ICE Candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.socket) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: userId,
                        room: this.roomId
                    });
                }
            };
            
            // Track handler
            peerConnection.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    this.addRemoteVideo(userId, event.streams[0]);
                    
                    const videoElement = document.getElementById(`remoteVideo-${userId}`);
                    if (videoElement) {
                        videoElement.volume = 1.0;
                    }
                }
            };
            
            // ICE Connection State handler dengan recovery
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                
                if (state === 'failed' || state === 'disconnected') {
                    console.log(`⚠️ ICE connection to ${userId} is ${state}`);
                    
                    // Attempt recovery setelah delay
                    setTimeout(() => {
                        if (peerConnection.iceConnectionState !== 'connected' && 
                            peerConnection.iceConnectionState !== 'checking' &&
                            this.localStream) {
                            console.log(`🔄 Attempting to recover connection to ${userId}`);
                            this.createOffer(userId, peerConnection);
                        }
                    }, 3000);
                } else if (state === 'connected') {
                    console.log(`✅ ICE connected to ${userId}`);
                }
            };
            
            // Connection State handler
            peerConnection.onconnectionstatechange = () => {
                if (peerConnection.connectionState === 'connected') {
                    console.log(`✅ Peer connection established with ${userId}`);
                } else if (peerConnection.connectionState === 'failed') {
                    console.log(`❌ Peer connection failed with ${userId}`);
                }
            };
            
            // Buat offer jika initiator
            if (isInitiator && this.localStream) {
                setTimeout(() => {
                    this.createOffer(userId, peerConnection);
                }, 1000);
            }
            
            return peerConnection;
        },
        
        // Buat Offer dengan optimasi
        async createOffer(userId, peerConnection) {
            try {
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: false,
                    iceRestart: true
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                
                // Set codec preferences untuk stabil
                if (offer.sdp) {
                    offer.sdp = this.preferCodec(offer.sdp, 'video', 'H264');
                    offer.sdp = this.preferCodec(offer.sdp, 'audio', 'opus');
                }
                
                await peerConnection.setLocalDescription(offer);
                
                if (this.socket) {
                    this.socket.emit('offer', {
                        sdp: peerConnection.localDescription,
                        to: userId,
                        room: this.roomId
                    });
                }
                
            } catch (error) {
                console.error('❌ Error creating offer:', error);
            }
        },
        
        // Helper untuk prefer codec tertentu
        preferCodec(sdp, type, codec) {
            const lines = sdp.split('\n');
            let mLine = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('m=' + type)) {
                    mLine = i;
                    break;
                }
            }
            
            if (mLine === -1) return sdp;
            
            const parts = lines[mLine].split(' ');
            const payloads = parts.slice(3);
            
            // Reorder payloads
            const newPayloads = [];
            for (const payload of payloads) {
                if (this.getCodecName(sdp, payload) === codec) {
                    newPayloads.unshift(payload);
                } else {
                    newPayloads.push(payload);
                }
            }
            
            lines[mLine] = parts.slice(0, 3).concat(newPayloads).join(' ');
            return lines.join('\n');
        },
        
        getCodecName(sdp, payload) {
            const lines = sdp.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('a=rtpmap:' + payload)) {
                    return lines[i].split(' ')[1].split('/')[0];
                }
            }
            return '';
        },
        
        // Handle Offer dari remote
        async handleOffer(data) {
            try {
                const peerConnection = this.createPeerConnection(data.from);
                
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                
                const answer = await peerConnection.createAnswer({
                    voiceActivityDetection: false
                });
                
                // Set codec preferences
                if (answer.sdp) {
                    answer.sdp = this.preferCodec(answer.sdp, 'video', 'H264');
                    answer.sdp = this.preferCodec(answer.sdp, 'audio', 'opus');
                }
                
                await peerConnection.setLocalDescription(answer);
                
                if (this.socket) {
                    this.socket.emit('answer', {
                        sdp: peerConnection.localDescription,
                        to: data.from,
                        room: this.roomId
                    });
                }
                
            } catch (error) {
                console.error('❌ Error handling offer:', error);
            }
        },
        
        // Handle Answer dari remote
        async handleAnswer(data) {
            try {
                const peerConnection = this.peerConnections[data.from];
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                }
            } catch (error) {
                console.error('❌ Error handling answer:', error);
            }
        },
        
        // Handle ICE Candidate
        async handleIceCandidate(data) {
            try {
                const peerConnection = this.peerConnections[data.from];
                if (peerConnection && data.candidate) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
            }
        },
        
        // Kirim stream ke semua peer
        sendStreamToAllPeers() {
            if (!this.localStream) return;
            
            Object.entries(this.peerConnections).forEach(([userId, pc]) => {
                if (pc.connectionState === 'connected' || pc.connectionState === 'new') {
                    this.sendStreamToPeer(userId, pc);
                }
            });
        },
        
        // Kirim stream ke peer tertentu
        sendStreamToPeer(userId, peerConnection) {
            if (!this.localStream) return;
            
            // Hapus track yang lama
            const senders = peerConnection.getSenders();
            senders.forEach(sender => {
                if (sender.track) {
                    peerConnection.removeTrack(sender);
                }
            });
            
            // Tambahkan track baru
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
            
            this.createOffer(userId, peerConnection);
        },
        
        // Tutup Peer Connection
        closePeerConnection(userId) {
            const peerConnection = this.peerConnections[userId];
            if (peerConnection) {
                peerConnection.close();
                delete this.peerConnections[userId];
            }
            this.removeRemoteVideo(userId);
        },
        
        // Tambahkan video remote
        addRemoteVideo(userId, stream) {
            const existingIndex = this.remoteVideos.findIndex(v => v.userId === userId);
            if (existingIndex >= 0) {
                this.remoteVideos[existingIndex].stream = stream;
            } else {
                this.remoteVideos.push({ userId, stream });
            }
            
            this.updateRemoteVideoElements();
        },
        
        // Hapus video remote
        removeRemoteVideo(userId) {
            this.remoteVideos = this.remoteVideos.filter(v => v.userId !== userId);
            this.updateRemoteVideoElements();
        },
        
        // Update elemen video remote di DOM
        updateRemoteVideoElements() {
            const container = document.getElementById('remoteVideosContainer');
            if (!container) return;
            
            container.innerHTML = '';
            
            this.remoteVideos.forEach(videoData => {
                const videoId = `remoteVideo-${videoData.userId}`;
                
                let videoElement = document.getElementById(videoId);
                
                if (!videoElement) {
                    videoElement = document.createElement('video');
                    videoElement.id = videoId;
                    videoElement.autoplay = true;
                    videoElement.playsInline = true;
                    videoElement.className = 'w-full h-full object-contain';
                    videoElement.volume = 1.0;
                    
                    videoElement.addEventListener('loadedmetadata', () => {
                        if (this.isFullscreenMode) {
                            const container = videoElement.closest('.sharing-video-container.fullscreen-mode');
                            if (container) {
                                this.adjustVideoForFullscreen(container);
                            }
                        }
                    });
                }
                
                if (videoElement.srcObject !== videoData.stream) {
                    videoElement.srcObject = videoData.stream;
                }
                
                // Buat container
                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'sharing-video-container video-container-mobile';
                
                // Live badge
                const liveBadge = document.createElement('div');
                liveBadge.className = 'absolute top-3 md:top-4 left-3 md:left-4';
                liveBadge.innerHTML = `
                    <div class="live-badge text-xs md:text-sm">
                        <i class="fas fa-broadcast-tower mr-1"></i>
                        <span class="hidden sm:inline">SEDANG BERBAGI</span>
                        <span class="sm:hidden">BERBAGI</span>
                    </div>
                `;
                
                // User label
                const userLabel = document.createElement('div');
                userLabel.className = 'absolute bottom-3 md:bottom-4 left-3 md:left-4 user-label';
                userLabel.innerHTML = `<i class="fas fa-user mr-1 md:mr-2"></i>User ${videoData.userId.substring(0, 8)}`;
                
                // Tombol fullscreen
                const fullscreenBtn = document.createElement('button');
                fullscreenBtn.className = 'fullscreen-btn absolute top-3 right-3 md:top-4 md:right-4';
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenBtn.onclick = () => this.toggleFullscreen(`remote-${videoData.userId}`);
                
                videoWrapper.appendChild(videoElement);
                videoWrapper.appendChild(liveBadge);
                videoWrapper.appendChild(userLabel);
                videoWrapper.appendChild(fullscreenBtn);
                container.appendChild(videoWrapper);
            });
        },
        
        // Helper: Tampilkan notifikasi
        showNotification(message, type = 'info') {
            const existingNotifications = document.querySelectorAll('[data-notification]');
            existingNotifications.forEach(n => {
                if (n.parentNode) {
                    document.body.removeChild(n);
                }
            });
            
            const notification = document.createElement('div');
            notification.setAttribute('data-notification', 'true');
            notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 max-w-sm ${type === 'success' ? 'bg-green-900 text-green-100' :
                type === 'error' ? 'bg-red-900 text-red-100' :
                type === 'warning' ? 'bg-yellow-900 text-yellow-100' :
                    'bg-blue-900 text-blue-100'
                }`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${type === 'success' ? 'check-circle' :
                    type === 'error' ? 'exclamation-circle' :
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle'
                } mr-3 flex-shrink-0"></i>
                    <span class="text-sm md:text-base">${message}</span>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, type === 'error' ? 5000 : 3000);
        }
    };
}