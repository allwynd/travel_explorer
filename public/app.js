/* ═══════════════════════════════════════════════════
   TRAVEL EXPLORER — Frontend Application
════════════════════════════════════════════════════ */

const API = '/api';
let allTrips = [];
let allExpenses = [];
let currentTripId = null;
let currentView = 'dashboard';

const CATEGORY_META = {
  accommodation: { icon: '🏨', label: 'Accommodation', color: '#3b82f6' },
  flights:       { icon: '✈️', label: 'Flights',       color: '#0ea5e9' },
  food:          { icon: '🍜', label: 'Food & Drink',  color: '#f59e0b' },
  transport:     { icon: '🚗', label: 'Transport',     color: '#22c55e' },
  shopping:      { icon: '🛍', label: 'Shopping',      color: '#a855f7' },
  activities:    { icon: '🎯', label: 'Activities',    color: '#f97316' },
  health:        { icon: '💊', label: 'Health',        color: '#ef4444' },
  communication: { icon: '📱', label: 'Communication', color: '#06b6d4' },
  visa:          { icon: '🛂', label: 'Visa & Fees',   color: '#64748b' },
  insurance:     { icon: '🛡', label: 'Insurance',     color: '#16a34a' },
  other:         { icon: '📦', label: 'Other',         color: '#9ca3af' },
};

const CHART_COLORS = ['#c8522a','#d4a843','#2a7a6e','#4a8fb5','#7a5a9e','#e8705a','#5a9e6e','#f59e0b','#06b6d4','#a855f7'];

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadTrips();
  checkHealth();
});

async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    const d = await r.json();
    const dot = document.querySelector('.db-dot');
    const label = document.querySelector('.db-status');
    if (d.status === 'ok') {
      label.innerHTML = `<span class="db-dot"></span> ${d.dbType}`;
    }
  } catch {}
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
  currentView = view;

  if (view === 'expenses') renderExpenses();
  if (view === 'analytics') populateAnalyticsTripSelect();
  if (view === 'trips') renderTripsTable();

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Trip Loading ──────────────────────────────────────────────────────────────
async function loadTrips() {
  try {
    const r = await fetch(`${API}/trips`);
    const d = await r.json();
    allTrips = d.data || [];
    renderDashboard();
    populateTripSelects();
  } catch (err) {
    showToast('Failed to load trips', 'error');
  }
}

function populateTripSelects() {
  const opts = allTrips.map(t =>
    `<option value="${t._id}">${t.name} — ${t.destination}</option>`
  ).join('');
  const placeholder = '<option value="">— Select a trip —</option>';
  document.getElementById('globalTripSelect').innerHTML = placeholder + opts;
  if (currentTripId) document.getElementById('globalTripSelect').value = currentTripId;

  populateAnalyticsTripSelect();
}

function onTripSelect(id) {
  currentTripId = id;
  if (currentView === 'expenses') renderExpenses();
  if (currentView === 'analytics') loadAnalytics(id);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  // Stat cards
  document.getElementById('stat-trips').textContent = allTrips.length;

  let totalBudget = 0, totalSpent = 0;

  // Load summary for each trip
  const summaries = await Promise.allSettled(
    allTrips.map(t => fetch(`${API}/expenses/summary/${t._id}`).then(r => r.json()))
  );

  summaries.forEach((res, i) => {
    if (res.status === 'fulfilled' && res.value.success) {
      const s = res.value.data;
      totalBudget += s.budget || 0;
      totalSpent  += s.totalSpent || 0;
      allTrips[i]._spent = s.totalSpent || 0;
      allTrips[i]._summary = s;
    }
  });

  const remaining = totalBudget - totalSpent;
  const curr = allTrips[0]?.currency || 'USD';
  document.getElementById('stat-budget').textContent    = fmt(totalBudget, curr);
  document.getElementById('stat-spent').textContent     = fmt(totalSpent, curr);
  document.getElementById('stat-remaining').textContent = fmt(remaining, curr);

  // Trip grid
  const grid = document.getElementById('tripGrid');
  if (allTrips.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌍</div>
        <p>No trips yet. Start your first adventure!</p>
        <button class="btn btn-primary" onclick="openModal('tripModal')">+ Add a Trip</button>
      </div>`;
    return;
  }

  grid.innerHTML = allTrips.map(trip => {
    const spent   = trip._spent || 0;
    const budget  = trip.budget || 0;
    const pct     = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over    = spent > budget && budget > 0;
    const startD  = trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
    const endD    = trip.endDate   ? new Date(trip.endDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
    return `
    <div class="trip-card" onclick="selectTripFromCard('${trip._id}')">
      <div class="trip-card-name">${esc(trip.name)}</div>
      <div class="trip-card-dest">📍 ${esc(trip.destination)}</div>
      ${startD ? `<div class="trip-card-dates">${startD} → ${endD || '…'}</div>` : ''}
      <div class="trip-card-budget">
        <span class="trip-card-budget-label">Spent / Budget</span>
        <span class="trip-card-budget-val">${fmt(spent, trip.currency)} <span style="opacity:.4;font-size:13px">/ ${fmt(budget, trip.currency)}</span></span>
      </div>
      <div class="mini-bar-track">
        <div class="mini-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="trip-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-ghost" onclick="editTrip('${trip._id}')">✏️ Edit</button>
        <button class="btn btn-sm btn-ghost" onclick="confirmDeleteTrip('${trip._id}')">🗑 Delete</button>
        <button class="btn btn-sm btn-teal" onclick="selectTripFromCard('${trip._id}')">View →</button>
      </div>
    </div>`;
  }).join('');
}

function selectTripFromCard(id) {
  currentTripId = id;
  document.getElementById('globalTripSelect').value = id;
  switchView('expenses');
}

// ── Trips Table ───────────────────────────────────────────────────────────────
async function renderTripsTable() {
  const tbody = document.getElementById('tripsTableBody');
  if (allTrips.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-row">No trips found. Create one!</td></tr>`;
    return;
  }

  // Load summaries if needed
  const rows = await Promise.all(allTrips.map(async trip => {
    let spent = trip._spent;
    if (spent === undefined) {
      try {
        const r = await fetch(`${API}/expenses/summary/${trip._id}`);
        const d = await r.json();
        spent = d.success ? d.data.totalSpent : 0;
        trip._spent = spent;
      } catch { spent = 0; }
    }
    const budget = trip.budget || 0;
    const over = spent > budget && budget > 0;
    const nearly = !over && budget > 0 && spent / budget >= 0.8;
    const badge = over ? '<span class="badge badge-over">Over budget</span>'
                : nearly ? '<span class="badge badge-warn">Nearly there</span>'
                : '<span class="badge badge-ok">On track</span>';
    const startD = trip.startDate ? new Date(trip.startDate).toLocaleDateString() : '—';
    const endD   = trip.endDate   ? new Date(trip.endDate).toLocaleDateString()   : '—';
    return `
      <tr>
        <td><strong>${esc(trip.name)}</strong></td>
        <td>📍 ${esc(trip.destination)}</td>
        <td><span class="mono" style="font-size:12px">${startD} → ${endD}</span></td>
        <td>${trip.currency || 'USD'}</td>
        <td class="mono">${fmt(budget, trip.currency)}</td>
        <td class="mono" style="color:var(--rust)">${fmt(spent, trip.currency)}</td>
        <td>${badge}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-ghost" onclick="editTrip('${trip._id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="confirmDeleteTrip('${trip._id}')">Delete</button>
          </div>
        </td>
      </tr>`;
  }));
  tbody.innerHTML = rows.join('');
}

// ── Expenses ──────────────────────────────────────────────────────────────────
async function renderExpenses() {
  if (!currentTripId) {
    document.getElementById('expenseTripInfo').textContent = 'Select a trip to view expenses';
    document.getElementById('budgetBarWrap').style.display = 'none';
    document.getElementById('expensesList').innerHTML = `
      <div class="empty-state"><div class="empty-icon">💳</div><p>Select a trip first.</p></div>`;
    return;
  }

  try {
    const [expR, sumR] = await Promise.all([
      fetch(`${API}/expenses?tripId=${currentTripId}`).then(r => r.json()),
      fetch(`${API}/expenses/summary/${currentTripId}`).then(r => r.json()),
    ]);
    allExpenses = expR.data || [];
    const sum = sumR.data;
    const trip = sum?.trip;

    // Header
    document.getElementById('expenseTripInfo').textContent =
      `${trip?.name || 'Trip'} — ${trip?.destination || ''}`;
    document.getElementById('budgetBarWrap').style.display = 'block';

    const pct  = sum.percentUsed || 0;
    const fill = document.getElementById('budgetBarFill');
    fill.style.width = Math.min(pct, 100) + '%';
    fill.className = 'budget-bar-fill' + (pct >= 100 ? ' danger' : '');
    document.getElementById('budgetPct').textContent = pct + '%';
    document.getElementById('budgetRemLabel').innerHTML =
      `Remaining: <strong>${fmt(sum.remaining, sum.currency)}</strong>`;

    filterExpenses();
  } catch (err) {
    showToast('Failed to load expenses', 'error');
  }
}

function filterExpenses() {
  const catF  = document.getElementById('filterCategory').value;
  const payF  = document.getElementById('filterPayment').value;
  const srchF = document.getElementById('filterSearch').value.toLowerCase();

  let list = [...allExpenses];
  if (catF)  list = list.filter(e => e.category === catF);
  if (payF)  list = list.filter(e => e.paymentMethod === payF);
  if (srchF) list = list.filter(e =>
    (e.description || '').toLowerCase().includes(srchF) ||
    (e.notes || '').toLowerCase().includes(srchF)
  );

  const container = document.getElementById('expensesList');
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state"><div class="empty-icon">🔍</div>
      <p>No expenses found. ${allExpenses.length === 0 ? 'Add your first expense!' : 'Try adjusting filters.'}</p>
      </div>`;
    return;
  }

  const trip = allTrips.find(t => t._id === currentTripId);
  const currency = trip?.currency || 'USD';

  container.innerHTML = list.map(e => {
    const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
    const dateStr = e.date ? new Date(e.date).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';
    return `
    <div class="expense-item">
      <div class="expense-cat-icon cat-${e.category}">${meta.icon}</div>
      <div class="expense-info">
        <div class="expense-desc">${esc(e.description || meta.label)}</div>
        <div class="expense-meta">
          <span>${meta.label}</span>
          ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
          <span>${paymentIcon(e.paymentMethod)} ${capitalize(e.paymentMethod)}</span>
          ${e.notes ? `<span>💬 ${esc(e.notes)}</span>` : ''}
        </div>
      </div>
      <div class="expense-amount">${fmt(e.amount, currency)}</div>
      <div class="expense-actions">
        <button class="btn btn-sm btn-ghost" onclick="editExpense('${e._id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="confirmDeleteExpense('${e._id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function populateAnalyticsTripSelect() {
  const sel = document.getElementById('analyticsTripSelect');
  const opts = allTrips.map(t =>
    `<option value="${t._id}" ${t._id === currentTripId ? 'selected' : ''}>${t.name} — ${t.destination}</option>`
  ).join('');
  sel.innerHTML = '<option value="">— Select a trip —</option>' + opts;
  if (currentTripId) {
    sel.value = currentTripId;
    loadAnalytics(currentTripId);
  }
}

async function loadAnalytics(tripId) {
  if (!tripId) return;
  currentTripId = tripId;
  try {
    const r = await fetch(`${API}/expenses/summary/${tripId}`);
    const d = await r.json();
    if (!d.success) return;
    renderAnalytics(d.data);
  } catch {
    showToast('Failed to load analytics', 'error');
  }
}

function renderAnalytics(data) {
  const { trip, totalSpent, budget, remaining, percentUsed, expenseCount,
          categoryBreakdown, dailyBreakdown, highestExpense, currency } = data;

  const cats = Object.entries(categoryBreakdown).sort((a,b) => b[1].total - a[1].total);
  const colorMap = {};
  cats.forEach(([cat], i) => colorMap[cat] = CHART_COLORS[i % CHART_COLORS.length]);

  // Donut chart SVG
  const donut = buildDonut(cats, colorMap, currency);

  // Bar chart
  const bars = cats.map(([cat, info], i) => {
    const pct = info.percentage;
    const color = colorMap[cat];
    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
    return `
      <div class="bar-row">
        <div class="bar-label">${meta.icon} ${meta.label}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}">
            ${pct > 8 ? pct + '%' : ''}
          </div>
        </div>
        <div class="bar-val">${fmt(info.total, currency)}</div>
      </div>`;
  }).join('');

  // Daily breakdown
  const days = Object.entries(dailyBreakdown).sort((a,b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(...days.map(d => d[1]), 1);
  const dailyBars = days.map(([day, amt]) => {
    const pct = (amt / maxDay) * 100;
    const dateLabel = new Date(day).toLocaleDateString('en-US', { month:'short', day:'numeric' });
    return `
      <div class="bar-row">
        <div class="bar-label" style="width:80px;font-size:11px">${dateLabel}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:var(--teal)">
            ${pct > 10 ? fmt(amt, currency) : ''}
          </div>
        </div>
        <div class="bar-val">${fmt(amt, currency)}</div>
      </div>`;
  }).join('');

  document.getElementById('analyticsContent').innerHTML = `
    <div class="analytics-grid">

      <!-- Summary -->
      <div class="analytics-card full-width">
        <div class="analytics-card-title">Trip Summary — ${esc(trip.name)}</div>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-val">${fmt(totalSpent, currency)}</div>
            <div class="summary-lbl">Total Spent</div>
          </div>
          <div class="summary-item">
            <div class="summary-val">${fmt(budget, currency)}</div>
            <div class="summary-lbl">Budget</div>
          </div>
          <div class="summary-item">
            <div class="summary-val" style="color:${remaining < 0 ? '#e03a2e' : 'var(--teal)'}">
              ${fmt(Math.abs(remaining), currency)} ${remaining < 0 ? 'over' : 'left'}
            </div>
            <div class="summary-lbl">Remaining</div>
          </div>
        </div>
        <div style="margin-top:16px">
          <div class="budget-bar-label">
            <span>Budget Used: <strong>${percentUsed}%</strong></span>
            <span>${expenseCount} expense${expenseCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${percentUsed >= 100 ? 'danger' : ''}"
                 style="width:${Math.min(percentUsed, 100)}%"></div>
          </div>
        </div>
      </div>

      <!-- Donut Chart -->
      <div class="analytics-card">
        <div class="analytics-card-title">Spending by Category</div>
        ${cats.length > 0 ? `
        <div class="donut-wrap">
          ${donut}
          <div class="donut-legend">
            ${cats.map(([cat, info]) => `
              <div class="legend-item">
                <div class="legend-dot" style="background:${colorMap[cat]}"></div>
                <div class="legend-name">${CATEGORY_META[cat]?.label || cat}</div>
                <div class="legend-pct">${info.percentage}%</div>
                <div class="legend-amount">${fmt(info.total, currency)}</div>
              </div>`).join('')}
          </div>
        </div>` : '<p style="opacity:.5">No expenses yet.</p>'}
      </div>

      <!-- Bar Chart -->
      <div class="analytics-card">
        <div class="analytics-card-title">Category Breakdown</div>
        ${cats.length > 0
          ? `<div class="bar-chart">${bars}</div>`
          : '<p style="opacity:.5">No expenses yet.</p>'}
      </div>

      <!-- Daily Spend -->
      <div class="analytics-card full-width">
        <div class="analytics-card-title">Daily Spending</div>
        ${days.length > 0
          ? `<div class="bar-chart">${dailyBars}</div>`
          : '<p style="opacity:.5">No daily data yet.</p>'}
      </div>

      ${highestExpense ? `
      <!-- Highest Expense -->
      <div class="analytics-card">
        <div class="analytics-card-title">Highest Single Expense</div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:8px">
          <div style="font-size:40px">${CATEGORY_META[highestExpense.category]?.icon || '💸'}</div>
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700">
              ${fmt(highestExpense.amount, currency)}
            </div>
            <div style="opacity:.6;font-size:13px;margin-top:4px">
              ${esc(highestExpense.description || highestExpense.category)}
            </div>
          </div>
        </div>
      </div>` : ''}

    </div>`;
}

function buildDonut(cats, colorMap, currency) {
  if (cats.length === 0) return '';
  const size = 180;
  const cx = size / 2, cy = size / 2;
  const R = 70, r = 42;
  let total = cats.reduce((s, [,v]) => s + v.total, 0);
  let startAngle = -Math.PI / 2;
  let paths = '';

  cats.forEach(([cat, info]) => {
    const sweep = (info.total / total) * 2 * Math.PI;
    const endAngle = startAngle + sweep;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const xi1 = cx + r * Math.cos(startAngle);
    const yi1 = cy + r * Math.sin(startAngle);
    const xi2 = cx + r * Math.cos(endAngle);
    const yi2 = cy + r * Math.sin(endAngle);
    const large = sweep > Math.PI ? 1 : 0;
    paths += `<path d="M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}
      L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z"
      fill="${colorMap[cat]}" opacity="0.9" />`;
    startAngle = endAngle;
  });

  return `
    <svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${paths}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle"
        font-family="'Playfair Display',serif" font-size="15" font-weight="700" fill="#1a1410">
        ${fmt(total, currency)}
      </text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle"
        font-family="'DM Sans',sans-serif" font-size="10" fill="#4a3f35" opacity=".6">
        TOTAL SPENT
      </text>
    </svg>`;
}

// ── Trip CRUD ─────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function openAddExpenseModal() {
  if (!currentTripId) { showToast('Please select a trip first', 'error'); return; }
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseCategory').value = 'food';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseDescription').value = '';
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expensePayment').value = 'cash';
  document.getElementById('expenseNotes').value = '';
  openModal('expenseModal');
}

async function saveTrip() {
  const id   = document.getElementById('tripId').value;
  const name = document.getElementById('tripName').value.trim();
  const dest = document.getElementById('tripDestination').value.trim();
  if (!name || !dest) { showToast('Name and destination are required', 'error'); return; }

  const payload = {
    name,
    destination: dest,
    startDate:  document.getElementById('tripStartDate').value,
    endDate:    document.getElementById('tripEndDate').value,
    currency:   document.getElementById('tripCurrency').value,
    budget:     parseFloat(document.getElementById('tripBudget').value) || 0,
    notes:      document.getElementById('tripNotes').value,
  };

  try {
    const url    = id ? `${API}/trips/${id}` : `${API}/trips`;
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    closeModal('tripModal');
    showToast(id ? 'Trip updated!' : 'Trip created!', 'success');
    await loadTrips();
    if (!id) {
      currentTripId = d.data._id;
      document.getElementById('globalTripSelect').value = currentTripId;
    }
  } catch (err) {
    showToast(err.message || 'Failed to save trip', 'error');
  }
}

function editTrip(id) {
  const trip = allTrips.find(t => t._id === id);
  if (!trip) return;
  document.getElementById('tripId').value          = trip._id;
  document.getElementById('tripModalTitle').textContent = 'Edit Trip';
  document.getElementById('tripName').value        = trip.name;
  document.getElementById('tripDestination').value = trip.destination;
  document.getElementById('tripStartDate').value   = (trip.startDate || '').split('T')[0];
  document.getElementById('tripEndDate').value     = (trip.endDate || '').split('T')[0];
  document.getElementById('tripCurrency').value    = trip.currency || 'USD';
  document.getElementById('tripBudget').value      = trip.budget || '';
  document.getElementById('tripNotes').value       = trip.notes || '';
  openModal('tripModal');
}

function confirmDeleteTrip(id) {
  const trip = allTrips.find(t => t._id === id);
  document.getElementById('confirmMessage').textContent =
    `Delete "${trip?.name}"? This will also delete ALL expenses for this trip.`;
  document.getElementById('confirmBtn').onclick = () => deleteTrip(id);
  openModal('confirmModal');
}

async function deleteTrip(id) {
  try {
    const r = await fetch(`${API}/trips/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    closeModal('confirmModal');
    showToast('Trip deleted', 'success');
    if (currentTripId === id) currentTripId = null;
    await loadTrips();
    if (currentView === 'trips') renderTripsTable();
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
  }
}

// ── Expense CRUD ──────────────────────────────────────────────────────────────
async function saveExpense() {
  const id     = document.getElementById('expenseId').value;
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

  const payload = {
    tripId:        currentTripId,
    category:      document.getElementById('expenseCategory').value,
    amount,
    description:   document.getElementById('expenseDescription').value,
    date:          document.getElementById('expenseDate').value,
    paymentMethod: document.getElementById('expensePayment').value,
    notes:         document.getElementById('expenseNotes').value,
  };

  try {
    const url    = id ? `${API}/expenses/${id}` : `${API}/expenses`;
    const method = id ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    closeModal('expenseModal');
    showToast(id ? 'Expense updated!' : 'Expense added!', 'success');
    await renderExpenses();
    // Refresh dashboard stats silently
    loadTrips();
  } catch (err) {
    showToast(err.message || 'Failed to save expense', 'error');
  }
}

function editExpense(id) {
  const e = allExpenses.find(x => x._id === id);
  if (!e) return;
  document.getElementById('expenseId').value          = e._id;
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseCategory').value    = e.category;
  document.getElementById('expenseAmount').value      = e.amount;
  document.getElementById('expenseDescription').value = e.description || '';
  document.getElementById('expenseDate').value        = (e.date || '').split('T')[0];
  document.getElementById('expensePayment').value     = e.paymentMethod || 'cash';
  document.getElementById('expenseNotes').value       = e.notes || '';
  openModal('expenseModal');
}

function confirmDeleteExpense(id) {
  const e = allExpenses.find(x => x._id === id);
  document.getElementById('confirmMessage').textContent =
    `Delete this expense: ${e?.description || e?.category} — ${fmt(e?.amount || 0)}?`;
  document.getElementById('confirmBtn').onclick = () => deleteExpense(id);
  openModal('confirmModal');
}

async function deleteExpense(id) {
  try {
    const r = await fetch(`${API}/expenses/${id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!d.success) throw new Error(d.message);
    closeModal('confirmModal');
    showToast('Expense deleted', 'success');
    await renderExpenses();
    loadTrips();
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
  }
}

// ── Trip modal reset on open ──────────────────────────────────────────────────
document.querySelector('[onclick="openModal(\'tripModal\')"]')?.addEventListener('click', () => {
  document.getElementById('tripId').value = '';
  document.getElementById('tripModalTitle').textContent = 'New Trip';
  document.getElementById('tripName').value = '';
  document.getElementById('tripDestination').value = '';
  document.getElementById('tripStartDate').value = '';
  document.getElementById('tripEndDate').value = '';
  document.getElementById('tripCurrency').value = 'USD';
  document.getElementById('tripBudget').value = '';
  document.getElementById('tripNotes').value = '';
});

// Override all "New Trip" button clicks to reset form
document.querySelectorAll('[onclick="openModal(\'tripModal\')"]').forEach(btn => {
  btn.addEventListener('click', resetTripForm);
});
function resetTripForm() {
  document.getElementById('tripId').value = '';
  document.getElementById('tripModalTitle').textContent = 'New Trip';
  ['tripName','tripDestination','tripBudget','tripNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('tripStartDate').value = '';
  document.getElementById('tripEndDate').value = '';
  document.getElementById('tripCurrency').value = 'USD';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function paymentIcon(method) {
  const icons = { cash: '💵', card: '💳', digital: '📱', other: '🔄' };
  return icons[method] || '💰';
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});
