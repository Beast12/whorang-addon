/**
 * WhoRang Dashboard - Dashboard-specific functionality
 */

class Dashboard {
    constructor() {
        this.app = null;
        this.refreshInterval = null;
        this.refreshIntervalMs = 30000; // 30 seconds
        
        this.init();
    }

    init() {
        // Wait for the main app to be initialized
        if (window.whorangApp) {
            this.app = window.whorangApp;
            this.setupDashboard();
        } else {
            // Wait for app initialization
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    this.app = window.whorangApp;
                    this.setupDashboard();
                }, 100);
            });
        }
    }

    setupDashboard() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
        
        console.log('Dashboard initialized');
    }

    setupEventListeners() {
        // Refresh button
        document.addEventListener('refresh-requested', () => {
            this.loadInitialData();
        });

        // WebSocket events
        document.addEventListener('stats-updated', (event) => {
            this.updateStats(event.detail);
        });

        document.addEventListener('face-detected', () => {
            this.loadRecentDetections();
        });

        document.addEventListener('person-recognized', () => {
            this.loadRecentDetections();
        });

        // Quick action buttons
        const triggerDetectionBtn = document.getElementById('triggerDetection');
        if (triggerDetectionBtn) {
            triggerDetectionBtn.addEventListener('click', () => {
                this.triggerTestDetection();
            });
        }

        const viewAllDetectionsBtn = document.getElementById('viewAllDetections');
        if (viewAllDetectionsBtn) {
            viewAllDetectionsBtn.addEventListener('click', () => {
                // Navigate to a detections page (to be implemented)
                this.app.showToast('Detections page coming soon!', 'info');
            });
        }

        const refreshAiStatusBtn = document.getElementById('refreshAiStatus');
        if (refreshAiStatusBtn) {
            refreshAiStatusBtn.addEventListener('click', () => {
                this.loadAiProviderStatus();
            });
        }
    }

    async loadInitialData() {
        try {
            // Load all dashboard data in parallel
            await Promise.all([
                this.loadStats(),
                this.loadRecentDetections(),
                this.loadFaceProgress(),
                this.loadAiProviderStatus(),
                this.checkSystemHealth()
            ]);
        } catch (error) {
            console.error('Failed to load initial dashboard data:', error);
            this.app.showToast('Failed to load dashboard data', 'error');
        }
    }

    async loadStats() {
        try {
            const stats = await this.app.getStats();
            this.updateStats(stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
            this.showStatsError();
        }
    }

    updateStats(stats) {
        // Update total visitors
        const totalVisitorsEl = document.getElementById('totalVisitors');
        if (totalVisitorsEl) {
            totalVisitorsEl.textContent = this.app.formatNumber(stats.total || 0);
        }

        // Update today's activity
        const todayActivityEl = document.getElementById('todayActivity');
        if (todayActivityEl) {
            todayActivityEl.textContent = this.app.formatNumber(stats.today || 0);
        }

        // Update known persons (we'll get this from a separate API call)
        this.loadKnownPersonsCount();
    }

    async loadKnownPersonsCount() {
        try {
            const persons = await this.app.getPersons();
            const knownPersonsEl = document.getElementById('knownPersons');
            if (knownPersonsEl) {
                const count = Array.isArray(persons) ? persons.length : 0;
                knownPersonsEl.textContent = this.app.formatNumber(count);
            }
        } catch (error) {
            console.error('Failed to load known persons count:', error);
            const knownPersonsEl = document.getElementById('knownPersons');
            if (knownPersonsEl) {
                knownPersonsEl.textContent = '0';
            }
        }
    }

    async checkSystemHealth() {
        try {
            const health = await this.app.getHealth();
            const systemStatusEl = document.getElementById('systemStatus');
            if (systemStatusEl) {
                if (health.status === 'ok' || health.status === 'healthy') {
                    systemStatusEl.innerHTML = '<span style="color: var(--accent-color);">🟢 Healthy</span>';
                } else {
                    systemStatusEl.innerHTML = '<span style="color: var(--warning-color);">🟡 Warning</span>';
                }
            }
        } catch (error) {
            console.error('Failed to check system health:', error);
            const systemStatusEl = document.getElementById('systemStatus');
            if (systemStatusEl) {
                systemStatusEl.innerHTML = '<span style="color: var(--error-color);">🔴 Error</span>';
            }
        }
    }

    async loadRecentDetections() {
        try {
            // Use the detected-faces/recent endpoint which now exists
            const detections = await this.app.apiRequest('/detected-faces/recent?limit=5');
            this.renderRecentDetections(detections);
        } catch (error) {
            console.error('Failed to load recent detections:', error);
            this.showRecentDetectionsError();
        }
    }

    renderRecentDetections(detections) {
        const container = document.getElementById('recentDetections');
        if (!container) return;

        if (!detections || detections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👁️</div>
                    <div class="empty-state-title">No recent detections</div>
                    <div class="empty-state-description">Face detections will appear here</div>
                </div>
            `;
            return;
        }

        const detectionsHtml = detections.map(detection => {
            const personName = detection.person_name || 'Unknown Person';
            const timeAgo = this.app.formatDate(detection.created_at || detection.timestamp);
            const confidence = detection.confidence ? Math.round(detection.confidence * 100) : 0;
            
            return `
                <div class="detection-item">
                    <div class="detection-avatar">
                        ${personName === 'Unknown Person' ? '❓' : '👤'}
                    </div>
                    <div class="detection-info">
                        <div class="detection-name">${personName}</div>
                        <div class="detection-time">${timeAgo} • ${confidence}% confidence</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = detectionsHtml;
    }

    async loadFaceProgress() {
        try {
            // Use the faces/gallery endpoint which provides statistics
            const response = await this.app.apiRequest('/faces/gallery');
            
            let totalFaces = 0;
            let labeledFaces = 0;
            let unknownFaces = 0;

            if (response && response.success && response.data && response.data.statistics) {
                const stats = response.data.statistics;
                unknownFaces = stats.total_unknown || 0;
                labeledFaces = stats.total_labeled_faces || 0;
                totalFaces = unknownFaces + labeledFaces;
            }

            this.updateFaceProgress(totalFaces, labeledFaces, unknownFaces);
        } catch (error) {
            console.error('Failed to load face progress:', error);
            this.showFaceProgressError();
        }
    }

    updateFaceProgress(total, labeled, unknown) {
        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        const percentage = total > 0 ? Math.round((labeled / total) * 100) : 100;
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${percentage}% labeled`;
        }

        // Update individual counters
        const labeledFacesEl = document.getElementById('labeledFaces');
        const unknownFacesEl = document.getElementById('unknownFaces');
        const totalFacesEl = document.getElementById('totalFaces');

        if (labeledFacesEl) labeledFacesEl.textContent = this.app.formatNumber(labeled);
        if (unknownFacesEl) unknownFacesEl.textContent = this.app.formatNumber(unknown);
        if (totalFacesEl) totalFacesEl.textContent = this.app.formatNumber(total);
    }

    async loadAiProviderStatus() {
        try {
            // Try to get AI provider configuration
            const config = await this.app.apiRequest('/config/face-recognition');
            this.renderAiProviderStatus(config);
        } catch (error) {
            console.error('Failed to load AI provider status:', error);
            this.showAiProviderError();
        }
    }

    renderAiProviderStatus(config) {
        const container = document.getElementById('aiProviderStatus');
        if (!container) return;

        if (!config) {
            this.showAiProviderError();
            return;
        }

        const providers = [
            {
                name: 'Gemini',
                active: config.ai_provider === 'gemini',
                configured: !!config.api_key,
                model: config.current_ai_model || 'gemini-1.5-flash'
            },
            {
                name: 'OpenAI',
                active: config.ai_provider === 'openai',
                configured: !!config.openai_api_key,
                model: config.openai_model || 'gpt-4o'
            },
            {
                name: 'Ollama',
                active: config.ai_provider === 'ollama',
                configured: !!config.ollama_url,
                model: config.ollama_model || 'llava-phi3:latest'
            }
        ];

        const providersHtml = providers.map(provider => {
            let statusClass = 'inactive';
            let statusText = 'Inactive';
            
            if (provider.active && provider.configured) {
                statusClass = 'active';
                statusText = 'Active';
            } else if (provider.configured) {
                statusClass = 'inactive';
                statusText = 'Configured';
            } else {
                statusClass = 'error';
                statusText = 'Not Configured';
            }

            return `
                <div class="ai-provider-item">
                    <div>
                        <div class="provider-name">${provider.name}</div>
                        <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
                            ${provider.model}
                        </div>
                    </div>
                    <div class="provider-status ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = providersHtml;
    }

    async triggerTestDetection() {
        try {
            const triggerBtn = document.getElementById('triggerDetection');
            if (triggerBtn) {
                triggerBtn.disabled = true;
                triggerBtn.innerHTML = '<span class="loading"></span> Testing...';
            }

            // Trigger a test detection (this would depend on your API)
            await this.app.apiRequest('/webhook/test', { method: 'POST' });
            
            this.app.showToast('Test detection triggered!', 'success');
            
            // Refresh detections after a short delay
            setTimeout(() => {
                this.loadRecentDetections();
            }, 2000);

        } catch (error) {
            console.error('Failed to trigger test detection:', error);
            this.app.showToast('Failed to trigger test detection', 'error');
        } finally {
            const triggerBtn = document.getElementById('triggerDetection');
            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.innerHTML = '<span>🔔</span> Test Detection';
            }
        }
    }

    showStatsError() {
        const elements = ['totalVisitors', 'todayActivity', 'knownPersons'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<span style="color: var(--error-color);">Error</span>';
            }
        });
    }

    showRecentDetectionsError() {
        const container = document.getElementById('recentDetections');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load detections</div>
                    <div class="empty-state-description">Please check your connection</div>
                </div>
            `;
        }
    }

    showFaceProgressError() {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = 'Error loading progress';
        }
    }

    showAiProviderError() {
        const container = document.getElementById('aiProviderStatus');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load AI status</div>
                    <div class="empty-state-description">Please check your configuration</div>
                </div>
            `;
        }
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Set up auto-refresh
        this.refreshInterval = setInterval(() => {
            this.loadStats();
            this.loadRecentDetections();
            this.checkSystemHealth();
        }, this.refreshIntervalMs);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.destroy();
    }
});
