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
        mobileMenuActive: 'video', // 'controls' atau 'video'
        
        // State fullscreen
        localVideoFullscreen: false,
        remoteVideoFullscreen: false,
        isFullscreenMode: false,
        currentFullscreenVideo: null,
        
        // Objek WebRTC
        socket: null,
        localStream: null,
        peerConnections: {},
        
        // Konfigurasi WebRTC
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
            ]
        },
        
        // Inisialisasi
        init() {
            // console.log('🚀 Aplikasi Screen Share dimulai');
            this.generateRoomId();
            this.initializeSocket();
            this.setupMobileFeatures();
            this.setupFullscreenListeners();
        },
        
        // Setup fitur mobile
        setupMobileFeatures() {
            // Deteksi perangkat mobile
            this.isMobile = window.innerWidth < 1024;
            
            // Update state saat resize
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
            // Deteksi perubahan fullscreen
            document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
            document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
            
            // Keluar fullscreen dengan ESC
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
            
            // Update UI state
            if (!isFullscreen) {
                this.localVideoFullscreen = false;
                this.remoteVideoFullscreen = false;
                this.currentFullscreenVideo = null;
                
                // Sembunyikan backdrop
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
                // Masuk ke fullscreen
                this.enterFullscreen(videoContainer, 'local');
                this.localVideoFullscreen = true;
                this.showNotification('Video lokal masuk mode fullscreen', 'info');
            } else {
                // Keluar dari fullscreen
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
                // Masuk ke fullscreen
                this.enterFullscreen(videoContainer, `remote-${userId}`);
                this.remoteVideoFullscreen = true;
                this.currentFullscreenVideo = userId;
                this.showNotification(`Video pengguna ${userId.substring(0, 6)} masuk mode fullscreen`, 'info');
            } else if (this.currentFullscreenVideo === userId) {
                // Keluar dari fullscreen
                this.exitFullscreen();
                this.remoteVideoFullscreen = false;
                this.currentFullscreenVideo = null;
            }
        },
        
        // Toggle fullscreen untuk semua video remote
        toggleRemoteFullscreen() {
            if (this.remoteVideos.length === 0) return;
            
            // Jika sudah fullscreen, keluar
            if (this.isFullscreenMode && this.remoteVideoFullscreen) {
                this.exitFullscreen();
                this.remoteVideoFullscreen = false;
                return;
            }
            
            // Ambil container pertama sebagai representasi
            const firstVideo = this.remoteVideos[0];
            if (firstVideo) {
                this.toggleRemoteVideoFullscreen(firstVideo.userId);
            }
        },
        
        // Toggle fullscreen untuk semua video
        toggleAllFullscreen() {
            // Jika sudah fullscreen, keluar
            if (this.isFullscreenMode) {
                this.exitFullscreen();
                return;
            }
            
            // Pilih video mana yang akan difullscreen
            if (this.isSharing) {
                this.toggleLocalVideoFullscreen();
            } else if (this.remoteVideos.length > 0) {
                this.toggleRemoteFullscreen();
            }
        },
        
        // Masuk ke mode fullscreen
        enterFullscreen(element, videoType) {
            // Tampilkan backdrop dan tombol close
            const backdrop = document.getElementById('fullscreenBackdrop');
            const closeBtn = document.getElementById('fullscreenCloseBtn');
            if (backdrop) backdrop.classList.add('active');
            if (closeBtn) closeBtn.classList.add('active');
            
            // Tambahkan class fullscreen
            element.classList.add('fullscreen-mode');
            
            // Gunakan Fullscreen API browser
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            } else {
                // Fallback untuk browser yang tidak support Fullscreen API
                this.isFullscreenMode = true;
                this.currentFullscreenVideo = videoType;
            }
        },
        
        // Keluar dari mode fullscreen
        exitFullscreen() {
            // Sembunyikan backdrop dan tombol close
            const backdrop = document.getElementById('fullscreenBackdrop');
            const closeBtn = document.getElementById('fullscreenCloseBtn');
            if (backdrop) backdrop.classList.remove('active');
            if (closeBtn) closeBtn.classList.remove('active');
            
            // Hapus class fullscreen dari semua video container
            document.querySelectorAll('.video-container.fullscreen-mode').forEach(el => {
                el.classList.remove('fullscreen-mode');
            });
            
            // Gunakan Fullscreen API browser untuk exit
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // Update state
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
                // console.log('🔑 Generated Room ID:', this.roomId);
                this.showNotification(`ID Ruangan dibuat: ${id}`, 'info');
            }
        },
        
        // Toggle Audio
        toggleAudio() {
            // console.log('🎵 Audio setting changed to:', this.shareAudio);
            if (this.isSharing) {
                this.showNotification('Restart screen sharing untuk menerapkan perubahan audio', 'info');
            }
        },
        
        // Inisialisasi Socket.io
        initializeSocket() {
            // console.log('🔌 Menghubungkan ke server...');
            this.socket = io(window.location.origin, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000
            });
            
            // Event handlers
            this.socket.on('connect', () => {
                // console.log('✅ Terhubung ke server. Socket ID:', this.socket.id);
                this.isConnected = true;
                this.socketId = this.socket.id;
                this.showNotification('Terhubung ke server', 'success');
            });
            
            this.socket.on('disconnect', () => {
                // console.log('❌ Terputus dari server');
                this.isConnected = false;
                this.showNotification('Terputus dari server', 'error');
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('⚠️ Koneksi error:', error);
                this.showNotification('Gagal terhubung ke server', 'error');
            });
            
            this.socket.on('room-joined', (data) => {
                // console.log('🚪 Berhasil bergabung ke ruangan:', data.roomId);
                // console.log('👥 Users in room:', data.users);
                this.usersInRoom = data.userCount;
                this.showNotification(`Bergabung ke ruangan ${data.roomId}`, 'success');
                
                // Switch to video view on mobile after joining
                if (window.innerWidth < 1024) {
                    this.mobileMenuActive = 'video';
                }
                
                // Buat koneksi dengan user yang sudah ada
                data.users.forEach(userId => {
                    this.createPeerConnection(userId, true);
                });
            });
            
            this.socket.on('user-connected', (userId) => {
                // console.log('👤 User connected:', userId);
                this.usersInRoom++;
                this.showNotification('Pengguna baru bergabung', 'info');
                this.createPeerConnection(userId, true);
            });
            
            this.socket.on('user-disconnected', (userId) => {
                // console.log('👤 User disconnected:', userId);
                this.usersInRoom--;
                this.closePeerConnection(userId);
                this.showNotification('Pengguna keluar dari ruangan', 'info');
            });
            
            this.socket.on('offer', async (data) => {
                // console.log('📨 Received offer from:', data.from);
                await this.handleOffer(data);
            });
            
            this.socket.on('answer', async (data) => {
                // console.log('📨 Received answer from:', data.from);
                await this.handleAnswer(data);
            });
            
            this.socket.on('ice-candidate', async (data) => {
                // console.log('🧊 Received ICE candidate from:', data.from);
                await this.handleIceCandidate(data);
            });
            
            this.socket.on('user-sharing-started', (userId) => {
                // console.log('📹 User started sharing:', userId);
                this.showNotification('Pengguna lain mulai berbagi layar', 'info');
            });
            
            this.socket.on('user-sharing-stopped', (userId) => {
                // console.log('📹 User stopped sharing:', userId);
                this.showNotification('Pengguna lain berhenti berbagi layar', 'info');
            });
        },
        
        // Bergabung ke ruangan
        joinRoom() {
            if (this.roomId && !this.isInRoom) {
                // console.log('🚪 Joining room:', this.roomId);
                this.socket.emit('join-room', this.roomId);
                this.isInRoom = true;
                this.showNotification(`Bergabung ke ruangan ${this.roomId}`, 'success');
            }
        },
        
        // Keluar dari ruangan
        leaveRoom() {
            if (this.isInRoom) {
                // console.log('🚪 Leaving room:', this.roomId);
                this.stopScreenShare();
                
                // Tutup semua koneksi peer
                Object.keys(this.peerConnections).forEach(userId => {
                    this.closePeerConnection(userId);
                });
                
                this.socket.emit('leave-room');
                this.isInRoom = false;
                this.usersInRoom = 1;
                this.remoteVideos = [];
                this.showNotification('Keluar dari ruangan', 'info');
            }
        },
        
        // Mulai berbagi layar
        async startScreenShare() {
            try {
                // console.log('🎬 Starting screen share with audio:', this.shareAudio);
                
                // Konfigurasi untuk getDisplayMedia
                const displayOptions = {
                    video: {
                        cursor: "always",
                        displaySurface: "monitor"
                    },
                    audio: this.shareAudio
                };
                
                // Untuk Chrome, coba capture audio sistem
                if (this.shareAudio && navigator.userAgent.indexOf('Chrome') > -1) {
                    displayOptions.audio = {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100,
                        suppressLocalAudioPlayback: false
                    };
                }
                
                // Minta izin untuk berbagi layar
                this.localStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
                
                // Tampilkan video lokal
                const localVideo = this.$refs.localVideo;
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                    this.isSharing = true;
                    // console.log('✅ Screen sharing started');
                    this.showNotification('Berbagi layar dimulai', 'success');
                    
                    // Switch to video view on mobile when sharing starts
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
                        // console.log('🛑 Screen sharing stopped by browser');
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
            
            // console.log('🛑 Screen sharing stopped');
            this.showNotification('Berbagi layar dihentikan', 'info');
        },
        
        // Buat Peer Connection
        createPeerConnection(userId, isInitiator = false) {
            // Cek apakah koneksi sudah ada
            if (this.peerConnections[userId]) {
                // console.log('⚠️ Peer connection already exists for:', userId);
                return this.peerConnections[userId];
            }
            
            // console.log('🔗 Creating peer connection for:', userId, 'Initiator:', isInitiator);
            
            // Buat RTCPeerConnection baru
            const peerConnection = new RTCPeerConnection(this.configuration);
            this.peerConnections[userId] = peerConnection;
            
            // Tambahkan local stream jika ada
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                    // console.log('➕ Added track:', track.kind, 'to peer:', userId);
                });
            }
            
            // ICE Candidate handler
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // console.log('🧊 Sending ICE candidate to:', userId);
                    this.socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: userId,
                        room: this.roomId
                    });
                } else {
                    // console.log('✅ All ICE candidates sent to:', userId);
                }
            };
            
            // Track handler (menerima stream dari remote)
            peerConnection.ontrack = (event) => {
                // console.log('📹 Received remote track from:', userId);
                if (event.streams && event.streams[0]) {
                    this.addRemoteVideo(userId, event.streams[0]);
                }
            };
            
            // ICE Connection State handler
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                // console.log(`ICE state for ${userId}:`, state);
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    // console.log(`⚠️ ICE connection failed for ${userId}`);
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
                // console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
            };
            
            // Buat offer jika kita adalah initiator
            if (isInitiator && this.localStream) {
                setTimeout(() => {
                    this.createOffer(userId, peerConnection);
                }, 1000);
            }
            
            return peerConnection;
        },
        
        // Buat Offer
        async createOffer(userId, peerConnection) {
            try {
                // console.log('📤 Creating offer for:', userId);
                
                const offerOptions = {
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true
                };
                
                const offer = await peerConnection.createOffer(offerOptions);
                await peerConnection.setLocalDescription(offer);
                
                // console.log('📤 Sending offer to:', userId);
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
                // console.log('📥 Handling offer from:', data.from);
                
                const peerConnection = this.createPeerConnection(data.from);
                
                // Set remote description
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                // console.log('✅ Remote description set for:', data.from);
                
                // Buat dan kirim answer
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                // console.log('📤 Sending answer to:', data.from);
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
                // console.log('📥 Handling answer from:', data.from);
                
                const peerConnection = this.peerConnections[data.from];
                if (peerConnection) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    // console.log('✅ Answer processed for:', data.from);
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
                    // console.log('✅ ICE candidate added for:', data.from);
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
            const peerConnection = this.peerConnections[userId];
            if (peerConnection) {
                peerConnection.close();
                delete this.peerConnections[userId];
            }
            this.removeRemoteVideo(userId);
            // console.log('🔒 Closed peer connection for:', userId);
        },
        
        // Tambahkan video remote
        addRemoteVideo(userId, stream) {
            // Cek apakah video sudah ada
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
                
                // Cek apakah element sudah ada
                let videoElement = document.getElementById(videoId);
                
                if (!videoElement) {
                    videoElement = document.createElement('video');
                    videoElement.id = videoId;
                    videoElement.autoplay = true;
                    videoElement.playsInline = true;
                    videoElement.className = 'w-full h-full object-cover';
                }
                
                // Set stream
                if (videoElement.srcObject !== videoData.stream) {
                    videoElement.srcObject = videoData.stream;
                }
                
                // Buat wrapper untuk video
                const videoWrapper = document.createElement('div');
                videoWrapper.className = 'video-container h-48 md:h-64 lg:h-80';
                
                // Badge user
                const userLabel = document.createElement('div');
                userLabel.className = 'absolute bottom-3 left-3 md:bottom-4 md:left-4 bg-black bg-opacity-70 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm';
                userLabel.innerHTML = `<i class="fas fa-user mr-1 md:mr-2"></i>User ${videoData.userId.substring(0, 6)}`;
                
                // LIVE badge
                const liveBadge = document.createElement('div');
                liveBadge.className = 'live-badge absolute top-3 left-3 md:top-4 md:left-4 text-xs md:text-sm';
                liveBadge.innerHTML = '<i class="fas fa-circle animate-pulse"></i> LIVE';
                
                // Tombol Fullscreen
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
            // Buat notifikasi sederhana
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 transform transition-transform duration-300 max-w-sm ${
                type === 'success' ? 'bg-green-900 text-green-100' :
                type === 'error' ? 'bg-red-900 text-red-100' :
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
            
            // Hapus notifikasi setelah 3 detik
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
