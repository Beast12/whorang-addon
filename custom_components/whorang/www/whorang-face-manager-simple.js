// Simple WhoRang Face Manager Card
console.log('Loading WhoRang Face Manager Card (Simple)');

class WhoRangFaceManagerCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error('You need to define an entity');
        }
        this.config = config;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        this.updateContent();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .card {
                    padding: 16px;
                    background: var(--card-background-color);
                    border-radius: var(--ha-card-border-radius);
                    box-shadow: var(--ha-card-box-shadow);
                }
                .title {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-bottom: 16px;
                }
                .status {
                    margin-bottom: 16px;
                    padding: 8px;
                    background: var(--primary-color);
                    color: white;
                    border-radius: 4px;
                    text-align: center;
                }
                .face-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 8px;
                    margin-bottom: 16px;
                }
                .face-item {
                    border: 2px solid transparent;
                    border-radius: 8px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: border-color 0.2s;
                }
                .face-item.selected {
                    border-color: var(--primary-color);
                }
                .face-image {
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                    background: #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: #666;
                }
                .face-info {
                    padding: 4px;
                    font-size: 10px;
                    text-align: center;
                    background: var(--secondary-background-color);
                }
                .controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    margin-top: 16px;
                }
                .controls input {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid var(--divider-color);
                    border-radius: 4px;
                }
                .controls button {
                    padding: 8px 16px;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                .controls button:hover {
                    opacity: 0.8;
                }
                .controls button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            </style>
            <div class="card">
                <div class="title">${this.config.title || 'Face Recognition Manager'}</div>
                <div class="status" id="status">Loading...</div>
                <div class="face-grid" id="faceGrid"></div>
                <div class="controls">
                    <input type="text" id="personName" placeholder="Enter person name..." />
                    <button id="labelBtn" disabled>Label Selected</button>
                    <button id="selectAllBtn">Select All</button>
                    <button id="clearBtn">Clear</button>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        const labelBtn = this.shadowRoot.getElementById('labelBtn');
        const selectAllBtn = this.shadowRoot.getElementById('selectAllBtn');
        const clearBtn = this.shadowRoot.getElementById('clearBtn');
        const personNameInput = this.shadowRoot.getElementById('personName');

        labelBtn.addEventListener('click', () => this.labelSelected());
        selectAllBtn.addEventListener('click', () => this.selectAll());
        clearBtn.addEventListener('click', () => this.clearSelection());
        personNameInput.addEventListener('input', () => this.updateLabelButton());

        this.selectedFaces = new Set();
    }

    getWhoRangBaseUrlCandidates() {
        const candidates = [];
        
        // 1. User-configured URL (highest priority)
        if (this.config.whorang_url) {
            candidates.push(this.config.whorang_url.replace(/\/$/, ''));
        }
        
        // 2. Integration-provided URL from entity attributes
        if (this._hass && this.config.entity) {
            const entity = this._hass.states[this.config.entity];
            if (entity?.attributes?.backend_url) {
                candidates.push(entity.attributes.backend_url.replace(/\/$/, ''));
            }
            if (entity?.attributes?.whorang_server_url) {
                candidates.push(entity.attributes.whorang_server_url.replace(/\/$/, ''));
            }
        }
        
        // 3. Smart detection based on current window location
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        // Same host with different protocols and ports
        candidates.push(`${protocol}//${hostname}:3001`);
        if (protocol === 'https:') {
            candidates.push(`http://${hostname}:3001`);
        }
        
        // 4. Common Home Assistant configurations
        if (hostname !== 'homeassistant.local') {
            candidates.push('http://homeassistant.local:3001');
        }
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            candidates.push('http://localhost:3001');
            candidates.push('http://127.0.0.1:3001');
        }
        
        // 5. Additional fallback URLs from config
        if (this.config.fallback_urls && Array.isArray(this.config.fallback_urls)) {
            candidates.push(...this.config.fallback_urls.map(url => url.replace(/\/$/, '')));
        }
        
        // Remove duplicates while preserving order
        return [...new Set(candidates)];
    }

    async testImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                resolve(false);
            }, 2000); // 2 second timeout
            
            img.onload = () => {
                clearTimeout(timeout);
                resolve(true);
            };
            
            img.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
            
            img.src = url;
        });
    }

    async getWorkingImageUrl(face) {
        // First try direct URLs from face data
        if (face.image_url) {
            if (await this.testImageUrl(face.image_url)) {
                return face.image_url;
            }
        }
        
        if (face.crop_path) {
            if (await this.testImageUrl(face.crop_path)) {
                return face.crop_path;
            }
        }
        
        if (face.thumbnail_url) {
            if (await this.testImageUrl(face.thumbnail_url)) {
                return face.thumbnail_url;
            }
        }
        
        // Try constructed URLs with different base URLs
        const baseUrls = this.getWhoRangBaseUrlCandidates();
        
        for (const baseUrl of baseUrls) {
            const imageUrl = `${baseUrl}/api/faces/${face.id}/image?size=thumbnail`;
            if (await this.testImageUrl(imageUrl)) {
                // Cache the working base URL for future use
                this._workingBaseUrl = baseUrl;
                return imageUrl;
            }
        }
        
        return null;
    }

    async updateContent() {
        if (!this._hass || !this.config.entity) return;

        const entity = this._hass.states[this.config.entity];
        if (!entity) {
            this.shadowRoot.getElementById('status').textContent = 'Entity not found';
            return;
        }

        const unknownFaces = entity.attributes.unknown_faces || [];
        const totalUnknown = entity.attributes.total_unknown || 0;
        const totalKnown = entity.attributes.total_known || 0;
        const progress = entity.attributes.labeling_progress || 0;

        // Update status
        const statusEl = this.shadowRoot.getElementById('status');
        statusEl.textContent = `${totalUnknown} unknown, ${totalKnown} known (${progress.toFixed(1)}% labeled)`;

        // Update face grid
        const faceGrid = this.shadowRoot.getElementById('faceGrid');
        faceGrid.innerHTML = '';

        if (unknownFaces.length === 0) {
            faceGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">All faces have been labeled!</div>';
            return;
        }

        // Process faces with robust image loading
        for (const face of unknownFaces) {
            const faceItem = document.createElement('div');
            faceItem.className = 'face-item';
            faceItem.dataset.faceId = face.id;

            // Create initial structure with loading state
            faceItem.innerHTML = `
                <div class="face-image">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #666;">
                        Loading...
                    </div>
                </div>
                <div class="face-info">
                    ID: ${face.id} | Quality: ${Math.round((face.quality || 0) * 100)}%
                </div>
            `;

            // Try to get a working image URL
            try {
                const workingUrl = await this.getWorkingImageUrl(face);
                
                if (workingUrl) {
                    const imageContainer = faceItem.querySelector('.face-image');
                    imageContainer.innerHTML = `
                        <img src="${workingUrl}" alt="Face ${face.id}" 
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.style.display='none'; this.parentNode.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #f44336;\\'>Image Error</div>';" />
                    `;
                } else {
                    // No working URL found
                    const imageContainer = faceItem.querySelector('.face-image');
                    imageContainer.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #f44336;">
                            Face ${face.id}<br>No Image
                        </div>
                    `;
                }
            } catch (error) {
                console.error(`Failed to load image for face ${face.id}:`, error);
                const imageContainer = faceItem.querySelector('.face-image');
                imageContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 12px; color: #f44336;">
                        Face ${face.id}<br>Load Error
                    </div>
                `;
            }

            faceItem.addEventListener('click', () => this.toggleFaceSelection(face.id, faceItem));
            faceGrid.appendChild(faceItem);
        }
    }

    toggleFaceSelection(faceId, element) {
        if (this.selectedFaces.has(faceId)) {
            this.selectedFaces.delete(faceId);
            element.classList.remove('selected');
        } else {
            this.selectedFaces.add(faceId);
            element.classList.add('selected');
        }
        this.updateLabelButton();
    }

    selectAll() {
        const faceItems = this.shadowRoot.querySelectorAll('.face-item');
        faceItems.forEach(item => {
            const faceId = parseInt(item.dataset.faceId);
            this.selectedFaces.add(faceId);
            item.classList.add('selected');
        });
        this.updateLabelButton();
    }

    clearSelection() {
        this.selectedFaces.clear();
        this.shadowRoot.querySelectorAll('.face-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.updateLabelButton();
    }

    updateLabelButton() {
        const labelBtn = this.shadowRoot.getElementById('labelBtn');
        const personName = this.shadowRoot.getElementById('personName').value.trim();
        labelBtn.disabled = this.selectedFaces.size === 0 || !personName;
    }

    async labelSelected() {
        const personName = this.shadowRoot.getElementById('personName').value.trim();
        if (!personName || this.selectedFaces.size === 0) return;

        const faceIds = Array.from(this.selectedFaces);
        
        try {
            await this._hass.callService('whorang', 'batch_label_faces', {
                face_ids: faceIds,
                person_name: personName,
                create_person: true
            });

            // Clear selection and input
            this.clearSelection();
            this.shadowRoot.getElementById('personName').value = '';
            
            // Show success message
            const statusEl = this.shadowRoot.getElementById('status');
            const originalText = statusEl.textContent;
            statusEl.textContent = `✓ Labeled ${faceIds.length} faces as ${personName}`;
            statusEl.style.background = 'green';
            
            setTimeout(() => {
                statusEl.style.background = 'var(--primary-color)';
                this.updateContent(); // Refresh the display
            }, 2000);

        } catch (error) {
            console.error('Error labeling faces:', error);
            const statusEl = this.shadowRoot.getElementById('status');
            statusEl.textContent = `Error: ${error.message}`;
            statusEl.style.background = 'red';
            
            setTimeout(() => {
                statusEl.style.background = 'var(--primary-color)';
                this.updateContent();
            }, 3000);
        }
    }

    getCardSize() {
        return 3;
    }
}

customElements.define('whorang-face-manager-simple-card', WhoRangFaceManagerCard);

// Register with window for debugging
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'whorang-face-manager-simple-card',
    name: 'WhoRang Face Manager Simple Card',
    description: 'Simple visual face management for WhoRang AI Doorbell'
});

console.log('WhoRang Face Manager Simple Card loaded successfully');
