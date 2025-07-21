/**
 * WhoRang Known Persons Card
 * Custom Lovelace card for displaying known persons with avatars
 */

class WhoRangKnownPersonsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.persons = [];
    this.totalKnown = 0;
    this.totalFaces = 0;
    this.avgFaces = 0;
    this.galleryReady = true; // Default to true so we show empty state immediately
    this.backendUrl = null;
    this.isLoading = false;
    this.loadingTimeout = null;
    this.loadingStartTime = null;
  }

  setConfig(config) {
    this.config = {
      entity: 'sensor.whorang_known_persons_gallery',
      title: 'Known Persons',
      columns: 3,
      show_stats: true,
      show_last_seen: true,
      show_face_count: true,
      whorang_url: null,
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.updatePersons();
  }

  updatePersons() {
    if (!this._hass) return;
    
    const gallery = this._hass.states[this.config.entity];
    if (gallery && gallery.attributes) {
      const persons = gallery.attributes.persons || [];
      const totalKnown = gallery.attributes.total_known_persons || 0;
      const totalFaces = gallery.attributes.total_labeled_faces || 0;
      const avgFaces = gallery.attributes.avg_faces_per_person || 0;
      const galleryReady = gallery.attributes.gallery_ready;
      const backendUrl = gallery.attributes.backend_url || this.config.whorang_url;
      
      // Set up timeout for loading state if gallery is not ready and we haven't started timing yet
      if (galleryReady === undefined && !this.loadingStartTime) {
        this.loadingStartTime = Date.now();
        this.loadingTimeout = setTimeout(() => {
          console.warn('WhoRang Known Persons Card: Loading timeout reached, forcing empty state display');
          if (this.galleryReady === undefined) {
            this.galleryReady = true; // Force show empty state
            this.totalKnown = 0;
            this.totalFaces = 0;
            this.renderContent();
          }
        }, 30000); // 30 second timeout
      }
      
      // Clear timeout if we get definitive data
      if (galleryReady !== undefined && this.loadingTimeout) {
        clearTimeout(this.loadingTimeout);
        this.loadingTimeout = null;
        this.loadingStartTime = null;
      }
      
      // Only update if data has changed
      if (JSON.stringify(this.persons) !== JSON.stringify(persons) || 
          this.galleryReady !== galleryReady) {
        this.persons = persons;
        this.totalKnown = totalKnown;
        this.totalFaces = totalFaces;
        this.avgFaces = avgFaces;
        this.galleryReady = galleryReady;
        this.backendUrl = backendUrl;
        this.renderContent();
      }
    }
  }

  render() {
    console.log('WhoRang Known Persons Card: render() called');
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        .known-persons {
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
        
        .stats-info {
          font-size: 0.9em;
          color: var(--secondary-text-color, #757575);
          text-align: right;
        }
        
        .stats-summary {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
        }
        
        .stat-item {
          text-align: center;
        }
        
        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: var(--primary-color, #03a9f4);
          display: block;
        }
        
        .stat-label {
          font-size: 0.8em;
          color: var(--secondary-text-color, #757575);
          margin-top: 4px;
        }
        
        .persons-grid {
          display: grid;
          grid-template-columns: repeat(var(--columns, 3), 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }
        
        @media (max-width: 768px) {
          .persons-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 480px) {
          .persons-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .person-card {
          background: var(--card-background-color, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        
        .person-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border-color: var(--primary-color, #03a9f4);
        }
        
        .avatar-container {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 12px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--secondary-background-color, #f5f5f5);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        
        .avatar-placeholder {
          width: 40px;
          height: 40px;
          color: var(--secondary-text-color, #757575);
          font-size: 40px;
        }
        
        .avatar-loading {
          width: 24px;
          height: 24px;
          border: 2px solid var(--divider-color, #e0e0e0);
          border-top: 2px solid var(--primary-color, #03a9f4);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .face-count-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--primary-color, #03a9f4);
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7em;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .person-name {
          font-size: 1em;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
          margin-bottom: 8px;
          word-break: break-word;
        }
        
        .person-details {
          font-size: 0.8em;
          color: var(--secondary-text-color, #757575);
          line-height: 1.4;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .detail-label {
          font-weight: 500;
        }
        
        .last-seen {
          color: var(--success-color, #4caf50);
        }
        
        .last-seen.old {
          color: var(--warning-color, #ff9800);
        }
        
        .last-seen.very-old {
          color: var(--error-color, #f44336);
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
        
        .loading-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--secondary-text-color, #757575);
        }
        
        .error-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--error-color, #f44336);
          background: var(--error-color, #f44336)10;
          border-radius: 8px;
          margin: 16px 0;
        }
        
        .controls {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 16px;
        }
        
        .control-btn {
          padding: 8px 16px;
          border: 1px solid var(--primary-color, #03a9f4);
          background: transparent;
          color: var(--primary-color, #03a9f4);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          transition: all 0.2s ease;
        }
        
        .control-btn:hover {
          background: var(--primary-color, #03a9f4);
          color: white;
        }
        
        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .person-card.active {
          border-color: var(--primary-color, #03a9f4);
          background: var(--primary-color, #03a9f4)08;
        }
        
        .confidence-indicator {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7em;
        }
        
        .confidence-high {
          background: rgba(76, 175, 80, 0.8);
        }
        
        .confidence-medium {
          background: rgba(255, 152, 0, 0.8);
        }
        
        .confidence-low {
          background: rgba(244, 67, 54, 0.8);
        }
        
        /* Person Management Modal Styles */
        .person-management-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          display: none;
          align-items: center;
          justify-content: center;
          font-family: var(--paper-font-body1_-_font-family);
        }
        
        .modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
        }
        
        .modal-content {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          max-width: 900px;
          width: 90%;
          max-height: 80vh;
          position: relative;
          z-index: 10001;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          flex-shrink: 0;
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 1.4em;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--secondary-text-color, #757575);
          padding: 4px;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .close-btn:hover {
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color, #212121);
        }
        
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        
        .person-management-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .add-person-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--primary-color, #03a9f4);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9em;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .add-person-btn:hover {
          background: var(--primary-color, #03a9f4)dd;
          transform: translateY(-1px);
        }
        
        .person-count {
          font-size: 0.9em;
          color: var(--secondary-text-color, #757575);
        }
        
        .persons-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .person-management-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--card-background-color, #fff);
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 12px;
          transition: all 0.2s ease;
        }
        
        .person-management-item:hover {
          border-color: var(--primary-color, #03a9f4);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .person-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }
        
        .person-avatar-small {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--secondary-background-color, #f5f5f5);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .person-avatar-small img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .avatar-placeholder-small {
          font-size: 24px;
          color: var(--secondary-text-color, #757575);
        }
        
        .person-details-management {
          flex: 1;
        }
        
        .person-name-editable {
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
          margin-bottom: 4px;
        }
        
        .person-stats {
          font-size: 0.85em;
          color: var(--secondary-text-color, #757575);
          margin-bottom: 4px;
        }
        
        .person-description-editable {
          font-size: 0.9em;
          color: var(--secondary-text-color, #757575);
          font-style: italic;
        }
        
        .person-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        
        .action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #212121);
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8em;
          transition: all 0.2s ease;
        }
        
        .action-btn:hover {
          border-color: var(--primary-color, #03a9f4);
          color: var(--primary-color, #03a9f4);
        }
        
        .action-btn.delete-btn:hover {
          border-color: var(--error-color, #f44336);
          color: var(--error-color, #f44336);
        }
        
        .action-btn .icon {
          font-size: 14px;
        }
        
        .empty-management-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--secondary-text-color, #757575);
        }
        
        .empty-management-state .icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .error-management-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--error-color, #f44336);
          background: var(--error-color, #f44336)10;
          border-radius: 8px;
        }
        
        .error-management-state .icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .retry-btn {
          margin-top: 16px;
          padding: 8px 16px;
          background: var(--primary-color, #03a9f4);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
        }
        
        .retry-btn:hover {
          background: var(--primary-color, #03a9f4)dd;
        }
        
        /* Faces Dialog Styles */
        .faces-dialog {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10002;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .faces-dialog-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
        }
        
        .faces-dialog-content {
          background: var(--card-background-color, #fff);
          border-radius: 12px;
          max-width: 800px;
          width: 90%;
          max-height: 70vh;
          position: relative;
          z-index: 10003;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
        }
        
        .faces-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .faces-dialog-header h3 {
          margin: 0;
          font-size: 1.2em;
          color: var(--primary-text-color, #212121);
        }
        
        .close-faces-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--secondary-text-color, #757575);
          padding: 4px;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-faces-btn:hover {
          background: var(--secondary-background-color, #f5f5f5);
        }
        
        .faces-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 16px;
          padding: 20px;
          overflow-y: auto;
        }
        
        .face-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        
        .face-thumbnail {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid var(--divider-color, #e0e0e0);
          margin-bottom: 8px;
        }
        
        .face-info {
          font-size: 0.8em;
          color: var(--secondary-text-color, #757575);
        }
        
        /* Notification Styles */
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 8px;
          color: white;
          font-size: 0.9em;
          z-index: 10004;
          animation: slideIn 0.3s ease;
        }
        
        .notification-success {
          background: var(--success-color, #4caf50);
        }
        
        .notification-error {
          background: var(--error-color, #f44336);
        }
        
        .notification-info {
          background: var(--primary-color, #03a9f4);
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .modal-content {
            width: 95%;
            max-height: 90vh;
          }
          
          .person-management-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
          
          .person-actions {
            width: 100%;
            justify-content: flex-end;
          }
          
          .faces-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 12px;
            padding: 16px;
          }
        }
      </style>
      
      <div class="known-persons">
        <div class="header">
          <h3 class="title">${this.config.title}</h3>
          <div class="stats-info" id="stats-info"></div>
        </div>
        
        <div class="stats-summary" id="stats-summary" style="display: none;">
          <div class="stat-item">
            <span class="stat-value" id="total-persons">0</span>
            <div class="stat-label">Known Persons</div>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="total-faces">0</span>
            <div class="stat-label">Total Faces</div>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="avg-faces">0</span>
            <div class="stat-label">Avg per Person</div>
          </div>
        </div>
        
        <div class="persons-grid" id="persons-grid" style="--columns: ${this.config.columns}"></div>
        
        <div class="controls" id="controls" style="display: none;">
          <button class="control-btn" id="refresh-btn">Refresh Gallery</button>
          <button class="control-btn" id="manage-btn">Manage Persons</button>
        </div>
      </div>
      
      <!-- Person Management Modal -->
      <div class="person-management-modal" id="person-modal">
        <div class="modal-backdrop" id="modal-backdrop"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Manage Known Persons</h2>
            <button class="close-btn" id="close-modal-btn">&times;</button>
          </div>
          <div class="modal-body" id="modal-body">
            <div class="loading-state">
              <div>Loading person management data...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
    this.renderContent();
  }

  renderContent() {
    if (!this.shadowRoot) return;
    
    const statsInfo = this.shadowRoot.getElementById('stats-info');
    const statsSummary = this.shadowRoot.getElementById('stats-summary');
    const controls = this.shadowRoot.getElementById('controls');
    
    // Always show count, never show loading - remove galleryReady check
    if (this.config.show_stats && this.totalKnown > 0) {
      statsSummary.style.display = 'grid';
      statsInfo.textContent = `${this.totalKnown || 0} persons, ${this.totalFaces || 0} faces`;
      
      this.shadowRoot.getElementById('total-persons').textContent = this.totalKnown || 0;
      this.shadowRoot.getElementById('total-faces').textContent = this.totalFaces || 0;
      this.shadowRoot.getElementById('avg-faces').textContent = this.avgFaces || 0;
    } else {
      statsSummary.style.display = 'none';
      // Always show count, never show loading
      statsInfo.textContent = `${this.totalKnown || 0} known persons`;
    }
    
    // Show/hide controls
    if (this.persons.length > 0) {
      controls.style.display = 'flex';
    } else {
      controls.style.display = 'none';
    }
    
    this.renderPersonsGrid();
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

  async getWorkingAvatarUrl(person) {
    console.log(`Getting avatar URL for person ${person.id} (${person.name})`);
    
    // First try direct avatar URL from person data
    if (person.avatar_url) {
      console.log(`Trying direct avatar URL: ${person.avatar_url}`);
      if (await this.testImageUrl(person.avatar_url)) {
        console.log(`Direct avatar URL works: ${person.avatar_url}`);
        return person.avatar_url;
      }
    }
    
    // Try multiple avatar URL patterns - prioritize the PersonController endpoint
    const baseUrls = this.getWhoRangBaseUrlCandidates();
    console.log(`Trying ${baseUrls.length} base URLs for person ${person.id}:`, baseUrls);
    
    for (const baseUrl of baseUrls) {
      // Try different avatar endpoint patterns - PersonController endpoint first
      const avatarPatterns = [
        `${baseUrl}/api/faces/persons/${person.id}/avatar`,  // PersonController pattern (primary)
        `${baseUrl}/api/persons/${person.id}/avatar`,        // Legacy pattern
        `${baseUrl}/api/persons/${person.id}/image`,         // Alternative pattern
        `${baseUrl}/api/persons/${person.id}/thumbnail`      // Another alternative
      ];
      
      console.log(`Testing ${avatarPatterns.length} avatar patterns for base URL ${baseUrl}`);
      
      for (const avatarUrl of avatarPatterns) {
        console.log(`Testing avatar URL: ${avatarUrl}`);
        if (await this.testImageUrl(avatarUrl)) {
          // Cache the working base URL for future use
          this._workingBaseUrl = baseUrl;
          console.log(`✅ Found working avatar URL for person ${person.id}: ${avatarUrl}`);
          return avatarUrl;
        } else {
          console.log(`❌ Avatar URL failed: ${avatarUrl}`);
        }
      }
    }
    
    console.warn(`❌ No working avatar URL found for person ${person.id} (${person.name})`);
    return null; // No avatar available - will show placeholder
  }

  renderPersonsGrid() {
    const grid = this.shadowRoot.getElementById('persons-grid');
    console.log('WhoRang Known Persons Card: renderPersonsGrid() called, persons.length =', this.persons.length);
    
    // If there are no persons, always show empty state (no loading)
    if (this.persons.length === 0) {
      console.log('WhoRang Known Persons Card: Showing empty state');
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="icon">👥</div>
          <div>No known persons yet</div>
          <div style="margin-top: 8px; font-size: 0.9em;">Start labeling faces to build your person gallery.</div>
        </div>
      `;
      return;
    }
    
    // If we have persons but gallery not ready, still show them
    if (!this.galleryReady && this.persons.length > 0) {
      // Continue to render persons even if gallery not fully ready
    }
    
    grid.innerHTML = '';
    
    this.persons.forEach(async (person) => {
      const personCard = document.createElement('div');
      personCard.className = 'person-card';
      personCard.dataset.personId = person.id;
      
      // Calculate last seen status
      const lastSeenClass = this.getLastSeenClass(person.last_seen);
      const lastSeenText = this.formatLastSeen(person.last_seen);
      
      // Calculate confidence level
      const confidence = person.avg_confidence || 0;
      const confidenceClass = confidence > 0.8 ? 'confidence-high' : 
                             confidence > 0.6 ? 'confidence-medium' : 'confidence-low';
      
      personCard.innerHTML = `
        <div class="avatar-container">
          <div class="avatar-loading"></div>
          <img class="avatar-image" alt="${person.name}" style="display: none;" />
          <div class="avatar-placeholder" style="display: none;">👤</div>
          ${this.config.show_face_count ? `<div class="face-count-badge">${person.face_count || 0}</div>` : ''}
        </div>
        <div class="person-name">${person.name}</div>
        <div class="person-details">
          ${this.config.show_last_seen && person.last_seen ? `
            <div class="detail-row">
              <span class="detail-label">Last seen:</span>
              <span class="last-seen ${lastSeenClass}">${lastSeenText}</span>
            </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Faces:</span>
            <span>${person.face_count || 0}</span>
          </div>
          ${person.recognition_count ? `
            <div class="detail-row">
              <span class="detail-label">Recognized:</span>
              <span>${person.recognition_count}x</span>
            </div>
          ` : ''}
        </div>
        ${confidence > 0 ? `<div class="confidence-indicator ${confidenceClass}">${Math.round(confidence * 100)}%</div>` : ''}
      `;
      
      const img = personCard.querySelector('.avatar-image');
      const loading = personCard.querySelector('.avatar-loading');
      const placeholder = personCard.querySelector('.avatar-placeholder');
      
      // Try to get a working avatar URL
      try {
        const workingUrl = await this.getWorkingAvatarUrl(person);
        
        if (workingUrl) {
          img.src = workingUrl;
          
          img.onload = () => {
            loading.style.display = 'none';
            img.style.display = 'block';
          };
          
          img.onerror = () => {
            loading.style.display = 'none';
            placeholder.style.display = 'flex';
          };
        } else {
          // No working URL found
          loading.style.display = 'none';
          placeholder.style.display = 'flex';
        }
      } catch (error) {
        console.error(`Failed to load avatar for person ${person.id}:`, error);
        loading.style.display = 'none';
        placeholder.style.display = 'flex';
      }
      
      personCard.addEventListener('click', () => this.handlePersonClick(person));
      grid.appendChild(personCard);
    });
  }

  getLastSeenClass(lastSeen) {
    if (!lastSeen) return '';
    
    const now = new Date();
    const seenDate = new Date(lastSeen);
    const daysDiff = (now - seenDate) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 1) return '';
    if (daysDiff < 7) return '';
    if (daysDiff < 30) return 'old';
    return 'very-old';
  }

  formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Never';
    
    const now = new Date();
    const seenDate = new Date(lastSeen);
    const diffMs = now - seenDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  handlePersonClick(person) {
    // Show person details or navigate to person management
    console.log('Person clicked:', person);
    
    // Fire custom event for person selection
    this.dispatchEvent(new CustomEvent('person-selected', {
      detail: { person },
      bubbles: true,
      composed: true
    }));
    
    // You could also open a more detailed view or navigate to person management
    // For now, we'll just highlight the selected person
    this.shadowRoot.querySelectorAll('.person-card').forEach(card => {
      card.classList.remove('active');
    });
    
    const clickedCard = this.shadowRoot.querySelector(`[data-person-id="${person.id}"]`);
    if (clickedCard) {
      clickedCard.classList.add('active');
    }
  }

  setupEventListeners() {
    const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
    const manageBtn = this.shadowRoot.getElementById('manage-btn');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshGallery());
    }

    if (manageBtn) {
      manageBtn.addEventListener('click', () => this.openPersonManagement());
    }

    // Modal event listeners
    const closeModalBtn = this.shadowRoot.getElementById('close-modal-btn');
    const modalBackdrop = this.shadowRoot.getElementById('modal-backdrop');

    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.closePersonManagement());
    }

    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', () => this.closePersonManagement());
    }

    // Keyboard event listener for ESC key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const modal = this.shadowRoot.getElementById('person-modal');
        if (modal && modal.style.display === 'flex') {
          this.closePersonManagement();
        }
      }
    });
  }

  refreshGallery() {
    if (!this._hass) return;
    
    try {
      this._hass.callService('homeassistant', 'update_entity', {
        entity_id: this.config.entity
      });
      
      // Show loading state briefly
      const statsInfo = this.shadowRoot.getElementById('stats-info');
      const originalText = statsInfo.textContent;
      statsInfo.textContent = 'Refreshing...';
      
      setTimeout(() => {
        if (statsInfo.textContent === 'Refreshing...') {
          statsInfo.textContent = originalText;
        }
      }, 2000);
      
    } catch (error) {
      console.error('Failed to refresh gallery:', error);
    }
  }

  async openPersonManagement() {
    console.log('Opening person management modal');
    
    // Show the modal
    const modal = this.shadowRoot.getElementById('person-modal');
    if (modal) {
      modal.style.display = 'flex';
      
      // Load fresh person data
      await this.loadPersonManagementData();
    }
    
    // Fire custom event for person management
    this.dispatchEvent(new CustomEvent('person-management-requested', {
      bubbles: true,
      composed: true
    }));
  }

  async loadPersonManagementData() {
    if (!this._hass) return;
    
    try {
      // Get detailed person data from the backend
      const baseUrls = this.getWhoRangBaseUrlCandidates();
      let personsData = null;
      
      for (const baseUrl of baseUrls) {
        try {
          const response = await fetch(`${baseUrl}/api/faces/persons`);
          if (response.ok) {
            const data = await response.json();
            // PersonController returns array directly, not wrapped in success object
            if (Array.isArray(data)) {
              personsData = data;
              break;
            } else if (data.success) {
              personsData = data.persons || data.data || [];
              break;
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${baseUrl}:`, error);
          continue;
        }
      }
      
      if (personsData) {
        this.renderPersonManagementModal(personsData);
      } else {
        console.error('Failed to load person management data from all URLs');
        this.renderPersonManagementError();
      }
    } catch (error) {
      console.error('Error loading person management data:', error);
      this.renderPersonManagementError();
    }
  }

  renderPersonManagementModal(persons) {
    const modalBody = this.shadowRoot.getElementById('modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
      <div class="person-management-header">
        <button class="add-person-btn" id="add-person-btn">
          <span class="icon">➕</span>
          Add New Person
        </button>
        <div class="person-count">${persons.length} known persons</div>
      </div>
      
      <div class="persons-list" id="persons-list">
        ${persons.map(person => this.renderPersonManagementItem(person)).join('')}
      </div>
      
      ${persons.length === 0 ? `
        <div class="empty-management-state">
          <div class="icon">👥</div>
          <div>No known persons yet</div>
          <div style="margin-top: 8px; font-size: 0.9em;">Add persons manually or label faces to get started.</div>
        </div>
      ` : ''}
    `;
    
    // Set up event listeners for the modal content
    this.setupPersonManagementListeners();
  }

  renderPersonManagementItem(person) {
    const lastSeenText = this.formatLastSeen(person.last_seen);
    const lastSeenClass = this.getLastSeenClass(person.last_seen);
    
    // Generate avatar URL from the first working base URL
    const baseUrls = this.getWhoRangBaseUrlCandidates();
    const avatarUrl = baseUrls.length > 0 ? `${baseUrls[0]}/api/faces/persons/${person.id}/avatar` : '';
    
    console.log(`Person ${person.id} (${person.name}): avatar URL = ${avatarUrl}`);
    console.log(`Person data:`, person);
    
    return `
      <div class="person-management-item" data-person-id="${person.id}">
        <div class="person-info">
          <div class="person-avatar-small">
            <img src="${avatarUrl}" alt="${person.name}" 
                 onerror="console.error('Avatar failed to load for person ${person.id}: ${avatarUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                 onload="console.log('Avatar loaded successfully for person ${person.id}: ${avatarUrl}');" />
            <div class="avatar-placeholder-small" style="display: none;">👤</div>
          </div>
          <div class="person-details-management">
            <div class="person-name-editable" data-field="name">${person.name}</div>
            <div class="person-stats">
              ${person.face_count || 0} faces • Last seen: <span class="last-seen ${lastSeenClass}">${lastSeenText}</span>
            </div>
            <div class="person-description-editable" data-field="description">
              ${person.description || 'No description'}
            </div>
          </div>
        </div>
        <div class="person-actions">
          <button class="action-btn edit-btn" data-action="edit" data-person-id="${person.id}">
            <span class="icon">✏️</span>
            Edit
          </button>
          <button class="action-btn faces-btn" data-action="faces" data-person-id="${person.id}">
            <span class="icon">👁️</span>
            View Faces
          </button>
          <button class="action-btn delete-btn" data-action="delete" data-person-id="${person.id}">
            <span class="icon">🗑️</span>
            Delete
          </button>
        </div>
      </div>
    `;
  }

  renderPersonManagementError() {
    const modalBody = this.shadowRoot.getElementById('modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
      <div class="error-management-state">
        <div class="icon">⚠️</div>
        <div>Failed to load person management data</div>
        <div style="margin-top: 8px; font-size: 0.9em;">Please check your WhoRang backend connection.</div>
        <button class="retry-btn" id="retry-load-btn">Retry</button>
      </div>
    `;
    
    const retryBtn = modalBody.querySelector('#retry-load-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadPersonManagementData());
    }
  }

  setupPersonManagementListeners() {
    const modalBody = this.shadowRoot.getElementById('modal-body');
    if (!modalBody) return;
    
    // Add person button
    const addPersonBtn = modalBody.querySelector('#add-person-btn');
    if (addPersonBtn) {
      addPersonBtn.addEventListener('click', () => this.showAddPersonDialog());
    }
    
    // Action buttons
    modalBody.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      
      const action = target.dataset.action;
      const personId = parseInt(target.dataset.personId);
      
      switch (action) {
        case 'edit':
          this.editPerson(personId);
          break;
        case 'faces':
          this.viewPersonFaces(personId);
          break;
        case 'delete':
          this.deletePerson(personId);
          break;
      }
    });
    
    // Editable fields
    modalBody.addEventListener('dblclick', (event) => {
      const editableField = event.target.closest('[data-field]');
      if (editableField) {
        this.makeFieldEditable(editableField);
      }
    });
  }

  async showAddPersonDialog() {
    const name = prompt('Enter person name:');
    if (!name || !name.trim()) return;
    
    const description = prompt('Enter description (optional):') || '';
    
    try {
      await this._hass.callService('whorang', 'add_known_visitor', {
        name: name.trim(),
        notes: description.trim()
      });
      
      // Reload the modal data
      await this.loadPersonManagementData();
      
      // Show success message
      this.showNotification('Person added successfully', 'success');
    } catch (error) {
      console.error('Failed to add person:', error);
      this.showNotification('Failed to add person', 'error');
    }
  }

  async editPerson(personId) {
    const personItem = this.shadowRoot.querySelector(`[data-person-id="${personId}"]`);
    if (!personItem) return;
    
    const nameElement = personItem.querySelector('[data-field="name"]');
    const descriptionElement = personItem.querySelector('[data-field="description"]');
    
    const currentName = nameElement.textContent;
    const currentDescription = descriptionElement.textContent === 'No description' ? '' : descriptionElement.textContent;
    
    const newName = prompt('Edit person name:', currentName);
    if (newName === null) return; // User cancelled
    
    const newDescription = prompt('Edit description:', currentDescription);
    if (newDescription === null) return; // User cancelled
    
    try {
      // Call the update person service (we'll need to add this)
      await this._hass.callService('whorang', 'update_person', {
        person_id: personId,
        name: newName.trim(),
        description: newDescription.trim()
      });
      
      // Update the UI immediately
      nameElement.textContent = newName.trim();
      descriptionElement.textContent = newDescription.trim() || 'No description';
      
      // Show success message
      this.showNotification('Person updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update person:', error);
      this.showNotification('Failed to update person', 'error');
    }
  }

  async viewPersonFaces(personId) {
    try {
      console.log(`Loading faces for person ${personId}`);
      
      // Get person faces from backend using the correct endpoint
      const baseUrls = this.getWhoRangBaseUrlCandidates();
      let facesData = null;
      let workingBaseUrl = null;
      
      for (const baseUrl of baseUrls) {
        try {
          console.log(`Trying to fetch faces from: ${baseUrl}/api/detected-faces/person/${personId}`);
          
          // Use the correct DetectedFacesController endpoint
          const facesResponse = await fetch(`${baseUrl}/api/detected-faces/person/${personId}`);
          if (facesResponse.ok) {
            const facesResult = await facesResponse.json();
            console.log(`Faces response from ${baseUrl}:`, facesResult);
            
            if (facesResult && Array.isArray(facesResult.faces)) {
              workingBaseUrl = baseUrl;
              facesData = facesResult.faces.map(face => {
                // Try multiple image URL patterns for better compatibility
                let imageUrls = [];
                
                // Build multiple URL candidates to try
                if (face.face_crop_path) {
                  if (face.face_crop_path.startsWith('http')) {
                    imageUrls.push(face.face_crop_path);
                  } else {
                    // Try multiple path patterns
                    const cleanPath = face.face_crop_path.replace(/^\/+/, '');
                    imageUrls.push(`${baseUrl}/${cleanPath}`);
                    imageUrls.push(`${baseUrl}/data/${cleanPath}`);
                    imageUrls.push(`${baseUrl}/${face.face_crop_path}`); // Original path as-is
                  }
                }
                
                if (face.thumbnail_path) {
                  if (face.thumbnail_path.startsWith('http')) {
                    imageUrls.push(face.thumbnail_path);
                  } else {
                    const cleanPath = face.thumbnail_path.replace(/^\/+/, '');
                    imageUrls.push(`${baseUrl}/${cleanPath}`);
                    imageUrls.push(`${baseUrl}/data/${cleanPath}`);
                    imageUrls.push(`${baseUrl}/${face.thumbnail_path}`); // Original path as-is
                  }
                }
                
                // Always add API endpoint as fallback
                imageUrls.push(`${baseUrl}/api/faces/${face.id}/image`);
                
                // Use the first URL as primary, but store all for fallback
                const primaryImageUrl = imageUrls[0] || `${baseUrl}/api/faces/${face.id}/image`;
                
                console.log(`Face ${face.id} image URL candidates:`, imageUrls);
                console.log(`Face ${face.id} primary image URL: ${primaryImageUrl}`);
                
                return {
                  id: face.id,
                  image_url: primaryImageUrl,
                  image_url_candidates: imageUrls, // Store all candidates for fallback
                  quality_score: face.quality_score || 0,
                  detection_date: face.created_at,
                  confidence: face.confidence || 0,
                  original_image: face.original_image
                };
              });
              console.log(`Found ${facesData.length} faces for person ${personId}:`, facesData);
              break;
            }
          } else {
            console.warn(`Failed to fetch faces from ${baseUrl}: ${facesResponse.status} ${facesResponse.statusText}`);
          }
        } catch (error) {
          console.warn(`Failed to fetch faces from ${baseUrl}:`, error);
          continue;
        }
      }
      
      // If no faces found via detected-faces endpoint, try the person endpoint as fallback
      if (!facesData && workingBaseUrl) {
        try {
          console.log(`Trying fallback person endpoint: ${workingBaseUrl}/api/faces/persons/${personId}`);
          const personResponse = await fetch(`${workingBaseUrl}/api/faces/persons/${personId}`);
          if (personResponse.ok) {
            const personData = await personResponse.json();
            console.log(`Person data from ${workingBaseUrl}:`, personData);
            
            if (personData && personData.encodings && personData.encodings.length > 0) {
              // Convert encodings to face objects (fallback)
              facesData = personData.encodings.map((encoding, index) => ({
                id: encoding.id || `encoding_${index}`,
                image_url: `${workingBaseUrl}/api/faces/persons/${personId}/avatar`,
                quality_score: 0.8, // Default quality
                detection_date: encoding.created_at || new Date().toISOString(),
                confidence: 0.9 // Default confidence
              }));
              console.log(`Using ${facesData.length} encodings as faces for person ${personId}`);
            }
          }
        } catch (error) {
          console.warn(`Fallback person endpoint failed:`, error);
        }
      }
      
      if (facesData && facesData.length > 0) {
        this.showPersonFacesDialog(personId, facesData);
      } else {
        console.warn(`No faces found for person ${personId}`);
        this.showNotification(`No faces found for this person. They may need to be detected and assigned first.`, 'info');
      }
    } catch (error) {
      console.error('Failed to view person faces:', error);
      this.showNotification('Failed to load person faces', 'error');
    }
  }

  showPersonFacesDialog(personId, faces) {
    // Create a simple faces viewer dialog with smart fallback
    const facesHtml = faces.map(face => {
      const candidatesJson = JSON.stringify(face.image_url_candidates || [face.image_url]).replace(/"/g, '&quot;');
      return `
        <div class="face-item" data-face-id="${face.id}">
          <img src="${face.image_url}" alt="Face ${face.id}" class="face-thumbnail" 
               data-candidates="${candidatesJson}"
               data-current-index="0"
               onerror="window.tryNextFaceImageUrl(this);"
               onload="console.log('Face image loaded successfully: ${face.image_url}');" />
          <div style="display: none; padding: 20px; text-align: center; color: #999; border: 2px dashed #ccc; border-radius: 8px;">
            Image failed to load<br>
            <small>Tried all ${(face.image_url_candidates || [face.image_url]).length} URLs</small>
          </div>
          <div class="face-info">
            <div>Quality: ${Math.round((face.quality_score || 0) * 100)}%</div>
            <div>Detected: ${new Date(face.detection_date).toLocaleDateString()}</div>
          </div>
        </div>
      `;
    }).join('');
    
    const dialog = document.createElement('div');
    dialog.className = 'faces-dialog';
    dialog.innerHTML = `
      <div class="faces-dialog-backdrop"></div>
      <div class="faces-dialog-content">
        <div class="faces-dialog-header">
          <h3>Person Faces (${faces.length})</h3>
          <button class="close-faces-btn">&times;</button>
        </div>
        <div class="faces-grid">
          ${facesHtml}
        </div>
      </div>
    `;
    
    this.shadowRoot.appendChild(dialog);
    
    // Close dialog listeners
    const closeBtn = dialog.querySelector('.close-faces-btn');
    const backdrop = dialog.querySelector('.faces-dialog-backdrop');
    
    const closeDialog = () => {
      dialog.remove();
    };
    
    closeBtn.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', closeDialog);
    
    // Add fallback URL functionality to the dialog
    dialog.tryNextImageUrl = (imgElement) => {
      const candidates = JSON.parse(imgElement.getAttribute('data-candidates') || '[]');
      let currentIndex = parseInt(imgElement.getAttribute('data-current-index') || '0');
      
      console.error(`Face image failed to load: ${imgElement.src}`);
      
      // Try next URL
      currentIndex++;
      if (currentIndex < candidates.length) {
        const nextUrl = candidates[currentIndex];
        console.log(`Trying next face image URL (${currentIndex + 1}/${candidates.length}): ${nextUrl}`);
        imgElement.setAttribute('data-current-index', currentIndex.toString());
        imgElement.src = nextUrl;
      } else {
        // All URLs failed, show error message
        console.error(`All ${candidates.length} face image URLs failed for face`);
        imgElement.style.display = 'none';
        imgElement.nextElementSibling.style.display = 'block';
      }
    };
  }

  async deletePerson(personId) {
    const personItem = this.shadowRoot.querySelector(`[data-person-id="${personId}"]`);
    if (!personItem) return;
    
    const personName = personItem.querySelector('[data-field="name"]').textContent;
    
    if (!confirm(`Are you sure you want to delete "${personName}"? This will remove all associated face data.`)) {
      return;
    }
    
    try {
      await this._hass.callService('whorang', 'remove_known_visitor', {
        person_id: personId
      });
      
      // Remove from UI immediately
      personItem.remove();
      
      // Update person count
      const countElement = this.shadowRoot.getElementById('modal-body').querySelector('.person-count');
      if (countElement) {
        const currentCount = parseInt(countElement.textContent);
        countElement.textContent = `${currentCount - 1} known persons`;
      }
      
      // Show success message
      this.showNotification('Person deleted successfully', 'success');
      
      // Refresh the main card data
      this.refreshGallery();
    } catch (error) {
      console.error('Failed to delete person:', error);
      this.showNotification('Failed to delete person', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    this.shadowRoot.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  closePersonManagement() {
    const modal = this.shadowRoot.getElementById('person-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  getCardSize() {
    const personCount = this.persons.length;
    if (personCount === 0) return 3;
    
    const rows = Math.ceil(personCount / this.config.columns);
    const baseSize = this.config.show_stats ? 4 : 3; // +1 for stats summary
    return Math.min(rows + baseSize, 12); // Max 12 rows
  }
}

// Register the custom element
customElements.define('whorang-known-persons-card', WhoRangKnownPersonsCard);

// Register with Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'whorang-known-persons-card',
  name: 'WhoRang Known Persons',
  description: 'Display known persons with avatars and statistics',
  preview: true,
  documentationURL: 'https://github.com/Beast12/whorang-addon'
});

console.info(
  '%c WHORANG-KNOWN-PERSONS-CARD %c v1.0.1-FIXED ',
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray'
);

// Force immediate empty state display
console.log('WhoRang Known Persons Card: Loaded with immediate empty state fix');

// Global function for face image fallback
window.tryNextFaceImageUrl = function(imgElement) {
  const candidates = JSON.parse(imgElement.getAttribute('data-candidates') || '[]');
  let currentIndex = parseInt(imgElement.getAttribute('data-current-index') || '0');
  
  console.error(`Face image failed to load: ${imgElement.src}`);
  
  // Try next URL
  currentIndex++;
  if (currentIndex < candidates.length) {
    const nextUrl = candidates[currentIndex];
    console.log(`Trying next face image URL (${currentIndex + 1}/${candidates.length}): ${nextUrl}`);
    imgElement.setAttribute('data-current-index', currentIndex.toString());
    imgElement.src = nextUrl;
  } else {
    // All URLs failed, show error message
    console.error(`All ${candidates.length} face image URLs failed for face`);
    imgElement.style.display = 'none';
    imgElement.nextElementSibling.style.display = 'block';
  }
};
