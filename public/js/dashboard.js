const Dashboard = {
  subscriptions: [],
  overview: null,
  insights: null,
  trends: [],
  activeCat: 'all',
  activeStatus: 'all',
  searchQuery: '',
  charts: {},
  editId: null,

  TAB_META: {
    overview: { label: 'Overview', title: (name) => (name ? `Hello, ${name.split(' ')[0]}` : 'Dashboard'), showActions: true },
    subscriptions: { label: 'Subscriptions', title: () => 'All Subscriptions', showActions: true },
    analytics: { label: 'Analytics', title: () => 'Spending Analytics', showActions: false },
    budget: { label: 'Budget', title: () => 'Monthly Budget', showActions: false },
    insights: { label: 'Insights', title: () => 'Smart Insights', showActions: false },
    shared: { label: 'Shared', title: () => 'Shared Plans', showActions: false },
    import: { label: 'Import', title: () => 'Import Subscriptions', showActions: false },
  },

  async init() {
    if (!App.requireAuth()) return;
    await App.loadUserSettings();
    AppNav.init({ onTabSelect: (tab) => this.switchTab(tab) });
    AppNav.updateThemeIcon();
    this.bindUI();
    const initialTab = location.hash.replace('#', '') || 'overview';
    this.switchTab(initialTab);
    await this.loadAll();
    this.checkBrowserReminders();
    setInterval(() => this.checkBrowserReminders(), 60000 * 30);
  },

  money(n) { return App.formatMoney(n); },

  monthlyAmount(s) {
    const a = parseFloat(s.amount) || 0;
    switch (s.billing_cycle) {
      case 'weekly': return a * 4.33;
      case 'yearly': return a / 12;
      case 'quarterly': return a / 3;
      default: return a;
    }
  },

  bindUI() {
    document.getElementById('addSubBtn').onclick = () => this.openModal();
    document.getElementById('importCsvBtn').onclick = () => this.switchTab('import');
    document.getElementById('subForm').onsubmit = (e) => this.handleSave(e);
    document.getElementById('saveBudgetBtn').onclick = () => this.saveBudget();
    document.getElementById('addSharedBtn').onclick = () => this.openSharedModal();
    document.getElementById('sharedForm').onsubmit = (e) => this.handleShared(e);
    document.getElementById('csvImportBtn').onclick = () => this.importCsv();
    document.getElementById('searchInput').oninput = (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTable();
    };

    document.getElementById('categoryFilter').onclick = (e) => {
      const b = e.target.closest('.filter-pill');
      if (!b) return;
      document.querySelectorAll('#categoryFilter .filter-pill').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      this.activeCat = b.dataset.cat;
      this.renderTable();
    };

    document.getElementById('statusFilter').onclick = (e) => {
      const b = e.target.closest('.filter-pill');
      if (!b) return;
      document.querySelectorAll('#statusFilter .filter-pill').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      this.activeStatus = b.dataset.status;
      this.renderTable();
    };

    document.querySelectorAll('.modal-overlay').forEach((o) => {
      o.onclick = (e) => { if (e.target === o) o.classList.remove('open'); };
    });
  },

  updateHeader(tab) {
    const meta = this.TAB_META[tab] || this.TAB_META.overview;
    document.getElementById('dashHeaderLabel').textContent = meta.label;
    const titleEl = document.getElementById('dashHeaderTitle');
    titleEl.textContent = meta.title(App.user?.name || '');
    titleEl.className = tab === 'overview' ? 'dashboard-greeting' : 'dashboard-page-title';
    document.getElementById('headerActions').style.display = meta.showActions ? 'flex' : 'none';
    AppNav.setActiveTab(tab);
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`panel-${tab}`)?.classList.add('active');
    this.updateHeader(tab);
    if (tab === 'analytics') this.renderCharts();
    if (tab === 'insights') this.renderInsights();
    history.replaceState(null, '', `#${tab}`);
  },

  async loadAll() {
    try {
      const [subs, overview, insights, trends, budget] = await Promise.all([
        App.api('/api/subscriptions'),
        App.api('/api/analytics/overview'),
        App.api('/api/analytics/insights'),
        App.api('/api/analytics/trends'),
        App.api('/api/budget/status').catch(() => ({})),
      ]);
      this.subscriptions = subs;
      this.overview = overview;
      this.insights = insights;
      this.trends = trends;
      this.renderOverview();
      this.renderTable();
      this.renderBudget(budget);
      this.loadShared();
    } catch (err) {
      if (String(err.message).toLowerCase().includes('token') || String(err.message).toLowerCase().includes('auth')) {
        App.logout();
      } else {
        App.toast(err.message, 'error');
      }
    }
  },

  renderOverview() {
    const o = this.overview;
    if (!o) return;

    document.getElementById('cardActive').textContent = o.totalActive;
    document.getElementById('cardCancelled').textContent = `${o.totalCancelled} cancelled`;
    document.getElementById('cardMonthly').textContent = this.money(o.monthlySpend);
    document.getElementById('cardYearly').textContent = this.money(o.yearlySpend);
    document.getElementById('projectedYearly').textContent = this.money(o.projectedYearly);

    if (o.nextRenewal) {
      document.getElementById('cardNextRenewal').textContent = o.nextRenewal.name;
      document.getElementById('cardNextDate').textContent = o.nextRenewal.renewalLabel;
    }

    const b = o.budget;
    const fill = document.getElementById('budgetWidgetFill');
    fill.style.width = `${b.percent}%`;
    fill.classList.toggle('over', b.exceeded);
    document.getElementById('budgetWidgetPct').textContent = b.limit > 0 ? `${Math.round(b.percent)}%` : '—';
    document.getElementById('budgetWidgetText').textContent = b.limit > 0
      ? `${this.money(b.spent)} of ${this.money(b.limit)}${b.exceeded ? ' — over budget!' : ''}`
      : 'Set a budget in the Budget tab';

    const upcoming = o.upcoming || [];
    document.getElementById('timelineCount').textContent = upcoming.length
      ? `${upcoming.length} upcoming`
      : '';

    const timeline = document.getElementById('renewalTimeline');
    if (!upcoming.length) {
      timeline.innerHTML = '<p class="timeline-empty">No upcoming renewals in the next 30 days.</p>';
      return;
    }

    timeline.innerHTML = `<div class="rtimeline">${upcoming.map((u, i) => {
      const urgency = u.daysUntil <= 1 ? 'critical' : u.daysUntil <= 3 ? 'urgent' : u.daysUntil <= 7 ? 'soon' : 'normal';
      const when = this.whenLabel(u.daysUntil);
      const dayWord = u.daysUntil === 1 ? 'day' : 'days';
      const isLast = i === upcoming.length - 1;
      return `
        <article class="rtimeline-row rtimeline-row--${urgency}${isLast ? ' rtimeline-row--last' : ''}">
          <div class="rtimeline-row__spine">
            <span class="rtimeline-row__dot"></span>
            ${!isLast ? '<span class="rtimeline-row__line"></span>' : ''}
          </div>
          <div class="rtimeline-row__content">
            <div class="rtimeline-row__head">
              <time class="rtimeline-row__when">${when}</time>
              <span class="rtimeline-row__date">${this.fmtDate(u.next_billing_date)}</span>
            </div>
            <div class="rtimeline-row__main">
              <div class="rtimeline-row__info">
                <h4 class="rtimeline-row__name">${u.name}</h4>
                <div class="rtimeline-row__meta">
                  <span class="tag tag--compact">${u.category || 'other'}</span>
                  <span class="rtimeline-row__cycle">${u.billing_cycle || 'monthly'}</span>
                </div>
              </div>
              <div class="rtimeline-row__amount">${this.money(this.monthlyAmount(u))}<small>/mo</small></div>
              <div class="rtimeline-row__countdown">
                <span class="rtimeline-row__count-num">${u.daysUntil}</span>
                <span class="rtimeline-row__count-label">${dayWord}</span>
              </div>
            </div>
          </div>
        </article>`;
    }).join('')}</div>`;
  },

  whenLabel(days) {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `This week`;
    if (days <= 14) return `Next two weeks`;
    return 'Upcoming';
  },

  getFiltered() {
    return this.subscriptions.filter((s) => {
      if (this.activeStatus !== 'all' && s.status !== this.activeStatus) return false;
      if (this.activeCat !== 'all' && (s.category || 'other') !== this.activeCat) return false;
      if (this.searchQuery && !s.name.toLowerCase().includes(this.searchQuery)) return false;
      return true;
    });
  },

  renderTable() {
    const filtered = this.getFiltered();
    const tbody = document.getElementById('subsBody');
    const empty = document.getElementById('emptySubs');
    const wrap = document.querySelector('#panel-subscriptions .data-table-wrap');

    if (!filtered.length) {
      tbody.innerHTML = '';
      empty.style.display = this.subscriptions.length ? 'none' : 'block';
      if (wrap) wrap.style.display = this.subscriptions.length ? 'block' : 'none';
      return;
    }

    empty.style.display = 'none';
    if (wrap) wrap.style.display = 'block';

    tbody.innerHTML = filtered.map((s) => `
      <tr>
        <td><strong>${s.name}</strong>${s.tags?.length ? `<br><small class="tag-inline">${s.tags.join(', ')}</small>` : ''}</td>
        <td><span class="tag">${s.category || 'other'}</span></td>
        <td>${this.money(s.amount)}</td>
        <td>${s.billing_cycle || 'monthly'}</td>
        <td><span class="renewal-badge renewal-badge--${s.daysUntil <= 3 ? 'urgent' : ''}">${s.renewalLabel || '—'}</span></td>
        <td><span class="tag tag--${s.status === 'active' ? 'active' : 'paused'}">${s.status}</span></td>
        <td class="actions-cell">
          <button class="icon-btn" onclick="Dashboard.markUsed('${s.id}')">Used</button>
          <button class="icon-btn" onclick="Dashboard.editSub('${s.id}')">Edit</button>
          <button class="icon-btn" onclick="Dashboard.deleteSub('${s.id}')">Delete</button>
        </td>
      </tr>`).join('');
  },

  openModal(sub) {
    this.editId = sub?.id || null;
    document.getElementById('modalTitle').textContent = sub ? 'Edit Subscription' : 'Add Subscription';
    document.getElementById('subId').value = sub?.id || '';
    document.getElementById('subName').value = sub?.name || '';
    document.getElementById('subAmount').value = sub?.amount || '';
    document.getElementById('subCategory').value = sub?.category || 'other';
    document.getElementById('subCycle').value = sub?.billing_cycle || 'monthly';
    document.getElementById('subStatus').value = sub?.status || 'active';
    document.getElementById('subTags').value = (sub?.tags || []).join(', ');
    document.getElementById('subNotes').value = sub?.notes || '';
    document.getElementById('subInvoice').value = sub?.invoice_url || '';
    const d = sub?.next_billing_date ? new Date(sub.next_billing_date) : new Date(Date.now() + 86400000 * 7);
    document.getElementById('subDate').value = d.toISOString().split('T')[0];
    document.getElementById('subTrial').value = sub?.trial_ends_at ? new Date(sub.trial_ends_at).toISOString().split('T')[0] : '';
    document.getElementById('subModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('subModal').classList.remove('open');
    document.getElementById('subForm').reset();
    this.editId = null;
  },

  editSub(id) {
    const sub = this.subscriptions.find((s) => s.id === id);
    if (sub) this.openModal(sub);
  },

  async handleSave(e) {
    e.preventDefault();
    const body = {
      name: document.getElementById('subName').value,
      amount: parseFloat(document.getElementById('subAmount').value),
      category: document.getElementById('subCategory').value,
      billing_cycle: document.getElementById('subCycle').value,
      next_billing_date: document.getElementById('subDate').value,
      status: document.getElementById('subStatus').value,
      tags: document.getElementById('subTags').value,
      notes: document.getElementById('subNotes').value,
      invoice_url: document.getElementById('subInvoice').value,
      trial_ends_at: document.getElementById('subTrial').value || null,
      currency: App.settings.currency || 'INR',
    };

    try {
      if (this.editId) {
        await App.api(`/api/subscriptions/${this.editId}`, { method: 'PUT', body: JSON.stringify(body) });
        App.toast('Subscription updated');
      } else {
        await App.api('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) });
        App.toast('Subscription added');
      }
      this.closeModal();
      await this.loadAll();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async deleteSub(id) {
    if (!confirm('Delete this subscription?')) return;
    try {
      await App.api(`/api/subscriptions/${id}`, { method: 'DELETE' });
      App.toast('Deleted');
      await this.loadAll();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async markUsed(id) {
    try {
      await App.api(`/api/subscriptions/${id}/mark-used`, { method: 'POST' });
      App.toast('Marked as used today');
      await this.loadAll();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderBudget(data) {
    const budget = parseFloat(data.monthly_budget) || 0;
    const spent = parseFloat(data.current_spend) || this.overview?.monthlySpend || 0;
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const over = budget > 0 && spent > budget;

    document.getElementById('budgetAmount').value = budget || '';
    document.getElementById('budgetSpent').textContent = this.money(spent);
    document.getElementById('budgetLimit').textContent = this.money(budget);
    document.getElementById('budgetStatus').textContent = data.status || (over ? 'Over Budget' : 'On Track');
    const fill = document.getElementById('budgetFill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('over', over);
    document.getElementById('budgetAlert').style.display = over ? 'block' : 'none';
    if (over) App.notify('Budget exceeded', `Spending ${this.money(spent)} exceeds ${this.money(budget)}`);
  },

  async saveBudget() {
    const monthly_budget = parseFloat(document.getElementById('budgetAmount').value);
    if (isNaN(monthly_budget) || monthly_budget < 0) return App.toast('Invalid budget', 'error');
    try {
      const data = await App.api('/api/budget', { method: 'POST', body: JSON.stringify({ monthly_budget }) });
      App.toast('Budget saved');
      this.renderBudget(data);
      const overview = await App.api('/api/analytics/overview');
      this.overview = overview;
      this.renderOverview();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  renderCharts() {
    const active = this.subscriptions.filter((s) => s.status === 'active');
    const cats = {};
    active.forEach((s) => {
      const c = s.category || 'other';
      cats[c] = (cats[c] || 0) + this.monthlyAmount(s);
    });

    const colors = ['#181818', '#636363', '#6d6d6d', '#808080', '#9a9a9a', '#000000', '#4a4a4a'];
    this.destroyChart('categoryChart');
    this.charts.category = new Chart(document.getElementById('categoryChart'), {
      type: 'pie',
      data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: colors }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });

    const sorted = [...active].sort((a, b) => this.monthlyAmount(b) - this.monthlyAmount(a)).slice(0, 6);
    this.destroyChart('expensesChart');
    this.charts.expenses = new Chart(document.getElementById('expensesChart'), {
      type: 'bar',
      data: { labels: sorted.map((s) => s.name), datasets: [{ data: sorted.map((s) => this.monthlyAmount(s)), backgroundColor: '#181818' }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });

    this.destroyChart('trendChart');
    this.charts.trend = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: this.trends.map((t) => t.label),
        datasets: [{ label: 'Monthly spend', data: this.trends.map((t) => t.amount), borderColor: '#181818', tension: 0.3, fill: false }],
      },
      options: { plugins: { legend: { display: false } } },
    });

    const breakdown = document.getElementById('categoryBreakdown');
    breakdown.innerHTML = Object.entries(cats).map(([cat, amt]) =>
      `<div class="breakdown-row"><span>${cat}</span><strong>${this.money(amt)}/mo</strong></div>`
    ).join('');
  },

  destroyChart(id) {
    const key = id.replace('Chart', '');
    if (this.charts[key]) { this.charts[key].destroy(); delete this.charts[key]; }
  },

  renderInsights() {
    const ins = this.insights;
    if (!ins) return;
    document.getElementById('totalSavings').textContent = this.money(ins.totalPotentialSavings);

    document.getElementById('insightsList').innerHTML = (ins.suggestions || []).map((s) => `
      <div class="insight-card insight-card--${s.type}">
        <span class="insight-type">${s.type}</span>
        <strong>${s.subscription}</strong>
        <p>${s.reason}</p>
        ${s.estimatedSavings ? `<p>Potential savings: ${this.money(s.estimatedSavings)}/yr</p>` : ''}
        ${s.alternative ? `<p>Try: ${s.alternative}</p>` : ''}
      </div>`).join('') || '<p class="body-text">No suggestions right now — you\'re doing great!</p>';

    document.getElementById('unusedList').innerHTML = (ins.unused || []).map((u) => `
      <div class="insight-card">
        <strong>${u.name}</strong>
        <p>${u.reason} · ${this.money(this.monthlyAmount(u))}/mo</p>
        <button class="pill-btn pill-btn--ghost-light" onclick="Dashboard.markUsed('${u.id}')">Mark as used</button>
      </div>`).join('') || '<p class="body-text">All subscriptions appear active.</p>';
  },

  async loadShared() {
    try {
      const shared = await App.api('/api/shared');
      const list = document.getElementById('sharedList');
      const empty = document.getElementById('emptyShared');
      if (!shared.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
      empty.style.display = 'none';
      list.innerHTML = shared.map((s) => `
        <div class="shared-card">
          <h4>${s.subscription_name}</h4>
          <p>${s.shared_with_email} — ${s.share_percentage}% · ${this.money(s.total_price)} total</p>
          <button class="icon-btn" onclick="Dashboard.deleteShared('${s.id}')">Remove</button>
        </div>`).join('');
    } catch { document.getElementById('emptyShared').style.display = 'block'; }
  },

  openSharedModal() {
    const sel = document.getElementById('sharedSub');
    sel.innerHTML = this.subscriptions.filter((s) => s.status === 'active').map((s) =>
      `<option value="${s.id}">${s.name} — ${this.money(s.amount)}</option>`
    ).join('');
    if (!sel.innerHTML) return App.toast('Add a subscription first', 'error');
    document.getElementById('sharedModal').classList.add('open');
  },

  closeSharedModal() { document.getElementById('sharedModal').classList.remove('open'); },

  async handleShared(e) {
    e.preventDefault();
    try {
      await App.api('/api/shared', {
        method: 'POST',
        body: JSON.stringify({
          subscription_id: document.getElementById('sharedSub').value,
          member_email: document.getElementById('sharedEmail').value,
          share_percentage: parseFloat(document.getElementById('sharedPct').value),
        }),
      });
      App.toast('Collaborator invited');
      this.closeSharedModal();
      this.loadShared();
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async deleteShared(id) {
    if (!confirm('Remove shared plan?')) return;
    try {
      await App.api(`/api/shared/${id}`, { method: 'DELETE' });
      App.toast('Removed');
      this.loadShared();
    } catch (err) { App.toast(err.message, 'error'); }
  },

  async importCsv() {
    const csv = document.getElementById('csvInput').value;
    try {
      const res = await App.api('/api/subscriptions/import', { method: 'POST', body: JSON.stringify({ csv }) });
      document.getElementById('importResult').textContent = `Imported ${res.imported} subscription(s).`;
      if (res.errors?.length) App.toast(`${res.errors.length} row(s) had errors`, 'error');
      await this.loadAll();
    } catch (err) { App.toast(err.message, 'error'); }
  },

  checkBrowserReminders() {
    if (!App.settings.reminders?.browserEnabled) return;
    const days = App.settings.reminders?.daysBeforeRenewal ?? 3;
    this.subscriptions.filter((s) => s.status === 'active').forEach((s) => {
      if (s.daysUntil !== null && s.daysUntil >= 0 && s.daysUntil <= days) {
        const key = `notified_${s.id}_${s.next_billing_date}`;
        if (!sessionStorage.getItem(key)) {
          App.notify(`${s.name} renews soon`, s.renewalLabel);
          sessionStorage.setItem(key, '1');
        }
      }
      if (s.trial_ends_at) {
        const trialEnd = new Date(s.trial_ends_at);
        const daysLeft = Math.ceil((trialEnd - Date.now()) / 86400000);
        if (daysLeft >= 0 && daysLeft <= 3) {
          const key = `trial_${s.id}`;
          if (!sessionStorage.getItem(key)) {
            App.notify('Trial ending', `Cancel ${s.name} before trial ends`);
            sessionStorage.setItem(key, '1');
          }
        }
      }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
