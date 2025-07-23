/**
 * WhoRang Persons Manager - Known persons management functionality
 */

class PersonsManager {
    constructor() {
        this.app = null;
        this.persons = [];
        this.statistics = {};
        this.refreshInterval = null;
        this.refreshIntervalMs = 30000; // 30 seconds
        
        this.init();
    }

    init() {
        // Wait for the main app to be initialized
        if (window.whorangApp) {
            this.app = window.whorangApp;
            this.setupPersonsManager();
        } else {
            // Wait for app initialization
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    this.app = window.whorangApp;
                    this.setupPersonsManager();
                }, 100);
            });
        }
    }

    setupPersonsManager() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
        
        console.log('Persons Manager initialized');
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadInitialData();
            });
        }

        // Add person button
        const addPersonBtn = document.getElementById('addPersonBtn');
        if (addPersonBtn) {
            addPersonBtn.addEventListener('click', () => {
                this.showAddPersonDialog();
            });
        }

        // Manage all button
        const manageBtn = document.getElementById('manageBtn');
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                this.showManageAllDialog();
            });
        }

        // WebSocket events
        document.addEventListener('person-created', () => {
            this.loadPersonsData();
        });

        document.addEventListener('person-updated', () => {
            this.loadPersonsData();
        });

        document.addEventListener('person-deleted', () => {
            this.loadPersonsData();
        });

        document.addEventListener('face-labeled', () => {
            this.loadPersonsData();
        });

        document.addEventListener('face_data_cleared', () => {
            this.loadPersonsData();
        });
    }

    async loadInitialData() {
        try {
            await this.loadPersonsData();
        } catch (error) {
            console.error('Failed to load initial persons data:', error);
            this.app.showToast('Failed to load persons data', 'error');
        }
    }

    async loadPersonsData() {
        try {
            // Load persons and face gallery data
            const [personsResponse, galleryResponse] = await Promise.all([
                this.app.apiRequest('/faces/persons'),
                this.app.apiRequest('/faces/gallery')
            ]);
            
            this.persons = Array.isArray(personsResponse) ? personsResponse : [];
            
            // Calculate statistics
            if (galleryResponse.success) {
                const galleryData = galleryResponse.data;
                this.statistics = {
                    total_persons: this.persons.length,
                    total_faces: galleryData.statistics.total_labeled_faces || 0,
                    avg_faces: this.persons.length > 0 ? 
                        Math.round((galleryData.statistics.total_labeled_faces || 0) / this.persons.length * 10) / 10 : 0
                };
            } else {
                this.statistics = {
                    total_persons: this.persons.length,
                    total_faces: this.persons.reduce((sum, p) => sum + (p.face_count || 0), 0),
                    avg_faces: this.persons.length > 0 ? 
                        Math.round(this.persons.reduce((sum, p) => sum + (p.face_count || 0), 0) / this.persons.length * 10) / 10 : 0
                };
            }
            
            this.renderPersonsGrid();
            this.updateStatistics();
            
        } catch (error) {
            console.error('Failed to load persons data:', error);
            this.showPersonsGridError();
            this.showStatisticsError();
        }
    }

    renderPersonsGrid() {
        const personsGrid = document.getElementById('personsGrid');
        if (!personsGrid) return;

        if (!this.persons || this.persons.length === 0) {
            personsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-title">No known persons</div>
                    <div class="empty-state-description">Start labeling faces to create person records</div>
                </div>
            `;
            return;
        }

        const personsHtml = this.persons.map(person => {
            const lastSeenText = this.formatLastSeen(person.last_seen);
            const lastSeenClass = this.getLastSeenClass(person.last_seen);
            const confidencePercent = Math.round((person.avg_confidence || 0) * 100);
            const faceCount = person.face_count || 0;
            
            return `
                <div class="person-card" data-person-id="${person.id}">
                    <div class="person-actions">
                        <div class="action-btn" onclick="window.personsManager.editPerson(${person.id})" title="Edit Person">
                            ✏️
                        </div>
                        <div class="action-btn" onclick="window.personsManager.deletePerson(${person.id})" title="Delete Person">
                            🗑️
                        </div>
                    </div>
                    
                    <div class="avatar-container">
                        <img src="/api/faces/persons/${person.id}/avatar" 
                             alt="${person.name}" 
                             class="avatar-image"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="avatar-placeholder" style="display: none;">👤</div>
                        ${faceCount > 0 ? `<div class="face-count-badge">${faceCount}</div>` : ''}
                    </div>
                    
                    <div class="person-name">${this.app.escapeHtml(person.name)}</div>
                    
                    <div class="person-details">
                        <div class="detail-row">
                            <span class="detail-label">Faces:</span>
                            <span>${faceCount}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Confidence:</span>
                            <span>${confidencePercent}%</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Last seen:</span>
                            <span class="last-seen ${lastSeenClass}">${lastSeenText}</span>
                        </div>
                    </div>
                    
                    ${confidencePercent > 0 ? `
                        <div class="confidence-indicator ${this.getConfidenceClass(person.avg_confidence)}">
                            ${confidencePercent}%
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        personsGrid.innerHTML = personsHtml;

        // Add click event listeners to person cards
        personsGrid.querySelectorAll('.person-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (e.target.closest('.person-actions')) return;
                
                const personId = parseInt(card.dataset.personId);
                this.viewPersonDetails(personId);
            });
        });
    }

    formatLastSeen(lastSeenDate) {
        if (!lastSeenDate) return 'Never';
        
        try {
            const date = new Date(lastSeenDate);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            if (diffMinutes < 60) {
                return diffMinutes <= 1 ? 'Just now' : `${diffMinutes}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else if (diffDays < 7) {
                return `${diffDays}d ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `${weeks}w ago`;
            } else {
                return date.toLocaleDateString();
            }
        } catch (error) {
            return 'Unknown';
        }
    }

    getLastSeenClass(lastSeenDate) {
        if (!lastSeenDate) return 'very-old';
        
        try {
            const date = new Date(lastSeenDate);
            const now = new Date();
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) return '';
            if (diffDays <= 7) return 'old';
            return 'very-old';
        } catch (error) {
            return 'very-old';
        }
    }

    getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'confidence-high';
        if (confidence >= 0.6) return 'confidence-medium';
        return 'confidence-low';
    }

    updateStatistics() {
        const totalPersons = document.getElementById('totalPersons');
        const totalFaces = document.getElementById('totalFaces');
        const avgFaces = document.getElementById('avgFaces');

        if (totalPersons) {
            totalPersons.textContent = this.app.formatNumber(this.statistics.total_persons || 0);
        }

        if (totalFaces) {
            totalFaces.textContent = this.app.formatNumber(this.statistics.total_faces || 0);
        }

        if (avgFaces) {
            avgFaces.textContent = this.statistics.avg_faces || '0';
        }
    }

    async viewPersonDetails(personId) {
        try {
            const person = this.persons.find(p => p.id === personId);
            if (!person) {
                this.app.showToast('Person not found', 'error');
                return;
            }

            // For now, show a simple info dialog
            // In a full implementation, this could open a detailed modal
            const message = `
                <strong>${this.app.escapeHtml(person.name)}</strong><br><br>
                <strong>Faces:</strong> ${person.face_count || 0}<br>
                <strong>Average Confidence:</strong> ${Math.round((person.avg_confidence || 0) * 100)}%<br>
                <strong>First Seen:</strong> ${person.first_seen ? new Date(person.first_seen).toLocaleDateString() : 'Unknown'}<br>
                <strong>Last Seen:</strong> ${this.formatLastSeen(person.last_seen)}
            `;

            await this.app.showAlert('Person Details', message);

        } catch (error) {
            console.error('Failed to view person details:', error);
            this.app.showToast('Failed to load person details', 'error');
        }
    }

    async editPerson(personId) {
        try {
            const person = this.persons.find(p => p.id === personId);
            if (!person) {
                this.app.showToast('Person not found', 'error');
                return;
            }

            const newName = await this.app.showPrompt(
                'Edit Person Name',
                'Enter the new name for this person:',
                person.name
            );

            if (!newName || newName.trim() === '') return;
            if (newName.trim() === person.name) return;

            const response = await this.app.apiRequest(`/faces/persons/${personId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: newName.trim()
                })
            });

            if (response.success || response.id) {
                this.app.showToast(`Person renamed to "${newName.trim()}"`, 'success');
                await this.loadPersonsData();
            } else {
                throw new Error(response.error || 'Failed to update person');
            }

        } catch (error) {
            console.error('Failed to edit person:', error);
            this.app.showToast('Failed to update person: ' + error.message, 'error');
        }
    }

    async deletePerson(personId) {
        try {
            const person = this.persons.find(p => p.id === personId);
            if (!person) {
                this.app.showToast('Person not found', 'error');
                return;
            }

            const confirmed = await this.app.showConfirm(
                `Delete "${person.name}"?`,
                `This will delete the person and unassign ${person.face_count || 0} face${(person.face_count || 0) !== 1 ? 's' : ''}. This action cannot be undone.`
            );

            if (!confirmed) return;

            const response = await this.app.apiRequest(`/faces/persons/${personId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.app.showToast(`Person "${person.name}" deleted successfully`, 'success');
                await this.loadPersonsData();
            } else {
                throw new Error(response.error || 'Failed to delete person');
            }

        } catch (error) {
            console.error('Failed to delete person:', error);
            this.app.showToast('Failed to delete person: ' + error.message, 'error');
        }
    }

    async showAddPersonDialog() {
        try {
            const personName = await this.app.showPrompt(
                'Add New Person',
                'Enter the name for the new person:',
                ''
            );

            if (!personName || personName.trim() === '') return;

            const response = await this.app.apiRequest('/faces/persons', {
                method: 'POST',
                body: JSON.stringify({
                    name: personName.trim()
                })
            });

            if (response.success || response.id) {
                this.app.showToast(`Person "${personName.trim()}" created successfully`, 'success');
                await this.loadPersonsData();
            } else {
                throw new Error(response.error || 'Failed to create person');
            }

        } catch (error) {
            console.error('Failed to add person:', error);
            this.app.showToast('Failed to create person: ' + error.message, 'error');
        }
    }

    async showManageAllDialog() {
        // For now, show a simple info dialog
        // In a full implementation, this could open a management interface
        const message = `
            <strong>Bulk Management Options:</strong><br><br>
            • Use the Face Manager to label unknown faces<br>
            • Use the Danger Zone in Settings to clear all data<br>
            • Click individual persons to view details<br>
            • Use the edit/delete buttons on person cards
        `;

        await this.app.showAlert('Manage All Persons', message);
    }

    showPersonsGridError() {
        const personsGrid = document.getElementById('personsGrid');
        if (personsGrid) {
            personsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-title">Failed to load persons</div>
                    <div class="empty-state-description">Please check your connection and try again</div>
                </div>
            `;
        }
    }

    showStatisticsError() {
        const elements = ['totalPersons', 'totalFaces', 'avgFaces'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<span style="color: var(--error-color);">Error</span>';
            }
        });
    }

    startAutoRefresh() {
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Set up auto-refresh
        this.refreshInterval = setInterval(() => {
            this.loadPersonsData();
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

// Initialize persons manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.personsManager = new PersonsManager();
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.personsManager) {
        window.personsManager.destroy();
    }
});
