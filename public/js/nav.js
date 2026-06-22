/* Shared app navigation — menu + theme toggle */

const AppNav = {
  init(options = {}) {
    this.options = options;
    this.bindMenu();
    this.bindThemeToggle();
    this.highlightCurrentPage();
    if (options.onTabSelect) this.bindDashboardTabs(options.onTabSelect);
  },

  bindMenu() {
    const btn = document.getElementById('navMenuBtn');
    const panel = document.getElementById('navMenuPanel');
    if (!btn || !panel) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });

    document.addEventListener('click', () => {
      panel.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
  },

  bindThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    this.updateThemeIcon(btn);

    btn.addEventListener('click', async () => {
      const isDark = document.documentElement.classList.toggle('theme-dark');
      localStorage.setItem('darkMode', isDark ? '1' : '0');

      if (App.getToken()) {
        try {
          await App.saveSettings({ darkMode: isDark });
        } catch { /* keep local toggle */ }
      }

      this.updateThemeIcon(btn);
    });
  },

  updateThemeIcon(btn) {
    const el = btn || document.getElementById('themeToggle');
    if (!el) return;
    const dark = document.documentElement.classList.contains('theme-dark');
    el.textContent = dark ? '☀' : '☾';
    el.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  },

  highlightCurrentPage() {
    const path = location.pathname;
    document.querySelectorAll('.nav-dropdown a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      a.classList.toggle('active', path.endsWith(href.replace(/^\//, '')) || path === href);
    });
  },

  bindDashboardTabs(onSelect) {
    document.querySelectorAll('.nav-dropdown [data-tab]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        onSelect(link.dataset.tab);
        document.getElementById('navMenuPanel')?.classList.remove('open');
      });
    });
  },

  setActiveTab(tab) {
    document.querySelectorAll('.nav-dropdown [data-tab]').forEach((l) => {
      l.classList.toggle('active', l.dataset.tab === tab);
    });
  },
};
