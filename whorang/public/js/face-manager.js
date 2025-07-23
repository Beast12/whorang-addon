/**
 * WhoRang Face Manager - Face labeling and management functionality
 */

class FaceManager {
    constructor() {
        this.app = null;
        this.selectedFaces = new Set();
        this.faces = [];
        this.statistics = {};
        this.refreshInterval = null;
        this.refreshIntervalMs = 30000; // 30 seconds
        
        this.init();
    }

    init() {
        // Wait for the main app to be initialized
        if (window.whorangApp) {
            this.app = window.whorangApp;
            this.setupFaceManager();
        } else {
            // Wait for app initialization
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    this.app = window.whorangApp;
                    this.setupFaceManager();
                }, 100);
            });
        }
    }

    setupFaceManager() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
        
        console.log('Face Manager initialized');
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadInitialData();
            });
        }

        // Selection controls
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllFaces();
            });
        }

        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        // Labeling controls
        const labelBtn = document.getElementById('labelBtn');
        const personNameInput = document.getElementById('personName');
        
        if (labelBtn && personNameInput) {
            labelBtn.addEventListener('click', () => {
                this.labelSelectedFaces();
            });

            personNameInput.addEventListener('input', () => {
                this.updateLabelButtonState();
            });

            personNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !labelBtn.disabled) {
                    this.labelSelectedFaces();
                }
            });
        }

        // Delete button
        const deleteBtn = document.getElementById('deleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteSelectedFaces();
            });
        }

        // WebSocket events
        document.addEventListener('face-detected', () => {
            this.loadFaceGallery();
        });

        document.addEventListener('face-labeled', () => {
            this.loadFaceGallery();
        });

        document.addEventListener('face-deleted', () => {
            this.loadFaceGallery();
        });

        document.addEventListener('face_data_cleared', () => {
            this.loadFaceGallery();
        });
    }

    async loadInitialData() {
        try {
            await this.loadFaceGallery();
        } catch (error) {
            console.error('Failed to load initial face manager data:', error);
            this.app.showToast('Failed to load face data', 'error');
        }
    }

    async loadFaceGallery() {
        try {
            const response = await this.app.apiRequest('/faces/gallery');
            
            if (response.success) {
                this.faces = response.data.unknown_faces || [];
                this.statistics = response.data.statistics || {};
                
                this.renderFaceGrid();
                this.updateProgress();
                this.clearSelection(); // Clear selection when data refreshes
            } else {
                throw new Error(response.error || 'Failed to load face gallery');
            }
        } catch (error) {
            console.error('Failed to load face gallery:', error);
            this.showFaceGridError();
            this.showProgressError();
        }
    }

    renderFaceGrid() {
        const faceGrid = document.getElementById('faceGrid');
        if (!faceGrid) return;

        if (!this.faces || this.faces.length === 0) {
            faceGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">✨</div>
                    <div class="empty-state-title">All faces labeled!</div>
                    <div class="empty-state-description">No unknown faces to label</div>
                </div>
            `;
            return;
        }

        const facesHtml = this.faces.map(face => {
            const isSelected = this.selectedFaces.has(face.id);
            const qualityClass = this.getQualityClass(face.quality_score);
            const confidencePercent = Math.round((face.confidence || 0) * 100);
            
            return `
                <div class="face-card ${isSelected ? 'selected' : ''}" data-face-id="${face.id}">
                    <img src="${face.thumbnail_url || face.image_url}" 
                         alt="Unknown face" 
                         loading="lazy"
                         onerror="this.parentElement.innerHTML='<div class=\\'loading-placeholder\\'>❓</div>'">
                    <div class="checkbox">✓</div>
                    <div class="quality-badge ${qualityClass}">
                        ${confidencePercent}%
                    </div>
                </div>
            `;
        }).join('');

        faceGrid.innerHTML = facesHtml;

        // Add click event listeners to face cards
        faceGrid.querySelectorAll('.face-card').forEach(card => {
            card.addEventListener('click', () => {
                const faceId = parseInt(card.dataset.faceId);
                this.toggleFaceSelection(faceId);
            });
        });
    }

    getQualityClass(qualityScore) {
        if (qualityScore >= 0.8) return 'quality-high';
        if (qualityScore >= 0.6) return 'quality-medium';
        return 'quality-low';
    }

    toggleFaceSelection(faceId) {
        if (this.selectedFaces.has(faceId)) {
            this.selectedFaces.delete(faceId);
        } else {
            this.selectedFaces.add(faceId);
        }
        
        this.updateFaceCardSelection(faceId);
        this.updateSelectionUI();
    }

    updateFaceCardSelection(faceId) {
        const faceCard = document.querySelector(`[data-face-id="${faceId}"]`);
        if (faceCard) {
            if (this.selectedFaces.has(faceId)) {
                faceCard.classList.add('selected');
            } else {
                faceCard.classList.remove('selected');
            }
        }
    }

    selectAllFaces() {
        this.faces.forEach(face => {
            this.selectedFaces.add(face.id);
        });
        
        // Update all face cards
        document.querySelectorAll('.face-card').forEach(card => {
            card.classList.add('selected');
        });
        
        this.updateSelectionUI();
    }

    clearSelection() {
        this.selectedFaces.clear();
        
        // Update all face cards
        document.querySelectorAll('.face-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.updateSelectionUI();
    }

    updateSelectionUI() {
        const selectionCount = document.getElementById('selectionCount');
        const labelBtn = document.getElementById('labelBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        
        const count = this.selectedFaces.size;
        
        if (selectionCount) {
            selectionCount.textContent = `${count} face${count !== 1 ? 's' : ''} selected`;
        }
        
        if (labelBtn) {
            this.updateLabelButtonState();
        }
        
        if (deleteBtn) {
            deleteBtn.disabled = count === 0;
        }
    }

    updateLabelButtonState() {
        const labelBtn = document.getElementById('labelBtn');
        const personNameInput = document.getElementById('personName');
        
        if (labelBtn && personNameInput) {
            const hasSelection = this.selectedFaces.size > 0;
            const hasName = personNameInput.value.trim().length > 0;
            labelBtn.disabled = !hasSelection || !hasName;
        }
    }

    async labelSelectedFaces() {
        const personNameInput = document.getElementById('personName');
        const labelBtn = document.getElementById('labelBtn');
        
        if (!personNameInput || !labelBtn) return;
        
        const personName = personNameInput.value.trim();
        const faceIds = Array.from(this.selectedFaces);
        
        if (faceIds.length === 0 || !personName) {
            this.app.showToast('Please select faces and enter a person name', 'warning');
            return;
        }

        // Confirm action
        const confirmed = await this.app.showConfirm(
            `Label ${faceIds.length} face${faceIds.length !== 1 ? 's' : ''} as "${personName}"?`,
            'This will create or update the person record.'
        );
        
        if (!confirmed) return;

        try {
            // Disable button and show loading
            labelBtn.disabled = true;
            labelBtn.innerHTML = '<span class="loading"></span> Labeling...';

            const response = await this.app.apiRequest('/faces/batch-label', {
                method: 'POST',
                body: JSON.stringify({
                    face_ids: faceIds,
                    person_name: personName,
                    create_person: true
                })
            });

            if (response.success) {
                const { labeled_count, total_requested } = response.data;
                
                if (labeled_count === total_requested) {
                    this.app.showToast(`Successfully labeled ${labeled_count} face${labeled_count !== 1 ? 's' : ''} as "${personName}"`, 'success');
                } else {
                    this.app.showToast(`Labeled ${labeled_count} of ${total_requested} faces. Some faces may have already been labeled.`, 'warning');
                }
                
                // Clear form and reload data
                personNameInput.value = '';
                this.clearSelection();
                await this.loadFaceGallery();
                
            } else {
                throw new Error(response.error || 'Failed to label faces');
            }

        } catch (error) {
            console.error('Failed to label faces:', error);
            this.app.showToast('Failed to label faces: ' + error.message, 'error');
        } finally {
            // Restore button
            if (labelBtn) {
                labelBtn.innerHTML = '<span>🏷️</span> Label Selected';
                this.updateLabelButtonState();
            }
        }
    }

    async deleteSelectedFaces() {
        const faceIds = Array.from(this.selectedFaces);
        
        if (faceIds.length === 0) {
            this.app.showToast('Please select faces to delete', 'warning');
            return;
        }

        // Confirm action
        const confirmed = await this.app.showConfirm(
            `Delete ${faceIds.length} selected face${faceIds.length !== 1 ? 's' : ''}?`,
            'This action cannot be undone.'
        );
        
        if (!confirmed) return;

        const deleteBtn = document.getElementById('deleteBtn');
        
        try {
            // Disable button and show loading
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<span class="loading"></span> Deleting...';
            }

            let deletedCount = 0;
            let failedCount = 0;

            // Delete faces one by one (could be optimized with batch endpoint)
            for (const faceId of faceIds) {
                try {
                    const response = await this.app.apiRequest(`/faces/${faceId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.success) {
                        deletedCount++;
                    } else {
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Failed to delete face ${faceId}:`, error);
                    failedCount++;
                }
            }

            if (deletedCount > 0) {
                this.app.showToast(`Successfully deleted ${deletedCount} face${deletedCount !== 1 ? 's' : ''}`, 'success');
            }
            
            if (failedCount > 0) {
                this.app.showToast(`Failed to delete ${failedCount} face${failedCount !== 1 ? 's' : ''}`, 'warning');
            }
            
            // Clear selection and reload data
            this.clearSelection();
            await this.loadFaceGallery();

        } catch (error) {
            console.error('Failed to delete faces:', error);
            this.app.showToast('Failed to delete faces: ' + error.message, 'error');
        } finally {
            // Restore button
            if (deleteBtn) {
                deleteBtn.innerHTML = 'Delete Selected';
                deleteBtn.disabled = this.selectedFaces.size === 0;
            }
        }
    }

    updateProgress() {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const labeledFaces = document.getElementById('labeledFaces');
        const unknownFaces = document.getElementById('unknownFaces');
        const totalFaces = document.getElementById('totalFaces');

        if (!this.statistics) return;

        const progress = this.statistics.labeling_progress || 0;
        const labeled = this.statistics.total_labeled_faces || 0;
        const unknown = this.statistics.total_unknown || 0;
        const total = labeled + unknown;

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(progress)}% labeled`;
        }

        if (labeledFaces) {
            labeledFaces.textContent = this.app.formatNumber(labeled);
        }

        if (unknownFaces) {
            unknownFaces.textContent = this.app.formatNumber(unknown);
        }

        if (totalFaces) {
            totalFaces.textContent = this.app.formatNumber(total);
        }
    }

    showFaceGridError() {
        const faceGrid = document.getElementById('faceGrid');
        if (faceGrid) {
            faceGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load faces</div>
                    <div class="empty-state-description">Please check your connection and try again</div>
                </div>
            `;
        }
    }

    showProgressError() {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = 'Error loading progress';
        }
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Set up auto-refresh
        this.refreshInterval = setInterval(() => {
            this.loadFaceGallery();
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
        this.selectedFaces.clear();
    }
}

// Initialize face manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.faceManager = new FaceManager();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.faceManager) {
        window.faceManager.destroy();
    }
});
