/* SubsTrack — shared UI interactions */

const App = {
  settings: { currency: 'INR', darkMode: false, reminders: {} },
  user: null,

  init() {
    this.initNav();
    this.initCookieBanner();
    this.initReveal();
    this.initSmoothAnchors();
    if (this.getToken()) {
      this.loadUserSettings().then(() => this.applyTheme());
    } else {
      this.applyThemeFromLocal();
    }
  },

  applyThemeFromLocal() {
    const dark = localStorage.getItem('darkMode') === '1';
    document.documentElement.classList.toggle('theme-dark', dark);
  },

  applyTheme() {
    const dark = this.settings.darkMode || localStorage.getItem('darkMode') === '1';
    document.documentElement.classList.toggle('theme-dark', dark);
    localStorage.setItem('darkMode', dark ? '1' : '0');
    Currency.setCode(this.settings.currency || 'INR');
    if (typeof AppNav !== 'undefined') AppNav.updateThemeIcon();
  },

  async loadUserSettings() {
    try {
      const data = await this.api('/api/auth/settings');
      this.settings = data.settings || { currency: 'INR', darkMode: false };
      this.user = { name: data.name, email: data.email, id: data.id };
      Currency.setCode(this.settings.currency);
      this.applyTheme();
      if (this.settings.reminders?.browserEnabled) {
        this.requestNotifications();
      }
      return this.settings;
    } catch {
      this.settings = { currency: localStorage.getItem('currency') || 'INR', darkMode: false };
      Currency.setCode(this.settings.currency);
      return this.settings;
    }
  },

  async saveSettings(partial) {
    const data = await this.api('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(partial),
    });
    this.settings = { ...this.settings, ...data.settings };
    this.applyTheme();
    return this.settings;
  },

  formatMoney(amount) {
    return Currency.format(amount, this.settings.currency);
  },

  requestNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  },

  notify(title, body) {
    if (!this.settings.reminders?.browserEnabled) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  },

  initNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const isDarkHero = document.querySelector('.frame-dark, .auth-visual');
    if (isDarkHero) nav.classList.add('nav--dark');
    else nav.classList.add('nav--light');

    const onScroll = () => {
      const scrolled = window.scrollY > 60;
      const overLight = this.isOverLightSection();
      if (scrolled || overLight) {
        nav.classList.remove('nav--dark');
        nav.classList.add('nav--light', 'nav--solid');
      } else if (isDarkHero) {
        nav.classList.add('nav--dark');
        nav.classList.remove('nav--light', 'nav--solid');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  },

  isOverLightSection() {
    const nav = document.querySelector('.nav');
    if (!nav) return false;
    const rect = nav.getBoundingClientRect();
    const el = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom + 1);
    if (!el) return false;
    return !!el.closest('.section-editorial, .auth-form-side, .dashboard-layout, .settings-layout, .site-footer');
  },

  initCookieBanner() {
    if (localStorage.getItem('cookieAccepted')) return;
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <p>We use cookies to improve your experience.</p>
      <div class="cookie-actions">
        <button class="pill-btn pill-btn--graphite" id="cookieAccept">Accept</button>
        <button class="cookie-dismiss" id="cookieDismiss">✕</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    document.getElementById('cookieAccept').onclick = () => {
      localStorage.setItem('cookieAccepted', '1');
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    };
    document.getElementById('cookieDismiss').onclick = () => {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 500);
    };
  },

  initReveal() {
    const items = document.querySelectorAll('.reveal, .feature-item');
    if (!items.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach((el, i) => {
      if (el.classList.contains('feature-item')) el.style.transitionDelay = `${i * 0.08}s`;
      observer.observe(el);
    });
  },

  initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  },

  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast${type === 'error' ? ' error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  getToken() { return localStorage.getItem('token'); },

  authHeaders() {
    const token = this.getToken();
    return { 'Content-Type': 'application/json', ...(token ? { 'x-auth-token': token } : {}) };
  },

  async api(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { ...this.authHeaders(), ...options.headers } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.errors?.[0]?.msg || 'Request failed');
    return data;
  },

  requireAuth(redirectTo = '/login.html') {
    if (!this.getToken()) { window.location.href = redirectTo; return false; }
    return true;
  },

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
