class SettingsManager {
    constructor() {
        this.initializeEventListeners();
        this.loadCurrentSettings();
    }

    initializeEventListeners() {
        // AI Configuration
        document.getElementById('aiProvider')?.addEventListener('change', this.handleProviderChange.bind(this));
        document.getElementById('confidenceThreshold')?.addEventListener('input', this.updateConfidenceValue.bind(this));
        document.getElementById('saveAiBtn')?.addEventListener('click', this.saveAiConfig.bind(this));
        
        // Danger Zone buttons
        document.getElementById('resetSettingsBtn')?.addEventListener('click', this.handleResetSettings.bind(this));
        document.getElementById('clearDataBtn')?.addEventListener('click', this.handleClearData.bind(this));
        document.getElementById('restartBtn')?.addEventListener('click', this.handleRestart.bind(this));
        
        // System refresh
        document.getElementById('refreshSystemBtn')?.addEventListener('click', this.loadSystemInfo.bind(this));
    }

    async loadCurrentSettings() {
        try {
            // Load AI configuration
            const response = await fetch('/api/faces/config');
            if (response.ok) {
                const config = await response.json();
                this.populateAiConfig(config);
            }
            
            // Load system information
            this.loadSystemInfo();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('Failed to load settings', 'error');
        }
    }

    populateAiConfig(config) {
        const provider = document.getElementById('aiProvider');
        const confidenceThreshold = document.getElementById('confidenceThreshold');
        const confidenceValue = document.getElementById('confidenceValue');
        const trainingImages = document.getElementById('trainingImages');
        
        if (config.ai_provider && provider) {
            provider.value = config.ai_provider;
            this.handleProviderChange();
        }
        
        if (config.confidence_threshold && confidenceThreshold) {
            confidenceThreshold.value = config.confidence_threshold;
            if (confidenceValue) {
                confidenceValue.textContent = config.confidence_threshold;
            }
        }
        
        if (config.training_images_per_person && trainingImages) {
            trainingImages.value = config.training_images_per_person;
        }

        // Populate API keys if available (masked)
        if (config.gemini_api_key) {
            document.getElementById('geminiApiKey').value = '••••••••••••••••';
        }
        if (config.openai_api_key) {
            document.getElementById('openaiApiKey').value = '••••••••••••••••';
        }
        if (config.ollama_url) {
            document.getElementById('ollamaUrl').value = config.ollama_url;
        }
    }

    handleProviderChange() {
        const provider = document.getElementById('aiProvider').value;
        
        // Hide all config sections
        document.getElementById('geminiConfig').style.display = 'none';
        document.getElementById('openaiConfig').style.display = 'none';
        document.getElementById('ollamaConfig').style.display = 'none';
        
        // Show relevant config section
        if (provider === 'gemini') {
            document.getElementById('geminiConfig').style.display = 'block';
        } else if (provider === 'openai') {
            document.getElementById('openaiConfig').style.display = 'block';
        } else if (provider === 'ollama') {
            document.getElementById('ollamaConfig').style.display = 'block';
        }
    }

    updateConfidenceValue() {
        const slider = document.getElementById('confidenceThreshold');
        const valueDisplay = document.getElementById('confidenceValue');
        if (slider && valueDisplay) {
            valueDisplay.textContent = slider.value;
        }
    }

    async saveAiConfig() {
        const saveBtn = document.getElementById('saveAiBtn');
        const originalText = saveBtn.innerHTML;
        
        try {
            saveBtn.innerHTML = '<span>⏳</span> Saving...';
            saveBtn.disabled = true;

            const provider = document.getElementById('aiProvider').value;
            const config = {
                ai_provider: provider,
                confidence_threshold: parseFloat(document.getElementById('confidenceThreshold').value),
                training_images_per_person: parseInt(document.getElementById('trainingImages').value)
            };

            // Add provider-specific settings
            if (provider === 'gemini') {
                const apiKey = document.getElementById('geminiApiKey').value;
                if (apiKey && !apiKey.includes('••••')) {
                    config.gemini_api_key = apiKey;
                }
            } else if (provider === 'openai') {
                const apiKey = document.getElementById('openaiApiKey').value;
                if (apiKey && !apiKey.includes('••••')) {
                    config.openai_api_key = apiKey;
                }
            } else if (provider === 'ollama') {
                config.ollama_url = document.getElementById('ollamaUrl').value;
            }

            const response = await fetch('/api/faces/config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                this.showToast('AI configuration saved successfully', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving AI config:', error);
            this.showToast(`Failed to save configuration: ${error.message}`, 'error');
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    async loadSystemInfo() {
        try {
            // Load system health
            const healthResponse = await fetch('/api/health');
            const backendStatus = document.getElementById('backendStatus');
            if (healthResponse.ok) {
                backendStatus.textContent = 'Healthy';
                backendStatus.className = 'info-value status-healthy';
            } else {
                backendStatus.textContent = 'Error';
                backendStatus.className = 'info-value status-error';
            }

            // Load database stats
            const dbResponse = await fetch('/api/database/stats');
            const databaseStatus = document.getElementById('databaseStatus');
            if (dbResponse.ok) {
                const stats = await dbResponse.json();
                databaseStatus.textContent = `${stats.totalEvents} events, ${stats.databaseSize}`;
                databaseStatus.className = 'info-value status-healthy';
            } else {
                databaseStatus.textContent = 'Error';
                databaseStatus.className = 'info-value status-error';
            }

            // Check uploads directory
            const uploadsStatus = document.getElementById('uploadsStatus');
            uploadsStatus.textContent = 'Available';
            uploadsStatus.className = 'info-value status-healthy';

        } catch (error) {
            console.error('Error loading system info:', error);
        }
    }

    // DANGER ZONE METHODS

    async handleResetSettings() {
        const confirmed = confirm(
            'Are you sure you want to reset ALL settings to defaults?\n\n' +
            'This will reset:\n' +
            '• AI provider configuration\n' +
            '• Face recognition settings\n' +
            '• All custom thresholds\n\n' +
            'This action cannot be undone.'
        );

        if (!confirmed) return;

        const resetBtn = document.getElementById('resetSettingsBtn');
        const originalText = resetBtn.innerHTML;

        try {
            resetBtn.innerHTML = '⏳ Resetting...';
            resetBtn.disabled = true;

            const response = await fetch('/api/config/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showToast('Settings reset successfully', 'success');
                // Reload the page to show default settings
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to reset settings');
            }
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showToast(`Failed to reset settings: ${error.message}`, 'error');
        } finally {
            resetBtn.innerHTML = originalText;
            resetBtn.disabled = false;
        }
    }

    async handleClearData() {
        // First confirmation
        const firstConfirm = confirm(
            'WARNING: This will permanently delete ALL face data!\n\n' +
            'This includes:\n' +
            '• All detected faces\n' +
            '• All person records\n' +
            '• All face images and thumbnails\n' +
            '• All visitor event data\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you absolutely sure?'
        );

        if (!firstConfirm) return;

        // Second confirmation with text input
        const confirmText = prompt(
            'To confirm this destructive action, please type "DELETE ALL DATA" exactly:'
        );

        if (confirmText !== 'DELETE ALL DATA') {
            this.showToast('Data clearing cancelled - confirmation text did not match', 'warning');
            return;
        }

        const clearBtn = document.getElementById('clearDataBtn');
        const originalText = clearBtn.innerHTML;

        try {
            clearBtn.innerHTML = '⏳ Clearing...';
            clearBtn.disabled = true;

            // Clear all face data
            const faceResponse = await fetch('/api/faces/clear-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!faceResponse.ok) {
                const error = await faceResponse.json();
                throw new Error(error.error || 'Failed to clear face data');
            }

            // Clear database events
            const dbResponse = await fetch('/api/database/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!dbResponse.ok) {
                const error = await dbResponse.json();
                throw new Error(error.error || 'Failed to clear database');
            }

            const dbResult = await dbResponse.json();
            this.showToast(
                `All data cleared successfully! Deleted ${dbResult.deletedCount} events and all face data.`, 
                'success'
            );

            // Refresh system info
            setTimeout(() => {
                this.loadSystemInfo();
            }, 1000);

        } catch (error) {
            console.error('Error clearing data:', error);
            this.showToast(`Failed to clear data: ${error.message}`, 'error');
        } finally {
            clearBtn.innerHTML = originalText;
            clearBtn.disabled = false;
        }
    }

    async handleRestart() {
        const confirmed = confirm(
            'Restart the WhoRang backend service?\n\n' +
            'This will:\n' +
            '• Temporarily disconnect all clients\n' +
            '• Restart the backend service\n' +
            '• Reload all configurations\n\n' +
            'The service should reconnect automatically in a few seconds.'
        );

        if (!confirmed) return;

        const restartBtn = document.getElementById('restartBtn');
        const originalText = restartBtn.innerHTML;

        try {
            restartBtn.innerHTML = '⏳ Restarting...';
            restartBtn.disabled = true;

            const response = await fetch('/api/system/restart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showToast('Backend restart initiated...', 'success');
                
                // Monitor reconnection
                this.monitorReconnection();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to restart service');
            }
        } catch (error) {
            console.error('Error restarting service:', error);
            this.showToast(`Failed to restart service: ${error.message}`, 'error');
            restartBtn.innerHTML = originalText;
            restartBtn.disabled = false;
        }
    }

    monitorReconnection() {
        const connectionStatus = document.getElementById('connectionStatus');
        const restartBtn = document.getElementById('restartBtn');
        
        // Update status to show restarting
        if (connectionStatus) {
            connectionStatus.innerHTML = '<span class="loading"></span><span>Restarting...</span>';
        }

        // Try to reconnect every 2 seconds
        let attempts = 0;
        const maxAttempts = 15; // 30 seconds total
        
        const checkConnection = async () => {
            attempts++;
            
            try {
                const response = await fetch('/api/health');
                if (response.ok) {
                    // Reconnected successfully
                    this.showToast('Backend restarted successfully!', 'success');
                    if (connectionStatus) {
                        connectionStatus.innerHTML = '<span class="status-dot connected"></span><span>Connected</span>';
                    }
                    restartBtn.innerHTML = 'Restart';
                    restartBtn.disabled = false;
                    
                    // Reload system info
                    setTimeout(() => {
                        this.loadSystemInfo();
                    }, 1000);
                    return;
                }
            } catch (error) {
                // Still connecting...
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkConnection, 2000);
            } else {
                // Failed to reconnect
                this.showToast('Failed to reconnect after restart. Please refresh the page.', 'error');
                if (connectionStatus) {
                    connectionStatus.innerHTML = '<span class="status-dot disconnected"></span><span>Disconnected</span>';
                }
                restartBtn.innerHTML = 'Restart';
                restartBtn.disabled = false;
            }
        };
        
        // Start checking after 3 seconds (give service time to restart)
        setTimeout(checkConnection, 3000);
    }

    showToast(message, type = 'info') {
        // Use the global toast function from app.js if available
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // Fallback to console and alert
            console.log(`${type.toUpperCase()}: ${message}`);
            if (type === 'error') {
                alert(`Error: ${message}`);
            }
        }
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});
