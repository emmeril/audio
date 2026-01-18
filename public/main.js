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
        
        // State audio
        audioVolume: 80, // 0-100
        audioQuality: 'checking',
        audioBitrate: 0,
        audioLevels: [5, 10, 15, 10, 5],
        audioMeterValue: 0,
        audioStabilizerEnabled: true,
        
        // Audio processing
        audioContext: null,
        audioAnalyser: null,
        audioSource: null,
        audioGainNode: null,
        audioCompressor: null,
        audioDestination: null,
        processedStream: null,
        
        // Monitoring intervals
        audioMonitoringIntervals: {},
        volumeAdjustmentInterval: null,
        audioVisualizerInterval: null,
        audioMeterInterval: null,
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Konfigurasi WebRTC dengan optimasi audio stabil
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
            encodedInsertableStreams: false,
            forceEncodedAudioInsertableStreams: false,
            forceEncodedVideoInsertableStreams: false,
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
            voiceActivityDetection: false
        },
        
        // Inisialisasi
        init() {
            console.log('🚀 Aplikasi Screen Share dengan Audio Stabil dimulai');
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
                if (this.isSharing && this.shareAudio && this.audioContext) {
                    this.updateAudioLevels();
                } else {
                    // Simulasi level audio untuk visualisasi
                    this.audioLevels = this.audioLevels.map(() => 
                        Math.floor(Math.random() * 15) + 5
                    );
                }
            }, 100);
        },
        
        // Update audio levels dari analyser
        updateAudioLevels() {
            if (!this.audioAnalyser || !this.audioContext) return;
            
            try {
                const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
                this.audioAnalyser.getByteFrequencyData(dataArray);
                
                // Ambil rata-rata dari beberapa frequency bins
                let sum = 0;
                const samples = Math.min(5, dataArray.length);
                for (let i = 0; i < samples; i++) {
                    sum += dataArray[i];
                }
                const average = sum / samples;
                
                // Convert ke level visual (0-20px)
                const level = Math.min(20, Math.max(5, average / 2));
                
                // Update levels dengan smoothing
                this.audioLevels.shift();
                this.audioLevels.push(level);
                
                // Update meter value (0-1)
                this.audioMeterValue = Math.min(1, average / 128);
                
            } catch (error) {
                console.warn('⚠️ Error updating audio levels:', error);
            }
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
        
        // Set Audio Volume
        setAudioVolume(volume) {
            const newVolume = Math.max(0, Math.min(1, volume));
            this.audioVolume = Math.round(newVolume * 100);
            
            // Update gain node jika ada
            if (this.audioGainNode && this.audioContext) {
                const gainValue = newVolume * 0.8 + 0.2; // Range 0.2-1.0 untuk stabilisasi
                this.audioGainNode.gain.value = gainValue;
                console.log('🔊 Volume set to:', this.audioVolume + '%', 'Gain:', gainValue.toFixed(2));
            }
            
            // Kirim update volume ke server (untuk logging)
            if (this.socket && this.isSharing) {
                this.socket.emit('audio-volume', {
                    volume: this.audioVolume
                });
            }
            
            // Update volume untuk remote videos
            this.updateRemoteAudioVolumes();
        },
        
        // Update volume untuk semua video remote
        updateRemoteAudioVolumes() {
            const remoteVideos = document.querySelectorAll('video[id^="remoteVideo-"]');
            const volume = this.audioVolume / 100;
            remoteVideos.forEach(video => {
                video.volume = volume;
            });
        },
        
        // Toggle Audio
        toggleAudio() {
            console.log('🎵 Audio setting changed to:', this.shareAudio);
            if (this.isSharing) {
                this.showNotification('Restart screen sharing untuk menerapkan perubahan audio', 'info');
            }
        },
        
        // Setup Audio Processing dengan Web Audio API
        setupAudioProcessing(audioTrack) {
            try {
                // Hentikan processing sebelumnya
                this.cleanupAudioProcessing();
                
                // Buat AudioContext baru
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext({ 
                    sampleRate: 48000,
                    latencyHint: 'interactive'
                });
                
                // Buat source dari audio track
                this.audioSource = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
                
                // Buat compressor untuk stabilisasi volume
                this.audioCompressor = this.audioContext.createDynamicsCompressor();
                this.audioCompressor.threshold.value = -24; // dB
                this.audioCompressor.knee.value = 30; // dB
                this.audioCompressor.ratio.value = 4; // 4:1 ratio
                this.audioCompressor.attack.value = 0.003; // seconds
                this.audioCompressor.release.value = 0.25; // seconds
                
                // Buat gain node untuk kontrol volume
                this.audioGainNode = this.audioContext.createGain();
                this.audioGainNode.gain.value = (this.audioVolume / 100) * 0.8 + 0.2;
                
                // Buat analyser untuk visualisasi
                this.audioAnalyser = this.audioContext.createAnalyser();
                this.audioAnalyser.fftSize = 256;
                this.audioAnalyser.smoothingTimeConstant = 0.8;
                
                // Buat destination stream
                this.audioDestination = this.audioContext.createMediaStreamDestination();
                
                // Hubungkan chain: source -> compressor -> gain -> analyser -> destination
                this.audioSource.connect(this.audioCompressor);
                this.audioCompressor.connect(this.audioGainNode);
                this.audioGainNode.connect(this.audioAnalyser);
                this.audioAnalyser.connect(this.audioDestination);
                
                // Dapatkan processed track
                this.processedStream = this.audioDestination.stream;
                
                console.log('🔧 Audio processing setup complete');
                console.log('⚙️ Compressor settings:', {
                    threshold: this.audioCompressor.threshold.value,
                    ratio: this.audioCompressor.ratio.value,
                    attack: this.audioCompressor.attack.value,
                    release: this.audioCompressor.release.value
                });
                
                return this.processedStream.getAudioTracks()[0];
                
            } catch (error) {
                console.warn('⚠️ Audio processing not available:', error);
                this.audioStabilizerEnabled = false;
                return audioTrack;
            }
        },
        
        // Cleanup audio processing
        cleanupAudioProcessing() {
            if (this.audioContext) {
                try {
                    this.audioContext.close();
                } catch (e) {}
                this.audioContext = null;
            }
            this.audioSource = null;
            this.audioCompressor = null;
            this.audioGainNode = null;
            this.audioAnalyser = null;
            this.audioDestination = null;
            this.processedStream = null;
        },
        
        // Start audio quality monitoring
        startAudioQualityMonitoring() {
            if (this.audioQualityInterval) {
                clearInterval(this.audioQualityInterval);
            }
            
            this.audioQualityInterval = setInterval(() => {
                this.updateAudioQuality();
            }, 3000);
        },
        
        // Update audio quality status
        updateAudioQuality() {
            if (!this.isSharing || !this.shareAudio) {
                this.audioQuality = 'checking';
                this.audioBitrate = 0;
                return;
            }
            
            // Simulasikan kualitas berdasarkan kondisi
            const networkQuality = this.getNetworkQuality();
            const volumeLevel = this.audioMeterValue;
            
            if (networkQuality) {
                if (networkQuality.downlink > 5 && volumeLevel > 0.3) {
                    this.audioQuality = 'excellent';
                    this.audioBitrate = 128;
                } else if (networkQuality.downlink > 2 && volumeLevel > 0.2) {
                    this.audioQuality = 'good';
                    this.audioBitrate = 96;
                } else if (networkQuality.downlink > 1 && volumeLevel > 0.1) {
                    this.audioQuality = 'fair';
                    this.audioBitrate = 64;
                } else {
                    this.audioQuality = 'poor';
                    this.audioBitrate = 32;
                }
            } else {
                // Fallback
                if (volumeLevel > 0.3) {
                    this.audioQuality = 'good';
                    this.audioBitrate = 96;
                } else if (volumeLevel > 0.1) {
                    this.audioQuality = 'fair';
                    this.audioBitrate = 64;
                } else {
                    this.audioQuality = 'poor';
                    this.audioBitrate = 32;
                }
            }
            
            // Kirim status audio ke server
            if (this.socket && this.isSharing) {
                this.socket.emit('audio-status', {
                    status: this.audioQuality,
                    volume: this.audioVolume,
                    quality: this.audioBitrate
                });
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
            
            this.socket.on('remote-audio-volume', (data) => {
                console.log('🔊 Remote audio volume update:', data.userId, data.volume + '%');
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
        
        // Mulai berbagi layar dengan audio stabil
        async startScreenShare() {
            try {
                console.log('🎬 Starting screen share with audio:', this.shareAudio);
                
                // Konfigurasi media constraints dengan optimasi audio stabil
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
                    // Nonaktifkan semua pengolahan otomatis untuk kontrol manual
                    displayOptions.audio = {
                        autoGainControl: false,
                        echoCancellation: false,
                        noiseSuppression: false,
                        channelCount: { ideal: 2, max: 2 },
                        sampleRate: { ideal: 48000 },
                        sampleSize: { ideal: 16 },
                        suppressLocalAudioPlayback: false,
                        volume: { ideal: 1.0 }
                    };
                }
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Optimasi audio track
                if (this.shareAudio && this.localStream.getAudioTracks().length > 0) {
                    const originalAudioTrack = this.localStream.getAudioTracks()[0];
                    
                    console.log('🔊 Original audio track:', {
                        enabled: originalAudioTrack.enabled,
                        muted: originalAudioTrack.muted,
                        readyState: originalAudioTrack.readyState
                    });
                    
                    // Setup audio processing
                    const processedAudioTrack = this.setupAudioProcessing(originalAudioTrack);
                    
                    // Ganti track asli dengan yang sudah diproses
                    if (processedAudioTrack && processedAudioTrack !== originalAudioTrack) {
                        this.localStream.removeTrack(originalAudioTrack);
                        this.localStream.addTrack(processedAudioTrack);
                        console.log('✅ Audio processing applied');
                        this.audioStabilizerEnabled = true;
                    } else {
                        console.log('⚠️ Using original audio track (no processing)');
                        this.audioStabilizerEnabled = false;
                    }
                    
                    // Setup audio event handlers
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    audioTrack.onmute = () => {
                        console.warn('🔇 Audio track muted');
                        this.showNotification('Audio terdeteksi mute', 'warning');
                    };
                    
                    audioTrack.onunmute = () => {
                        console.log('🔊 Audio track unmuted');
                    };
                    
                    audioTrack.addEventListener('ended', () => {
                        console.warn('🔇 Audio track ended');
                        if (this.isSharing) {
                            this.showNotification('Audio berbagi terputus', 'warning');
                        }
                    });
                    
                    // Start audio monitoring
                    this.startAudioQualityMonitoring();
                    
                    // Start volume meter
                    this.startVolumeMeter();
                } else if (this.shareAudio) {
                    console.warn('⚠️ No audio track available');
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
                    
                    this.showNotification('Berbagi layar dimulai' + (this.shareAudio ? ' dengan audio stabil' : ''), 'success');
                    
                    // Switch to video view on mobile
                    if (window.innerWidth < 1024) {
                        this.mobileMenuActive = 'video';
                    }
                    
                    // Kirim event ke server
                    this.socket.emit('sharing-started');
                }
                
                // Kirim stream ke semua peer
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
            }
        },
        
        // Start volume meter
        startVolumeMeter() {
            if (this.audioMeterInterval) {
                clearInterval(this.audioMeterInterval);
            }
            
            this.audioMeterInterval = setInterval(() => {
                if (!this.isSharing || !this.shareAudio || !this.audioAnalyser) {
                    this.audioMeterValue = 0;
                    return;
                }
                
                try {
                    const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
                    this.audioAnalyser.getByteFrequencyData(dataArray);
                    
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / dataArray.length;
                    
                    // Normalize to 0-1 range
                    this.audioMeterValue = Math.min(1, average / 128);
                    
                } catch (error) {
                    console.warn('⚠️ Error reading audio meter:', error);
                }
            }, 200);
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
            this.audioMeterValue = 0;
            
            // Cleanup audio processing
            this.cleanupAudioProcessing();
            
            // Hentikan monitoring intervals
            if (this.audioQualityInterval) {
                clearInterval(this.audioQualityInterval);
            }
            if (this.audioMeterInterval) {
                clearInterval(this.audioMeterInterval);
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
        
        // Buat Peer Connection dengan optimasi audio stabil
        createPeerConnection(userId, isInitiator = false) {
            if (this.peerConnections[userId]) {
                console.log('⚠️ Peer connection already exists for:', userId);
                return this.peerConnections[userId];
            }
            
            console.log('🔗 Creating peer connection for:', userId, 'Initiator:', isInitiator);
            
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            // Tambahkan transceiver untuk audio
            if (this.shareAudio) {
                try {
                    peerConnection.addTransceiver('audio', {
                        direction: 'sendrecv',
                        streams: this.localStream ? [this.localStream] : []
                    });
                } catch (error) {
                    console.warn('⚠️ Could not add audio transceiver:', error);
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
                    voiceActivityDetection: false,
                    iceRestart: false
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                
                // Optimasi SDP untuk audio stabil
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
            if (this.audioMonitoringIntervals[userId]) {
                clearInterval(this.audioMonitoringIntervals[userId]);
            }
            
            this.audioMonitoringIntervals[userId] = setInterval(() => {
                if (!this.peerConnections[userId]) {
                    clearInterval(this.audioMonitoringIntervals[userId]);
                    delete this.audioMonitoringIntervals[userId];
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
                                    
                                    if (lossPercentage > 10) {
                                        console.warn(`⚠️ High audio packet loss (${lossPercentage.toFixed(2)}%) with ${userId}`);
                                        if (lossPercentage > 20) {
                                            this.showNotification(`Kualitas audio rendah dengan pengguna ${userId.substring(0, 6)}`, 'warning');
                                        }
                                    }
                                }
                            }
                        });
                    });
                } catch (error) {
                    console.warn('⚠️ Could not get audio stats:', error);
                }
            }, 10000);
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
                    videoElement.volume = this.audioVolume / 100;
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
        
        // Helper: Tampilkan notifikasi
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