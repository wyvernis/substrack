const Settings = {
  async init() {
    if (!App.requireAuth()) return;
    await App.loadUserSettings();
    AppNav.init();
    AppNav.updateThemeIcon();
    this.populateCurrencySelect();
    this.loadForms();
    this.bindEvents();
  },

  populateCurrencySelect() {
    const select = document.getElementById('currencySelect');
    select.innerHTML = Currency.list().map((c) =>
      `<option value="${c.code}">${c.code} — ${c.name} (${c.symbol})</option>`
    ).join('');
  },

  async loadForms() {
    try {
      const profile = await App.api('/api/auth/profile');
      document.getElementById('profileName').value = profile.name || '';
      document.getElementById('profileEmail').value = profile.email || '';

      const s = App.settings;
      document.getElementById('currencySelect').value = s.currency || 'INR';
      document.getElementById('darkModeToggle').checked = !!s.darkMode;
      document.getElementById('timezoneSelect').value = s.timezone || 'Asia/Kolkata';

      const r = s.reminders || {};
      document.getElementById('emailReminders').checked = r.emailEnabled !== false;
      document.getElementById('browserReminders').checked = r.browserEnabled !== false;
      document.getElementById('trialReminders').checked = r.trialReminder !== false;
      document.getElementById('budgetAlerts').checked = r.budgetAlert !== false;
      document.getElementById('daysBefore').value = r.daysBeforeRenewal ?? 3;
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  bindEvents() {
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await App.api('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({
            name: document.getElementById('profileName').value,
            email: document.getElementById('profileEmail').value,
          }),
        });
        App.toast('Profile updated');
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await App.saveSettings({
          currency: document.getElementById('currencySelect').value,
          darkMode: document.getElementById('darkModeToggle').checked,
          timezone: document.getElementById('timezoneSelect').value,
          reminders: {
            emailEnabled: document.getElementById('emailReminders').checked,
            browserEnabled: document.getElementById('browserReminders').checked,
            trialReminder: document.getElementById('trialReminders').checked,
            budgetAlert: document.getElementById('budgetAlerts').checked,
            daysBeforeRenewal: parseInt(document.getElementById('daysBefore').value, 10),
          },
        });
        if (document.getElementById('browserReminders').checked) App.requestNotifications();
        App.toast('Settings saved');
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });

    document.getElementById('passwordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await App.api('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: document.getElementById('newPassword').value,
          }),
        });
        App.toast('Password updated');
        document.getElementById('passwordForm').reset();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => Settings.init());
