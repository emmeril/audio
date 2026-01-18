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
        
        // State audio quality
        audioQuality: 'checking',
        audioBitrate: 0,
        audioLevels: [5, 10, 15, 10, 5],
        audioContext: null,
        audioAnalyser: null,
        audioMonitoringIntervals: {},
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Konfigurasi WebRTC dengan optimasi audio
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
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            sdpSemantics: 'unified-plan',
            // Prioritaskan audio
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        },
        
        // Inisialisasi
        init() {
            console.log('🚀 Aplikasi Screen Share dengan Audio Berkualitas dimulai');
            this.generateRoomId();
            this.initializeSocket();
            this.setupMobileFeatures();
            this.setupFullscreenListeners();
            this.setupAudioVisualizer();
        },
        
        // Setup fitur mobile
        setupMobileFeatures() {
            this.isMobile = window.innerWidth < 1024;
            
            window.addEventListener('resize', () => {
                this.isMobile = window.innerWidth < 1024;
            });
            
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
        
        // Setup audio visualizer
        setupAudioVisualizer() {
            this.audioVisualizerInterval = setInterval(() => {
                if (this.isSharing && this.shareAudio) {
                    // Simulasi level audio untuk visualisasi
                    this.audioLevels = this.audioLevels.map(() => 
                        Math.floor(Math.random() * 20) + 5
                    );
                }
            }, 100);
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
        
        // Toggle fullscreen
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
        
        // Toggle fullscreen untuk video remote
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
        
        // Inisialisasi Socket.io
        initializeSocket() {
            console.log('🔌 Menghubungkan ke server...');
            this.socket = io(window.location.origin, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000
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
                this.showNotification('Gagal terhubung ke server', 'error');
            });
            
            this.socket.on('room-joined', (data) => {
                console.log('🚪 Berhasil bergabung ke ruangan:', data.roomId);
                console.log('👥 Users in room:', data.users);
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
                console.log('👤 User connected:', userId);
                this.usersInRoom++;
                this.showNotification('Pengguna baru bergabung', 'info');
                this.createPeerConnection(userId, true);
            });
            
            this.socket.on('user-disconnected', (userId) => {
                console.log('👤 User disconnected:', userId);
                this.usersInRoom--;
                this.closePeerConnection(userId);
                this.cleanupAudioMonitoring(userId);
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
                
                // Cleanup semua monitoring audio
                Object.keys(this.audioMonitoringIntervals).forEach(userId => {
                    this.cleanupAudioMonitoring(userId);
                });
                
                // Tutup semua koneksi peer
                Object.keys(this.peerConnections).forEach(userId => {
                    this.closePeerConnection(userId);
                });
                
                this.socket.emit('leave-room');
                this.isInRoom = false;
                this.usersInRoom = 1;
                this.remoteVideos = [];
                this.audioQuality = 'checking';
                this.audioBitrate = 0;
                this.showNotification('Keluar dari ruangan', 'info');
            }
        },
        
        // Mulai berbagi layar dengan audio berkualitas
        async startScreenShare() {
            try {
                console.log('🎬 Starting screen share with audio:', this.shareAudio);
                
                // Konfigurasi media constraints dengan optimasi audio
                const displayOptions = {
                    video: {
                        cursor: "always",
                        displaySurface: "monitor",
                        frameRate: { ideal: 30, max: 60 },
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 }
                    }
                };
                
                // Konfigurasi audio berdasarkan browser
                if (this.shareAudio) {
                    if (navigator.userAgent.indexOf('Chrome') > -1) {
                        // Optimasi untuk Chrome
                        displayOptions.audio = {
                            autoGainControl: false,
                            echoCancellation: false,
                            noiseSuppression: false,
                            // High quality audio settings
                            sampleRate: 48000,
                            channelCount: 2,
                            sampleSize: 16,
                            suppressLocalAudioPlayback: false,
                            latency: 0.01,
                            volume: 1.0,
                            // Advanced audio settings for Chrome
                            advanced: [
                                { channelCount: 2 },
                                { sampleRate: 48000 },
                                { sampleSize: 16 }
                            ]
                        };
                    } else if (navigator.userAgent.indexOf('Firefox') > -1) {
                        // Optimasi untuk Firefox
                        displayOptions.audio = {
                            mediaSource: "audio",
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                            channelCount: 2,
                            sampleRate: 48000
                        };
                    } else {
                        // Fallback untuk browser lain
                        displayOptions.audio = {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                            channelCount: 2
                        };
                    }
                }
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Optimasi audio track
                if (this.shareAudio && this.localStream.getAudioTracks().length > 0) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    
                    // Apply audio constraints untuk kualitas tinggi
                    const audioConstraints = {
                        // High quality audio settings
                        sampleRate: 48000,
                        channelCount: 2,
                        sampleSize: 16,
                        // Disable processing untuk kualitas asli
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        // Latency rendah
                        latency: 0.01,
                        // Bitrate tinggi
                        bitrate: 128000
                    };
                    
                    try {
                        await audioTrack.applyConstraints(audioConstraints);
                        console.log('✅ Audio constraints applied:', audioConstraints);
                        this.audioQuality = 'excellent';
                        this.audioBitrate = 128;
                    } catch (constraintError) {
                        console.warn('⚠️ Could not apply audio constraints:', constraintError);
                        this.audioQuality = 'good';
                        this.audioBitrate = 64;
                    }
                    
                    // Setup audio event handlers
                    audioTrack.onmute = () => {
                        console.warn('🔇 Audio track muted');
                        this.showNotification('Audio terdeteksi mute', 'warning');
                        this.audioQuality = 'poor';
                    };
                    
                    audioTrack.onunmute = () => {
                        console.log('🔊 Audio track unmuted');
                        this.audioQuality = 'excellent';
                    };
                    
                    audioTrack.addEventListener('ended', () => {
                        console.warn('🔇 Audio track ended');
                        if (this.isSharing) {
                            this.showNotification('Audio berbagi terputus', 'warning');
                            this.audioQuality = 'poor';
                        }
                    });
                    
                    // Start audio monitoring
                    this.startAudioQualityMonitoring();
                } else if (this.shareAudio) {
                    console.warn('⚠️ No audio track available');
                    this.audioQuality = 'poor';
                    this.showNotification('Audio sistem tidak tersedia', 'warning');
                }
                
                // Tampilkan video lokal
                const localVideo = this.$refs.localVideo;
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    this.isSharing = true;
                    
                    console.log('✅ Screen sharing started');
                    console.log('🎵 Audio tracks:', this.localStream.getAudioTracks().length);
                    console.log('📹 Video tracks:', this.localStream.getVideoTracks().length);
                    
                    // Log detail audio
                    if (this.shareAudio && this.localStream.getAudioTracks().length > 0) {
                        const audioTrack = this.localStream.getAudioTracks()[0];
                        const settings = audioTrack.getSettings();
                        console.log('🔊 Audio settings:', {
                            sampleRate: settings.sampleRate,
                            channelCount: settings.channelCount,
                            sampleSize: settings.sampleSize,
                            latency: settings.latency
                        });
                    }
                    
                    this.showNotification('Berbagi layar dimulai' + (this.shareAudio ? ' dengan audio HD' : ''), 'success');
                    
                    // Switch to video view on mobile
                    if (window.innerWidth < 1024) {
                        this.mobileMenuActive = 'video';
                    }
                    
                    // Kirim event ke server
                    this.socket.emit('sharing-started');
                }
                
                // Kirim stream ke semua peer dengan optimasi
                this.sendStreamToAllPeers();
                
                // Handle ketika user stop sharing via browser
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
                    if (this.shareAudio) {
                        errorMessage = 'Konfigurasi audio tidak didukung. Coba nonaktifkan audio sistem.';
                        this.shareAudio = false;
                    } else {
                        errorMessage = 'Konfigurasi video tidak didukung. Coba pilih layar yang berbeda.';
                    }
                } else if (error.name === 'TypeError') {
                    errorMessage = 'Browser tidak mendukung fitur berbagi layar. Gunakan Chrome atau Edge.';
                } else {
                    errorMessage += error.message;
                }
                
                this.showNotification(errorMessage, 'error');
                this.audioQuality = 'poor';
            }
        },
        
        // Start audio quality monitoring
        startAudioQualityMonitoring() {
            this.updateAudioQuality();
            
            // Update kualitas audio secara berkala
            this.audioQualityInterval = setInterval(() => {
                this.updateAudioQuality();
            }, 5000);
        },
        
        // Update audio quality status
        updateAudioQuality() {
            if (!this.isSharing || !this.shareAudio) return;
            
            // Simulasi kualitas audio berdasarkan kondisi
            const networkQuality = this.getNetworkQuality();
            
            if (networkQuality) {
                if (networkQuality.downlink > 5) {
                    this.audioQuality = 'excellent';
                    this.audioBitrate = 128;
                } else if (networkQuality.downlink > 2) {
                    this.audioQuality = 'good';
                    this.audioBitrate = 96;
                } else if (networkQuality.downlink > 1) {
                    this.audioQuality = 'fair';
                    this.audioBitrate = 64;
                } else {
                    this.audioQuality = 'poor';
                    this.audioBitrate = 32;
                }
            } else {
                // Fallback random quality for demo
                const qualities = ['excellent', 'good', 'fair', 'poor'];
                this.audioQuality = qualities[Math.floor(Math.random() * qualities.length)];
                this.audioBitrate = this.audioQuality === 'excellent' ? 128 :
                                   this.audioQuality === 'good' ? 96 :
                                   this.audioQuality === 'fair' ? 64 : 32;
            }
        },
        
        // Get network quality
        getNetworkQuality() {
            if ('connection' in navigator) {
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                if (connection) {
                    return {
                        effectiveType: connection.effectiveType,
                        downlink: connection.downlink,
                        rtt: connection.rtt,
                        saveData: connection.saveData
                    };
                }
            }
            return null;
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
            this.audioQuality = 'checking';
            this.audioBitrate = 0;
            
            // Hentikan monitoring audio
            if (this.audioQualityInterval) {
                clearInterval(this.audioQualityInterval);
            }
            
            // Hentikan semua track di peer connections
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
            
            // Kirim event ke server
            this.socket.emit('sharing-stopped');
            
            console.log('🛑 Screen sharing stopped');
            this.showNotification('Berbagi layar dihentikan', 'info');
        },
        
        // Buat Peer Connection dengan optimasi audio
        createPeerConnection(userId, isInitiator = false) {
            if (this.peerConnections[userId]) {
                console.log('⚠️ Peer connection already exists for:', userId);
                return this.peerConnections[userId];
            }
            
            console.log('🔗 Creating peer connection for:', userId, 'Initiator:', isInitiator);
            
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            // Tambahkan transceiver untuk audio dengan preferensi codec OPUS
            if (this.shareAudio) {
                try {
                    const transceiver = peerConnection.addTransceiver('audio', {
                        direction: 'sendrecv',
                        streams: this.localStream ? [this.localStream] : [],
                        sendEncodings: [{
                            priority: 'high',
                            maxBitrate: 128000,
                            maxFramerate: 60,
                            rid: 'high'
                        }]
                    });
                    
                    // Prioritaskan OPUS codec
                    const codecPreferences = RTCRtpSender.getCapabilities('audio').codecs;
                    const opusCodec = codecPreferences.find(codec => codec.mimeType.includes('opus'));
                    if (opusCodec) {
                        transceiver.setCodecPreferences([opusCodec]);
                        console.log('🔊 Set OPUS codec preference for:', userId);
                    }
                } catch (error) {
                    console.warn('⚠️ Could not configure audio transceiver:', error);
                }
            }
            
            // Tambahkan local stream jika ada
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    const existingSenders = peerConnection.getSenders();
                    const alreadyExists = existingSenders.some(sender => 
                        sender.track && sender.track.kind === track.kind
                    );
                    
                    if (!alreadyExists) {
                        peerConnection.addTrack(track, this.localStream);
                        console.log('➕ Added track:', track.kind, 'to peer:', userId);
                        
                        // Optimasi encoding untuk audio track
                        if (track.kind === 'audio') {
                            const senders = peerConnection.getSenders();
                            const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
                            if (audioSender) {
                                const params = audioSender.getParameters();
                                if (!params) return;
                                
                                params.encodings = [{
                                    active: true,
                                    priority: 'high',
                                    maxBitrate: 128000,
                                    maxFramerate: 60,
                                    rid: 'high'
                                }];
                                
                                audioSender.setParameters(params)
                                    .then(() => console.log('✅ Audio parameters optimized for:', userId))
                                    .catch(err => console.warn('⚠️ Could not set audio parameters:', err));
                            }
                        }
                    }
                });
            }
            
            // ICE Candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Sending ICE candidate to:', userId);
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: userId,
                        room: this.roomId
                    });
                } else {
                    console.log('✅ All ICE candidates sent to:', userId);
                }
            };
            
            // Track handler (menerima stream dari remote)
            peerConnection.ontrack = (event) => {
                console.log('📹 Received remote track from:', userId);
                console.log('🎵 Track kind:', event.track.kind);
                
                if (event.streams && event.streams[0]) {
                    this.addRemoteVideo(userId, event.streams[0]);
                    
                    // Log detail audio track yang diterima
                    const remoteAudioTracks = event.streams[0].getAudioTracks();
                    if (remoteAudioTracks.length > 0) {
                        const audioTrack = remoteAudioTracks[0];
                        const settings = audioTrack.getSettings();
                        console.log('🔊 Received audio settings:', {
                            sampleRate: settings.sampleRate,
                            channelCount: settings.channelCount,
                            latency: settings.latency,
                            state: audioTrack.readyState
                        });
                    }
                }
            };
            
            // ICE Connection State handler
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                console.log(`ICE state for ${userId}:`, state);
                
                if (state === 'connected' || state === 'completed') {
                    console.log(`✅ Audio connection established with ${userId}`);
                    this.monitorAudioQuality(peerConnection, userId);
                }
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    console.log(`⚠️ ICE connection failed for ${userId}`);
                    setTimeout(() => {
                        if (peerConnection.iceConnectionState !== 'connected' && 
                            peerConnection.iceConnectionState !== 'checking') {
                            this.closePeerConnection(userId);
                            this.showNotification(`Koneksi dengan pengguna terputus`, 'warning');
                        }
                    }, 2000);
                }
            };
            
            // Connection State handler
            peerConnection.onconnectionstatechange = () => {
                console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
            };
            
            // Buat offer jika kita adalah initiator
            if (isInitiator && this.localStream) {
                setTimeout(() => {
                    this.createOffer(userId, peerConnection);
                }, 1000);
            }
            
            return peerConnection;
        },
        
        // Buat Offer dengan optimasi audio
        async createOffer(userId, peerConnection) {
            try {
                console.log('📤 Creating offer for:', userId);
                
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                    voiceActivityDetection: true,
                    iceRestart: false
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                
                // Optimasi SDP untuk audio
                let sdp = offer.sdp;
                
                // Prioritaskan audio codec OPUS
                sdp = this.prioritizeAudioCodec(sdp);
                
                // Atur bandwidth audio
                sdp = this.setAudioBandwidth(sdp, 128);
                
                // Update offer dengan SDP yang dioptimasi
                offer.sdp = sdp;
                
                await peerConnection.setLocalDescription(offer);
                
                console.log('📤 Sending optimized offer to:', userId);
                this.socket.emit('offer', {
                    sdp: peerConnection.localDescription,
                    to: userId,
                    room: this.roomId
                });
                
            } catch (error) {
                console.error('❌ Error creating offer:', error);
            }
        },
        
        // Helper: Prioritaskan audio codec
        prioritizeAudioCodec(sdp) {
            const lines = sdp.split('\n');
            let audioSection = false;
            let mLineIndex = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('m=audio')) {
                    audioSection = true;
                    mLineIndex = i;
                } else if (lines[i].startsWith('m=') && !lines[i].startsWith('m=audio')) {
                    audioSection = false;
                }
                
                if (audioSection && lines[i].startsWith('a=rtpmap:')) {
                    if (lines[i].includes('opus')) {
                        const opusLine = lines[i];
                        lines.splice(i, 1);
                        
                        const insertIndex = mLineIndex + 1;
                        lines.splice(insertIndex, 0, opusLine);
                        
                        if (i < lines.length && lines[i].startsWith('a=fmtp:')) {
                            const fmtpLine = lines[i];
                            lines.splice(i, 1);
                            lines.splice(insertIndex + 1, 0, fmtpLine);
                        }
                        break;
                    }
                }
            }
            
            return lines.join('\n');
        },
        
        // Helper: Atur bandwidth audio
        setAudioBandwidth(sdp, bandwidth) {
            const lines = sdp.split('\n');
            let audioSection = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('m=audio')) {
                    audioSection = true;
                } else if (lines[i].startsWith('m=') && !lines[i].startsWith('m=audio')) {
                    audioSection = false;
                }
                
                if (audioSection && lines[i].startsWith('c=')) {
                    lines.splice(i + 1, 0, `b=AS:${bandwidth}`);
                    lines.splice(i + 2, 0, `b=TIAS:${bandwidth * 1000}`);
                    break;
                }
            }
            
            return lines.join('\n');
        },
        
        // Monitor kualitas audio
        monitorAudioQuality(peerConnection, userId) {
            const monitorInterval = setInterval(() => {
                if (!this.peerConnections[userId]) {
                    clearInterval(monitorInterval);
                    return;
                }
                
                try {
                    peerConnection.getStats().then(report => {
                        let audioBytesSent = 0;
                        let audioPacketsSent = 0;
                        let audioPacketsLost = 0;
                        
                        report.forEach(stat => {
                            if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
                                audioBytesSent = stat.bytesSent || 0;
                                audioPacketsSent = stat.packetsSent || 0;
                            }
                            if (stat.type === 'remote-inbound-rtp' && stat.kind === 'audio') {
                                audioPacketsLost = stat.packetsLost || 0;
                                
                                if (audioPacketsSent > 0) {
                                    const lossPercentage = (audioPacketsLost / audioPacketsSent) * 100;
                                    
                                    if (lossPercentage > 5) {
                                        console.warn(`⚠️ High audio packet loss (${lossPercentage.toFixed(2)}%) with ${userId}`);
                                        if (lossPercentage > 20) {
                                            this.showNotification(`Kualitas audio rendah dengan pengguna ${userId.substring(0, 6)}`, 'warning');
                                        }
                                    }
                                }
                            }
                        });
                        
                        if (audioBytesSent > 0) {
                            console.log(`📊 Audio stats for ${userId}:`, {
                                bytesSent: audioBytesSent,
                                packetsSent: audioPacketsSent,
                                packetsLost: audioPacketsLost,
                                estimatedBitrate: Math.round((audioBytesSent * 8) / 1000) + ' kbps'
                            });
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ Could not get audio stats:', error);
                }
            }, 10000);
            
            this.audioMonitoringIntervals[userId] = monitorInterval;
        },
        
        // Cleanup audio monitoring
        cleanupAudioMonitoring(userId) {
            if (this.audioMonitoringIntervals && this.audioMonitoringIntervals[userId]) {
                clearInterval(this.audioMonitoringIntervals[userId]);
                delete this.audioMonitoringIntervals[userId];
            }
        },
        
        // Handle Offer dari remote
        async handleOffer(data) {
            try {
                console.log('📥 Handling offer from:', data.from);
                
                const peerConnection = this.createPeerConnection(data.from);
                
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
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('✅ ICE candidate added for:', data.from);
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
            
            // Buat offer baru
            this.createOffer(userId, peerConnection);
        },
        
        // Tutup Peer Connection
        closePeerConnection(userId) {
            this.cleanupAudioMonitoring(userId);
            
            const peerConnection = this.peerConnections[userId];
            if (peerConnection) {
                peerConnection.close();
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
                
                // Audio indicator untuk remote video
                const audioIndicator = document.createElement('div');
                audioIndicator.className = 'absolute top-3 right-10 md:top-4 md:right-12';
                audioIndicator.innerHTML = '<i class="fas fa-volume-up text-green-400"></i>';
                
                const fullscreenBtn = document.createElement('button');
                fullscreenBtn.className = 'fullscreen-btn absolute top-3 right-3 md:top-4 md:right-4';
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenBtn.onclick = () => this.toggleFullscreen(`remote-${videoData.userId}`);
                
                videoWrapper.appendChild(videoElement);
                videoWrapper.appendChild(userLabel);
                videoWrapper.appendChild(liveBadge);
                videoWrapper.appendChild(audioIndicator);
                videoWrapper.appendChild(fullscreenBtn);
                container.appendChild(videoWrapper);
            });
        },
        
        // Helper: Tampilkan notifikasi dengan style yang lebih baik
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="flex items-start">
                    <i class="fas ${
                        type === 'success' ? 'fa-check-circle' :
                        type === 'error' ? 'fa-exclamation-circle' :
                        type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
                    } mr-3 mt-0.5"></i>
                    <div class="flex-1">
                        <p class="font-medium">${message}</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-gray-300 hover:text-white">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            const container = document.getElementById('notificationContainer') || document.body;
            container.appendChild(notification);
            
            // Hapus notifikasi setelah 5 detik
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }
            }, 5000);
        }
    };
}