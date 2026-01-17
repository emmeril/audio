// Debug utilities for WebRTC streaming

class WebRTCDebug {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.debugEnabled = true;
        
        this.init();
    }
    
    init() {
        // Override console methods
        this.overrideConsole();
        
        // Add global error handler
        window.addEventListener('error', this.handleError.bind(this));
        window.addEventListener('unhandledrejection', this.handlePromiseRejection.bind(this));
        
        // Add debug panel to page
        this.addDebugPanel();
        
        console.log('🔧 WebRTC Debug initialized');
    }
    
    overrideConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = (...args) => {
            this.addLog('log', args);
            originalLog.apply(console, args);
        };
        
        console.error = (...args) => {
            this.addLog('error', args);
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };
    }
    
    addLog(type, args) {
        const log = {
            timestamp: new Date().toISOString(),
            type: type,
            message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ')
        };
        
        this.logs.unshift(log);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }
        
        this.updateDebugPanel();
    }
    
    handleError(event) {
        this.addLog('error', [`Uncaught error: ${event.message}`, `at ${event.filename}:${event.lineno}:${event.colno}`]);
    }
    
    handlePromiseRejection(event) {
        this.addLog('error', [`Unhandled promise rejection: ${event.reason}`]);
    }
    
    addDebugPanel() {
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'webrtc-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 300px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            font-family: monospace;
            font-size: 12px;
            border-radius: 8px;
            overflow: hidden;
            z-index: 9999;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            display: none;
        `;
        
        panel.innerHTML = `
            <div style="padding: 10px; background: #333; display: flex; justify-content: space-between; align-items: center;">
                <strong>WebRTC Debug Panel</strong>
                <div>
                    <button id="debug-clear" style="margin-right: 5px; padding: 2px 8px; font-size: 10px;">Clear</button>
                    <button id="debug-toggle" style="padding: 2px 8px; font-size: 10px;">Hide</button>
                </div>
            </div>
            <div id="debug-logs" style="padding: 10px; overflow-y: auto; max-height: 250px;"></div>
        `;
        
        document.body.appendChild(panel);
        
        // Add toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'debug-toggle-btn';
        toggleBtn.textContent = '🐛';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #333;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 20px;
            z-index: 9998;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(toggleBtn);
        
        // Add event listeners
        toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        
        document.getElementById('debug-toggle').addEventListener('click', () => {
            panel.style.display = 'none';
        });
        
        document.getElementById('debug-clear').addEventListener('click', () => {
            this.logs = [];
            this.updateDebugPanel();
        });
    }
    
    updateDebugPanel() {
        const logsElement = document.getElementById('debug-logs');
        if (!logsElement) return;
        
        const logItems = this.logs.slice(0, 10).map(log => {
            const color = log.type === 'error' ? '#ff6b6b' : 
                         log.type === 'warn' ? '#ffd93d' : '#4ecdc4';
            return `
                <div style="margin-bottom: 5px; padding: 5px; border-left: 3px solid ${color}; background: rgba(255,255,255,0.05);">
                    <div style="font-size: 10px; color: #999; margin-bottom: 2px;">
                        ${log.timestamp.split('T')[1].split('.')[0]}
                    </div>
                    <div style="color: ${color}; word-break: break-all;">
                        ${log.message}
                    </div>
                </div>
            `;
        }).join('');
        
        logsElement.innerHTML = logItems || '<div style="color: #999; text-align: center;">No logs yet</div>';
    }
    
    // Public API
    static log(...args) {
        console.log('[WebRTC]', ...args);
    }
    
    static error(...args) {
        console.error('[WebRTC]', ...args);
    }
    
    static warn(...args) {
        console.warn('[WebRTC]', ...args);
    }
    
    static checkMediaTracks(stream) {
        if (!stream) {
            console.error('No stream provided');
            return false;
        }
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        console.log('📹 Video Tracks:', videoTracks.length);
        console.log('🎵 Audio Tracks:', audioTracks.length);
        
        audioTracks.forEach((track, i) => {
            console.log(`Audio Track ${i}:`, {
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                label: track.label,
                kind: track.kind,
                id: track.id
            });
        });
        
        return audioTracks.length > 0;
    }
    
    static getConnectionStats(pc) {
        if (!pc) return null;
        
        return {
            iceConnectionState: pc.iceConnectionState,
            iceGatheringState: pc.iceGatheringState,
            signalingState: pc.signalingState,
            connectionState: pc.connectionState
        };
    }
    
    static async getDetailedStats(pc) {
        if (!pc) return null;
        
        try {
            const stats = await pc.getStats();
            const results = {};
            
            stats.forEach(report => {
                results[report.type] = report;
            });
            
            return results;
        } catch (error) {
            console.error('Error getting stats:', error);
            return null;
        }
    }
}

// Initialize debugger
window.WebRTCDebug = WebRTCDebug;

// Auto-initialize if not in production
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugger = new WebRTCDebug();
    
    // Add global helper functions
    window.debug = {
        log: WebRTCDebug.log,
        error: WebRTCDebug.error,
        warn: WebRTCDebug.warn,
        checkTracks: WebRTCDebug.checkMediaTracks,
        getStats: WebRTCDebug.getConnectionStats,
        getDetailedStats: WebRTCDebug.getDetailedStats
    };
}

console.log('🔧 Debug utilities loaded');
