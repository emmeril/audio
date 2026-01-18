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
        networkQuality: 'Unknown',
        
        // State fullscreen
        localVideoFullscreen: false,
        remoteVideoFullscreen: false,
        isFullscreenMode: false,
        currentFullscreenVideo: null,
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Audio processing
        audioContext: null,
        audioNodes: null,
        audioMonitorInterval: null,
        
        // Konfigurasi connection attempts
        maxConnectionAttempts: 3,
        connectionAttempts: {},
        
        // Konfigurasi WebRTC
        configuration: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' },
                // TURN server alternatif
                { 
                    urls: 'turn:relay1.expressturn.com:3478',
                    username: 'efT2VOJ3O5Yy',
                    credential: 'lV87P5DkI84k'
                },
                { 
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                { 
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                { 
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            // Konfigurasi untuk audio yang lebih stabil
            encodedInsertableStreams: false,
            forceEncodedAudioInsertableStreams: false,
            forceEncodedVideoInsertableStreams: false
        },
        
        // Audio constraints untuk stabilisasi
        audioConstraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2,
            latency: 0.01
        },
        
        // Inisialisasi
        async init() {
            console.log('🚀 Aplikasi Screen Share dimulai');
            this.generateRoomId();
            
            // Cek kualitas jaringan
            this.checkNetworkQuality();
            
            // Setup socket connection
            this.initializeSocket();
            this.setupMobileFeatures();
            this.setupFullscreenListeners();
            
            // Setup network monitoring
            this.setupNetworkMonitoring();
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
        
        // Setup network monitoring
        setupNetworkMonitoring() {
            // Monitor perubahan koneksi
            if (navigator.connection) {
                navigator.connection.addEventListener('change', () => {
                    this.checkNetworkQuality();
                });
            }
            
            // Periodic network check
            setInterval(() => {
                this.checkNetworkQuality();
            }, 30000);
        },
        
        // Cek kualitas jaringan
        checkNetworkQuality() {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                this.networkQuality = connection.effectiveType || 'Unknown';
                console.log('📶 Network quality:', this.networkQuality);
                
                // Tampilkan warning untuk jaringan lambat
                if (connection.effectiveType === '2g' || connection.downlink < 1) {
                    this.showNotification('Koneksi jaringan lambat, kualitas video mungkin terpengaruh', 'warning');
                }
            }
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
                console.log('🔑 Generated Room ID:', this.roomId);
                this.showNotification(`ID Ruangan dibuat: ${id}`, 'info');
            }
        },
        
        // Toggle Audio
        toggleAudio() {
            console.log('🎵 Audio setting changed to:', this.shareAudio);
            if (this.isSharing) {
                this.showNotification('Restart screen sharing untuk menerapkan perubahan audio', 'info');
            }
        },
        
        // Setup Audio Normalization
        setupAudioNormalization(audioTrack) {
            try {
                if (!audioTrack || !window.AudioContext) {
                    console.log('AudioContext tidak tersedia, melewati normalisasi audio');
                    return;
                }
                
                console.log('🔧 Setting up audio normalization...');
                
                // Cek apakah track sudah memiliki processing
                const settings = audioTrack.getSettings();
                if (settings.autoGainControl) {
                    console.log('✅ Auto gain control sudah aktif di track');
                }
                
                // Buat AudioContext jika belum ada
                if (!this.audioContext || this.audioContext.state === 'closed') {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                        sampleRate: 48000,
                        latencyHint: 'interactive'
                    });
                }
                
                // Buat source dari track audio
                const source = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
                
                // Buat compressor untuk menstabilkan volume
                const compressor = this.audioContext.createDynamicsCompressor();
                compressor.threshold.value = -20;    // Threshold -20 dB
                compressor.knee.value = 10;          // Soft knee 10 dB
                compressor.ratio.value = 4;          // Ratio 4:1
                compressor.attack.value = 0.005;     // Attack 5ms
                compressor.release.value = 0.1;      // Release 100ms
                
                // Buat gain node untuk volume konstan
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0.8; // Volume 80% untuk mencegah clipping
                
                // Buat destination stream
                const destination = this.audioContext.createMediaStreamDestination();
                
                // Hubungkan: source -> compressor -> gain -> destination
                source.connect(compressor);
                compressor.connect(gainNode);
                gainNode.connect(destination);
                
                // Simpan nodes untuk cleanup
                this.audioNodes = { source, compressor, gainNode, destination };
                
                // Ganti audio track di localStream dengan yang sudah diproses
                this.localStream.removeTrack(audioTrack);
                this.localStream.addTrack(destination.stream.getAudioTracks()[0]);
                
                console.log('✅ Audio normalization enabled');
                
                // Log parameter untuk debugging
                console.log('🎛️ Audio processing parameters:', {
                    sampleRate: this.audioContext.sampleRate,
                    compressionRatio: compressor.ratio.value,
                    gain: gainNode.gain.value
                });
                
            } catch (error) {
                console.warn('⚠️ Audio normalization error:', error);
                // Jangan crash jika audio processing gagal
            }
        },
        
        // Monitor kualitas audio
        monitorAudioQuality() {
            if (!this.localStream || !this.shareAudio || this.audioMonitorInterval) return;
            
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length === 0) return;
            
            console.log('📊 Starting audio quality monitoring...');
            
            this.audioMonitorInterval = setInterval(() => {
                try {
                    const track = audioTracks[0];
                    const settings = track.getSettings();
                    
                    // Log audio metrics
                    const stats = {
                        autoGainControl: settings.autoGainControl,
                        echoCancellation: settings.echoCancellation,
                        noiseSuppression: settings.noiseSuppression,
                        sampleRate: settings.sampleRate,
                        channelCount: settings.channelCount
                    };
                    
                    console.log('📈 Audio stats:', stats);
                    
                } catch (error) {
                    console.warn('⚠️ Audio monitoring error:', error);
                }
            }, 5000); // Periksa setiap 5 detik
        },
        
        // Inisialisasi Socket.io
        initializeSocket() {
            console.log('🔌 Menghubungkan ke server...');
            this.socket = io(window.location.origin, {
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 30000,
                transports: ['websocket', 'polling'],
                forceNew: true,
                withCredentials: false
            });
            
            // Event handlers
            this.socket.on('connect', () => {
                console.log('✅ Terhubung ke server. Socket ID:', this.socket.id);
                this.isConnected = true;
                this.socketId = this.socket.id;
                this.showNotification('Terhubung ke server', 'success');
            });
            
            this.socket.on('disconnect', () => {
                console.log('❌ Terputus dari server');
                this.isConnected = false;
                this.showNotification('Terputus dari server', 'error');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('⚠️ Koneksi error:', error);
                this.showNotification('Gagal terhubung ke server. Coba refresh halaman.', 'error');
            });
            
            this.socket.on('room-joined', (data) => {
                console.log('🚪 Berhasil bergabung ke ruangan:', data.roomId);
                console.log('👥 Users in room:', data.users);
                this.usersInRoom = data.userCount;
                this.showNotification(`Bergabung ke ruangan ${data.roomId}`, 'success');
                
                // Reset connection attempts untuk semua user
                this.connectionAttempts = {};
                
                if (window.innerWidth < 1024) {
                    this.mobileMenuActive = 'video';
                }
                
                data.users.forEach(userId => {
                    this.createPeerConnection(userId, true);
                });
            });
            
            this.socket.on('user-connected', (userId) => {
                console.log('👤 User connected:', userId);
                this.usersInRoom++;
                this.showNotification('Pengguna baru bergabung', 'info');
                this.createPeerConnection(userId, true);
            });
            
            this.socket.on('user-disconnected', (userId) => {
                console.log('👤 User disconnected:', userId);
                this.usersInRoom--;
                this.closePeerConnection(userId);
                this.showNotification('Pengguna keluar dari ruangan', 'info');
            });
            
            this.socket.on('offer', async (data) => {
                console.log('📨 Received offer from:', data.from);
                await this.handleOffer(data);
            });
            
            this.socket.on('answer', async (data) => {
                console.log('📨 Received answer from:', data.from);
                await this.handleAnswer(data);
            });
            
            this.socket.on('ice-candidate', async (data) => {
                console.log('🧊 Received ICE candidate from:', data.from);
                await this.handleIceCandidate(data);
            });
            
            this.socket.on('user-sharing-started', (userId) => {
                console.log('📹 User started sharing:', userId);
                this.showNotification('Pengguna lain mulai berbagi layar', 'info');
            });
            
            this.socket.on('user-sharing-stopped', (userId) => {
                console.log('📹 User stopped sharing:', userId);
                this.showNotification('Pengguna lain berhenti berbagi layar', 'info');
            });
        },
        
        // Bergabung ke ruangan
        joinRoom() {
            if (this.roomId && !this.isInRoom) {
                console.log('🚪 Joining room:', this.roomId);
                this.socket.emit('join-room', this.roomId);
                this.isInRoom = true;
                this.showNotification(`Bergabung ke ruangan ${this.roomId}`, 'success');
            }
        },
        
        // Keluar dari ruangan
        leaveRoom() {
            if (this.isInRoom) {
                console.log('🚪 Leaving room:', this.roomId);
                this.stopScreenShare();
                
                Object.keys(this.peerConnections).forEach(userId => {
                    this.closePeerConnection(userId);
                });
                
                this.socket.emit('leave-room');
                this.isInRoom = false;
                this.usersInRoom = 1;
                this.remoteVideos = [];
                this.connectionAttempts = {};
                this.showNotification('Keluar dari ruangan', 'info');
            }
        },
        
        // Mulai berbagi layar
        async startScreenShare() {
            try {
                console.log('🎬 Starting screen share with audio:', this.shareAudio);
                
                // Konfigurasi untuk layar
                const displayOptions = {
                    video: {
                        cursor: "always",
                        displaySurface: "monitor",
                        frameRate: { ideal: 30, max: 60 }
                    }
                };
                
                // Konfigurasi audio jika diaktifkan
                if (this.shareAudio) {
                    // Untuk Chrome/Edge yang mendukung audio sistem
                    if (navigator.userAgent.indexOf('Chrome') > -1) {
                        displayOptions.audio = {
                            echoCancellation: this.audioConstraints.echoCancellation,
                            noiseSuppression: this.audioConstraints.noiseSuppression,
                            autoGainControl: this.audioConstraints.autoGainControl,
                            sampleRate: this.audioConstraints.sampleRate,
                            channelCount: this.audioConstraints.channelCount,
                            suppressLocalAudioPlayback: false
                        };
                        
                        // Tambahkan constraint khusus Chrome
                        displayOptions.audio = {
                            ...displayOptions.audio,
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                chromeMediaSourceId: undefined
                            }
                        };
                    } else {
                        // Untuk browser lain
                        displayOptions.audio = {
                            echoCancellation: this.audioConstraints.echoCancellation,
                            noiseSuppression: this.audioConstraints.noiseSuppression,
                            autoGainControl: this.audioConstraints.autoGainControl
                        };
                    }
                }
                
                console.log('🎛️ Display options:', displayOptions);
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Setup audio normalization jika ada audio track
                if (this.shareAudio && this.localStream.getAudioTracks().length > 0) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    console.log('🔊 Audio track acquired:', {
                        enabled: audioTrack.enabled,
                        muted: audioTrack.muted,
                        settings: audioTrack.getSettings()
                    });
                    
                    // Setup audio normalization
                    this.setupAudioNormalization(audioTrack);
                    
                    // Setup audio track event listeners
                    audioTrack.addEventListener('mute', () => {
                        console.log('🔇 Audio track muted');
                        this.showNotification('Audio dimute oleh sistem', 'warning');
                    });
                    
                    audioTrack.addEventListener('unmute', () => {
                        console.log('🔊 Audio track unmuted');
                    });
                    
                    audioTrack.addEventListener('ended', () => {
                        console.log('⏹️ Audio track ended');
                        this.showNotification('Audio dihentikan', 'info');
                    });
                }
                
                // Setup video di elemen lokal
                const localVideo = this.$refs.localVideo;
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    this.isSharing = true;
                    console.log('✅ Screen sharing started');
                    this.showNotification('Berbagi layar dimulai', 'success');
                    
                    // Monitor kualitas audio
                    if (this.shareAudio) {
                        setTimeout(() => this.monitorAudioQuality(), 2000);
                    }
                    
                    if (window.innerWidth < 1024) {
                        this.mobileMenuActive = 'video';
                    }
                    
                    // Kirim notifikasi ke server
                    this.socket.emit('sharing-started');
                }
                
                // Kirim stream ke semua peer
                this.sendStreamToAllPeers();
                
                // Setup event listener untuk saat user menghentikan sharing dari browser
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.onended = () => {
                        console.log('🛑 Screen sharing stopped by browser');
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
                } else if (error.name === 'OverconstrainedError') {
                    errorMessage = 'Konfigurasi audio/video tidak didukung. Coba nonaktifkan audio.';
                } else {
                    errorMessage += error.message;
                }
                
                this.showNotification(errorMessage, 'error');
            }
        },
        
        // Berhenti berbagi layar
        stopScreenShare() {
            // Hentikan audio monitoring
            if (this.audioMonitorInterval) {
                clearInterval(this.audioMonitorInterval);
                this.audioMonitorInterval = null;
                console.log('📊 Audio monitoring stopped');
            }
            
            // Cleanup audio processing
            if (this.audioNodes) {
                try {
                    if (this.audioNodes.source) {
                        this.audioNodes.source.disconnect();
                    }
                    if (this.audioNodes.compressor) {
                        this.audioNodes.compressor.disconnect();
                    }
                    if (this.audioNodes.gainNode) {
                        this.audioNodes.gainNode.disconnect();
                    }
                    this.audioNodes = null;
                } catch (error) {
                    console.warn('Error cleaning up audio nodes:', error);
                }
            }
            
            // Close audio context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close().then(() => {
                    this.audioContext = null;
                    console.log('🔇 AudioContext closed');
                }).catch(error => {
                    console.warn('Error closing AudioContext:', error);
                });
            }
            
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    track.stop();
                });
                this.localStream = null;
            }
            
            // Clear local video
            const localVideo = this.$refs.localVideo;
            if (localVideo) {
                localVideo.srcObject = null;
            }
            
            // Update state
            this.isSharing = false;
            
            // Remove tracks from peer connections
            Object.values(this.peerConnections).forEach(pc => {
                if (pc && pc.signalingState !== 'closed') {
                    const senders = pc.getSenders();
                    senders.forEach(sender => {
                        if (sender.track) {
                            try {
                                pc.removeTrack(sender);
                            } catch (error) {
                                console.warn('Error removing track:', error);
                            }
                        }
                    });
                }
            });
            
            // Notify server
            this.socket.emit('sharing-stopped');
            
            console.log('🛑 Screen sharing stopped');
            this.showNotification('Berbagi layar dihentikan', 'info');
        },
        
        // Buat Peer Connection
        createPeerConnection(userId, isInitiator = false) {
            if (this.peerConnections[userId]) {
                console.log('⚠️ Peer connection already exists for:', userId);
                return this.peerConnections[userId];
            }
            
            if (!this.connectionAttempts[userId]) {
                this.connectionAttempts[userId] = 0;
            }
            
            if (this.connectionAttempts[userId] >= this.maxConnectionAttempts) {
                console.error(`❌ Maksimum koneksi attempts tercapai untuk ${userId}`);
                this.showNotification('Gagal terhubung dengan peer', 'error');
                return null;
            }
            
            this.connectionAttempts[userId]++;
            
            console.log('🔗 Creating peer connection for:', userId, 'Initiator:', isInitiator, 'Attempt:', this.connectionAttempts[userId]);
            
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            // Tambahkan tracks jika ada localStream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    try {
                        const sender = peerConnection.addTrack(track, this.localStream);
                        console.log('➕ Added track:', track.kind, 'to peer:', userId);
                        
                        // Konfigurasi audio sender untuk kualitas yang lebih baik
                        if (track.kind === 'audio' && sender.setParameters) {
                            const params = sender.getParameters();
                            if (params) {
                                // Prioritaskan audio untuk kualitas yang lebih stabil
                                params.priority = 'high';
                                params.networkPriority = 'high';
                                
                                // Konfigurasi encoding untuk audio
                                if (!params.encodings) {
                                    params.encodings = [{}];
                                }
                                
                                params.encodings[0].active = true;
                                params.encodings[0].priority = 'high';
                                params.encodings[0].networkPriority = 'high';
                                
                                sender.setParameters(params)
                                    .then(() => console.log(`✅ Audio parameters set for ${userId}`))
                                    .catch(err => console.warn(`⚠️ Failed to set audio parameters:`, err));
                            }
                        }
                    } catch (error) {
                        console.error('Error adding track:', error);
                    }
                });
            }
            
            // ICE Candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 ICE Candidate ditemukan untuk', userId);
                    
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: userId,
                        room: this.roomId
                    });
                } else {
                    console.log('✅ All ICE candidates sent to:', userId);
                }
            };
            
            // Track handler
            peerConnection.ontrack = (event) => {
                console.log('📹 Received remote track from:', userId, 'streams:', event.streams.length);
                if (event.streams && event.streams[0]) {
                    this.addRemoteVideo(userId, event.streams[0]);
                }
            };
            
            // ICE Connection State handler
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                console.log(`🧊 ICE State untuk ${userId}: ${state}`);
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    console.log(`⚠️ ICE connection failed for ${userId}`);
                    
                    if (state === 'failed') {
                        this.showNotification('Koneksi gagal, mencoba ulang...', 'warning');
                        setTimeout(() => {
                            if (peerConnection.iceConnectionState !== 'connected' && 
                                peerConnection.iceConnectionState !== 'checking') {
                                this.retryConnection(userId);
                            }
                        }, 2000);
                    }
                }
                
                if (state === 'connected') {
                    console.log(`✅ ICE Connected untuk ${userId}`);
                    this.showNotification('Koneksi peer berhasil', 'success');
                }
            };
            
            // Signaling State handler
            peerConnection.onsignalingstatechange = () => {
                console.log(`📡 Signaling state untuk ${userId}: ${peerConnection.signalingState}`);
            };
            
            // Connection State handler
            peerConnection.onconnectionstatechange = () => {
                console.log(`🔗 Connection state untuk ${userId}: ${peerConnection.connectionState}`);
                
                // Jika koneksi gagal, coba ulang
                if (peerConnection.connectionState === 'failed') {
                    console.log(`❌ Connection failed for ${userId}, retrying...`);
                    this.retryConnection(userId);
                }
            };
            
            // ICE Gathering State handler
            peerConnection.onicegatheringstatechange = () => {
                console.log(`❄️ ICE Gathering state untuk ${userId}: ${peerConnection.iceGatheringState}`);
            };
            
            // Buat offer jika initiator
            if (isInitiator && this.localStream) {
                setTimeout(() => {
                    this.createOffer(userId, peerConnection);
                }, 1000);
            }
            
            return peerConnection;
        },
        
        // Coba ulang koneksi
        retryConnection(userId) {
            if (this.connectionAttempts[userId] < this.maxConnectionAttempts) {
                console.log(`🔄 Mencoba ulang koneksi ke ${userId}, attempt: ${this.connectionAttempts[userId]}`);
                
                this.closePeerConnection(userId);
                
                setTimeout(() => {
                    if (this.isInRoom) {
                        const newPc = this.createPeerConnection(userId, true);
                        if (newPc && this.localStream) {
                            this.createOffer(userId, newPc);
                        }
                    }
                }, 1000 * this.connectionAttempts[userId]);
            } else {
                console.error(`❌ Gagal menghubungkan ke ${userId} setelah ${this.maxConnectionAttempts} percobaan`);
                this.showNotification('Gagal terhubung dengan peer. Coba jaringan yang berbeda.', 'error');
            }
        },
        
        // Buat Offer
        async createOffer(userId, peerConnection) {
            try {
                console.log('📤 Creating offer for:', userId);
                
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: false, // Nonaktifkan VAD untuk volume konstan
                    iceRestart: false
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                console.log('📤 Offer created:', offer.type);
                
                await peerConnection.setLocalDescription(offer);
                
                console.log('📤 Sending offer to:', userId);
                this.socket.emit('offer', {
                    sdp: peerConnection.localDescription,
                    to: userId,
                    room: this.roomId
                });
                
            } catch (error) {
                console.error('❌ Error creating offer:', error);
                this.showNotification('Gagal membuat koneksi peer', 'error');
            }
        },
        
        // Handle Offer dari remote
        async handleOffer(data) {
            try {
                console.log('📥 Handling offer from:', data.from);
                
                const peerConnection = this.createPeerConnection(data.from);
                if (!peerConnection) return;
                
                console.log('📥 Setting remote description for:', data.from);
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                console.log('✅ Remote description set for:', data.from);
                
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                console.log('📤 Sending answer to:', data.from);
                this.socket.emit('answer', {
                    sdp: peerConnection.localDescription,
                    to: data.from,
                    room: this.roomId
                });
                
            } catch (error) {
                console.error('❌ Error handling offer:', error);
                this.showNotification('Gagal memproses koneksi dari peer', 'error');
            }
        },
        
        // Handle Answer dari remote
        async handleAnswer(data) {
            try {
                console.log('📥 Handling answer from:', data.from);
                
                const peerConnection = this.peerConnections[data.from];
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    console.log('✅ Answer processed for:', data.from);
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
                    console.log('🧊 Adding ICE candidate for:', data.from);
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('✅ ICE candidate added for:', data.from);
                } else {
                    console.warn('⚠️ No peer connection for ICE candidate from:', data.from);
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
            
            // Hapus semua track yang ada
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
            
            // Buat offer baru
            this.createOffer(userId, peerConnection);
        },
        
        // Tutup Peer Connection
        closePeerConnection(userId) {
            const peerConnection = this.peerConnections[userId];
            if (peerConnection) {
                try {
                    peerConnection.close();
                } catch (error) {
                    console.warn('Error closing peer connection:', error);
                }
                delete this.peerConnections[userId];
            }
            this.removeRemoteVideo(userId);
            console.log('🔒 Closed peer connection for:', userId);
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
                    
                    // Tambahkan event listener untuk audio
                    videoElement.addEventListener('volumechange', () => {
                        console.log(`🎚️ Remote video volume changed: ${videoElement.volume}`);
                    });
                }
                
                if (videoElement.srcObject !== videoData.stream) {
                    videoElement.srcObject = videoData.stream;
                    
                    // Set volume ke level yang stabil (80%)
                    videoElement.volume = 0.8;
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
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 max-w-sm ${type === 'success' ? 'bg-green-900 text-green-100' : type === 'error' ? 'bg-red-900 text-red-100' : type === 'warning' ? 'bg-yellow-900 text-yellow-100' : 'bg-blue-900 text-blue-100'}`;
            notification.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-3 flex-shrink-0"></i>
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