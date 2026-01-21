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
        
        // State fullscreen
        localVideoFullscreen: false,
        remoteVideoFullscreen: false,
        isFullscreenMode: false,
        currentFullscreenVideo: null,
        
        // YouTube Music Remote Control
        youtubeMusicMode: false,
        youtubePlaying: false,
        youtubeVolume: 50,
        youtubeCurrentTrack: 'Tidak ada lagu',
        youtubeSearchQuery: '',
        youtubeSearchResults: [],
        showDebugInfo: false,
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Konfigurasi WebRTC dengan audio stabil
        configuration: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                { 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                { 
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            encodedInsertableStreams: false,
            forceEncodedAudioInsertableStreams: false,
            forceEncodedVideoInsertableStreams: false
        },
        
        // Inisialisasi
        init() {
            this.generateRoomId();
            this.initializeSocket();
            this.setupMobileFeatures();
            this.setupFullscreenListeners();
            this.setupYouTubeAutoCheck();
        },
        
        // Setup fitur mobile
        setupMobileFeatures() {
            this.isMobile = window.innerWidth < 1024;
            
            window.addEventListener('resize', () => {
                this.isMobile = window.innerWidth < 1024;
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
        
        // Setup YouTube auto-check
        setupYouTubeAutoCheck() {
            // Auto check YouTube status setiap 5 detik jika di room
            setInterval(() => {
                if (this.isInRoom && !this.isSharing && !this.youtubeMusicMode) {
                    this.socket.emit('check-youtube-host', this.roomId);
                }
            }, 5000);
        },
        
        // Setup listener untuk fullscreen
        setupFullscreenListeners() {
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isFullscreenMode) {
                    this.exitFullscreen();
                }
            });
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
            }
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
            const videoContainer = document.querySelector('.video-container video')?.closest('.video-container');
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
            
            const videoContainer = videoElement.closest('.video-container');
            if (!videoContainer) return;
            
            if (!this.remoteVideoFullscreen) {
                this.enterFullscreen(videoContainer, `remote-${userId}`);
                this.remoteVideoFullscreen = true;
                this.currentFullscreenVideo = userId;
                this.showNotification(`Video pengguna ${userId.substring(0, 6)} masuk mode fullscreen`, 'info');
            } else if (this.currentFullscreenVideo === userId) {
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
            }
        },
        
        // Keluar dari mode fullscreen
        exitFullscreen() {
            const backdrop = document.getElementById('fullscreenBackdrop');
            const closeBtn = document.getElementById('fullscreenCloseBtn');
            if (backdrop) backdrop.classList.remove('active');
            if (closeBtn) closeBtn.classList.remove('active');
            
            document.querySelectorAll('.video-container.fullscreen-mode').forEach(el => {
                el.classList.remove('fullscreen-mode');
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
        
        // Toggle Audio
        toggleAudio() {
            if (this.isSharing) {
                this.showNotification('Restart screen sharing untuk menerapkan perubahan audio', 'info');
            }
        },
        
        // Inisialisasi Socket.io dengan YouTube Music handlers
        initializeSocket() {
            this.socket = io(window.location.origin, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000
            });
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.socketId = this.socket.id;
                this.showNotification('Terhubung ke server', 'success');
                console.log('✅ Socket connected:', this.socketId);
                
                // Cek YouTube status jika sudah di room
                if (this.isInRoom) {
                    setTimeout(() => {
                        this.socket.emit('check-youtube-host', this.roomId);
                    }, 1000);
                }
            });
            
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.showNotification('Terputus dari server', 'error');
                console.log('❌ Socket disconnected');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('⚠️ Koneksi error:', error);
                this.showNotification('Gagal terhubung ke server', 'error');
            });
            
            this.socket.on('room-joined', (data) => {
                this.usersInRoom = data.userCount;
                this.showNotification(`Bergabung ke ruangan ${data.roomId}`, 'success');
                console.log(`🚪 Joined room: ${data.roomId}, users: ${data.userCount}`);
                
                if (window.innerWidth < 1024) {
                    this.mobileMenuActive = 'video';
                }
                
                data.users.forEach(userId => {
                    this.createPeerConnection(userId, true);
                });
                
                // Cek status YouTube Music session
                setTimeout(() => {
                    this.socket.emit('check-youtube-host', this.roomId);
                }, 2000);
            });
            
            this.socket.on('user-connected', (userId) => {
                this.usersInRoom++;
                this.showNotification('Pengguna baru bergabung', 'info');
                console.log(`👤 User connected: ${userId}`);
                this.createPeerConnection(userId, true);
            });
            
            this.socket.on('user-disconnected', (userId) => {
                this.usersInRoom--;
                this.closePeerConnection(userId);
                this.showNotification('Pengguna keluar dari ruangan', 'info');
                console.log(`👤 User disconnected: ${userId}`);
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
            
            // YouTube Music handlers
            this.socket.on('youtube-music-command', (data) => {
                console.log('🎵 Received YouTube command:', data);
                this.handleYouTubeCommand(data);
            });
            
            this.socket.on('youtube-session-info', (session) => {
                console.log('🎵 YouTube session info:', session);
                this.updateYouTubeSession(session);
            });
            
            this.socket.on('youtube-host-disconnected', () => {
                console.log('🎵 YouTube host disconnected');
                if (!this.isSharing) {
                    this.youtubeMusicMode = false;
                    this.youtubePlaying = false;
                    this.showNotification('Host YouTube Music telah keluar', 'info');
                }
            });
            
            this.socket.on('youtube-broadcast-status', (data) => {
                console.log('🎵 YouTube broadcast status:', data);
                this.handleYouTubeBroadcast(data);
            });
            
            this.socket.on('youtube-host-check-response', (data) => {
                console.log('🎵 YouTube host check response:', data);
                this.handleHostCheckResponse(data);
            });
            
            this.socket.on('youtube-control-error', (error) => {
                console.error('🎵 YouTube control error:', error);
                this.showNotification(`YouTube Error: ${error.message}`, 'error');
            });
            
            this.socket.on('youtube-status-update', (status) => {
                console.log('🎵 YouTube status update:', status);
                this.youtubePlaying = status.playing;
                this.youtubeVolume = status.volume;
                if (status.currentTrack) {
                    this.youtubeCurrentTrack = status.currentTrack;
                }
            });
        },
        
        // YouTube Music: Toggle mode
        toggleYouTubeMusicMode() {
            if (!this.isInRoom) {
                this.showNotification('Gabung ruangan terlebih dahulu', 'error');
                this.youtubeMusicMode = false;
                return;
            }
            
            if (!this.isSharing) {
                // Viewer tidak bisa toggle mode, hanya bisa cek status
                this.socket.emit('check-youtube-host', this.roomId);
                this.showNotification('Mengecek status host YouTube Music...', 'info');
                return;
            }
            
            // Host bisa toggle mode
            const newMode = !this.youtubeMusicMode;
            this.youtubeMusicMode = newMode;
            
            if (newMode) {
                // Aktifkan sebagai host
                this.socket.emit('register-youtube-host', {
                    roomId: this.roomId,
                    hostSocketId: this.socketId,
                    hostName: 'Host'
                });
                
                // Broadcast status ke semua user
                setTimeout(() => {
                    this.socket.emit('broadcast-youtube-status', {
                        roomId: this.roomId,
                        status: {
                            hostActive: true,
                            hostSocketId: this.socketId,
                            hostName: 'Host',
                            playing: this.youtubePlaying,
                            volume: this.youtubeVolume,
                            currentTrack: this.youtubeCurrentTrack
                        }
                    });
                }, 500);
                
                this.showNotification('YouTube Music Remote aktif sebagai Host', 'success');
                console.log('🎵 YouTube Music mode enabled as Host');
            } else {
                // Nonaktifkan
                this.socket.emit('unregister-youtube-host', this.roomId);
                
                // Reset state
                this.youtubePlaying = false;
                this.youtubeCurrentTrack = 'Tidak ada lagu';
                this.youtubeVolume = 50;
                
                this.showNotification('YouTube Music Remote dinonaktifkan', 'info');
                console.log('🎵 YouTube Music mode disabled');
            }
        },
        
        // YouTube Music: Check host status
        checkYouTubeHostStatus() {
            if (!this.isInRoom) {
                this.showNotification('Gabung ruangan terlebih dahulu', 'error');
                return;
            }
            
            this.socket.emit('check-youtube-host', this.roomId);
            this.showNotification('Mengecek status host YouTube Music...', 'info');
            console.log('🎵 Checking YouTube host status for room:', this.roomId);
        },
        
        // YouTube Music: Send command
        sendYouTubeCommand(action, value = null) {
            console.log('🎵 Sending YouTube command:', action, value);
            
            if (!this.isInRoom) {
                this.showNotification('Gabung ruangan terlebih dahulu', 'error');
                return;
            }
            
            if (!this.youtubeMusicMode) {
                // Jika belum terhubung, cek dulu
                this.socket.emit('check-youtube-host', this.roomId);
                setTimeout(() => {
                    if (this.youtubeMusicMode) {
                        this.sendCommand(action, value);
                    } else {
                        this.showNotification('Tidak terhubung ke host YouTube Music', 'error');
                    }
                }, 500);
                return;
            }
            
            this.sendCommand(action, value);
        },
        
        // Helper untuk mengirim command
        sendCommand(action, value) {
            this.socket.emit('youtube-music-control', {
                roomId: this.roomId,
                action,
                value,
                from: this.socketId
            });
            
            // Update local state untuk feedback langsung
            this.updateLocalState(action, value);
        },
        
        // Update local state berdasarkan command
        updateLocalState(action, value) {
            switch(action) {
                case 'play':
                    this.youtubePlaying = true;
                    this.showNotification('Memutar musik', 'info');
                    break;
                case 'pause':
                    this.youtubePlaying = false;
                    this.showNotification('Menjeda musik', 'info');
                    break;
                case 'next':
                    this.showNotification('Lagu berikutnya', 'info');
                    break;
                case 'previous':
                    this.showNotification('Lagu sebelumnya', 'info');
                    break;
                case 'volume':
                    this.youtubeVolume = value;
                    this.showNotification(`Volume: ${value}%`, 'info');
                    break;
                case 'playTrack':
                    this.youtubeCurrentTrack = value;
                    this.youtubePlaying = true;
                    this.showNotification(`Memutar: ${value}`, 'success');
                    break;
                case 'search':
                    this.youtubeSearchQuery = value;
                    this.showNotification(`Mencari: ${value}`, 'info');
                    break;
            }
        },
        
        // YouTube Music: Handle perintah dari remote (untuk host)
        handleYouTubeCommand(data) {
            if (!this.isSharing || !this.youtubeMusicMode) return;
            
            const { action, value, from } = data;
            console.log(`🎵 Host received command from ${from}:`, action, value);
            
            // Update state lokal host
            this.updateLocalState(action, value);
            
            // Kirim status update ke semua user
            this.socket.emit('youtube-status-update', {
                playing: this.youtubePlaying,
                volume: this.youtubeVolume,
                currentTrack: this.youtubeCurrentTrack
            });
            
            // Log untuk debugging
            this.logToDebug(`Command from ${from.substring(0, 6)}: ${action} ${value || ''}`);
        },
        
        // YouTube Music: Update session info
        updateYouTubeSession(session) {
            this.youtubeMusicMode = true;
            this.youtubePlaying = session.playing;
            this.youtubeVolume = session.volume;
            if (session.currentTrack) {
                this.youtubeCurrentTrack = session.currentTrack;
            }
            console.log('🎵 YouTube session updated:', session);
        },
        
        // YouTube Music: Handle broadcast status
        handleYouTubeBroadcast(data) {
            if (data.roomId !== this.roomId) return;
            
            console.log('🎵 Handling YouTube broadcast:', data);
            
            if (data.status.hostActive) {
                this.youtubeMusicMode = true;
                this.youtubePlaying = data.status.playing;
                this.youtubeVolume = data.status.volume;
                this.youtubeCurrentTrack = data.status.currentTrack || 'Tidak ada lagu';
                
                if (!this.isSharing) {
                    this.showNotification('Terhubung ke host YouTube Music', 'success');
                }
            } else {
                this.youtubeMusicMode = false;
                if (!this.isSharing) {
                    this.showNotification('Host YouTube Music tidak aktif', 'info');
                }
            }
        },
        
        // YouTube Music: Handle host check response
        handleHostCheckResponse(data) {
            console.log('🎵 Host check response:', data);
            
            if (data.hasHost) {
                this.youtubeMusicMode = true;
                this.youtubePlaying = data.playing;
                this.youtubeVolume = data.volume;
                if (data.currentTrack) {
                    this.youtubeCurrentTrack = data.currentTrack;
                }
                this.showNotification('Terhubung ke host YouTube Music', 'success');
            } else {
                this.youtubeMusicMode = false;
                if (!this.isSharing) {
                    this.showNotification('Host YouTube Music tidak ditemukan', 'info');
                }
            }
        },
        
        // YouTube Music: Search
        searchYouTubeMusic() {
            if (this.youtubeSearchQuery.trim()) {
                this.sendYouTubeCommand('search', this.youtubeSearchQuery);
                
                // Simulasi hasil pencarian
                this.youtubeSearchResults = [
                    { id: 1, title: `${this.youtubeSearchQuery} - Original Mix`, duration: '3:45' },
                    { id: 2, title: `${this.youtubeSearchQuery} - Acoustic Version`, duration: '4:20' },
                    { id: 3, title: `${this.youtubeSearchQuery} - Remix 2024`, duration: '3:15' },
                    { id: 4, title: `Best of ${this.youtubeSearchQuery}`, duration: '1:00:00' }
                ];
            }
        },
        
        // YouTube Music: Select track
        selectYouTubeTrack(track) {
            this.youtubeCurrentTrack = track.title;
            this.sendYouTubeCommand('playTrack', track.title);
            this.youtubeSearchResults = [];
            this.youtubeSearchQuery = '';
        },
        
        // Toggle debug info
        toggleDebugInfo() {
            this.showDebugInfo = !this.showDebugInfo;
        },
        
        // Log ke debug panel
        logToDebug(message) {
            const debugPanel = document.getElementById('debugPanel');
            if (debugPanel && debugPanel.style.display === 'block') {
                const timestamp = new Date().toLocaleTimeString();
                debugPanel.innerHTML += `[${timestamp}] ${message}<br>`;
                debugPanel.scrollTop = debugPanel.scrollHeight;
            }
        },
        
        // Bergabung ke ruangan
        joinRoom() {
            if (this.roomId && !this.isInRoom) {
                this.socket.emit('join-room', this.roomId);
                this.isInRoom = true;
                this.showNotification(`Bergabung ke ruangan ${this.roomId}`, 'success');
                console.log(`🚪 Joining room: ${this.roomId}`);
            }
        },
        
        // Keluar dari ruangan
        leaveRoom() {
            if (this.isInRoom) {
                this.stopScreenShare();
                
                // Unregister YouTube host jika aktif
                if (this.youtubeMusicMode) {
                    this.socket.emit('unregister-youtube-host', this.roomId);
                }
                
                Object.keys(this.peerConnections).forEach(userId => {
                    this.closePeerConnection(userId);
                });
                
                this.socket.emit('leave-room');
                this.isInRoom = false;
                this.usersInRoom = 1;
                this.remoteVideos = [];
                this.youtubeMusicMode = false;
                this.youtubePlaying = false;
                this.youtubeCurrentTrack = 'Tidak ada lagu';
                this.youtubeVolume = 50;
                this.showNotification('Keluar dari ruangan', 'info');
                console.log('🚪 Left room');
            }
        },
        
        // Mulai berbagi layar dengan audio yang stabil
        async startScreenShare() {
            try {
                // Konfigurasi video
                const displayOptions = {
                    video: {
                        cursor: "always",
                        displaySurface: "monitor",
                        frameRate: { ideal: 30, max: 30 },
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 }
                    }
                };
                
                // Konfigurasi audio khusus untuk volume stabil
                if (this.shareAudio) {
                    displayOptions.audio = {
                        autoGainControl: false,
                        noiseSuppression: false,
                        echoCancellation: false,
                        channelCount: 2,
                        sampleRate: 48000,
                        sampleSize: 16,
                        volume: 1.0,
                        googAutoGainControl: false,
                        googNoiseSuppression: false,
                        googHighpassFilter: false,
                        googEchoCancellation: false,
                        mozAutoGainControl: false,
                        mozNoiseSuppression: false,
                        mozEchoCancellation: false
                    };
                }
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Optimasi audio track jika ada
                if (this.shareAudio && this.localStream.getAudioTracks().length > 0) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    
                    try {
                        await audioTrack.applyConstraints({
                            autoGainControl: false,
                            noiseSuppression: false,
                            echoCancellation: false,
                            volume: 1.0
                        });
                        
                        const settings = audioTrack.getSettings();
                        console.log('🎵 Audio settings:', settings);
                        
                    } catch (constraintError) {
                        console.warn('⚠️ Tidak bisa apply constraints audio:', constraintError);
                    }
                }
                
                // Tampilkan video lokal
                const localVideo = this.$refs.localVideo;
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    this.isSharing = true;
                    this.showNotification('Berbagi layar dimulai', 'success');
                    
                    // Atur volume tetap maksimal
                    localVideo.volume = 1.0;
                    
                    if (window.innerWidth < 1024) {
                        this.mobileMenuActive = 'video';
                    }
                    
                    this.socket.emit('sharing-started');
                }
                
                // Kirim stream ke semua peer
                this.sendStreamToAllPeers();
                
                // Handle ketika user stop sharing via browser
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.onended = () => {
                        this.stopScreenShare();
                    };
                }
                
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
            this.youtubeMusicMode = false;
            
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
            
            this.socket.emit('sharing-stopped');
            this.socket.emit('unregister-youtube-host', this.roomId);
            this.showNotification('Berbagi layar dihentikan', 'info');
        },
        
        // Buat Peer Connection dengan audio yang stabil
        createPeerConnection(userId, isInitiator = false) {
            if (this.peerConnections[userId]) {
                return this.peerConnections[userId];
            }
            
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    if (track.kind === 'audio') {
                        const sender = peerConnection.addTrack(track, this.localStream);
                        
                        if (sender && sender.track) {
                            const params = sender.getParameters();
                            if (!params.encodings) {
                                params.encodings = [{}];
                            }
                            params.encodings[0].maxBitrate = 128000;
                            sender.setParameters(params).catch(e => console.warn('Set parameters error:', e));
                        }
                    } else {
                        peerConnection.addTrack(track, this.localStream);
                    }
                });
            }
            
            // ICE Candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: userId,
                        room: this.roomId
                    });
                }
            };
            
            // Track handler (menerima stream dari remote)
            peerConnection.ontrack = (event) => {
                if (event.streams && event.streams[0]) {
                    this.addRemoteVideo(userId, event.streams[0]);
                    
                    const videoElement = document.getElementById(`remoteVideo-${userId}`);
                    if (videoElement) {
                        videoElement.volume = 1.0;
                    }
                }
            };
            
            // ICE Connection State handler
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    setTimeout(() => {
                        if (peerConnection.iceConnectionState !== 'connected' && 
                            peerConnection.iceConnectionState !== 'checking') {
                            this.closePeerConnection(userId);
                        }
                    }, 2000);
                }
            };
            
            // Connection State handler
            peerConnection.onconnectionstatechange = () => {
                if (peerConnection.connectionState === 'connected') {
                    console.log(`✅ Connected to ${userId}`);
                }
            };
            
            if (isInitiator && this.localStream) {
                setTimeout(() => {
                    this.createOffer(userId, peerConnection);
                }, 1000);
            }
            
            return peerConnection;
        },
        
        // Buat Offer dengan audio constraint yang stabil
        async createOffer(userId, peerConnection) {
            try {
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: false,
                    iceRestart: false
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                await peerConnection.setLocalDescription(offer);
                
                this.socket.emit('offer', {
                    sdp: peerConnection.localDescription,
                    to: userId,
                    room: this.roomId
                });
                
            } catch (error) {
                console.error('❌ Error creating offer:', error);
            }
        },
        
        // Handle Offer dari remote
        async handleOffer(data) {
            try {
                const peerConnection = this.createPeerConnection(data.from);
                
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                
                const answer = await peerConnection.createAnswer({
                    voiceActivityDetection: false
                });
                await peerConnection.setLocalDescription(answer);
                
                this.socket.emit('answer', {
                    sdp: peerConnection.localDescription,
                    to: data.from,
                    room: this.roomId
                });
                
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
                } else {
                    console.error('❌ No peer connection found for:', data.from);
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
            
            // Tambahkan track baru dengan constraint audio
            this.localStream.getTracks().forEach(track => {
                const sender = peerConnection.addTrack(track, this.localStream);
                
                if (track.kind === 'audio' && sender) {
                    setTimeout(() => {
                        try {
                            const params = sender.getParameters();
                            if (!params.encodings) {
                                params.encodings = [{}];
                            }
                            params.encodings[0].maxBitrate = 128000;
                            params.encodings[0].priority = 'high';
                            sender.setParameters(params);
                        } catch (e) {
                            console.warn('Failed to set audio parameters:', e);
                        }
                    }, 100);
                }
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
                    videoElement.className = 'w-full h-full object-cover';
                    videoElement.volume = 1.0;
                }
                
                if (videoElement.srcObject !== videoData.stream) {
                    videoElement.srcObject = videoData.stream;
                }
                
                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'video-container h-48 md:h-64 lg:h-80';
                
                const userLabel = document.createElement('div');
                userLabel.className = 'absolute bottom-3 left-3 md:bottom-4 md:left-4 bg-black bg-opacity-70 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm';
                userLabel.innerHTML = `<i class="fas fa-user mr-1 md:mr-2"></i>User ${videoData.userId.substring(0, 6)}`;
                
                const liveBadge = document.createElement('div');
                liveBadge.className = 'live-badge absolute top-3 left-3 md:top-4 md:left-4 text-xs md:text-sm';
                liveBadge.innerHTML = '<i class="fas fa-circle animate-pulse"></i> LIVE';
                
                const fullscreenBtn = document.createElement('button');
                fullscreenBtn.className = 'fullscreen-btn absolute top-3 right-3 md:top-4 md:right-4';
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenBtn.onclick = () => this.toggleFullscreen(`remote-${videoData.userId}`);
                
                videoWrapper.appendChild(videoElement);
                videoWrapper.appendChild(userLabel);
                videoWrapper.appendChild(liveBadge);
                videoWrapper.appendChild(fullscreenBtn);
                container.appendChild(videoWrapper);
            });
        },
        
        // Helper: Tampilkan notifikasi
        showNotification(message, type = 'info') {
            // Hapus notifikasi sebelumnya
            const existingNotifications = document.querySelectorAll('[data-notification]');
            existingNotifications.forEach(n => {
                if (n.parentNode) {
                    document.body.removeChild(n);
                }
            });
            
            const notification = document.createElement('div');
            notification.setAttribute('data-notification', 'true');
            notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 max-w-sm ${
                type === 'success' ? 'bg-green-900 text-green-100' :
                type === 'error' ? 'bg-red-900 text-red-100' :
                type === 'youtube' ? 'youtube-notification' :
                'bg-blue-900 text-blue-100'
            }`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${
                        type === 'success' ? 'check-circle' :
                        type === 'error' ? 'exclamation-circle' : 'info-circle'
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
            }, 3000);
        }
    };
}