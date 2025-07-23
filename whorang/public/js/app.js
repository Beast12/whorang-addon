/**
 * WhoRang Frontend - Main Application
 * Core functionality and utilities for the WhoRang web interface
 */

class WhoRangApp {
    constructor() {
        this.baseUrl = window.location.origin;
        this.apiUrl = `${this.baseUrl}/api`;
        this.wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initWebSocket();
        this.updateConnectionStatus('connecting');
        
        // Initialize navigation
        this.initNavigation();
        
        console.log('WhoRang App initialized');
    }

    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');

        if (sidebarToggle && sidebar && mainContent) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // Handle mobile navigation
        this.setupMobileNavigation();
    }

    setupMobileNavigation() {
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (event) => {
            const sidebar = document.getElementById('sidebar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            
            if (window.innerWidth <= 768 && sidebar && !sidebar.contains(event.target) && !sidebarToggle.contains(event.target)) {
                sidebar.classList.add('collapsed');
                document.getElementById('mainContent').classList.add('expanded');
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            const sidebar = document.getElementById('sidebar');
            const mainContent = document.getElementById('mainContent');
            
            if (window.innerWidth > 768) {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
            }
        });
    }

    initNavigation() {
        // Set active navigation item based on current page
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.classList.remove('active');
            const href = item.getAttribute('href');
            
            if (href === currentPath || (currentPath === '/' && href === '/')) {
                item.classList.add('active');
            }
        });
    }

    initWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
                
                // Send initial ping
                this.sendMessage({ type: 'ping' });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.updateConnectionStatus('error');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'pong':
                // Handle ping response
                break;
            case 'face_detected':
                this.handleFaceDetected(data.payload);
                break;
            case 'person_recognized':
                this.handlePersonRecognized(data.payload);
                break;
            case 'stats_updated':
                this.handleStatsUpdated(data.payload);
                break;
            case 'system_status':
                this.handleSystemStatus(data.payload);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    handleFaceDetected(payload) {
        this.showToast('New face detected!', 'info');
        // Trigger refresh of relevant components
        this.dispatchEvent('face-detected', payload);
    }

    handlePersonRecognized(payload) {
        this.showToast(`${payload.person_name} recognized`, 'success');
        this.dispatchEvent('person-recognized', payload);
    }

    handleStatsUpdated(payload) {
        this.dispatchEvent('stats-updated', payload);
    }

    handleSystemStatus(payload) {
        this.dispatchEvent('system-status', payload);
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                this.initWebSocket();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.updateConnectionStatus('failed');
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        statusElement.className = `status-indicator ${status}`;
        
        const loadingSpan = statusElement.querySelector('.loading');
        const textSpan = statusElement.querySelector('span:last-child');
        
        switch (status) {
            case 'connecting':
                if (loadingSpan) loadingSpan.style.display = 'inline-block';
                if (textSpan) textSpan.textContent = 'Connecting...';
                break;
            case 'connected':
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.textContent = '🟢 Connected';
                break;
            case 'disconnected':
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.textContent = '🟡 Disconnected';
                break;
            case 'error':
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.textContent = '🔴 Error';
                break;
            case 'failed':
                if (loadingSpan) loadingSpan.style.display = 'none';
                if (textSpan) textSpan.textContent = '❌ Failed';
                break;
        }
    }

    // API Methods
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async getStats() {
        return await this.apiRequest('/stats');
    }

    async getHealth() {
        return await this.apiRequest('/health');
    }

    async getFaces(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.apiRequest(`/faces${queryString ? '?' + queryString : ''}`);
    }

    async getPersons() {
        return await this.apiRequest('/faces/persons');
    }

    async labelFaces(faceIds, personName, createPerson = true) {
        return await this.apiRequest('/faces/label', {
            method: 'POST',
            body: JSON.stringify({
                face_ids: faceIds,
                person_name: personName,
                create_person: createPerson
            })
        });
    }

    async deleteFace(faceId) {
        return await this.apiRequest(`/faces/${faceId}`, {
            method: 'DELETE'
        });
    }


    // Utility Methods
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 1.2em;">&times;</button>
            </div>
        `;

        container.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, duration);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    async refreshData() {
        this.showToast('Refreshing data...', 'info', 2000);
        this.dispatchEvent('refresh-requested');
    }

    // Dialog utilities
    async showConfirm(title, message) {
        return new Promise((resolve) => {
            const confirmed = confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    async showAlert(title, message) {
        return new Promise((resolve) => {
            alert(`${title}\n\n${message}`);
            resolve();
        });
    }

    async showPrompt(title, message, defaultValue = '') {
        return new Promise((resolve) => {
            const result = prompt(`${title}\n\n${message}`, defaultValue);
            resolve(result);
        });
    }

    // HTML escaping utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Image URL helpers (similar to the Home Assistant cards)
    async testImageUrl(url, timeout = 2000) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeoutId = setTimeout(() => {
                resolve(false);
            }, timeout);
            
            img.onload = () => {
                clearTimeout(timeoutId);
                resolve(true);
            };
            
            img.onerror = () => {
                clearTimeout(timeoutId);
                resolve(false);
            };
            
            img.src = url;
        });
    }

    getImageUrlCandidates(faceId) {
        const baseUrl = this.baseUrl;
        return [
            `${baseUrl}/api/faces/${faceId}/image?size=thumbnail`,
            `${baseUrl}/api/faces/${faceId}/image`,
            `${baseUrl}/uploads/faces/${faceId}.jpg`,
            `${baseUrl}/uploads/thumbnails/${faceId}.jpg`
        ];
    }

    async getWorkingImageUrl(faceId) {
        const candidates = this.getImageUrlCandidates(faceId);
        
        for (const url of candidates) {
            if (await this.testImageUrl(url)) {
                return url;
            }
        }
        
        return null;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.whorangApp = new WhoRangApp();
    
    // Make showToast globally available
    window.showToast = (message, type, duration) => {
        if (window.whorangApp) {
            window.whorangApp.showToast(message, type, duration);
        }
    };
});

// Export for use in other scripts
window.WhoRangApp = WhoRangApp;
