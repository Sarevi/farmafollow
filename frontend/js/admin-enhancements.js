/**
 * FarmaFollow - Admin Interface Enhancements
 * Mejoras adicionales para el panel de administración
 */

// Quick Search Functionality
function initAdminQuickSearch() {
  const searchInput = document.getElementById('adminQuickSearch');
  if (!searchInput) return;

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      if (query.length < 2) return;

      performQuickSearch(query);
    }, 300);
  });
}

function performQuickSearch(query) {
  const results = [];

  // Search in patients
  if (app.users) {
    const patientResults = app.users.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    ).map(user => ({
      type: 'patient',
      title: user.name,
      subtitle: user.email,
      action: () => app.showUserDetails(user._id)
    }));
    results.push...
(patientResults);
  }

  // Search in medications
  if (app.medications) {
    const medResults = app.medications.filter(med =>
      med.name?.toLowerCase().includes(query) ||
      med.activeIngredient?.toLowerCase().includes(query)
    ).map(med => ({
      type: 'medication',
      title: med.name,
      subtitle: med.activeIngredient,
      action: () => app.editMedication(med._id)
    }));
    results.push(...medResults);
  }

  displayQuickSearchResults(results);
}

function displayQuickSearchResults(results) {
  let resultsContainer = document.getElementById('quickSearchResults');

  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'quickSearchResults';
    resultsContainer.className = 'quick-search-results';
    document.querySelector('.admin-search-box').appendChild(resultsContainer);
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="search-no-results">No se encontraron resultados</div>';
    resultsContainer.style.display = 'block';
    return;
  }

  resultsContainer.innerHTML = results.map(result => `
    <div class="search-result-item" onclick="handleSearchResultClick('${result.type}', this)">
      <div class="search-result-icon">
        ${result.type === 'patient' ? '👤' : result.type === 'medication' ? '💊' : '📄'}
      </div>
      <div class="search-result-content">
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-subtitle">${result.subtitle || ''}</div>
      </div>
    </div>
  `).join('');

  resultsContainer.style.display = 'block';

  // Store results for click handling
  window._searchResults = results;
}

function handleSearchResultClick(type, element) {
  const index = Array.from(element.parentNode.children).indexOf(element);
  const result = window._searchResults[index];
  if (result && result.action) {
    result.action();
    // Hide results
    document.getElementById('quickSearchResults').style.display = 'none';
    document.getElementById('adminQuickSearch').value = '';
  }
}

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
  const searchBox = document.querySelector('.admin-search-box');
  const resultsContainer = document.getElementById('quickSearchResults');

  if (resultsContainer && searchBox && !searchBox.contains(e.target)) {
    resultsContainer.style.display = 'none';
  }
});

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminQuickSearch);
} else {
  initAdminQuickSearch();
}

// Re-initialize after admin dashboard renders
const originalRenderAdmin = app?.renderAdminDashboard;
if (originalRenderAdmin && typeof originalRenderAdmin === 'function') {
  app.renderAdminDashboard = async function(...args) {
    await originalRenderAdmin.apply(this, args);
    setTimeout(initAdminQuickSearch, 100);
  };
}
