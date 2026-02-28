/**
 * Competitor Ad War Room — Dashboard JS
 * Full SPA logic: API calls, rendering, charts, state management
 */

const API = '/api';
const CHART_COLORS = ['#e8ff47','#4fffb0','#7b8cff','#ff4f5e','#ff9547','#ff47c8','#47e4ff','#c847ff'];

// ===== STATE =====
let state = {
  currentView: 'dashboard',
  selectedBrand: null,   // null = all brands
  brands: [],
  stats: {},
  ads: [],
  adsPage: 0,
  insights: {},
  charts: {},
  filters: {
    media_type: '',
    theme: '',
    is_active: '',
    days_back: ''
  }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadBrands();
  await loadDashboard();
  setupNav();
});

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      navigateTo(view);
    });
  });
}

function navigateTo(view) {
  state.currentView = view;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

  // Update views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');

  // Update breadcrumb
  const names = {
    dashboard: 'Dashboard',
    ads: 'Ad Feed',
    insights: 'AI Insights',
    brief: 'Weekly Brief',
    competitors: 'Competitors'
  };
  document.getElementById('breadcrumb').textContent = names[view] || view;

  // Load view data
  if (view === 'ads') loadAdFeed();
  if (view === 'insights') loadInsights();
  if (view === 'brief') loadBrief();
  if (view === 'competitors') renderCompetitors();
}

// ===== API HELPERS =====
async function api(path, opts = {}) {
  const resp = await fetch(API + path, opts);
  if (!resp.ok) throw new Error(`API error ${resp.status}`);
  return resp.json();
}

function buildQueryString(extra = {}) {
  const params = new URLSearchParams();
  if (state.selectedBrand) params.set('brand_key', state.selectedBrand);
  if (state.filters.media_type) params.set('media_type', state.filters.media_type);
  if (state.filters.theme) params.set('theme', state.filters.theme);
  if (state.filters.is_active) params.set('is_active', state.filters.is_active);
  if (state.filters.days_back) params.set('days_back', state.filters.days_back);
  Object.entries(extra).forEach(([k, v]) => params.set(k, v));
  return params.toString() ? '?' + params.toString() : '';
}

// ===== LOAD BRANDS =====
async function loadBrands() {
  try {
    const data = await api('/brands');
    state.brands = data.brands;
    renderBrandSelector();
  } catch (e) {
    toast('Failed to load brands', 'error');
  }
}

function renderBrandSelector() {
  const container = document.getElementById('brandList');
  const allItem = document.createElement('button');
  allItem.className = 'brand-item' + (state.selectedBrand === null ? ' active' : '');
  allItem.innerHTML = `
    <div class="brand-dot"></div>
    <span class="brand-name">All Brands</span>
    <span class="brand-count">${state.brands.reduce((s, b) => s + b.competitor_count, 0)}</span>
  `;
  allItem.onclick = () => selectBrand(null);
  container.innerHTML = '';
  container.appendChild(allItem);

  state.brands.forEach(brand => {
    const item = document.createElement('button');
    item.className = 'brand-item' + (state.selectedBrand === brand.key ? ' active' : '');
    item.dataset.brandKey = brand.key;
    item.innerHTML = `
      <div class="brand-dot"></div>
      <span class="brand-name">${brand.display_name}</span>
      <span class="brand-count">${brand.competitor_count}</span>
    `;
    item.onclick = () => selectBrand(brand.key);
    container.appendChild(item);
  });
}

function selectBrand(brandKey) {
  state.selectedBrand = brandKey;
  renderBrandSelector();

  // Update subtitle
  const brandName = brandKey
    ? state.brands.find(b => b.key === brandKey)?.display_name || brandKey
    : 'All Mosaic Brands';
  const dashSub = document.getElementById('dashSubtitle');
  if (dashSub) dashSub.textContent = `Competitor intelligence for ${brandName}`;

  // Reload current view
  const view = state.currentView;
  if (view === 'dashboard') loadDashboard();
  else if (view === 'ads') loadAdFeed();
  else if (view === 'insights') loadInsights();
  else if (view === 'brief') loadBrief();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const qs = state.selectedBrand ? `?brand_key=${state.selectedBrand}` : '';
    const [statsData, topData] = await Promise.all([
      api('/stats' + qs),
      api('/ads/top-performers?limit=12' + (state.selectedBrand ? `&brand_key=${state.selectedBrand}` : ''))
    ]);

    state.stats = state.selectedBrand
      ? statsData.by_brand[state.selectedBrand] || statsData.overall
      : statsData.overall;

    renderKPIs(state.stats);
    renderCharts(state.stats);
    renderTopPerformers(topData.top_performers || []);
  } catch (e) {
    console.error(e);
    toast('Failed to load dashboard', 'error');
  }
}

function renderKPIs(stats) {
  const grid = document.getElementById('kpiGrid');
  const items = [
    { label: 'Total Ads Tracked', value: stats.total_ads || 0, class: '' },
    { label: 'Active Right Now', value: stats.active_ads || 0, class: 'accent3' },
    { label: 'Top Performers', value: stats.top_performers || 0, class: 'accent' },
    { label: 'Competitors Tracked', value: Object.keys(stats.competitor_breakdown || {}).length, class: '' },
    { label: 'Unique Themes', value: Object.keys(stats.theme_breakdown || {}).length, class: 'accent4' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="kpi-card">
      <div class="kpi-label">${item.label}</div>
      <div class="kpi-value ${item.class}">${item.value.toLocaleString()}</div>
    </div>
  `).join('');
}

function renderCharts(stats) {
  // Destroy old charts
  ['chartMedia', 'chartTheme', 'chartComp'].forEach(id => {
    if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
  });

  // Media type donut
  const media = stats.media_breakdown || {};
  if (Object.keys(media).length) {
    const ctx = document.getElementById('chartMedia').getContext('2d');
    state.charts['chartMedia'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(media),
        datasets: [{
          data: Object.values(media),
          backgroundColor: CHART_COLORS,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#9197a8', font: { family: 'Space Mono', size: 9 }, padding: 8, boxWidth: 8 }
          },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } }
        }
      }
    });

    const topMedia = Object.entries(media).sort((a,b) => b[1]-a[1])[0];
    if (topMedia) {
      document.getElementById('chartMediaBadge').textContent = topMedia[0];
    }
  }

  // Theme horizontal bar
  const themes = stats.theme_breakdown || {};
  if (Object.keys(themes).length) {
    const sorted = Object.entries(themes).sort((a,b) => b[1]-a[1]).slice(0, 6);
    const ctx2 = document.getElementById('chartTheme').getContext('2d');
    state.charts['chartTheme'] = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
        datasets: [{
          data: sorted.map(([,v]) => v),
          backgroundColor: CHART_COLORS.map(c => c + '33'),
          borderColor: CHART_COLORS,
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#585f70', font: { family: 'Space Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
          y: { ticks: { color: '#9197a8', font: { family: 'DM Sans', size: 11 } }, grid: { display: false } }
        }
      }
    });
    const topTheme = sorted[0];
    if (topTheme) document.getElementById('chartThemeBadge').textContent = topTheme[0].replace(/_/g,' ');
  }

  // Competitor bar chart
  const comps = stats.competitor_breakdown || {};
  if (Object.keys(comps).length) {
    const sorted = Object.entries(comps).sort((a,b) => b[1]-a[1]).slice(0, 10);
    const ctx3 = document.getElementById('chartComp').getContext('2d');
    state.charts['chartComp'] = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k),
        datasets: [{
          label: 'Ads',
          data: sorted.map(([,v]) => v),
          backgroundColor: CHART_COLORS[0] + '33',
          borderColor: CHART_COLORS[0],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9197a8', font: { family: 'DM Sans', size: 10 }, maxRotation: 35 }, grid: { display: false } },
          y: { ticks: { color: '#585f70', font: { family: 'Space Mono', size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } }
        }
      }
    });
    document.getElementById('chartCompBadge').textContent = `${sorted.length} tracked`;
  }
}

function renderTopPerformers(ads) {
  const grid = document.getElementById('topPerformersGrid');
  if (!ads.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">◈</div><p>No top performer ads yet.</p></div>';
    return;
  }
  grid.innerHTML = ads.map(ad => renderAdCard(ad)).join('');
}

// ===== AD FEED =====
let adFeedOffset = 0;
async function loadAdFeed(reset = true) {
  if (reset) { adFeedOffset = 0; document.getElementById('adFeedGrid').innerHTML = ''; }
  try {
    const qs = buildQueryString({ limit: 30, offset: adFeedOffset });
    const data = await api('/ads' + qs);
    const grid = document.getElementById('adFeedGrid');
    if (!data.ads.length && reset) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-icon">◉</div><p>No ads found. Adjust filters or refresh data.</p></div>';
      return;
    }
    grid.innerHTML += data.ads.map(ad => renderAdCard(ad)).join('');
    adFeedOffset += data.ads.length;

    const brandName = state.selectedBrand
      ? state.brands.find(b => b.key === state.selectedBrand)?.display_name
      : 'All Brands';
    document.getElementById('adFeedSubtitle').textContent = `${data.total} ads tracked — ${brandName}`;
  } catch (e) {
    toast('Failed to load ads', 'error');
  }
}

function loadMoreAds() { loadAdFeed(false); }

function applyFilters() {
  state.filters.media_type = document.getElementById('filterMediaType').value;
  state.filters.theme = document.getElementById('filterTheme').value;
  state.filters.is_active = document.getElementById('filterActive').value;
  state.filters.days_back = document.getElementById('filterDays').value;

  if (state.currentView === 'ads') loadAdFeed(true);
  else if (state.currentView === 'dashboard') loadDashboard();
}

function renderAdCard(ad) {
  const mediaClass = ad.media_type === 'VIDEO' ? 'badge-video' : ad.media_type === 'CAROUSEL' ? 'badge-carousel' : 'badge-image';
  const startDate = ad.ad_delivery_start_time
    ? new Date(ad.ad_delivery_start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

  const spendText = ad.spend_lower
    ? `₹${(ad.spend_lower/1000).toFixed(0)}K–${(ad.spend_upper/1000).toFixed(0)}K`
    : '—';

  const platforms = Array.isArray(ad.publisher_platforms) ? ad.publisher_platforms.slice(0,2).join(', ') : 'meta';

  const themeLabel = (ad.theme || 'unknown').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase());

  const cardClasses = [
    'ad-card',
    ad.is_top_performer ? 'top-performer' : '',
    ad.is_active ? 'active-ad' : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="${cardClasses}">
      <div class="ad-card-header">
        <div>
          <div class="ad-brand">${escHtml(ad.competitor_name || ad.page_name || '—')}</div>
          <div class="ad-competitor">${escHtml(brandLabel(ad.brand_key))}</div>
        </div>
        <div class="ad-badges">
          <span class="badge ${mediaClass}">${ad.media_type || 'IMG'}</span>
          ${ad.is_active ? '<span class="badge badge-active">LIVE</span>' : ''}
          ${ad.is_top_performer ? '<span class="badge badge-top">⚡ TOP</span>' : ''}
        </div>
      </div>
      ${ad.theme ? `<div class="theme-tag">${themeLabel}</div>` : ''}
      ${ad.ad_title ? `<div class="ad-title">${escHtml(ad.ad_title)}</div>` : ''}
      ${ad.ad_body ? `<div class="ad-body">${escHtml(ad.ad_body)}</div>` : '<div class="ad-body" style="color:var(--text3);font-style:italic">No ad copy available</div>'}
      <div class="ad-meta">
        <div class="ad-meta-item">▸ <span>${startDate}</span></div>
        <div class="ad-meta-item">⟳ <span>${ad.run_days ?? 0}d</span></div>
        <div class="ad-meta-item">$ <span>${spendText}</span></div>
        <div class="ad-meta-item">📡 <span>${platforms}</span></div>
      </div>
    </div>
  `;
}

function brandLabel(key) {
  const labels = { bebodywise: 'Be Bodywise', manmatters: 'Man Matters', littlejoys: 'Little Joys' };
  return labels[key] || key || '—';
}

// ===== INSIGHTS =====
async function loadInsights() {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '<div style="color:var(--text3);padding:20px;font-family:var(--font-mono);font-size:12px">Analyzing competitor data...</div>';

  try {
    const qs = state.selectedBrand ? `?brand_key=${state.selectedBrand}` : '';
    const data = await api('/insights' + qs);
    renderInsights(data);
  } catch (e) {
    toast('Failed to load insights', 'error');
  }
}

function renderInsights(data) {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '';

  const brands = state.selectedBrand
    ? { [state.selectedBrand]: data[state.selectedBrand] }
    : data;

  Object.entries(brands).forEach(([bk, bdata]) => {
    if (!bdata) return;
    const analysis = bdata.analysis || {};
    const insights = analysis.insights || [];

    const section = document.createElement('div');
    section.className = 'insight-brand-section';
    section.innerHTML = `
      <div class="insight-brand-header">
        <div class="insight-brand-name">${bdata.brand || brandLabel(bk)}</div>
        <div class="insight-summary">${analysis.summary_one_liner || `${bdata.ad_count} ads analyzed`}</div>
      </div>
      ${analysis.underused_format ? `
        <div class="gap-highlight">
          <strong>💡 CREATIVE GAP DETECTED</strong>
          <strong>${analysis.underused_format}</strong> ads are underused by competitors — this is an immediate opportunity to claim creative whitespace.
        </div>
      ` : ''}
      <div class="insights-list">
        ${insights.length ? insights.map(ins => renderInsightCard(ins)).join('') : '<p style="color:var(--text3);font-size:12px;padding:12px 0">No AI insights available. Set GEMINI_API_KEY in .env for AI-powered analysis.</p>'}
      </div>
    `;
    grid.appendChild(section);
  });
}

function renderInsightCard(ins) {
  const urgencyClass = `urgency-${ins.urgency || 'medium'}`;
  const typeClass = `type-${ins.type || 'trend'}`;
  const typeLabel = (ins.type || 'trend').replace(/_/g,' ').toUpperCase();

  return `
    <div class="insight-card ${urgencyClass}">
      <div class="insight-type ${typeClass}">${typeLabel}</div>
      <div class="insight-title">${escHtml(ins.title || '')}</div>
      <div class="insight-detail">${escHtml(ins.detail || '')}</div>
      ${ins.recommended_action ? `<div class="insight-action">${escHtml(ins.recommended_action)}</div>` : ''}
    </div>
  `;
}

// ===== WEEKLY BRIEF =====
async function loadBrief() {
  if (!state.selectedBrand) {
    document.getElementById('briefContainer').innerHTML = `
      <div class="brief-placeholder">
        <div class="placeholder-icon">◎</div>
        <p>Select a brand from the sidebar to view or generate their weekly brief.</p>
      </div>
    `;
    return;
  }
  try {
    const data = await api(`/brief/${state.selectedBrand}`);
    if (data.brief_text && data.brief_text !== 'No brief generated yet. Run a refresh first.') {
      renderBrief(data);
    } else {
      document.getElementById('briefContainer').innerHTML = `
        <div class="brief-placeholder">
          <div class="placeholder-icon">◎</div>
          <p>No brief generated yet. Click "Generate This Week's Brief" to create one.</p>
        </div>
      `;
    }
    if (data.generated_at) {
      document.getElementById('briefTimestamp').textContent =
        'Last generated: ' + new Date(data.generated_at).toLocaleString('en-IN');
    }
  } catch (e) {
    toast('Failed to load brief', 'error');
  }
}

async function generateBrief() {
  if (!state.selectedBrand) {
    toast('Please select a brand first', 'error');
    return;
  }
  showLoading('Generating weekly intelligence brief...');
  try {
    const data = await api(`/brief/${state.selectedBrand}/generate`, { method: 'POST' });
    renderBrief(data);
    document.getElementById('briefTimestamp').textContent =
      'Generated: ' + new Date(data.generated_at).toLocaleString('en-IN');
    toast('Weekly brief generated!', 'success');
  } catch (e) {
    toast('Failed to generate brief', 'error');
  } finally {
    hideLoading();
  }
}

function renderBrief(data) {
  const container = document.getElementById('briefContainer');
  const html = typeof marked !== 'undefined'
    ? marked.parse(data.brief_text || '')
    : data.brief_text?.replace(/\n/g, '<br>') || '';
  container.innerHTML = html;
}

// ===== COMPETITORS VIEW =====
function renderCompetitors() {
  const grid = document.getElementById('competitorsGrid');
  grid.innerHTML = '';

  const brandsToShow = state.selectedBrand
    ? [[state.selectedBrand, state.brands.find(b => b.key === state.selectedBrand)]]
    : state.brands.map(b => [b.key, b]);

  brandsToShow.forEach(([bk, brand]) => {
    if (!brand) return;
    const section = document.createElement('div');
    section.className = 'comp-brand-section';
    section.innerHTML = `
      <div class="comp-brand-header">
        <div class="comp-brand-info">
          <div class="comp-brand-name">${brand.display_name}</div>
          <div class="comp-brand-meta">${brand.category} · ${brand.target_audience} · ${brand.competitor_count} competitors tracked</div>
        </div>
      </div>
      <div class="comp-list">
        ${(brand.competitors || []).map(comp => `
          <div class="comp-card">
            <div class="comp-name">${escHtml(comp.name)}</div>
            <div class="comp-category">${escHtml(comp.category || '')}</div>
            <div class="comp-justification">${escHtml(comp.justification || '')}</div>
          </div>
        `).join('')}
      </div>
    `;
    grid.appendChild(section);
  });
}

// ===== FETCH / REFRESH =====
async function fetchAds() {
  showLoading('Fetching competitor ads...');
  const btn = document.getElementById('btnFetch');
  btn.disabled = true;

  try {
    const qs = state.selectedBrand ? `?brand_key=${state.selectedBrand}` : '';
    const data = await api('/fetch' + qs, { method: 'POST' });
    const msg = data.source === 'sample_data'
      ? `Loaded ${data.ads_loaded} sample ads. Add META_ACCESS_TOKEN for live data.`
      : `Fetched ${data.ads_loaded} ads from Meta Ad Library`;
    toast(msg, 'info');
    document.getElementById('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN');
    await loadDashboard();
  } catch (e) {
    toast('Fetch failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    hideLoading();
  }
}

// ===== LOADING =====
function showLoading(text = 'Loading...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

// ===== TOAST =====
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '◆';
  el.innerHTML = `<span style="color:var(--accent${type==='success'?'3':type==='error'?'2':''})">${icon}</span> ${escHtml(message)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ===== UTILS =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}