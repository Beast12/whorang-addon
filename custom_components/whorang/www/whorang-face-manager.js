/**
 * WhoRang Face Manager Card
 * Custom Lovelace card for visual face selection and labeling
 */

class WhoRangFaceManagerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedFaces = new Set();
    this.faces = [];
    this.isLoading = false;
  }

  setConfig(config) {
    this.config = {
      entity: 'sensor.whorang_ai_doorbell_face_gallery',
      title: 'Face Manager',
      columns: 4,
      show_progress: true,
      show_controls: true,
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.updateFaces();
  }

  updateFaces() {
    if (!this._hass) return;
    
    const gallery = this._hass.states[this.config.entity];
    if (gallery && gallery.attributes) {
      const unknownFaces = gallery.attributes.unknown_faces || [];
      const knownPersons = gallery.attributes.known_persons || [];
      const totalUnknown = gallery.attributes.total_unknown || 0;
      const totalKnown = gallery.attributes.total_known || 0;
      const progress = gallery.attributes.labeling_progress || 100;
      
      // Only update if data has changed
      if (JSON.stringify(this.faces) !== JSON.stringify(unknownFaces)) {
        this.faces = unknownFaces;
        this.knownPersons = knownPersons;
        this.totalUnknown = totalUnknown;
        this.totalKnown = totalKnown;
        this.progress = progress;
        this.renderContent();
      }
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        .face-manager {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.1));
          padding: 16px;
          font-family: var(--paper-font-body1_-_font-family);
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .title {
          font-size: 1.2em;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
          margin: 0;
        }
        
        .progress-info {
          font-size: 0.9em;
          color: var(--secondary-text-color, #757575);
        }
        
        .progress-bar {
          width: 100%;
          height: 4px;
          background: var(--divider-color, #e0e0e0);
          border-radius: 2px;
          margin: 8px 0;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: var(--primary-color, #03a9f4);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        
        .selection-info {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .selection-count {
          color: var(--primary-text-color, #212121);
          font-weight: 500;
        }
        
        .select-all-btn {
          background: none;
          border: 1px solid var(--primary-color, #03a9f4);
          color: var(--primary-color, #03a9f4);
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8em;
          transition: all 0.2s ease;
        }
        
        .select-all-btn:hover {
          background: var(--primary-color, #03a9f4);
          color: white;
        }
        
        .face-grid {
          display: grid;
          grid-template-columns: repeat(var(--columns, 4), 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        
        @media (max-width: 768px) {
          .face-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        
        @media (max-width: 480px) {
          .face-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        .face-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          background: var(--secondary-background-color, #f5f5f5);
        }
        
        .face-card:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .face-card.selected {
          border-color: var(--primary-color, #03a9f4);
          transform: scale(1.08);
          box-shadow: 0 6px 16px rgba(3, 169, 244, 0.3);
        }
        
        .face-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        
        .face-card .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: var(--secondary-text-color, #757575);
          font-size: 0.8em;
        }
        
        .face-card .error {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: var(--error-color, #f44336);
          font-size: 0.8em;
          text-align: center;
        }
        
        .face-card .checkbox {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color, #03a9f4);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          opacity: 0;
          transition: opacity 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .face-card.selected .checkbox {
          opacity: 1;
        }
        
        .face-card .quality-badge {
          position: absolute;
          bottom: 4px;
          left: 4px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7em;
        }
        
        .controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .control-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .control-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 200px;
        }
        
        input[type="text"] {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 6px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          font-size: 14px;
          transition: border-color 0.2s ease;
        }
        
        input[type="text"]:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }
        
        button {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .primary-btn {
          background: var(--primary-color, #03a9f4);
          color: white;
        }
        
        .primary-btn:hover:not(:disabled) {
          background: var(--dark-primary-color, #0288d1);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(3, 169, 244, 0.3);
        }
        
        .secondary-btn {
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color, #212121);
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .secondary-btn:hover {
          background: var(--divider-color, #e0e0e0);
        }
        
        .danger-btn {
          background: var(--error-color, #f44336);
          color: white;
        }
        
        .danger-btn:hover:not(:disabled) {
          background: #d32f2f;
        }
        
        button:disabled {
          background: var(--disabled-color, #bdbdbd) !important;
          color: var(--disabled-text-color, #9e9e9e) !important;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
        
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--secondary-text-color, #757575);
        }
        
        .empty-state .icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .loading-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .success-message {
          background: #e8f5e8;
          color: #2e7d32;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          display: none;
        }
        
        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          display: none;
        }
      </style>
      
      <div class="face-manager">
        <div class="header">
          <h3 class="title">${this.config.title}</h3>
          <div class="progress-info" id="progress-info"></div>
        </div>
        
        <div class="progress-bar" id="progress-container" style="display: none;">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        
        <div class="success-message" id="success-message"></div>
        <div class="error-message" id="error-message"></div>
        
        <div class="selection-info" id="selection-info" style="display: none;">
          <span class="selection-count" id="selection-count">0 faces selected</span>
          <button class="select-all-btn" id="select-all-btn">Select All</button>
        </div>
        
        <div class="face-grid" id="face-grid" style="--columns: ${this.config.columns}"></div>
        
        <div class="controls" id="controls" style="display: none;">
          <div class="control-row">
            <div class="control-group">
              <input type="text" id="person-name" placeholder="Enter person name..." />
              <button class="primary-btn" id="label-btn" disabled>
                <span id="label-btn-text">Label Selected</span>
              </button>
            </div>
          </div>
          <div class="control-row">
            <button class="secondary-btn" id="clear-btn">Clear Selection</button>
            <button class="secondary-btn" id="refresh-btn">Refresh Gallery</button>
            <button class="danger-btn" id="delete-btn" disabled>Delete Selected</button>
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
    this.renderContent();
  }

  renderContent() {
    if (!this.shadowRoot) return;
    
    const progressContainer = this.shadowRoot.getElementById('progress-container');
    const progressFill = this.shadowRoot.getElementById('progress-fill');
    const progressInfo = this.shadowRoot.getElementById('progress-info');
    const selectionInfo = this.shadowRoot.getElementById('selection-info');
    const controls = this.shadowRoot.getElementById('controls');
    
    // Update progress
    if (this.config.show_progress && typeof this.progress === 'number') {
      progressContainer.style.display = 'block';
      progressFill.style.width = `${this.progress}%`;
      progressInfo.textContent = `${Math.round(this.progress)}% labeled (${this.totalKnown} known, ${this.totalUnknown} unknown)`;
    }
    
    // Show/hide controls based on faces availability
    if (this.faces.length > 0) {
      selectionInfo.style.display = 'flex';
      if (this.config.show_controls) {
        controls.style.display = 'block';
      }
    } else {
      selectionInfo.style.display = 'none';
      controls.style.display = 'none';
    }
    
    this.renderFaceGrid();
    this.updateSelectionInfo();
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

  renderFaceGrid() {
    const grid = this.shadowRoot.getElementById('face-grid');
    
    if (this.faces.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="icon">🎉</div>
          <div>All faces have been labeled!</div>
          <div style="margin-top: 8px; font-size: 0.9em;">Great job managing your face recognition system.</div>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = '';
    
    this.faces.forEach(async (face) => {
      const faceCard = document.createElement('div');
      faceCard.className = 'face-card';
      faceCard.dataset.faceId = face.id;
      
      if (this.selectedFaces.has(face.id)) {
        faceCard.classList.add('selected');
      }
      
      const quality = Math.round((face.quality || 0) * 100);
      
      faceCard.innerHTML = `
        <div class="loading">Loading...</div>
        <img alt="Face ${face.id}" style="display: none;" />
        <div class="checkbox">✓</div>
        <div class="quality-badge">${quality}%</div>
      `;
      
      const img = faceCard.querySelector('img');
      const loading = faceCard.querySelector('.loading');
      
      // Try to get a working image URL
      try {
        const workingUrl = await this.getWorkingImageUrl(face);
        
        if (workingUrl) {
          img.src = workingUrl;
          
          img.onload = () => {
            loading.style.display = 'none';
            img.style.display = 'block';
          };
          
          img.onerror = () => {
            loading.innerHTML = `<div class="error">Image<br>Error</div>`;
          };
        } else {
          // No working URL found
          loading.innerHTML = `<div class="error">Face ${face.id}<br>No Image</div>`;
        }
      } catch (error) {
        console.error(`Failed to load image for face ${face.id}:`, error);
        loading.innerHTML = `<div class="error">Face ${face.id}<br>Load Error</div>`;
      }
      
      faceCard.addEventListener('click', () => this.toggleFace(face.id));
      grid.appendChild(faceCard);
    });
  }

  toggleFace(faceId) {
    const card = this.shadowRoot.querySelector(`[data-face-id="${faceId}"]`);
    
    if (this.selectedFaces.has(faceId)) {
      this.selectedFaces.delete(faceId);
      card.classList.remove('selected');
    } else {
      this.selectedFaces.add(faceId);
      card.classList.add('selected');
    }
    
    this.updateSelectionInfo();
  }

  selectAllFaces() {
    this.faces.forEach(face => {
      this.selectedFaces.add(face.id);
      const card = this.shadowRoot.querySelector(`[data-face-id="${face.id}"]`);
      if (card) {
        card.classList.add('selected');
      }
    });
    this.updateSelectionInfo();
  }

  clearSelection() {
    this.selectedFaces.clear();
    this.shadowRoot.querySelectorAll('.face-card').forEach(card => {
      card.classList.remove('selected');
    });
    this.updateSelectionInfo();
  }

  updateSelectionInfo() {
    const count = this.selectedFaces.size;
    const countEl = this.shadowRoot.getElementById('selection-count');
    const labelBtn = this.shadowRoot.getElementById('label-btn');
    const deleteBtn = this.shadowRoot.getElementById('delete-btn');
    const selectAllBtn = this.shadowRoot.getElementById('select-all-btn');
    
    countEl.textContent = `${count} face${count !== 1 ? 's' : ''} selected`;
    
    if (labelBtn) labelBtn.disabled = count === 0 || this.isLoading;
    if (deleteBtn) deleteBtn.disabled = count === 0 || this.isLoading;
    
    if (selectAllBtn) {
      selectAllBtn.textContent = count === this.faces.length ? 'Clear All' : 'Select All';
    }
  }

  setupEventListeners() {
    const personNameInput = this.shadowRoot.getElementById('person-name');
    const labelBtn = this.shadowRoot.getElementById('label-btn');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
    const deleteBtn = this.shadowRoot.getElementById('delete-btn');
    const selectAllBtn = this.shadowRoot.getElementById('select-all-btn');

    if (labelBtn) {
      labelBtn.addEventListener('click', () => {
        const personName = personNameInput.value.trim();
        if (personName && this.selectedFaces.size > 0) {
          this.labelSelectedFaces(personName);
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearSelection());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshFaces());
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteSelectedFaces());
    }

    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        if (this.selectedFaces.size === this.faces.length) {
          this.clearSelection();
        } else {
          this.selectAllFaces();
        }
      });
    }

    if (personNameInput) {
      personNameInput.addEventListener('input', () => {
        const labelBtn = this.shadowRoot.getElementById('label-btn');
        if (labelBtn) {
          labelBtn.disabled = !personNameInput.value.trim() || this.selectedFaces.size === 0 || this.isLoading;
        }
      });
      
      personNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !labelBtn.disabled) {
          labelBtn.click();
        }
      });
    }
  }

  async labelSelectedFaces(personName) {
    if (!this._hass || this.isLoading) return;
    
    this.setLoading(true);
    const selectedIds = Array.from(this.selectedFaces);
    
    try {
      await this._hass.callService('whorang', 'batch_label_faces', {
        face_ids: selectedIds,
        person_name: personName,
        create_person: true
      });
      
      this.showMessage(`Successfully labeled ${selectedIds.length} face${selectedIds.length !== 1 ? 's' : ''} as "${personName}"`, 'success');
      
      // Clear form and selection
      this.selectedFaces.clear();
      const personNameInput = this.shadowRoot.getElementById('person-name');
      if (personNameInput) personNameInput.value = '';
      
      // Refresh after a short delay
      setTimeout(() => this.refreshFaces(), 1000);
      
    } catch (error) {
      console.error('Failed to label faces:', error);
      this.showMessage('Failed to label faces. Please try again.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  async deleteSelectedFaces() {
    if (!this._hass || this.isLoading || this.selectedFaces.size === 0) return;
    
    const count = this.selectedFaces.size;
    if (!confirm(`Are you sure you want to delete ${count} face${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    
    this.setLoading(true);
    const selectedIds = Array.from(this.selectedFaces);
    let successCount = 0;
    
    try {
      // Delete faces one by one (if no batch delete service exists)
      for (const faceId of selectedIds) {
        try {
          await this._hass.callService('whorang', 'delete_face', { face_id: faceId });
          successCount++;
        } catch (error) {
          console.error(`Failed to delete face ${faceId}:`, error);
        }
      }
      
      if (successCount > 0) {
        this.showMessage(`Successfully deleted ${successCount} face${successCount !== 1 ? 's' : ''}`, 'success');
        this.selectedFaces.clear();
        setTimeout(() => this.refreshFaces(), 1000);
      } else {
        this.showMessage('Failed to delete faces. Please try again.', 'error');
      }
      
    } catch (error) {
      console.error('Failed to delete faces:', error);
      this.showMessage('Failed to delete faces. Please try again.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  refreshFaces() {
    if (!this._hass) return;
    
    try {
      this._hass.callService('homeassistant', 'update_entity', {
        entity_id: this.config.entity
      });
      this.showMessage('Gallery refreshed', 'success');
    } catch (error) {
      console.error('Failed to refresh faces:', error);
      this.showMessage('Failed to refresh gallery', 'error');
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const labelBtn = this.shadowRoot.getElementById('label-btn');
    const labelBtnText = this.shadowRoot.getElementById('label-btn-text');
    const deleteBtn = this.shadowRoot.getElementById('delete-btn');
    
    if (labelBtn && labelBtnText) {
      if (loading) {
        labelBtnText.innerHTML = '<span class="loading-spinner"></span>Labeling...';
      } else {
        labelBtnText.textContent = 'Label Selected';
      }
    }
    
    this.updateSelectionInfo();
  }

  showMessage(message, type) {
    const successEl = this.shadowRoot.getElementById('success-message');
    const errorEl = this.shadowRoot.getElementById('error-message');
    
    // Hide both messages first
    successEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    // Show appropriate message
    const messageEl = type === 'success' ? successEl : errorEl;
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 5000);
  }

  getCardSize() {
    const faceCount = this.faces.length;
    if (faceCount === 0) return 3;
    
    const rows = Math.ceil(faceCount / this.config.columns);
    return Math.min(rows + 3, 10); // +3 for header and controls, max 10
  }
}

// Register the custom element
customElements.define('whorang-face-manager-card', WhoRangFaceManagerCard);

// Register with Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'whorang-face-manager-card',
  name: 'WhoRang Face Manager',
  description: 'Visual face selection and labeling interface for WhoRang AI Doorbell',
  preview: true,
  documentationURL: 'https://github.com/Beast12/whorang-addon'
});

console.info(
  '%c WHORANG-FACE-MANAGER-CARD %c v1.0.0 ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);
