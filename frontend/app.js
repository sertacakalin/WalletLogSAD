/* WalletLog frontend — vanilla JS SPA. */
(() => {
  'use strict';

  const API = '/api';
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const $ = (id) => document.getElementById(id);

  /* -------------------- Auth state (in-memory only) -------------------- */
  let accessToken = null;
  let currentUser = null;
  const setAccessToken = (t) => { accessToken = t || null; };
  const clearAuth = () => { accessToken = null; currentUser = null; };

  /* -------------------- HTTP helpers -------------------- */
  async function rawFetch(method, url, body, withAuth) {
    const init = { method, headers: {}, credentials: 'include' };
    if (withAuth && accessToken) init.headers['Authorization'] = `Bearer ${accessToken}`;
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(url, init);
  }
  async function parseResponse(res) {
    if (res.status === 204) return null;
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  async function tryRefresh() {
    try {
      const res = await rawFetch('POST', `${API}/auth/refresh`, undefined, false);
      if (!res.ok) return false;
      const data = await res.json();
      setAccessToken(data.accessToken);
      if (data.user) currentUser = data.user;
      return true;
    } catch { return false; }
  }
  async function request(method, url, body) {
    let res = await rawFetch(method, url, body, true);
    if (res.status === 401 && accessToken !== null) {
      const ok = await tryRefresh();
      if (ok) res = await rawFetch(method, url, body, true);
      else { clearAuth(); showAuthScreen(); throw new Error('Session expired. Please sign in again.'); }
    }
    return parseResponse(res);
  }
  async function publicRequest(method, url, body) {
    const res = await rawFetch(method, url, body, false);
    return parseResponse(res);
  }

  /* -------------------- API surface -------------------- */
  const auth = {
    register: (b) => publicRequest('POST', `${API}/auth/register`, b),
    login:    (b) => publicRequest('POST', `${API}/auth/login`,    b),
    logout:   ()  => publicRequest('POST', `${API}/auth/logout`),
    me:       ()  => request('GET', `${API}/auth/me`),
  };
  const api = {
    listCategories:    ()        => request('GET',    `${API}/categories`),
    createCategory:    (b)       => request('POST',   `${API}/categories`, b),
    updateCategory:    (id, b)   => request('PUT',    `${API}/categories/${id}`, b),
    deleteCategory:    (id)      => request('DELETE', `${API}/categories/${id}`),

    listTransactions:  (q = {})  => request('GET',    `${API}/transactions${qs(q)}`),
    createTransaction: (b)       => request('POST',   `${API}/transactions`, b),
    updateTransaction: (id, b)   => request('PUT',    `${API}/transactions/${id}`, b),
    deleteTransaction: (id)      => request('DELETE', `${API}/transactions/${id}`),

    listBudgets:       ()        => request('GET',    `${API}/budgets`),
    createBudget:      (b)       => request('POST',   `${API}/budgets`, b),
    updateBudget:      (id, b)   => request('PUT',    `${API}/budgets/${id}`, b),
    deleteBudget:      (id)      => request('DELETE', `${API}/budgets/${id}`),

    listWallets:       ()        => request('GET',    `${API}/wallets`),
    createWallet:      (b)       => request('POST',   `${API}/wallets`, b),
    updateWallet:      (id, b)   => request('PUT',    `${API}/wallets/${id}`, b),
    deleteWallet:      (id)      => request('DELETE', `${API}/wallets/${id}`),

    listRecurring:     ()        => request('GET',    `${API}/recurring`),
    createRecurring:   (b)       => request('POST',   `${API}/recurring`, b),
    updateRecurring:   (id, b)   => request('PUT',    `${API}/recurring/${id}`, b),
    deleteRecurring:   (id)      => request('DELETE', `${API}/recurring/${id}`),

    getDashboard:      (m, y)    => request('GET',    `${API}/dashboard${qs({ month: m, year: y })}`),
  };
  function qs(params) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) usp.append(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : '';
  }

  /* -------------------- Utils -------------------- */
  function fmtMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtMoneyShort(n) {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return v.toFixed(0);
  }
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(message, kind = 'ok') {
    const el = $('toast');
    el.textContent = message;
    el.className = `toast show ${kind === 'error' ? 'error' : 'ok'}`;
    setTimeout(() => { el.className = 'toast'; }, 3000);
  }
  function setError(inputId, message) {
    const el = document.querySelector(`[data-error-for="${inputId}"]`);
    if (!el) return;
    el.textContent = message || '';
  }
  function clearErrors(formEl) {
    formEl.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
  }

  /* -------------------- Validators -------------------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmail = (v) => !v ? 'Required' : !EMAIL_RE.test(v.trim()) ? 'Invalid email' : '';
  const validNewPassword = (v) => {
    if (!v || v.length < 8) return 'At least 8 characters';
    if (v.length > 72)      return 'At most 72 characters';
    if (!/[A-Za-z]/.test(v)) return 'Must include a letter';
    if (!/\d/.test(v))      return 'Must include a digit';
    return '';
  };
  const positiveNumber = (v) => {
    const n = Number(v);
    return !Number.isFinite(n) || n <= 0 ? 'Enter a number greater than zero' : '';
  };
  const validYear = (v) => {
    const n = Number(v);
    return !Number.isInteger(n) || n < 1900 || n > 2999 ? 'Invalid year' : '';
  };
  const requiredText = (v, label) => !v || !String(v).trim() ? `${label} is required` : '';
  const requiredDate = (v) => !v ? 'Date is required' : '';

  /* -------------------- Cache for relations -------------------- */
  let categoryCache  = [];
  let walletCache    = [];
  let budgetCache    = [];
  let recurringCache = [];

  /* -------------------- Auth UI -------------------- */
  function showAuthScreen() {
    $('app-root').classList.add('hidden');
    $('auth-root').classList.remove('hidden');
  }
  function showAppShell() {
    $('auth-root').classList.add('hidden');
    $('app-root').classList.remove('hidden');
    $('who').textContent = currentUser
      ? (currentUser.display_name ? `${currentUser.display_name} (${currentUser.email})` : currentUser.email)
      : '';
    showPage('dashboard');
  }
  function activateTab(which) {
    const isLogin = which === 'login';
    $('tab-login').classList.toggle('active', isLogin);
    $('tab-register').classList.toggle('active', !isLogin);
    $('tab-login').setAttribute('aria-selected', String(isLogin));
    $('tab-register').setAttribute('aria-selected', String(!isLogin));
    $('login-form').classList.toggle('hidden', !isLogin);
    $('register-form').classList.toggle('hidden', isLogin);
    clearErrors($('login-form'));
    clearErrors($('register-form'));
  }

  async function submitLogin(e) {
    e.preventDefault();
    clearErrors($('login-form'));
    const email = $('login-email').value;
    const pw    = $('login-password').value;
    let ok = true;
    const eErr = validEmail(email);
    setError('login-email', eErr); if (eErr) ok = false;
    if (!pw)  { setError('login-password', 'Required'); ok = false; }
    if (!ok) return;
    try {
      const result = await auth.login({ email: email.trim(), password: pw });
      setAccessToken(result.accessToken);
      currentUser = result.user;
      $('login-form').reset();
      toast(`Welcome back, ${currentUser.email}`);
      showAppShell();
    } catch (err) {
      toast(err.message || 'Login failed', 'error');
    }
  }
  async function submitRegister(e) {
    e.preventDefault();
    clearErrors($('register-form'));
    const display = $('reg-display').value;
    const email   = $('reg-email').value;
    const pw      = $('reg-password').value;
    let ok = true;
    const eErr = validEmail(email);
    setError('reg-email', eErr); if (eErr) ok = false;
    const pErr = validNewPassword(pw);
    setError('reg-password', pErr); if (pErr) ok = false;
    if (display && display.length > 80) {
      setError('reg-display', 'Display name must be at most 80 characters'); ok = false;
    }
    if (!ok) return;
    try {
      await auth.register({
        email: email.trim(),
        password: pw,
        displayName: display ? display.trim() : undefined,
      });
      // Otomatik giriş yapma — kullanıcıyı boş login ekranına yönlendir.
      $('register-form').reset();
      activateTab('login');
      $('login-form').reset();
      toast('Account created successfully! Please log in.');
    } catch (err) {
      toast(err.message || 'Registration failed', 'error');
    }
  }
  async function doLogout() {
    try { await auth.logout(); } catch { /* ignore */ }
    clearAuth();
    showAuthScreen();
    activateTab('login');
  }

  /* -------------------- Page navigation -------------------- */
  function showPage(id) {
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('nav button').forEach((b) => {
      b.classList.toggle('active', b.dataset.page === id);
    });
    if (id === 'dashboard')    { loadDashboard(); }
    if (id === 'transactions') { loadCategoriesIntoSelects(); loadWalletsIntoSelects(); loadTransactions(); }
    if (id === 'categories')   { loadCategories(); }
    if (id === 'budgets')      { loadCategoriesIntoSelects(); loadBudgets(); }
    if (id === 'wallets')      { loadWallets(); }
    if (id === 'recurring')    { loadCategoriesIntoSelects(); loadWalletsIntoSelects(); loadRecurring(); }
  }

  /* -------------------- Categories CRUD -------------------- */
  async function loadCategories() {
    try {
      const data = await api.listCategories();
      categoryCache = data;
      $('category-list').innerHTML = data.length === 0
        ? '<tr><td colspan="3" class="muted">No categories yet</td></tr>'
        : data.map((c) => `
          <tr>
            <td><span class="swatch" style="background:${escapeHtml(c.color)}"></span></td>
            <td>${escapeHtml(c.name)}</td>
            <td class="actions">
              <button class="btn btn-ghost"  data-edit-cat="${c.id}">Edit</button>
              <button class="btn btn-danger" data-delete-cat="${c.id}">Delete</button>
            </td>
          </tr>`).join('');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function loadCategoriesIntoSelects() {
    try {
      const data = await api.listCategories();
      categoryCache = data;
      const opts = `<option value="">— None —</option>` +
        data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      ['t-category', 'r-category'].forEach((id) => { const el = $(id); if (el) el.innerHTML = opts; });
      const filterOpts = `<option value="">All</option>` +
        data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      const fcat = $('f-cat'); if (fcat) fcat.innerHTML = filterOpts;
      const bcat = $('b-category');
      if (bcat) bcat.innerHTML = data.length === 0
        ? '<option value="">No categories yet</option>'
        : data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch { /* ignore */ }
  }
  function validateCategoryForm() {
    const name = $('c-name').value;
    const color = $('c-color').value;
    const nameErr = requiredText(name, 'Name');
    setError('c-name', nameErr);
    if (nameErr) return null;
    return { name: name.trim(), color };
  }
  async function submitCategory(e) {
    e.preventDefault();
    const payload = validateCategoryForm();
    if (!payload) return;
    const id = $('c-id').value;
    try {
      if (id) { await api.updateCategory(id, payload); toast('Category updated'); }
      else    { await api.createCategory(payload);     toast('Category created'); }
      resetCategoryForm();
      loadCategories();
    } catch (e2) { toast(e2.message, 'error'); }
  }
  function resetCategoryForm() {
    $('c-id').value = '';
    $('c-name').value = '';
    $('c-color').value = '#3498db';
    $('c-form-title').textContent = 'Add Category';
    $('c-cancel').classList.add('hidden');
    clearErrors($('c-form'));
  }
  function startEditCategory(id) {
    const c = categoryCache.find((x) => String(x.id) === String(id));
    if (!c) return;
    $('c-id').value = c.id;
    $('c-name').value = c.name;
    $('c-color').value = c.color || '#3498db';
    $('c-form-title').textContent = `Edit Category: ${c.name}`;
    $('c-cancel').classList.remove('hidden');
    $('c-name').focus();
  }
  async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    try { await api.deleteCategory(id); toast('Category deleted'); loadCategories(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* -------------------- Wallets CRUD -------------------- */
  async function loadWallets() {
    try {
      const data = await api.listWallets();
      walletCache = data;
      // Also fetch balances for display.
      const balances = await request('GET', `${API}/wallets/balances`);
      const balById = new Map(balances.map((b) => [b.id, b]));
      $('wallet-list').innerHTML = data.length === 0
        ? '<tr><td colspan="7" class="muted">No wallets yet</td></tr>'
        : data.map((w) => {
          const b = balById.get(w.id) || { income: 0, expense: 0, balance: Number(w.initial_balance) || 0 };
          return `
            <tr>
              <td><span class="swatch" style="background:${escapeHtml(w.color)}"></span></td>
              <td>${escapeHtml(w.name)}</td>
              <td class="num">${fmtMoney(w.initial_balance)}</td>
              <td class="num income">${fmtMoney(b.income)}</td>
              <td class="num expense">${fmtMoney(b.expense)}</td>
              <td class="num"><strong>${fmtMoney(b.balance)}</strong></td>
              <td class="actions">
                <button class="btn btn-ghost"  data-edit-wallet="${w.id}">Edit</button>
                <button class="btn btn-danger" data-delete-wallet="${w.id}">Delete</button>
              </td>
            </tr>`;
        }).join('');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function loadWalletsIntoSelects() {
    try {
      const data = await api.listWallets();
      walletCache = data;
      const opts = `<option value="">— None —</option>` +
        data.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
      ['t-wallet', 'r-wallet'].forEach((id) => { const el = $(id); if (el) el.innerHTML = opts; });
      const filterOpts = `<option value="">All</option>` +
        data.map((w) => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
      const fw = $('f-wallet'); if (fw) fw.innerHTML = filterOpts;
    } catch { /* ignore */ }
  }
  function validateWalletForm() {
    const name = $('w-name').value;
    const color = $('w-color').value;
    const initial = $('w-initial').value;
    const nameErr = requiredText(name, 'Name');
    setError('w-name', nameErr);
    if (nameErr) return null;
    const payload = { name: name.trim(), color };
    if (initial !== '' && initial !== null) {
      const n = Number(initial);
      if (!Number.isFinite(n)) { toast('Initial balance must be a number', 'error'); return null; }
      payload.initial_balance = n;
    }
    return payload;
  }
  async function submitWallet(e) {
    e.preventDefault();
    const payload = validateWalletForm();
    if (!payload) return;
    const id = $('w-id').value;
    try {
      if (id) { await api.updateWallet(id, payload); toast('Wallet updated'); }
      else    { await api.createWallet(payload);     toast('Wallet created'); }
      resetWalletForm();
      loadWallets();
    } catch (e2) { toast(e2.message, 'error'); }
  }
  function resetWalletForm() {
    $('w-id').value = '';
    $('w-name').value = '';
    $('w-color').value = '#3a3733';
    $('w-initial').value = '';
    $('w-form-title').textContent = 'Add Wallet';
    $('w-cancel').classList.add('hidden');
    clearErrors($('w-form'));
  }
  function startEditWallet(id) {
    const w = walletCache.find((x) => String(x.id) === String(id));
    if (!w) return;
    $('w-id').value = w.id;
    $('w-name').value = w.name;
    $('w-color').value = w.color || '#3a3733';
    $('w-initial').value = w.initial_balance;
    $('w-form-title').textContent = `Edit Wallet: ${w.name}`;
    $('w-cancel').classList.remove('hidden');
    $('w-name').focus();
  }
  async function deleteWallet(id) {
    if (!confirm('Delete this wallet? Transactions in it stay but become unassigned.')) return;
    try { await api.deleteWallet(id); toast('Wallet deleted'); loadWallets(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* -------------------- Recurring CRUD -------------------- */
  async function loadRecurring() {
    try {
      const data = await api.listRecurring();
      recurringCache = data;
      $('recurring-list').innerHTML = data.length === 0
        ? '<tr><td colspan="8" class="muted">No recurring transactions yet</td></tr>'
        : data.map((r) => `
          <tr>
            <td>${escapeHtml(String(r.next_due_date).slice(0, 10))}</td>
            <td>${escapeHtml(r.title)}</td>
            <td>${escapeHtml(r.category_name || '—')}</td>
            <td>${escapeHtml(r.wallet_name || '—')}</td>
            <td class="cap">${escapeHtml(r.frequency)}</td>
            <td><span class="tag tag-${r.type}">${escapeHtml(r.type)}</span></td>
            <td class="num">${fmtMoney(r.amount)}</td>
            <td class="actions">
              <button class="btn btn-ghost"  data-edit-recurring="${r.id}">Edit</button>
              <button class="btn btn-danger" data-delete-recurring="${r.id}">Delete</button>
            </td>
          </tr>`).join('');
    } catch (e) { toast(e.message, 'error'); }
  }
  function validateRecurringForm() {
    const title = $('r-title').value;
    const amount = $('r-amount').value;
    const type = $('r-type').value;
    const frequency = $('r-frequency').value;
    const next = $('r-next').value;
    let ok = true;
    const tErr = requiredText(title, 'Title');     setError('r-title', tErr);  if (tErr) ok = false;
    const aErr = positiveNumber(amount);           if (aErr) { toast(aErr, 'error'); ok = false; }
    const dErr = requiredDate(next);               setError('r-next', dErr);   if (dErr) ok = false;
    if (!ok) return null;
    const payload = {
      title: title.trim(),
      amount: Number(amount),
      type,
      frequency,
      next_due_date: next,
      category_id: $('r-category').value ? Number($('r-category').value) : null,
      wallet_id:   $('r-wallet').value   ? Number($('r-wallet').value)   : null,
      note: $('r-note').value || null,
    };
    return payload;
  }
  async function submitRecurring(e) {
    e.preventDefault();
    const payload = validateRecurringForm();
    if (!payload) return;
    const id = $('r-id').value;
    try {
      if (id) { await api.updateRecurring(id, payload); toast('Recurring updated'); }
      else    { await api.createRecurring(payload);     toast('Recurring created'); }
      resetRecurringForm();
      loadRecurring();
    } catch (e2) { toast(e2.message, 'error'); }
  }
  function resetRecurringForm() {
    $('r-id').value = '';
    $('r-title').value = '';
    $('r-amount').value = '';
    $('r-type').value = 'expense';
    $('r-frequency').value = 'monthly';
    $('r-next').value = '';
    $('r-category').value = '';
    $('r-wallet').value = '';
    $('r-note').value = '';
    $('r-form-title').textContent = 'Add Recurring';
    $('r-cancel').classList.add('hidden');
    clearErrors($('r-form'));
  }
  function startEditRecurring(id) {
    const r = recurringCache.find((x) => String(x.id) === String(id));
    if (!r) return;
    $('r-id').value = r.id;
    $('r-title').value = r.title;
    $('r-amount').value = r.amount;
    $('r-type').value = r.type;
    $('r-frequency').value = r.frequency;
    $('r-next').value = String(r.next_due_date).slice(0, 10);
    $('r-category').value = r.category_id || '';
    $('r-wallet').value = r.wallet_id || '';
    $('r-note').value = r.note || '';
    $('r-form-title').textContent = `Edit Recurring: ${r.title}`;
    $('r-cancel').classList.remove('hidden');
    $('r-title').focus();
  }
  async function deleteRecurring(id) {
    if (!confirm('Delete this recurring transaction?')) return;
    try { await api.deleteRecurring(id); toast('Recurring deleted'); loadRecurring(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* -------------------- Transactions CRUD -------------------- */
  async function loadTransactions() {
    try {
      const filters = {
        type:        $('f-type').value || undefined,
        category_id: $('f-cat').value  || undefined,
        wallet_id:   $('f-wallet').value || undefined,
        startDate:   $('f-start').value || undefined,
        endDate:     $('f-end').value   || undefined,
      };
      const rows = await api.listTransactions(filters);
      $('transaction-list').innerHTML = rows.length === 0
        ? '<tr><td colspan="7" class="muted">No transactions match these filters</td></tr>'
        : rows.map((t) => `
          <tr>
            <td>${escapeHtml(String(t.date).slice(0, 10))}</td>
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.category_name || '—')}</td>
            <td>${escapeHtml(t.wallet_name || '—')}</td>
            <td><span class="tag tag-${t.type}">${escapeHtml(t.type)}</span></td>
            <td class="num ${t.type}">${fmtMoney(t.amount)}</td>
            <td class="actions">
              <button class="btn btn-ghost"  data-edit-tx="${t.id}">Edit</button>
              <button class="btn btn-danger" data-delete-tx="${t.id}">Delete</button>
            </td>
          </tr>`).join('');
      _txCache = rows;
    } catch (e) { toast(e.message, 'error'); }
  }
  let _txCache = [];
  function validateTransactionForm() {
    const title = $('t-title').value;
    const amount = $('t-amount').value;
    const date = $('t-date').value;
    let ok = true;
    const tErr = requiredText(title, 'Title'); setError('t-title', tErr); if (tErr) ok = false;
    const aErr = positiveNumber(amount);       if (aErr) { setError('t-amount', aErr); ok = false; }
    const dErr = requiredDate(date);           setError('t-date', dErr);  if (dErr) ok = false;
    if (!ok) return null;
    return {
      title: title.trim(),
      amount: Number(amount),
      type: $('t-type').value,
      category_id: $('t-category').value ? Number($('t-category').value) : null,
      wallet_id:   $('t-wallet').value   ? Number($('t-wallet').value)   : null,
      date,
      note: $('t-note').value || null,
    };
  }
  async function submitTransaction(e) {
    e.preventDefault();
    const payload = validateTransactionForm();
    if (!payload) return;
    const id = $('t-id').value;
    try {
      if (id) { await api.updateTransaction(id, payload); toast('Transaction updated'); }
      else    { await api.createTransaction(payload);     toast('Transaction created'); }
      resetTransactionForm();
      loadTransactions();
    } catch (e2) { toast(e2.message, 'error'); }
  }
  function resetTransactionForm() {
    $('t-id').value = '';
    $('t-title').value = '';
    $('t-amount').value = '';
    $('t-type').value = 'expense';
    $('t-category').value = '';
    $('t-wallet').value = '';
    $('t-date').value = new Date().toISOString().slice(0, 10);
    $('t-note').value = '';
    $('t-form-title').textContent = 'Add Transaction';
    $('t-cancel').classList.add('hidden');
    clearErrors($('t-form'));
  }
  function startEditTransaction(id) {
    const t = _txCache.find((x) => String(x.id) === String(id));
    if (!t) return;
    $('t-id').value = t.id;
    $('t-title').value = t.title;
    $('t-amount').value = t.amount;
    $('t-type').value = t.type;
    $('t-category').value = t.category_id || '';
    $('t-wallet').value = t.wallet_id || '';
    $('t-date').value = String(t.date).slice(0, 10);
    $('t-note').value = t.note || '';
    $('t-form-title').textContent = `Edit Transaction: ${t.title}`;
    $('t-cancel').classList.remove('hidden');
    $('t-title').focus();
  }
  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try { await api.deleteTransaction(id); toast('Transaction deleted'); loadTransactions(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* -------------------- Budgets CRUD -------------------- */
  async function loadBudgets() {
    try {
      const data = await api.listBudgets();
      budgetCache = data;
      $('budget-list').innerHTML = data.length === 0
        ? '<tr><td colspan="4" class="muted">No budgets yet</td></tr>'
        : data.map((b) => `
          <tr>
            <td>${escapeHtml(b.category_name || '—')}</td>
            <td>${MONTHS[b.month - 1]} ${b.year}</td>
            <td class="num">${fmtMoney(b.limit_amount)}</td>
            <td class="actions">
              <button class="btn btn-ghost"  data-edit-budget="${b.id}">Edit</button>
              <button class="btn btn-danger" data-delete-budget="${b.id}">Delete</button>
            </td>
          </tr>`).join('');
    } catch (e) { toast(e.message, 'error'); }
  }
  function validateBudgetForm(isEdit) {
    const category = $('b-category').value;
    const month    = $('b-month').value;
    const year     = $('b-year').value;
    const limit    = $('b-limit').value;
    let ok = true;
    if (!isEdit) {
      if (!category) { setError('b-category', 'Choose a category'); ok = false; }
      const yErr = validYear(year); setError('b-year', yErr); if (yErr) ok = false;
    }
    const limitErr = positiveNumber(limit);
    setError('b-limit', limitErr); if (limitErr) ok = false;
    if (!ok) return null;
    if (isEdit) return { limit_amount: Number(limit) };
    return {
      category_id: Number(category),
      month: Number(month),
      year: Number(year),
      limit_amount: Number(limit),
    };
  }
  async function submitBudget(e) {
    e.preventDefault();
    const id = $('b-id').value;
    const payload = validateBudgetForm(Boolean(id));
    if (!payload) return;
    try {
      if (id) { await api.updateBudget(id, payload); toast('Budget updated'); }
      else    { await api.createBudget(payload);     toast('Budget created'); }
      resetBudgetForm();
      loadBudgets();
    } catch (e2) { toast(e2.message, 'error'); }
  }
  function resetBudgetForm() {
    $('b-id').value = '';
    $('b-limit').value = '';
    $('b-form-title').textContent = 'Add Budget';
    $('b-cancel').classList.add('hidden');
    clearErrors($('b-form'));
    const now = new Date();
    $('b-month').value = now.getMonth() + 1;
    $('b-year').value  = now.getFullYear();
  }
  function startEditBudget(id) {
    const b = budgetCache.find((x) => String(x.id) === String(id));
    if (!b) return;
    $('b-id').value = b.id;
    $('b-category').value = b.category_id;
    $('b-month').value = b.month;
    $('b-year').value = b.year;
    $('b-limit').value = b.limit_amount;
    $('b-form-title').textContent = `Edit Budget: ${b.category_name} ${MONTHS[b.month - 1]} ${b.year}`;
    $('b-cancel').classList.remove('hidden');
    $('b-limit').focus();
  }
  async function deleteBudget(id) {
    if (!confirm('Delete this budget?')) return;
    try { await api.deleteBudget(id); toast('Budget deleted'); loadBudgets(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* -------------------- Dashboard render -------------------- */
  async function loadDashboard() {
    const month = $('sum-month').value;
    const year  = $('sum-year').value;
    const yErr = validYear(year);
    if (yErr) { toast(yErr, 'error'); return; }
    try {
      const d = await api.getDashboard(month, year);

      // 1. Summary cards
      $('card-balance').textContent = fmtMoney(d.balance);
      $('card-income').textContent  = fmtMoney(d.monthlyIncome);
      $('card-expense').textContent = fmtMoney(d.monthlyExpense);
      $('card-savings').textContent = `${d.savingsRate}%`;
      const periodLabel = `${MONTHS[(d.month || month) - 1]} ${d.year || year}`;
      $('card-income-period').textContent = periodLabel;
      $('card-expense-period').textContent = periodLabel;

      // 2. Insights
      renderInsights(d.insights || []);

      // 3a. Donut
      renderDonut(d.categoryExpenses || []);

      // 3b. Line chart
      renderLine(d.monthlyTrend || []);

      // 4. Budget tracking (reuse bar component)
      renderBudgets(d.budgets || []);

      // 5. Recent transactions
      renderRecent(d.recentTransactions || []);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function renderInsights(items) {
    const ul = $('insights-list');
    if (!items.length) {
      ul.innerHTML = '<li class="insight muted">No insights yet — add some transactions to see trends.</li>';
      return;
    }
    ul.innerHTML = items.map((i) => `
      <li class="insight insight-${escapeHtml(i.level)}">
        <span class="insight-dot" aria-hidden="true"></span>
        <span class="insight-text">${escapeHtml(i.message)}</span>
      </li>`).join('');
  }

  function renderBudgets(rows) {
    const c = $('budget-status-list');
    if (!rows.length) {
      c.innerHTML = '<p class="muted">No budgets set for this month.</p>';
      return;
    }
    c.innerHTML = `<div class="budget-bars">${rows.map(renderBudgetRow).join('')}</div>`;
  }
  function renderBudgetRow(b) {
    const limit = Number(b.limit) || 0;
    const spent = Number(b.spent) || 0;
    const remaining = Number(b.remaining) || 0;
    const ratio = limit > 0 ? spent / limit : 0;
    const pct = Math.round(ratio * 100);
    const fillWidth = Math.min(100, Math.max(0, ratio * 100));
    let state = 'ok';
    if (b.exceeded || ratio > 1) state = 'exceeded';
    else if (ratio >= 0.9)       state = 'critical';
    else if (ratio >= 0.7)       state = 'warn';
    const remainingLabel = remaining < 0
      ? `Exceeded by ${fmtMoney(Math.abs(remaining))}`
      : `Left ${fmtMoney(remaining)}`;
    const cat = escapeHtml(b.category || 'Uncategorized');
    return `
      <article class="budget-row" data-state="${state}">
        <header class="budget-row__head">
          <h4 class="budget-row__cat">${cat}</h4>
          <span class="budget-row__pct" data-state="${state}">
            ${pct}%${state === 'exceeded' ? ' &middot; OVER' : ''}
          </span>
        </header>
        <svg class="budget-bar" viewBox="0 0 100 6" preserveAspectRatio="none"
             role="img" aria-label="${cat}: ${pct}% of budget used">
          <rect class="budget-bar__track" x="0" y="0" width="100" height="6" />
          <rect class="budget-bar__fill"  x="0" y="0" width="${fillWidth}" height="6"
                data-state="${state}" />
        </svg>
        <p class="budget-row__numbers">
          <span>${fmtMoney(spent)} / ${fmtMoney(limit)}</span>
          <span class="${remaining < 0 ? 'budget-row__over' : ''}">${remainingLabel}</span>
        </p>
      </article>`;
  }

  /* --- SVG Donut chart --- */
  function renderDonut(rows) {
    const svg = $('chart-donut');
    const legend = $('chart-donut-legend');
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    $('donut-total').textContent = total > 0 ? fmtMoneyShort(total) : '—';
    if (!rows.length || total === 0) {
      svg.innerHTML = `<circle cx="100" cy="100" r="70" fill="none" stroke="var(--rule-soft)" stroke-width="22"/>`;
      legend.innerHTML = '<li class="muted">No expenses to chart.</li>';
      return;
    }
    const cx = 100, cy = 100, r = 70, stroke = 22;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    const PALETTE = ['#7a1f1f','#3a3733','#8a6d1a','#1f4a2c','#5e1515','#6e6358','#3a5a72'];
    const segments = rows.map((row, i) => {
      const value = Number(row.total || 0);
      const frac = value / total;
      const dash = circumference * frac;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                    stroke="${row.color || PALETTE[i % PALETTE.length]}"
                    stroke-width="${stroke}"
                    stroke-dasharray="${dash.toFixed(3)} ${circumference}"
                    stroke-dashoffset="${(-offset).toFixed(3)}"
                    transform="rotate(-90 ${cx} ${cy})">
                    <title>${escapeHtml(row.category)}: ${fmtMoney(value)} (${Math.round(frac * 100)}%)</title>
                  </circle>`;
      offset += dash;
      return seg;
    }).join('');
    svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--rule-soft)" stroke-width="${stroke}"/>${segments}`;
    legend.innerHTML = rows.map((row, i) => {
      const value = Number(row.total || 0);
      const frac = total > 0 ? (value / total) * 100 : 0;
      return `<li class="legend-row">
        <span class="legend-swatch" style="background:${row.color || PALETTE[i % PALETTE.length]}"></span>
        <span class="legend-name">${escapeHtml(row.category)}</span>
        <span class="legend-pct">${frac.toFixed(0)}%</span>
        <span class="legend-amt">${fmtMoney(value)}</span>
      </li>`;
    }).join('');
  }

  /* --- SVG Line chart --- */
  function renderLine(rows) {
    const svg = $('chart-line');
    if (!rows.length) { svg.innerHTML = `<text x="200" y="100" text-anchor="middle" fill="var(--muted)">No data</text>`; return; }
    const W = 400, H = 200, P = { l: 40, r: 12, t: 16, b: 28 };
    const innerW = W - P.l - P.r;
    const innerH = H - P.t - P.b;
    const values = rows.map((r) => Number(r.total) || 0);
    const max = Math.max(1, ...values);
    const step = rows.length > 1 ? innerW / (rows.length - 1) : innerW;
    const points = rows.map((r, i) => {
      const x = P.l + i * step;
      const y = P.t + innerH - (values[i] / max) * innerH;
      return { x, y, v: values[i], label: r.period };
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const area = `${path} L${points[points.length - 1].x.toFixed(2)},${(P.t + innerH).toFixed(2)} L${points[0].x.toFixed(2)},${(P.t + innerH).toFixed(2)} Z`;
    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => {
      const y = P.t + innerH - innerH * f;
      const v = max * f;
      return `
        <line x1="${P.l}" y1="${y}" x2="${W - P.r}" y2="${y}" stroke="var(--rule-soft)" stroke-dasharray="2 3"/>
        <text x="${P.l - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${fmtMoneyShort(v)}</text>`;
    }).join('');
    const dots = points.map((p) => `
      <g class="line-point">
        <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="var(--accent)"/>
        <title>${escapeHtml(p.label)}: ${fmtMoney(p.v)}</title>
      </g>`).join('');
    const labels = points.map((p, i) => {
      if (rows.length > 6 && i % 2 !== 0) return '';
      const [, mm] = (p.label || '').split('-');
      const m = Number(mm) || 0;
      return `<text x="${p.x.toFixed(2)}" y="${(H - 8).toFixed(2)}" text-anchor="middle" font-size="10" fill="var(--muted)">${SHORT_MONTHS[m - 1] || ''}</text>`;
    }).join('');
    svg.innerHTML = `
      ${gridLines}
      <path d="${area}" fill="var(--accent)" fill-opacity="0.08"/>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
      ${dots}
      ${labels}`;
  }

  /* --- Recent transactions --- */
  function renderRecent(rows) {
    const ul = $('recent-list');
    if (!rows.length) {
      ul.innerHTML = '<li class="muted">No transactions yet.</li>';
      return;
    }
    ul.innerHTML = rows.map((t) => `
      <li class="recent-row">
        <div class="recent-row__main">
          <span class="recent-row__title">${escapeHtml(t.title)}</span>
          <span class="recent-row__meta">
            ${escapeHtml(t.category || 'Uncategorized')}${t.wallet ? ' &middot; ' + escapeHtml(t.wallet) : ''}
          </span>
        </div>
        <div class="recent-row__date">${escapeHtml(String(t.date).slice(0, 10))}</div>
        <div class="recent-row__amount ${escapeHtml(t.type)}">${t.type === 'expense' ? '−' : '+'}${fmtMoney(t.amount)}</div>
      </li>`).join('');
  }

  /* -------------------- Wiring -------------------- */
  function populateMonthSelects() {
    const opts = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    $('sum-month').innerHTML = opts;
    $('b-month').innerHTML   = opts;
    const now = new Date();
    $('sum-month').value = now.getMonth() + 1;
    $('sum-year').value  = now.getFullYear();
    $('b-month').value   = now.getMonth() + 1;
    $('b-year').value    = now.getFullYear();
  }
  function bindNav() {
    document.querySelectorAll('nav button').forEach((b) => {
      b.addEventListener('click', () => showPage(b.dataset.page));
    });
    document.querySelectorAll('[data-page-link]').forEach((b) => {
      b.addEventListener('click', () => showPage(b.dataset.pageLink));
    });
    document.querySelectorAll('[data-quick]').forEach((b) => {
      b.addEventListener('click', () => {
        const target = b.dataset.quick;
        const map = { transaction: 'transactions', budget: 'budgets', category: 'categories', wallet: 'wallets' };
        const page = map[target] || 'dashboard';
        showPage(page);
        // Focus the first form field on the destination.
        const firstInput = { transactions: 't-title', budgets: 'b-category', categories: 'c-name', wallets: 'w-name' }[page];
        if (firstInput) setTimeout(() => { const el = $(firstInput); if (el) el.focus(); }, 0);
      });
    });
  }
  function bindForms() {
    $('c-form').addEventListener('submit', submitCategory);
    $('t-form').addEventListener('submit', submitTransaction);
    $('b-form').addEventListener('submit', submitBudget);
    $('w-form').addEventListener('submit', submitWallet);
    $('r-form').addEventListener('submit', submitRecurring);
    $('c-cancel').addEventListener('click', resetCategoryForm);
    $('t-cancel').addEventListener('click', resetTransactionForm);
    $('b-cancel').addEventListener('click', resetBudgetForm);
    $('w-cancel').addEventListener('click', resetWalletForm);
    $('r-cancel').addEventListener('click', resetRecurringForm);
  }
  function bindFilters() {
    ['f-type', 'f-cat', 'f-wallet', 'f-start', 'f-end'].forEach((id) => {
      const el = $(id); if (el) el.addEventListener('change', loadTransactions);
    });
    $('f-clear').addEventListener('click', () => {
      $('f-type').value = '';
      $('f-cat').value = '';
      $('f-wallet').value = '';
      $('f-start').value = '';
      $('f-end').value = '';
      loadTransactions();
    });
    $('btn-load-summary').addEventListener('click', loadDashboard);
  }
  function bindListClicks() {
    // Event delegation: one listener per body for all table actions.
    document.body.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      const map = [
        ['edit-cat',       startEditCategory],
        ['delete-cat',     deleteCategory],
        ['edit-tx',        startEditTransaction],
        ['delete-tx',      deleteTransaction],
        ['edit-budget',    startEditBudget],
        ['delete-budget',  deleteBudget],
        ['edit-wallet',    startEditWallet],
        ['delete-wallet',  deleteWallet],
        ['edit-recurring', startEditRecurring],
        ['delete-recurring', deleteRecurring],
      ];
      for (const [key, fn] of map) {
        const v = t.getAttribute(`data-${key}`);
        if (v) { fn(v); return; }
      }
    });
  }

  /* -------------------- Boot -------------------- */
  async function boot() {
    populateMonthSelects();
    activateTab('login');
    bindNav();
    bindForms();
    bindFilters();
    bindListClicks();

    $('login-form').addEventListener('submit', submitLogin);
    $('register-form').addEventListener('submit', submitRegister);
    $('tab-login').addEventListener('click', () => activateTab('login'));
    $('tab-register').addEventListener('click', () => activateTab('register'));
    $('logout-btn').addEventListener('click', doLogout);

    $('t-date').value = new Date().toISOString().slice(0, 10);

    // Attempt silent refresh on boot. If the user has a valid refresh cookie,
    // we get a fresh access token and land straight on the dashboard.
    const ok = await tryRefresh();
    if (ok) {
      try {
        const r = await auth.me();
        if (r && r.user) currentUser = r.user;
      } catch { /* fall through to auth screen */ }
      if (accessToken) { showAppShell(); return; }
    }
    showAuthScreen();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
