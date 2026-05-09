/* WalletLog frontend — vanilla JS SPA. */
(() => {
  'use strict';

  const API = 'http://localhost:3000/api';

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const $ = (id) => document.getElementById(id);

  /* -------------------- Auth state (in-memory only) -------------------- */

  let accessToken = null;
  let currentUser = null;

  const setAccessToken = (t) => { accessToken = t || null; };
  const clearAuth = () => { accessToken = null; currentUser = null; };

  /* -------------------- HTTP helpers -------------------- */

  async function rawFetch(method, url, body, withAuth) {
    const init = { method, headers: {}, credentials: 'include' };
    if (withAuth && accessToken) {
      init.headers['Authorization'] = `Bearer ${accessToken}`;
    }
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
    } catch {
      return false;
    }
  }

  /**
   * Authenticated request with transparent refresh-on-401.
   * Public auth endpoints should not call this.
   */
  async function request(method, url, body) {
    let res = await rawFetch(method, url, body, true);
    if (res.status === 401 && accessToken !== null) {
      const ok = await tryRefresh();
      if (ok) {
        res = await rawFetch(method, url, body, true);
      } else {
        clearAuth();
        showAuthScreen();
        throw new Error('Session expired. Please sign in again.');
      }
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
    getSummary:        (m, y)    => request('GET',    `${API}/transactions/summary${qs({ month: m, year: y })}`),

    listBudgets:       ()        => request('GET',    `${API}/budgets`),
    createBudget:      (b)       => request('POST',   `${API}/budgets`, b),
    updateBudget:      (id, b)   => request('PUT',    `${API}/budgets/${id}`, b),
    deleteBudget:      (id)      => request('DELETE', `${API}/budgets/${id}`),
    getBudgetStatus:   (m, y)    => request('GET',    `${API}/budgets/status${qs({ month: m, year: y })}`),
  };

  function qs(params) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) usp.append(k, v);
    });
    const s = usp.toString();
    return s ? `?${s}` : '';
  }

  /* -------------------- UI helpers -------------------- */

  function toast(message, type = 'success') {
    const el = $('toast');
    el.textContent = message;
    el.className = `toast ${type}`;
    setTimeout(() => { el.className = 'toast'; el.textContent = ''; }, 2800);
  }

  function setError(inputId, message) {
    const input = $(inputId);
    const errEl = document.querySelector(`[data-error-for="${inputId}"]`);
    if (input) input.classList.toggle('invalid', !!message);
    if (errEl) errEl.textContent = message || '';
  }

  function clearErrors(formEl) {
    formEl.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    formEl.querySelectorAll('.error').forEach((el) => { el.textContent = ''; });
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtMoney(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /* -------------------- Validators -------------------- */

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
  const ISO_DATE  = /^\d{4}-\d{2}-\d{2}$/;
  const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function nonEmpty(value, max) {
    if (typeof value !== 'string' || value.trim() === '') return 'This field is required';
    if (max && value.trim().length > max) return `Must be at most ${max} characters`;
    return null;
  }

  function positiveNumber(value) {
    if (value === '' || value === null || value === undefined) return 'This field is required';
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 'Must be a number greater than zero';
    return null;
  }

  function validISODate(value) {
    if (!value) return 'Date is required';
    if (!ISO_DATE.test(value) || isNaN(Date.parse(value))) return 'Invalid date';
    return null;
  }

  function validYear(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1900 || n > 2999) return 'Year must be between 1900 and 2999';
    return null;
  }

  function validHexColor(value) {
    if (!value) return null;
    if (!HEX_COLOR.test(value)) return 'Invalid color (use #RRGGBB)';
    return null;
  }

  function validEmail(value) {
    if (typeof value !== 'string' || value.trim() === '') return 'Email is required';
    if (!EMAIL_RE.test(value.trim())) return 'Email format is invalid';
    if (value.trim().length > 254) return 'Email is too long';
    return null;
  }

  function validNewPassword(value) {
    if (typeof value !== 'string' || value.length === 0) return 'Password is required';
    if (value.length < 8)  return 'Password must be at least 8 characters';
    if (value.length > 72) return 'Password must be at most 72 characters';
    if (!/[A-Za-z]/.test(value)) return 'Password must include a letter';
    if (!/\d/.test(value))       return 'Password must include a digit';
    return null;
  }

  /* -------------------- Auth screen -------------------- */

  function showAuthScreen() {
    $('app-root').classList.add('hidden');
    $('auth-root').classList.remove('hidden');
    activateTab('login');
  }

  function showAppShell() {
    $('auth-root').classList.add('hidden');
    $('app-root').classList.remove('hidden');
    if (currentUser) {
      $('who').textContent = currentUser.display_name
        ? `${currentUser.display_name} (${currentUser.email})`
        : currentUser.email;
    }
    showPage('dashboard');
  }

  function activateTab(name) {
    const isLogin = name === 'login';
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
    if (!pw) { setError('login-password', 'Password is required'); ok = false; }
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
      const result = await auth.register({
        email: email.trim(),
        password: pw,
        displayName: display ? display.trim() : undefined,
      });
      setAccessToken(result.accessToken);
      currentUser = result.user;
      $('register-form').reset();
      toast(`Account created — welcome ${currentUser.email}`);
      showAppShell();
    } catch (err) {
      toast(err.message || 'Registration failed', 'error');
    }
  }

  async function doLogout() {
    try { await auth.logout(); } catch { /* ignore */ }
    clearAuth();
    showAuthScreen();
    toast('Signed out');
  }

  /* -------------------- Navigation -------------------- */

  function showPage(id) {
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === id));
    document.querySelectorAll('nav button').forEach((b) =>
      b.classList.toggle('active', b.dataset.page === id));

    if (id === 'transactions') { loadCategoriesIntoSelects(); loadTransactions(); }
    if (id === 'categories')   loadCategories();
    if (id === 'budgets')      { loadCategoriesIntoSelects(); loadBudgets(); }
    if (id === 'dashboard')    loadDashboard();
  }

  /* -------------------- Categories -------------------- */

  let categoryCache = [];

  async function loadCategories() {
    try {
      const data = await api.listCategories();
      categoryCache = data;
      $('category-list').innerHTML = data.length === 0
        ? '<tr><td colspan="3" class="muted">No categories yet</td></tr>'
        : data.map((c) => `
            <tr>
              <td><span class="color-swatch" style="background:${escapeHtml(c.color)}"></span></td>
              <td>${escapeHtml(c.name)}</td>
              <td class="btn-row">
                <button class="btn btn-ghost"  data-edit-category="${c.id}">Edit</button>
                <button class="btn btn-danger" data-delete-category="${c.id}">Delete</button>
              </td>
            </tr>`).join('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function loadCategoriesIntoSelects() {
    try {
      const data = await api.listCategories();
      categoryCache = data;
      const optsNoneFirst = '<option value="">No Category</option>' +
        data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      $('t-category').innerHTML = optsNoneFirst;
      $('f-cat').innerHTML = '<option value="">All Categories</option>' +
        data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      $('b-category').innerHTML = data.length === 0
        ? '<option value="">— create a category first —</option>'
        : data.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function validateCategoryForm() {
    const name  = $('c-name').value;
    const color = $('c-color').value;
    let ok = true;
    const nameErr = nonEmpty(name, 100);
    setError('c-name', nameErr); if (nameErr) ok = false;
    const colorErr = validHexColor(color);
    if (colorErr) { toast(colorErr, 'error'); ok = false; }
    return ok ? { name: name.trim(), color } : null;
  }

  async function submitCategory(e) {
    e.preventDefault();
    clearErrors($('c-form'));
    const payload = validateCategoryForm();
    if (!payload) return;
    const id = $('c-id').value;
    try {
      if (id) {
        await api.updateCategory(id, payload);
        toast('Category updated');
      } else {
        await api.createCategory(payload);
        toast('Category created');
      }
      resetCategoryForm();
      loadCategories();
    } catch (e2) {
      toast(e2.message, 'error');
    }
  }

  function resetCategoryForm() {
    $('c-form').reset();
    $('c-id').value = '';
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

  async function removeCategory(id) {
    if (!confirm('Delete this category? Transactions in it will be unlinked.')) return;
    try {
      await api.deleteCategory(id);
      toast('Category deleted');
      loadCategories();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* -------------------- Transactions -------------------- */

  let transactionCache = [];

  async function loadTransactions() {
    try {
      const filters = {
        type:        $('f-type').value,
        category_id: $('f-cat').value,
        startDate:   $('f-start').value,
        endDate:     $('f-end').value,
      };
      const data = await api.listTransactions(filters);
      transactionCache = data;
      $('transaction-list').innerHTML = data.length === 0
        ? '<tr><td colspan="6" class="muted">No transactions found</td></tr>'
        : data.map((t) => `
          <tr>
            <td>${escapeHtml(String(t.date).slice(0, 10))}</td>
            <td>${escapeHtml(t.title)}</td>
            <td>${escapeHtml(t.category_name || '-')}</td>
            <td class="${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</td>
            <td class="${t.type}">${fmtMoney(t.amount)}</td>
            <td class="btn-row">
              <button class="btn btn-ghost"  data-edit-transaction="${t.id}">Edit</button>
              <button class="btn btn-danger" data-delete-transaction="${t.id}">Delete</button>
            </td>
          </tr>`).join('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function validateTransactionForm() {
    const title  = $('t-title').value;
    const amount = $('t-amount').value;
    const type   = $('t-type').value;
    const date   = $('t-date').value;
    const note   = $('t-note').value;
    const categoryId = $('t-category').value || null;

    let ok = true;
    const titleErr = nonEmpty(title, 200);
    setError('t-title', titleErr); if (titleErr) ok = false;
    const amountErr = positiveNumber(amount);
    setError('t-amount', amountErr); if (amountErr) ok = false;
    const dateErr = validISODate(date);
    setError('t-date', dateErr); if (dateErr) ok = false;

    if (!ok) return null;
    return {
      title: title.trim(),
      amount: Number(amount),
      type,
      date,
      category_id: categoryId,
      note: note.trim() || null,
    };
  }

  async function submitTransaction(e) {
    e.preventDefault();
    clearErrors($('t-form'));
    const payload = validateTransactionForm();
    if (!payload) return;
    const id = $('t-id').value;
    try {
      if (id) {
        await api.updateTransaction(id, payload);
        toast('Transaction updated');
      } else {
        await api.createTransaction(payload);
        toast('Transaction created');
      }
      resetTransactionForm();
      loadTransactions();
    } catch (e2) {
      toast(e2.message, 'error');
    }
  }

  function resetTransactionForm() {
    $('t-form').reset();
    $('t-id').value = '';
    $('t-date').value = todayISO();
    $('t-form-title').textContent = 'Add Transaction';
    $('t-cancel').classList.add('hidden');
    clearErrors($('t-form'));
  }

  function startEditTransaction(id) {
    const t = transactionCache.find((x) => String(x.id) === String(id));
    if (!t) return;
    $('t-id').value = t.id;
    $('t-title').value = t.title;
    $('t-amount').value = t.amount;
    $('t-type').value = t.type;
    $('t-category').value = t.category_id || '';
    $('t-date').value = String(t.date).slice(0, 10);
    $('t-note').value = t.note || '';
    $('t-form-title').textContent = `Edit Transaction: ${t.title}`;
    $('t-cancel').classList.remove('hidden');
    $('t-title').focus();
  }

  async function removeTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      toast('Transaction deleted');
      loadTransactions();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* -------------------- Budgets -------------------- */

  let budgetCache = [];

  async function loadBudgets() {
    try {
      const data = await api.listBudgets();
      budgetCache = data;
      $('budget-list').innerHTML = data.length === 0
        ? '<tr><td colspan="4" class="muted">No budgets yet</td></tr>'
        : data.map((b) => `
          <tr>
            <td>${escapeHtml(b.category_name || '-')}</td>
            <td>${MONTHS[b.month - 1]} ${b.year}</td>
            <td>${fmtMoney(b.limit_amount)}</td>
            <td class="btn-row">
              <button class="btn btn-ghost"  data-edit-budget="${b.id}">Edit</button>
              <button class="btn btn-danger" data-delete-budget="${b.id}">Delete</button>
            </td>
          </tr>`).join('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function validateBudgetForm(isEdit) {
    const categoryId = $('b-category').value;
    const month      = $('b-month').value;
    const year       = $('b-year').value;
    const limit      = $('b-limit').value;

    let ok = true;
    if (!isEdit) {
      if (!categoryId) {
        setError('b-category', 'Pick a category'); ok = false;
      } else {
        setError('b-category', '');
      }
    }
    const yearErr = validYear(year);
    setError('b-year', yearErr); if (yearErr) ok = false;
    const limitErr = positiveNumber(limit);
    setError('b-limit', limitErr); if (limitErr) ok = false;

    if (!ok) return null;
    if (isEdit) return { limit_amount: Number(limit) };
    return {
      category_id: Number(categoryId),
      month: Number(month),
      year: Number(year),
      limit_amount: Number(limit),
    };
  }

  async function submitBudget(e) {
    e.preventDefault();
    clearErrors($('b-form'));
    const id = $('b-id').value;
    const payload = validateBudgetForm(Boolean(id));
    if (!payload) return;
    try {
      if (id) {
        await api.updateBudget(id, payload);
        toast('Budget updated');
      } else {
        await api.createBudget(payload);
        toast('Budget created');
      }
      resetBudgetForm();
      loadBudgets();
    } catch (e2) {
      toast(e2.message, 'error');
    }
  }

  function resetBudgetForm() {
    $('b-form').reset();
    $('b-id').value = '';
    const now = new Date();
    $('b-month').value = now.getMonth() + 1;
    $('b-year').value  = now.getFullYear();
    $('b-form-title').textContent = 'Add Budget';
    $('b-cancel').classList.add('hidden');
    $('b-category').disabled = false;
    $('b-month').disabled = false;
    clearErrors($('b-form'));
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
    $('b-category').disabled = true;
    $('b-month').disabled = true;
    $('b-limit').focus();
  }

  async function removeBudget(id) {
    if (!confirm('Delete this budget?')) return;
    try {
      await api.deleteBudget(id);
      toast('Budget deleted');
      loadBudgets();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  /* -------------------- Dashboard -------------------- */

  async function loadDashboard() {
    const month = $('sum-month').value;
    const year  = $('sum-year').value;
    const yErr = validYear(year);
    if (yErr) { toast(yErr, 'error'); return; }
    try {
      const [summary, status] = await Promise.all([
        api.getSummary(month, year),
        api.getBudgetStatus(month, year),
      ]);
      $('sum-income').textContent  = fmtMoney(summary.income);
      $('sum-expense').textContent = fmtMoney(summary.expense);
      const balEl = $('sum-balance');
      balEl.textContent = fmtMoney(summary.balance);
      balEl.className = summary.balance >= 0 ? 'income' : 'expense';

      const container = $('budget-status-list');
      container.innerHTML = status.length === 0
        ? '<div class="card muted">No budgets set for this month.</div>'
        : status.map((b) => `
          <div class="card">
            <h3>${escapeHtml(b.category)} ${b.exceeded ? '— BUDGET EXCEEDED' : ''}</h3>
            <p>
              Limit: <strong>${fmtMoney(b.limit)}</strong> &nbsp;|&nbsp;
              Spent: <span class="${b.exceeded ? 'warning' : 'expense'}">${fmtMoney(b.spent)}</span> &nbsp;|&nbsp;
              Remaining: <span class="${b.remaining >= 0 ? 'income' : 'warning'}">${fmtMoney(b.remaining)}</span>
            </p>
          </div>`).join('');
    } catch (e) {
      toast(e.message, 'error');
    }
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
  }

  function bindForms() {
    $('c-form').addEventListener('submit', submitCategory);
    $('t-form').addEventListener('submit', submitTransaction);
    $('b-form').addEventListener('submit', submitBudget);
    $('c-cancel').addEventListener('click', resetCategoryForm);
    $('t-cancel').addEventListener('click', resetTransactionForm);
    $('b-cancel').addEventListener('click', resetBudgetForm);
  }

  function bindFilters() {
    ['f-type', 'f-cat', 'f-start', 'f-end'].forEach((id) => {
      $(id).addEventListener('change', loadTransactions);
    });
    $('f-clear').addEventListener('click', () => {
      $('f-type').value = '';
      $('f-cat').value = '';
      $('f-start').value = '';
      $('f-end').value = '';
      loadTransactions();
    });
    $('btn-load-summary').addEventListener('click', loadDashboard);
  }

  function bindAuth() {
    $('login-form').addEventListener('submit', submitLogin);
    $('register-form').addEventListener('submit', submitRegister);
    $('tab-login').addEventListener('click', () => activateTab('login'));
    $('tab-register').addEventListener('click', () => activateTab('register'));
    $('logout-btn').addEventListener('click', doLogout);
  }

  function bindTableActions() {
    document.body.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.dataset.editCategory)     return startEditCategory(t.dataset.editCategory);
      if (t.dataset.deleteCategory)   return removeCategory(t.dataset.deleteCategory);
      if (t.dataset.editTransaction)  return startEditTransaction(t.dataset.editTransaction);
      if (t.dataset.deleteTransaction) return removeTransaction(t.dataset.deleteTransaction);
      if (t.dataset.editBudget)       return startEditBudget(t.dataset.editBudget);
      if (t.dataset.deleteBudget)     return removeBudget(t.dataset.deleteBudget);
    });
  }

  /* -------------------- Boot -------------------- */

  async function boot() {
    populateMonthSelects();
    $('t-date').value = todayISO();
    bindNav();
    bindForms();
    bindFilters();
    bindAuth();
    bindTableActions();

    // Try silent refresh using the httpOnly cookie. If that succeeds we land
    // straight on the dashboard; otherwise we show the auth screen.
    const refreshed = await tryRefresh();
    if (refreshed) {
      try {
        const me = await auth.me();
        currentUser = me.user;
        showAppShell();
        return;
      } catch {
        clearAuth();
      }
    }
    showAuthScreen();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
