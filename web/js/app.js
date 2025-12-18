/**
 * Neighborhood Reporter - Frontend Application
 */

const API_BASE = '/api/v1';

// Category display info
const CATEGORIES = {
  municipal: { icon: '🏛️', label: 'Government & Municipal' },
  civic: { icon: '🏘️', label: 'Civic & Community' },
  media: { icon: '📰', label: 'News Media' },
  'local-news': { icon: '📰', label: 'Local News' },
  hyperlocal: { icon: '📍', label: 'Hyperlocal' },
  educational: { icon: '🎓', label: 'Education' },
  religious: { icon: '⛪', label: 'Religious' },
  corporate: { icon: '🏢', label: 'Business & Corporate' },
  social: { icon: '💬', label: 'Social Media' },
  'public-safety': { icon: '🚨', label: 'Public Safety' },
  events: { icon: '📅', label: 'Events' },
  transit: { icon: '🚇', label: 'Transit' },
  other: { icon: '📌', label: 'Other' }
};

// Media type badges
const MEDIA_TYPES = {
  newspaper: '📰 Newspaper',
  television: '📺 TV',
  radio: '📻 Radio',
  podcast: '🎙️ Podcast',
  newsletter: '✉️ Newsletter',
  online: '🌐 Online',
  'social-media': '💬 Social',
  blog: '📝 Blog'
};

/**
 * Initialize the application
 */
async function init() {
  await loadNeighborhoods();
  setupEventListeners();
}

/**
 * Load neighborhoods into the selector
 */
async function loadNeighborhoods() {
  const select = document.getElementById('neighborhood-select');
  
  try {
    const response = await fetch(`${API_BASE}/neighborhoods/index.json`);
    
    if (!response.ok) {
      throw new Error('Failed to load neighborhoods');
    }
    
    const data = await response.json();
    
    select.innerHTML = '<option value="">Select a neighborhood...</option>';
    
    for (const neighborhood of data.neighborhoods) {
      if (neighborhood.active !== false) {
        const option = document.createElement('option');
        option.value = neighborhood.id;
        option.textContent = `${neighborhood.name}${neighborhood.region ? ` (${neighborhood.region})` : ''}`;
        select.appendChild(option);
      }
    }
  } catch (error) {
    console.error('Error loading neighborhoods:', error);
    select.innerHTML = '<option value="">Error loading neighborhoods</option>';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const loadButton = document.getElementById('load-sources');
  const select = document.getElementById('neighborhood-select');
  
  loadButton.addEventListener('click', () => {
    const neighborhoodId = select.value;
    if (neighborhoodId) {
      loadNeighborhoodSources(neighborhoodId);
    }
  });
  
  select.addEventListener('change', () => {
    const neighborhoodId = select.value;
    if (neighborhoodId) {
      loadNeighborhoodSources(neighborhoodId);
    }
  });
}

/**
 * Load sources for a neighborhood
 */
async function loadNeighborhoodSources(neighborhoodId) {
  const section = document.getElementById('sources-section');
  const grid = document.getElementById('sources-grid');
  const nameEl = document.getElementById('neighborhood-name');
  const summaryEl = document.getElementById('sources-summary');
  
  // Show section and loading state
  section.style.display = 'block';
  grid.innerHTML = '<div class="loading">Loading sources</div>';
  
  try {
    const response = await fetch(`${API_BASE}/neighborhoods/${neighborhoodId}.json`);
    
    if (!response.ok) {
      throw new Error('Failed to load neighborhood data');
    }
    
    const data = await response.json();
    
    // Update header
    nameEl.textContent = `${data.neighborhood.name} News Sources`;
    summaryEl.textContent = `${data.summary.total_sources} sources from ${Object.keys(data.summary.sources_by_category).length} categories`;
    
    // Render sources by category
    grid.innerHTML = '';
    
    const categories = data.sources.by_category;
    
    for (const [category, sources] of Object.entries(categories)) {
      if (sources.length === 0) continue;
      
      const categoryEl = createCategorySection(category, sources);
      grid.appendChild(categoryEl);
    }
    
    // Add leaders section if available
    if (data.leaders && data.leaders.all && data.leaders.all.length > 0) {
      const leadersEl = createLeadersSection(data.leaders.all);
      grid.appendChild(leadersEl);
    }
    
    // Scroll to section
    section.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Error loading sources:', error);
    grid.innerHTML = '<div class="error">Error loading sources. Please try again.</div>';
  }
}

/**
 * Create a category section element
 */
function createCategorySection(category, sources) {
  const categoryInfo = CATEGORIES[category] || CATEGORIES.other;
  
  const section = document.createElement('div');
  section.className = 'source-category';
  
  section.innerHTML = `
    <h3>
      <span class="source-category-icon">${categoryInfo.icon}</span>
      ${categoryInfo.label}
      <span style="font-weight: normal; font-size: 0.9rem; color: #718096;">(${sources.length})</span>
    </h3>
    <div class="source-list">
      ${sources.map(source => createSourceItem(source)).join('')}
    </div>
  `;
  
  return section;
}

/**
 * Create a source item element
 */
function createSourceItem(source) {
  const mediaType = MEDIA_TYPES[source.media_type] || source.media_type;
  const typeLabel = source.type === 'rss' ? '📡 RSS' : 
                    source.type === 'api' ? '🔌 API' :
                    source.type === 'social' ? '💬 Social' :
                    source.type === 'newsletter' ? '✉️ Email' :
                    source.type;
  
  return `
    <div class="source-item">
      <h4>
        ${source.url ? 
          `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)}</a>` : 
          escapeHtml(source.name)}
      </h4>
      <div class="source-meta">
        <span class="source-type">${mediaType}</span>
        <span class="source-type">${typeLabel}</span>
        ${source.frequency ? `<span>${source.frequency}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Create leaders section
 */
function createLeadersSection(leaders) {
  const section = document.createElement('div');
  section.className = 'source-category leaders-section';
  
  section.innerHTML = `
    <h3>
      <span class="source-category-icon">👤</span>
      Community Leaders
      <span style="font-weight: normal; font-size: 0.9rem; color: #718096;">(${leaders.length})</span>
    </h3>
    <div class="source-list">
      ${leaders.map(leader => createLeaderItem(leader)).join('')}
    </div>
  `;
  
  return section;
}

/**
 * Create a leader item element
 */
function createLeaderItem(leader) {
  const initials = leader.name.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  
  return `
    <div class="leader-item">
      <div class="leader-avatar">${initials}</div>
      <div class="leader-info">
        <h4>${escapeHtml(leader.name)}</h4>
        <p>${escapeHtml(leader.role)}</p>
        <p>${escapeHtml(leader.organization)}</p>
        ${leader.contact?.website ? 
          `<a href="${escapeHtml(leader.contact.website)}" target="_blank" rel="noopener">Website →</a>` : 
          ''}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
