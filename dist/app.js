/* ═══════════════════════════════════════════════════════════════════
   portal.forense.io — Single Page Application
   a ness. company · Plataforma de Inteligência Corporativa
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────
  // STATE
  // ────────────────────────────────────────────────────────────────
  const state = {
    user: null,
    projects: [],
    currentProject: null,
    currentTab: 'entregas',
    sidebarOpen: false,
    loading: true,
  };

  // ────────────────────────────────────────────────────────────────
  // CONFIG
  // ────────────────────────────────────────────────────────────────
  const API_BASE = '/api';
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
  ];

  // ────────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).replace('.', '');
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace('.', '');
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatCurrency(value) {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function statusLabel(status) {
    const labels = {
      em_andamento: 'Em andamento',
      entregue: 'Entregue',
      proposta: 'Proposta',
      arquivado: 'Arquivado',
      pendente: 'Pendente',
      confirmado: 'Confirmado',
      ativo: 'Ativo',
      inativo: 'Inativo',
      rejeitado: 'Rejeitado',
      risco_alto: 'Risco Alto',
    };
    return labels[status] || status || '—';
  }

  // — SVG Icon Helpers —
  const SVG_ICONS = {
    home: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg>`,
    stats: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='12' width='4' height='9' rx='1'/><rect x='10' y='7' width='4' height='14' rx='1'/><rect x='17' y='3' width='4' height='18' rx='1'/></svg>`,
    users: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'/></svg>`,
    folder: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z'/></svg>`,
    folderOpen: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z'/></svg>`,
    file: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>`,
    fileText: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/></svg>`,
    upload: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='16 16 12 12 8 16'/><line x1='12' y1='12' x2='12' y2='21'/><path d='M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3'/></svg>`,
    download: `<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/></svg>`,
    calendar: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>`,
    refresh: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='23 4 23 10 17 10'/><path d='M20.49 15a9 9 0 11-2.12-9.36L23 10'/></svg>`,
    send: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><line x1='22' y1='2' x2='11' y2='13'/><polygon points='22 2 15 22 11 13 2 9 22 2'/></svg>`,
    message: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/></svg>`,
    dollar: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><line x1='12' y1='1' x2='12' y2='23'/><path d='M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'/></svg>`,
    pin: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z'/><circle cx='12' cy='10' r='3'/></svg>`,
    rocket: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z'/><path d='M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z'/></svg>`,
    paperclip: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48'/></svg>`,
    image: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>`,
    archive: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='21 8 21 21 3 21 3 8'/><rect x='1' y='3' width='22' height='5'/><line x1='10' y1='12' x2='14' y2='12'/></svg>`,
    briefcase: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='7' width='20' height='14' rx='2'/><path d='M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16'/></svg>`,
    clipboard: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2'/><rect x='8' y='2' width='8' height='4' rx='1'/></svg>`,
    inbox: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='22 12 16 12 14 15 10 15 8 12 2 12'/><path d='M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z'/></svg>`,
    settings: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z'/></svg>`,
    logout: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9'/></svg>`,
    bell: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0'/></svg>`,
    database: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><ellipse cx='12' cy='5' rx='9' ry='3'/><path d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'/><path d='M3 12c0 1.66 4 3 9 3s9-1.34 9-3'/></svg>`,
    hamburger: `<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6h16M4 12h16M4 18h16'/></svg>`,
    spreadsheet: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2'/><line x1='3' y1='9' x2='21' y2='9'/><line x1='3' y1='15' x2='21' y2='15'/><line x1='9' y1='3' x2='9' y2='21'/></svg>`,
    presentation: `<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><rect x='2' y='3' width='20' height='14' rx='2'/><line x1='8' y1='21' x2='16' y2='21'/><line x1='12' y1='17' x2='12' y2='21'/></svg>`,
  };

  function deliverableIcon(tipo) {
    const icons = {
      relatorio: SVG_ICONS.fileText,
      apresentacao: SVG_ICONS.presentation,
      proposta: SVG_ICONS.briefcase,
      planilha: SVG_ICONS.spreadsheet,
      outro: SVG_ICONS.paperclip,
    };
    return icons[tipo] || SVG_ICONS.paperclip;
  }

  function timelineIcon(tipo) {
    const icons = {
      entrega: SVG_ICONS.fileText,
      upload: SVG_ICONS.upload,
      inicio: SVG_ICONS.rocket,
      status: SVG_ICONS.refresh,
      comentario: SVG_ICONS.message,
      pagamento: SVG_ICONS.dollar,
    };
    return icons[tipo] || SVG_ICONS.pin;
  }

  function fileExtIcon(filename) {
    if (!filename) return SVG_ICONS.paperclip;
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      pdf: SVG_ICONS.file, doc: SVG_ICONS.fileText, docx: SVG_ICONS.fileText,
      xls: SVG_ICONS.spreadsheet, xlsx: SVG_ICONS.spreadsheet,
      ppt: SVG_ICONS.presentation, pptx: SVG_ICONS.presentation,
      jpg: SVG_ICONS.image, jpeg: SVG_ICONS.image, png: SVG_ICONS.image,
      webp: SVG_ICONS.image, txt: SVG_ICONS.fileText,
      zip: SVG_ICONS.archive, rar: SVG_ICONS.archive,
    };
    return map[ext] || SVG_ICONS.paperclip;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ────────────────────────────────────────────────────────────────
  // API CLIENT
  // ────────────────────────────────────────────────────────────────
  const api = {
    async request(method, path, body) {
      const opts = {
        method,
        credentials: 'include',
        headers: {},
      };
      if (body && !(body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      } else if (body instanceof FormData) {
        opts.body = body;
      }

      try {
        const res = await fetch(`${API_BASE}${path}`, opts);

        if (res.status === 401) {
          // Not authenticated — show login screen
          if (!document.getElementById('login-screen')) {
            showLoginScreen();
          }
          return null;
        }

        if (res.status === 403) {
          showToast('Acesso negado.', 'error');
          return null;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
          showToast(err.message || `Erro ${res.status}`, 'error');
          return null;
        }

        if (res.status === 204) return {};
        return await res.json();
      } catch (e) {
        showToast('Erro de conexão. Tente novamente.', 'error');
        console.error('API Error:', e);
        return null;
      }
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    put(path, body) { return this.request('PUT', path, body); },
    delete(path) { return this.request('DELETE', path); },
  };

  // ────────────────────────────────────────────────────────────────
  // TOAST NOTIFICATIONS
  // ────────────────────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
  }

  // ────────────────────────────────────────────────────────────────
  // MODAL
  // ────────────────────────────────────────────────────────────────
  function openModal(title, contentHtml, footerHtml = '') {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${escapeHtml(title)}</h3>
          <button class="modal-close" onclick="window.__closeModal()" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">${contentHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Close on backdrop click
    overlay.onclick = (e) => {
      if (e.target === overlay) window.__closeModal();
    };

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        window.__closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  window.__closeModal = function () {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
    }, 200);
  };

  // ────────────────────────────────────────────────────────────────
  // ROUTER
  // ────────────────────────────────────────────────────────────────
  const routes = {
    '/dashboard': { view: renderDashboard, auth: true, admin: false },
    '/projeto/:id': { view: renderProjectDetail, auth: true, admin: false },
    '/admin': { view: renderAdminDashboard, auth: true, admin: true },
    '/admin/clientes': { view: renderAdminClientes, auth: true, admin: true },
    '/admin/projetos': { view: renderAdminProjetos, auth: true, admin: true },
  };

  function parseRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    // Match /projeto/:id
    const projectMatch = hash.match(/^\/projeto\/(.+)$/);
    if (projectMatch) {
      return { path: '/projeto/:id', params: { id: projectMatch[1] } };
    }
    return { path: hash, params: {} };
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  async function handleRoute() {
    const { path, params } = parseRoute();
    const route = routes[path];

    if (!route) {
      navigate('/dashboard');
      return;
    }

    // Auth guard
    if (route.auth && !state.user) {
      showLoginScreen();
      return;
    }

    // Admin guard
    if (route.admin && state.user && state.user.role !== 'admin') {
      showToast('Acesso restrito a administradores.', 'error');
      navigate('/dashboard');
      return;
    }

    // Close sidebar on mobile
    closeSidebar();

    // Re-render shell with active state
    renderShell();

    // Render the page content
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = renderLoading();
      try {
        const html = await route.view(params);
        content.innerHTML = '';
        content.innerHTML = html;
        // Re-animate
        content.style.animation = 'none';
        content.offsetHeight; // trigger reflow
        content.style.animation = '';
        // Bind page-specific events
        bindPageEvents(path, params);
      } catch (e) {
        console.error('View error:', e);
        content.innerHTML = renderEmpty('Erro ao carregar a página.');
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // PAGE TITLE HELPER
  // ────────────────────────────────────────────────────────────────
  function getPageTitle() {
    const { path, params } = parseRoute();
    if (path === '/dashboard') return 'Overview';
    if (path === '/admin') return 'Painel Admin';
    if (path === '/admin/clientes') return 'Clientes';
    if (path === '/admin/projetos') return 'Projetos';
    if (path === '/projeto/:id' && state.currentProject) {
      const code = state.currentProject.codigo_proposta || state.currentProject.code || '';
      const title = state.currentProject.titulo || state.currentProject.title || '';
      return code ? `${code} — ${title}` : title;
    }
    return 'Portal';
  }

  // ────────────────────────────────────────────────────────────────
  // COMPONENTS
  // ────────────────────────────────────────────────────────────────
  function renderHeader() {
    if (!state.user) return '';
    const initials = getInitials(state.user.nome || state.user.name);
    const pageTitle = getPageTitle();
    const isAdmin = state.user.role === 'admin';
    const userName = escapeHtml(state.user.nome || state.user.name || '');
    const userEmail = escapeHtml(state.user.email || '');
    const userRole = isAdmin ? 'Administrador' : 'Cliente';

    return `
    <header class="header" style="height:64px;min-height:64px;">
      <div class="header-left">
        <button class="hamburger" onclick="window.__toggleSidebar()" aria-label="Menu">${SVG_ICONS.hamburger}</button>
        <div class="header-title">${escapeHtml(pageTitle)}</div>
      </div>
      <div class="header-right" style="position:relative; display:flex; align-items:center; gap:var(--space-12);">
        <!-- Database/Cluster Status Icon (Operational) -->
        <span class="header-status-icon text-success" title="Plataforma Operacional" style="display:flex;align-items:center;color:var(--success);opacity:0.85;cursor:pointer;" onclick="showToast('Banco de dados e serviços operacionais.', 'success')">
          ${SVG_ICONS.database}
        </span>
        <!-- Bell Notification Icon -->
        <button class="header-icon-btn" aria-label="Notificações" onclick="showToast('Nenhuma notificação nova.', 'info')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:var(--space-4);display:flex;align-items:center;">
          ${SVG_ICONS.bell}
        </button>
        <!-- User Avatar Circle -->
        <div class="header-avatar" onclick="window.__toggleHeaderProfile(event)" style="width:32px;height:32px;border-radius:var(--radius-full);background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-muted);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;text-transform:uppercase;cursor:pointer;flex-shrink:0;">
          ${initials}
        </div>
        
        <!-- Header Profile Dropdown -->
        <div class="user-dropdown" id="header-user-dropdown" onclick="event.stopPropagation()" style="position: absolute; top: calc(100% + 8px); right: 0; width: 260px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6); display: none; z-index: 1000; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-16); flex-direction: column; gap: var(--space-16); text-align: left;">
          <div class="dropdown-header">Perfil</div>
          <div class="dropdown-field">
            <label>Nome</label>
            <input id="header-edit-name" type="text" value="${userName}" class="form-input" style="margin-top:4px;" />
          </div>
          <div class="dropdown-field">
            <label>Email</label>
            <span class="dropdown-value">${userEmail}</span>
          </div>
          <div class="dropdown-field">
            <label>Papel</label>
            <span class="dropdown-value">${userRole}</span>
          </div>
          <div class="dropdown-actions">
            <button onclick="event.stopPropagation(); window.__saveHeaderProfile()" class="btn btn-primary btn-sm" style="width:100%;">Salvar</button>
          </div>
        </div>
      </div>
    </header>`;
  }

  function renderSidebar() {
    if (!state.user) return '';
    const { path } = parseRoute();
    const isAdmin = state.user.role === 'admin';
    const initials = getInitials(state.user.nome || state.user.name);
    const userName = escapeHtml(state.user.nome || state.user.name || '');
    const userEmail = escapeHtml(state.user.email || '');
    const userRole = isAdmin ? 'Administrador' : 'Cliente';

    const clientLinks = [
      { href: '#/dashboard', icon: SVG_ICONS.home, label: 'Overview', match: '/dashboard' },
    ];

    const adminLinks = [
      { href: '#/admin', icon: SVG_ICONS.stats, label: 'Painel Admin', match: '/admin' },
      { href: '#/admin/clientes', icon: SVG_ICONS.users, label: 'Clientes', match: '/admin/clientes' },
      { href: '#/admin/projetos', icon: SVG_ICONS.folder, label: 'Projetos', match: '/admin/projetos' },
    ];

    const renderLink = (link) => {
      const isActive = path === link.match || path.startsWith(link.match + '/');
      return `
        <li>
          <a href="${link.href}" class="nav-link ${isActive ? 'active' : ''}">
            <span class="nav-icon">${link.icon}</span>
            ${link.label}
            ${link.badge ? `<span class="nav-badge">${link.badge}</span>` : ''}
          </a>
        </li>`;
    };

    return `
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="window.__closeSidebar()"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="header-brand" onclick="navigate('/dashboard')">
          <span class="logo" style="font-size: 1.2rem; display: block;">forense<span class="dot">.</span>io</span>
          <span class="logo-sub" style="font-size: 0.65rem; display: block;">a <span class="ness">ness<span class="dot">.</span></span> company</span>
        </div>
      </div>
      <div class="sidebar-nav-wrapper">
        <nav>
          <div class="sidebar-section">Portal</div>
          <ul class="sidebar-nav">
            ${clientLinks.map(renderLink).join('')}
          </ul>
          ${isAdmin ? `
          <div class="sidebar-section">Administração</div>
          <ul class="sidebar-nav">
            ${adminLinks.map(renderLink).join('')}
          </ul>` : ''}
        </nav>
      </div>

      <!-- User Profile Card in Sidebar Bottom -->
      <div class="sidebar-user-card" onclick="window.__toggleProfile(event)">
        <div class="user-avatar">${initials}</div>
        <div class="user-meta">
          <span class="user-name">${userName}</span>
          <span class="user-email">${userEmail}</span>
        </div>
        <span class="user-badge">${isAdmin ? 'admin' : 'cliente'}</span>

        <!-- Absolute positioned dropdown inside sidebar user card -->
        <div class="user-dropdown" id="user-dropdown" onclick="event.stopPropagation()">
          <div class="dropdown-header">Perfil</div>
          <div class="dropdown-field">
            <label>Nome</label>
            <input id="edit-name" type="text" value="${userName}" class="form-input" style="margin-top:4px;" />
          </div>
          <div class="dropdown-field">
            <label>Email</label>
            <span class="dropdown-value">${userEmail}</span>
          </div>
          <div class="dropdown-field">
            <label>Papel</label>
            <span class="dropdown-value">${userRole}</span>
          </div>
          <div class="dropdown-actions">
            <button onclick="event.stopPropagation(); window.__saveProfile()" class="btn btn-primary btn-sm" style="width:100%;">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Footer settings / logout links -->
      <div class="sidebar-footer-links">
        <a href="javascript:void(0)" onclick="showToast('Configurações do sistema.', 'info')" class="sidebar-footer-link">
          ${SVG_ICONS.settings} Configurações
        </a>
        <a href="javascript:void(0)" onclick="window.__logout()" class="sidebar-footer-link">
          ${SVG_ICONS.logout} Sair
        </a>
      </div>
    </aside>`;
  }

  function renderLoading() {
    return `
    <div class="loading-container">
      <div class="spinner"></div>
      <span class="loading-text">Carregando...</span>
    </div>`;
  }

  function renderEmpty(message, icon) {
    const emptyIcon = icon || SVG_ICONS.inbox;
    return `
    <div class="empty-state">
      <span class="empty-icon" style="opacity:0.4;">${emptyIcon}</span>
      <div class="empty-title">${escapeHtml(message)}</div>
      <div class="empty-desc">Não há dados para exibir no momento.</div>
    </div>`;
  }

  function renderBadge(status) {
    return `<span class="badge badge-${status}">${statusLabel(status)}</span>`;
  }

  function renderProjectCard(project) {
    const code = project.codigo_proposta || project.code || '—';
    const title = project.titulo || project.title || 'Sem título';
    const client = project.cliente_nome || project.client || '';
    const status = project.status || 'proposta';
    const date = formatDate(project.updated_at || project.created_at);
    const deliverables = project.entregas_count || project.deliverables || 0;
    const uploads = project.uploads_count || project.uploads || 0;
    const id = project.id;

    return `
    <div class="project-card" onclick="navigate('/projeto/${id}')">
      <div class="project-card-header">
        <div>
          <div class="project-label">Proposta</div>
          <div class="project-code">${escapeHtml(code)}</div>
        </div>
        ${renderBadge(status)}
      </div>
      <div class="project-title">${escapeHtml(title)}</div>
      <div class="project-client">${escapeHtml(client)}</div>
      <div class="project-footer">
        <div class="project-date">${date}</div>
        <div class="project-counts">
          <span>${SVG_ICONS.file} ${deliverables}</span>
          <span>${SVG_ICONS.upload} ${uploads}</span>
        </div>
      </div>
    </div>`;
  }

  function renderTimeline(events) {
    if (!events || events.length === 0) {
      return renderEmpty('Nenhum evento registrado.', SVG_ICONS.calendar);
    }

    return `
    <div class="timeline">
      ${events.map((e) => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-date">${formatDateTime(e.created_at || e.date)}</div>
          <div class="timeline-title">
            ${timelineIcon(e.tipo || e.type)} ${escapeHtml(e.titulo || e.title || '')}
          </div>
          <div class="timeline-desc">${escapeHtml(e.descricao || e.description || '')}</div>
        </div>
      `).join('')}
    </div>`;
  }

  function renderUploadZone(projectId) {
    return `
    <div class="upload-zone" id="upload-zone"
         ondragover="window.__dragOver(event)"
         ondragleave="window.__dragLeave(event)"
         ondrop="window.__drop(event, '${projectId}')">
      <input type="file" id="file-input"
             accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
             onchange="window.__fileSelected(event, '${projectId}')"
             multiple>
      <span class="upload-zone-icon">${SVG_ICONS.upload}</span>
      <div class="upload-zone-text">Arraste arquivos aqui</div>
      <div class="upload-zone-sub">ou clique para selecionar · PDF, JPG, PNG, DOC · Máx 50MB</div>
    </div>
    <div id="upload-progress" class="upload-progress hidden"></div>`;
  }

  function renderFileItem(file) {
    const name = file.nome_original || file.filename || file.name || '—';
    const size = formatFileSize(file.tamanho || file.size);
    const date = formatDate(file.created_at || file.uploaded_at);
    const status = file.status || 'pendente';
    const icon = fileExtIcon(name);

    return `
    <div class="file-item">
      <div class="file-icon">${icon}</div>
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="file-meta">
          <span class="mono">${size}</span>
          <span>${date}</span>
        </div>
      </div>
      ${renderBadge(status)}
      <div class="file-actions">
        ${file.url ? `<a href="${file.url}" target="_blank" class="btn btn-ghost btn-sm" aria-label="Download">${SVG_ICONS.download}</a>` : ''}
      </div>
    </div>`;
  }

  // ────────────────────────────────────────────────────────────────
  // SHELL
  // ────────────────────────────────────────────────────────────────
  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="app-layout">
        ${renderHeader()}
        ${renderSidebar()}
        <div class="content-wrapper">
          <main class="content" id="page-content">
            ${renderLoading()}
          </main>
        </div>
      </div>
    `;
  }

  // ────────────────────────────────────────────────────────────────
  // PAGES
  // ────────────────────────────────────────────────────────────────

  // — DASHBOARD (Client View) ——————————————————————————————————
  async function renderDashboard() {
    const data = await api.get('/projetos');
    if (!data) return renderEmpty('Erro ao carregar projetos.');

    state.projects = Array.isArray(data) ? data : (data.projects || data.data || []);

    const nome = state.user.nome || state.user.name || '';
    const firstName = nome.split(' ')[0];

    if (state.projects.length === 0) {
      return `
        <div class="page-content-header" style="border-bottom:1px solid var(--border);padding-bottom:var(--space-20);margin-bottom:var(--space-24);">
          <p class="page-subtitle" style="font-size:14px;color:var(--text-secondary);margin:0 0 var(--space-12) 0;">Visão geral dos relatórios de inteligência</p>
          <p class="page-greeting" style="font-size:13px;color:var(--text-muted);margin:0;">Olá, ${escapeHtml(firstName)}. Contexto corporativo ativo para ${escapeHtml(state.user.empresa || 'ness.')}.</p>
        </div>
        ${renderEmpty('Nenhum projeto encontrado.', SVG_ICONS.folderOpen)}
      `;
    }

    return `
      <div class="page-content-header" style="border-bottom:1px solid var(--border);padding-bottom:var(--space-20);margin-bottom:var(--space-24);">
        <p class="page-subtitle" style="font-size:14px;color:var(--text-secondary);margin:0 0 var(--space-12) 0;">Status dos projetos e resumos de atividades</p>
        <p class="page-greeting" style="font-size:13px;color:var(--text-muted);margin:0;">Olá, ${escapeHtml(firstName)}. Contexto corporativo ativo para ${escapeHtml(state.user.empresa || 'ness.')}.</p>
      </div>
      <div class="project-grid">
        ${state.projects.map(renderProjectCard).join('')}
      </div>
    `;
  }

  // — PROJECT DETAIL ————————————————————————————————————————————
  async function renderProjectDetail(params) {
    const data = await api.get(`/projetos/${params.id}`);
    if (!data) return renderEmpty('Projeto não encontrado.');

    state.currentProject = data;
    const p = data;
    const code = p.codigo_proposta || p.code || '—';
    const title = p.titulo || p.title || 'Sem título';
    const status = p.status || 'proposta';
    const tab = state.currentTab;

    return `
      <div class="page-content-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border); padding-bottom:var(--space-20); margin-bottom:var(--space-24);">
        <div>
          <p class="page-subtitle">
            ${renderBadge(status)}
            <span class="mono" style="margin-left:8px;">${escapeHtml(code)}</span>
            ${p.cliente_nome ? ` · ${escapeHtml(p.cliente_nome)}` : ''}
            ${p.valor ? ` · ${formatCurrency(p.valor)}` : ''}
          </p>
          <p class="page-greeting">Detalhes do projeto, entregáveis e histórico de timeline.</p>
        </div>
        <a href="#/dashboard" class="btn btn-secondary btn-sm" style="flex-shrink:0;">← Voltar</a>
      </div>

      <div class="tab-bar" id="tab-bar">
        <button class="tab-item ${tab === 'entregas' ? 'active' : ''}" data-tab="entregas">${SVG_ICONS.fileText} Entregáveis</button>
        <button class="tab-item ${tab === 'uploads' ? 'active' : ''}" data-tab="uploads">${SVG_ICONS.upload} Uploads</button>
        <button class="tab-item ${tab === 'timeline' ? 'active' : ''}" data-tab="timeline">${SVG_ICONS.calendar} Timeline</button>
      </div>

      <div id="tab-content">
        ${await renderTabContent(tab, params.id)}
      </div>
    `;
  }

  async function renderTabContent(tab, projectId) {
    if (tab === 'entregas') {
      const p = state.currentProject;
      const entregas = p.entregas || p.deliverables || [];

      if (entregas.length === 0) {
        return renderEmpty('Nenhum entregável disponível.', SVG_ICONS.fileText);
      }

      return `
        <div class="deliverables-list">
          ${entregas.map((e) => `
            <div class="deliverable-item">
              <span class="deliverable-icon">${deliverableIcon(e.tipo || e.type)}</span>
              <div class="deliverable-info">
                <div class="deliverable-title">${escapeHtml(e.titulo || e.title || e.nome || '')}</div>
                <div class="deliverable-type">${escapeHtml(e.tipo || e.type || '')}</div>
              </div>
              ${e.url ? `<a href="${e.url}" target="_blank" class="btn btn-primary btn-sm">${SVG_ICONS.download} Download</a>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    if (tab === 'uploads') {
      const p = state.currentProject;
      const uploads = p.uploads || [];

      return `
        ${renderUploadZone(projectId)}
        <div class="section-title mt-24">${SVG_ICONS.upload} Arquivos enviados</div>
        ${uploads.length > 0
          ? `<div class="file-list">${uploads.map(renderFileItem).join('')}</div>`
          : renderEmpty('Nenhum arquivo enviado.', SVG_ICONS.upload)
        }
      `;
    }

    if (tab === 'timeline') {
      const p = state.currentProject;
      const events = p.timeline || p.events || [];
      return renderTimeline(events);
    }

    return '';
  }

  // — ADMIN DASHBOARD —————————————————————————————————————————
  async function renderAdminDashboard() {
    const stats = await api.get('/admin/stats');

    const s = stats || {};
    const activities = Array.isArray(s.recent_activity) ? s.recent_activity : [];

    return `
      <div class="page-content-header" style="border-bottom:1px solid var(--border); padding-bottom:var(--space-20); margin-bottom:var(--space-24);">
        <p class="page-subtitle">Visão geral e métricas gerais do sistema</p>
        <p class="page-greeting">Olá, ${escapeHtml(state.user.nome || '').split(' ')[0]}. Acesso administrativo completo operacional.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">${SVG_ICONS.folder}</span>
          <div class="stat-label">Total de Projetos</div>
          <div class="stat-value">${s.total_projetos || s.total_projects || 0}</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">${SVG_ICONS.refresh}</span>
          <div class="stat-label">Projetos Ativos</div>
          <div class="stat-value">${s.projetos_ativos || s.active_projects || 0}</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">${SVG_ICONS.upload}</span>
          <div class="stat-label">Uploads Pendentes</div>
          <div class="stat-value">${s.uploads_pendentes || s.pending_uploads || 0}</div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">${SVG_ICONS.users}</span>
          <div class="stat-label">Clientes</div>
          <div class="stat-value">${s.total_clientes || s.total_clients || 0}</div>
        </div>
      </div>

      <div class="section-title">${SVG_ICONS.clipboard} Atividade Recente</div>
      ${activities.length > 0 ? `
      <div class="glass" style="padding: var(--space-20);">
        <div class="activity-list">
          ${activities.map((a) => `
            <div class="activity-item">
              <div class="activity-dot"></div>
              <div>
                <div class="activity-text"><strong>${escapeHtml(a.actor || a.user || '')}</strong> ${escapeHtml(a.action || a.descricao || '')}</div>
                <div class="activity-time">${formatDateTime(a.created_at || a.date)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : renderEmpty('Nenhuma atividade recente.', SVG_ICONS.clipboard)}
    `;
  }

  // — ADMIN CLIENTES ——————————————————————————————————————————
  async function renderAdminClientes() {
    const data = await api.get('/admin/clientes');
    const clients = Array.isArray(data) ? data : (data?.clients || data?.data || []);

    return `
      <div class="page-content-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border); padding-bottom:var(--space-20); margin-bottom:var(--space-24);">
        <div>
          <p class="page-subtitle">Cadastro de empresas e usuários clientes</p>
          <p class="page-greeting">Exibindo ${clients.length} cliente${clients.length !== 1 ? 's' : ''} registrado${clients.length !== 1 ? 's' : ''}.</p>
        </div>
        <button class="btn btn-primary" onclick="window.__addClient()" style="flex-shrink:0;">+ Novo Cliente</button>
      </div>

      ${clients.length > 0 ? `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Empresa</th>
              <th>E-mail</th>
              <th>Projetos</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${clients.map((c) => `
              <tr>
                <td class="primary">${escapeHtml(c.nome || c.name || '')}</td>
                <td>${escapeHtml(c.empresa || c.company || '—')}</td>
                <td><span class="code">${escapeHtml(c.email || '')}</span></td>
                <td class="mono">${c.projetos_count || c.projects_count || 0}</td>
                <td>${renderBadge(c.status || 'ativo')}</td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" onclick="window.__editClient('${c.id}')">Editar</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.__toggleClient('${c.id}', '${c.status}')" style="color:var(--text-secondary);">
                    ${c.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </button>
                  <button class="btn btn-ghost btn-sm text-danger" onclick="window.__deleteClient('${c.id}')">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : renderEmpty('Nenhum cliente cadastrado.', SVG_ICONS.users)}
    `;
  }

  // — ADMIN PROJETOS ——————————————————————————————————————————
  async function renderAdminProjetos() {
    const data = await api.get('/projetos');
    const projects = Array.isArray(data) ? data : (data?.projects || data?.data || []);

    return `
      <div class="page-content-header" style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border); padding-bottom:var(--space-20); margin-bottom:var(--space-24);">
        <div>
          <p class="page-subtitle">Gestão de propostas e entregas de inteligência</p>
          <p class="page-greeting">Exibindo ${projects.length} projeto${projects.length !== 1 ? 's' : ''} cadastrado${projects.length !== 1 ? 's' : ''}.</p>
        </div>
        <button class="btn btn-primary" onclick="window.__addProject()" style="flex-shrink:0;">+ Novo Projeto</button>
      </div>

      ${projects.length > 0 ? `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map((p) => `
              <tr>
                <td class="mono">${escapeHtml(p.codigo_proposta || p.code || '')}</td>
                <td class="primary">${escapeHtml(p.titulo || p.title || '')}</td>
                <td>${escapeHtml(p.cliente_nome || p.client || '—')}</td>
                <td>${renderBadge(p.status || 'proposta')}</td>
                <td class="mono">${formatCurrency(p.valor || p.value)}</td>
                <td>${formatDate(p.created_at)}</td>
                <td class="actions">
                  <button class="btn btn-ghost btn-sm" onclick="window.__editProjectStatus('${p.id}')">Status</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.__uploadDeliverable('${p.id}')">Entrega</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : renderEmpty('Nenhum projeto cadastrado.', SVG_ICONS.folder)}
    `;
  }

  // ────────────────────────────────────────────────────────────────
  // PAGE EVENTS BINDING
  // ────────────────────────────────────────────────────────────────
  function bindPageEvents(path, params) {
    // Tab switching on project detail
    if (path === '/projeto/:id') {
      const tabBar = document.getElementById('tab-bar');
      if (tabBar) {
        tabBar.addEventListener('click', async (e) => {
          const tab = e.target.closest('.tab-item');
          if (!tab) return;
          const tabName = tab.dataset.tab;
          if (tabName === state.currentTab) return;

          state.currentTab = tabName;
          // Update active tab
          tabBar.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');

          // Re-render tab content
          const tabContent = document.getElementById('tab-content');
          if (tabContent) {
            tabContent.innerHTML = renderLoading();
            tabContent.innerHTML = await renderTabContent(tabName, params.id);
            // Re-bind upload events if uploads tab
            if (tabName === 'uploads') bindUploadEvents(params.id);
          }
        });
      }

      // Bind upload events if starting on uploads tab
      if (state.currentTab === 'uploads') {
        bindUploadEvents(params.id);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // UPLOAD LOGIC
  // ────────────────────────────────────────────────────────────────
  function bindUploadEvents(projectId) {
    // Events are bound via inline handlers on the upload zone
  }

  window.__dragOver = function (e) {
    e.preventDefault();
    e.stopPropagation();
    const zone = document.getElementById('upload-zone');
    if (zone) zone.classList.add('dragover');
  };

  window.__dragLeave = function (e) {
    e.preventDefault();
    e.stopPropagation();
    const zone = document.getElementById('upload-zone');
    if (zone) zone.classList.remove('dragover');
  };

  window.__drop = function (e, projectId) {
    e.preventDefault();
    e.stopPropagation();
    const zone = document.getElementById('upload-zone');
    if (zone) zone.classList.remove('dragover');

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files), projectId);
    }
  };

  window.__fileSelected = function (e, projectId) {
    const files = e.target?.files;
    if (files && files.length > 0) {
      handleFiles(Array.from(files), projectId);
    }
  };

  async function handleFiles(files, projectId) {
    for (const file of files) {
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} excede o limite de 50MB.`, 'error');
        continue;
      }

      // Validate type (relaxed — allow if MIME in list or if extension looks fine)
      const ext = file.name.split('.').pop().toLowerCase();
      const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'];
      if (!allowedExt.includes(ext)) {
        showToast(`Tipo de arquivo não permitido: .${ext}`, 'error');
        continue;
      }

      await uploadFile(file, projectId);
    }
  }

  async function uploadFile(file, projectId) {
    const progressContainer = document.getElementById('upload-progress');
    if (progressContainer) {
      progressContainer.classList.remove('hidden');
      progressContainer.innerHTML = `
        <div class="progress-bar"><div class="progress-bar-fill" id="progress-fill" style="width: 0%"></div></div>
        <div class="progress-text" id="progress-text">Preparando upload...</div>
      `;
    }

    try {
      updateProgress(5, 'Aguardando verificação de segurança...');

      // Render Turnstile and wait for token
      const turnstileToken = await new Promise((resolve, reject) => {
        const widgetDiv = document.createElement('div');
        widgetDiv.id = 'turnstile-widget';
        widgetDiv.style.margin = 'var(--space-16) auto';
        widgetDiv.style.display = 'flex';
        widgetDiv.style.justifyContent = 'center';
        progressContainer.appendChild(widgetDiv);

        if (typeof turnstile === 'undefined') {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            renderWidget();
          };
          script.onerror = () => {
            widgetDiv.remove();
            reject(new Error('Erro ao carregar Turnstile.'));
          };
          document.head.appendChild(script);
        } else {
          renderWidget();
        }

        function renderWidget() {
          try {
            turnstile.render('#turnstile-widget', {
              sitekey: '0x4AAAAAAC8ypNR4kOb4FSVp',
              callback: function (token) {
                widgetDiv.remove();
                resolve(token);
              },
              'error-callback': function () {
                widgetDiv.remove();
                reject(new Error('Falha na validação Turnstile.'));
              }
            });
          } catch (err) {
            reject(err);
          }
        }
      });

      // Step 1: Get presigned URL
      const presign = await api.post('/uploads/presign', {
        projeto_id: projectId,
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        tamanho: file.size,
        turnstile_token: turnstileToken,
      });

      if (!presign) {
        updateProgress(0, 'Erro ao preparar upload.');
        return;
      }

      const presignedUrl = presign.upload_url || presign.url;
      const uploadId = presign.upload_id || presign.id;

      // Step 2: Upload to presigned URL with progress
      updateProgress(10, 'Enviando arquivo...');

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 80) + 10;
            updateProgress(pct, `Enviando... ${Math.round(e.loaded / e.total * 100)}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      // Step 3: Confirm upload
      updateProgress(92, 'Finalizando...');
      const confirm = await api.post('/uploads/confirm', {
        upload_id: uploadId,
        project_id: projectId,
      });

      if (confirm) {
        updateProgress(100, 'Upload concluído!');
        showToast(`${file.name} enviado com sucesso!`, 'success');

        // Refresh project data
        setTimeout(async () => {
          const data = await api.get(`/projetos/${projectId}`);
          if (data) {
            state.currentProject = data;
            const tabContent = document.getElementById('tab-content');
            if (tabContent && state.currentTab === 'uploads') {
              tabContent.innerHTML = await renderTabContent('uploads', projectId);
            }
          }
          if (progressContainer) progressContainer.classList.add('hidden');
        }, 1500);
      }
    } catch (e) {
      console.error('Upload error:', e);
      showToast('Erro ao enviar arquivo. Tente novamente.', 'error');
      updateProgress(0, 'Erro no upload.');
    }
  }

  function updateProgress(pct, text) {
    const fill = document.getElementById('progress-fill');
    const txt = document.getElementById('progress-text');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = text;
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN ACTIONS
  // ────────────────────────────────────────────────────────────────
  window.__addClient = function () {
    openModal('Novo Cliente', `
      <form id="client-form">
        <div class="form-group">
          <label class="form-label">Nome completo</label>
          <input type="text" class="form-input" name="nome" required placeholder="Nome do contato">
        </div>
        <div class="form-group">
          <label class="form-label">Empresa</label>
          <input type="text" class="form-input" name="empresa" placeholder="Nome da empresa">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-input" name="email" required placeholder="email@empresa.com">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input type="tel" class="form-input" name="telefone" placeholder="(11) 99999-9999">
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="window.__closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="window.__submitClient()">Criar Cliente</button>
    `);
  };

  window.__submitClient = async function () {
    const form = document.getElementById('client-form');
    if (!form) return;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);

    if (!body.nome || !body.email) {
      showToast('Preencha nome e e-mail.', 'warning');
      return;
    }

    const btn = document.querySelector('#modal-overlay .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Criando...';
    }

    try {
      const result = await api.post('/admin/clientes', body);
      if (result) {
        showToast('Cliente criado com sucesso!', 'success');
        window.__closeModal();
        handleRoute(); // refresh page
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Criar Cliente';
      }
    }
  };

  window.__editClient = async function (id) {
    // Fetch all clients and filter client-side (no individual GET endpoint)
    const data = await api.get('/admin/clientes');
    const clients = Array.isArray(data) ? data : (data?.clients || data?.data || []);
    const client = clients.find(c => c.id === id);
    if (!client) {
      showToast('Cliente não encontrado.', 'error');
      return;
    }

    openModal('Editar Cliente', `
      <form id="client-form">
        <div class="form-group">
          <label class="form-label">Nome completo</label>
          <input type="text" class="form-input" name="nome" value="${escapeHtml(client.nome || client.name || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Empresa</label>
          <input type="text" class="form-input" name="empresa" value="${escapeHtml(client.empresa || client.company || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-input" name="email" value="${escapeHtml(client.email || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Telefone</label>
          <input type="tel" class="form-input" name="telefone" value="${escapeHtml(client.telefone || client.phone || '')}">
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="window.__closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="window.__updateClient('${id}')">Salvar</button>
    `);
  };

  window.__updateClient = async function (id) {
    const form = document.getElementById('client-form');
    if (!form) return;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);

    const btn = document.querySelector('#modal-overlay .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
    }

    try {
      const result = await api.put('/admin/clientes', { id, ...body });
      if (result) {
        showToast('Cliente atualizado.', 'success');
        window.__closeModal();
        handleRoute();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  };

  window.__toggleClient = async function (id, currentStatus) {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const result = await api.put('/admin/clientes', { id, status: newStatus });
    if (result) {
      showToast(`Cliente ${newStatus === 'ativo' ? 'ativado' : 'desativado'}.`, 'success');
      handleRoute();
    }
  };

  window.__deleteClient = async function (id) {
    if (!confirm('Tem certeza de que deseja excluir este cliente?')) return;
    const result = await api.delete(`/admin/clientes?id=${id}`);
    if (result) {
      showToast('Cliente excluído com sucesso.', 'success');
      handleRoute();
    }
  };

  window.__addProject = function () {
    openModal('Novo Projeto', `
      <form id="project-form">
        <div class="form-group">
          <label class="form-label">Título</label>
          <input type="text" class="form-input" name="titulo" required placeholder="Título do projeto">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Código da Proposta</label>
            <input type="text" class="form-input font-mono" name="codigo_proposta" placeholder="PPS-00001/2026">
          </div>
          <div class="form-group">
            <label class="form-label">Valor</label>
            <input type="number" class="form-input" name="valor" placeholder="10300.00" step="0.01">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Cliente (ID)</label>
          <input type="text" class="form-input" name="cliente_id" required placeholder="ID do cliente">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição</label>
          <textarea class="form-input" name="descricao" placeholder="Descrição do projeto..." rows="3"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-input form-select" name="status">
            <option value="proposta">Proposta</option>
            <option value="em_andamento">Em andamento</option>
            <option value="entregue">Entregue</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="window.__closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="window.__submitProject()">Criar Projeto</button>
    `);
  };

  window.__submitProject = async function () {
    const form = document.getElementById('project-form');
    if (!form) return;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);
    if (body.valor) body.valor = parseFloat(body.valor);

    if (!body.titulo || !body.cliente_id) {
      showToast('Preencha título e cliente.', 'warning');
      return;
    }

    const btn = document.querySelector('#modal-overlay .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Criando...';
    }

    try {
      const result = await api.post('/projetos', body);
      if (result) {
        showToast('Projeto criado com sucesso!', 'success');
        window.__closeModal();
        handleRoute();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Criar Projeto';
      }
    }
  };

  window.__editProjectStatus = function (id) {
    openModal('Alterar Status', `
      <form id="status-form">
        <div class="form-group">
          <label class="form-label">Novo Status</label>
          <select class="form-input form-select" name="status">
            <option value="proposta">Proposta</option>
            <option value="em_andamento">Em andamento</option>
            <option value="entregue">Entregue</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="window.__closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="window.__updateProjectStatus('${id}')">Salvar</button>
    `);
  };

  window.__updateProjectStatus = async function (id) {
    const form = document.getElementById('status-form');
    if (!form) return;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);

    const btn = document.querySelector('#modal-overlay .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Salvando...';
    }

    try {
      const result = await api.put(`/projetos/${id}`, body);
      if (result) {
        showToast('Status atualizado.', 'success');
        window.__closeModal();
        handleRoute();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Salvar';
      }
    }
  };

  window.__uploadDeliverable = function (projectId) {
    openModal('Upload de Entregável', `
      <form id="deliverable-form">
        <div class="form-group">
          <label class="form-label">Título do entregável</label>
          <input type="text" class="form-input" name="titulo" required placeholder="Ex: Relatório de Inteligência">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-input form-select" name="tipo">
            <option value="relatorio">Relatório</option>
            <option value="apresentacao">Apresentação</option>
            <option value="proposta">Proposta</option>
            <option value="planilha">Planilha</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Arquivo</label>
          <input type="file" class="form-input" id="deliverable-file" required
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip">
        </div>
      </form>
    `, `
      <button class="btn btn-secondary" onclick="window.__closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="window.__submitDeliverable('${projectId}')">Enviar</button>
    `);
  };

  window.__submitDeliverable = async function (projectId) {
    const form = document.getElementById('deliverable-form');
    const fileInput = document.getElementById('deliverable-file');
    if (!form || !fileInput) return;

    const file = fileInput.files[0];
    if (!file) {
      showToast('Selecione um arquivo.', 'warning');
      return;
    }

    const formData = new FormData(form);
    formData.append('project_id', projectId);
    formData.append('file', file);

    const btn = document.querySelector('#modal-overlay .btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    try {
      const result = await api.post('/admin/upload-entregavel', formData);
      if (result) {
        showToast('Entregável adicionado!', 'success');
        window.__closeModal();
        handleRoute();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enviar';
      }
    }
  };

  // ────────────────────────────────────────────────────────────────
  // SIDEBAR CONTROLS
  // ────────────────────────────────────────────────────────────────
  window.__toggleSidebar = function () {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    state.sidebarOpen = !state.sidebarOpen;
    sidebar.classList.toggle('open', state.sidebarOpen);
    if (backdrop) backdrop.classList.toggle('visible', state.sidebarOpen);
  };

  window.__closeSidebar = closeSidebar;

  function closeSidebar() {
    state.sidebarOpen = false;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('visible');
  }

  // ────────────────────────────────────────────────────────────────
  // USER PROFILE DROPDOWN
  // ────────────────────────────────────────────────────────────────
  window.__toggleProfile = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('visible');
      // Close on outside click
      if (dropdown.classList.contains('visible')) {
        setTimeout(() => {
          const closeHandler = (ev) => {
            if (!dropdown.contains(ev.target) && !ev.target.closest('.sidebar-user-card')) {
              dropdown.classList.remove('visible');
              document.removeEventListener('click', closeHandler);
            }
          };
          document.addEventListener('click', closeHandler);
        }, 10);
      }
    }
  };

  window.__saveProfile = async function () {
    const nameInput = document.getElementById('edit-name');
    if (!nameInput) return;
    const newName = nameInput.value.trim();
    if (!newName) return;
    const result = await api.put('/me', { nome: newName });
    if (result) {
      state.user.nome = newName;
      state.user.name = newName;
      renderShell();
      await handleRoute();
      showToast('Nome atualizado.', 'success');
    }
  };

  window.__toggleHeaderProfile = function (e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('header-user-dropdown');
    if (dropdown) {
      const isVisible = dropdown.style.display === 'flex';
      dropdown.style.display = isVisible ? 'none' : 'flex';
      
      // Close on outside click
      if (!isVisible) {
        setTimeout(() => {
          const closeHandler = (ev) => {
            if (!dropdown.contains(ev.target) && !ev.target.closest('.header-avatar')) {
              dropdown.style.display = 'none';
              document.removeEventListener('click', closeHandler);
            }
          };
          document.addEventListener('click', closeHandler);
        }, 10);
      }
    }
  };

  window.__saveHeaderProfile = async function () {
    const nameInput = document.getElementById('header-edit-name');
    if (!nameInput) return;
    const newName = nameInput.value.trim();
    if (!newName) return;
    const result = await api.put('/me', { nome: newName });
    if (result) {
      state.user.nome = newName;
      state.user.name = newName;
      renderShell();
      await handleRoute();
      showToast('Nome atualizado.', 'success');
    }
  };

  // ────────────────────────────────────────────────────────────────
  // LOGIN SCREEN
  // ────────────────────────────────────────────────────────────────
  function showLoginScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div id="login-screen" style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-primary);
        padding: var(--space-24);
      ">
        <div style="
          width: 100%;
          max-width: 400px;
          text-align: center;
        ">
          <div style="margin-bottom: var(--space-32);">
            <span style="
              font-family: var(--font-primary);
              font-weight: 500;
              font-size: 2.4rem;
              color: var(--text-primary);
            ">forense<span style="color: var(--accent)">.</span>io</span>
            <div style="
              font-size: 0.72rem;
              color: var(--text-muted);
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-top: var(--space-8);
            ">a <span style="color: var(--text-primary); font-weight: 500;">ness<span style="color: var(--accent)">.</span></span> company</div>
          </div>

          <div style="
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: var(--radius-xl);
            padding: var(--space-32);
          ">
            <h2 style="
              font-size: 1.1rem;
              font-weight: 600;
              color: var(--text-primary);
              margin-bottom: var(--space-8);
            ">Acesso ao Portal</h2>
            <p style="
              font-size: 0.85rem;
              color: var(--text-secondary);
              margin-bottom: var(--space-24);
            ">Entre com seu email autorizado</p>

            <form id="login-form" onsubmit="window.__handleLogin(event)">
              <input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                required
                autocomplete="email"
                style="
                  width: 100%;
                  padding: 14px 16px;
                  font-family: var(--font-primary);
                  font-size: 0.95rem;
                  background: var(--bg-primary);
                  border: 1px solid var(--border);
                  border-radius: var(--radius-md);
                  color: var(--text-primary);
                  outline: none;
                  transition: border-color var(--duration-md) var(--ease-out);
                  box-sizing: border-box;
                "
                onfocus="this.style.borderColor='var(--accent)'"
                onblur="this.style.borderColor='var(--border)'"
              />
              <div id="login-error" style="
                color: var(--danger);
                font-size: 0.8rem;
                margin-top: var(--space-8);
                min-height: 20px;
              "></div>
              <button type="submit" id="login-btn" style="
                width: 100%;
                padding: 14px;
                margin-top: var(--space-12);
                font-family: var(--font-primary);
                font-size: 0.95rem;
                font-weight: 600;
                background: var(--accent);
                color: var(--bg-primary);
                border: none;
                border-radius: var(--radius-md);
                cursor: pointer;
                transition: all var(--duration-md) var(--ease-out);
              "
                onmouseover="this.style.background='var(--accent-hover)'"
                onmouseout="this.style.background='var(--accent)'"
              >Entrar</button>
            </form>
          </div>

          <p style="
            font-size: 0.75rem;
            color: var(--text-dim);
            margin-top: var(--space-24);
          ">Acesso restrito a clientes e administradores autorizados.</p>
        </div>
      </div>
    `;
  }

  window.__handleLogin = async function (e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-email');
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    const email = emailInput.value.trim().toLowerCase();

    if (!email) return;

    btn.disabled = true;
    btn.textContent = 'Verificando...';
    errorDiv.textContent = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Reload to init with session cookie
        window.location.reload();
      } else {
        errorDiv.textContent = data.error || 'Email não autorizado.';
        btn.disabled = false;
        btn.textContent = 'Entrar';
        emailInput.style.borderColor = 'var(--danger)';
        emailInput.classList.add('shake');
        setTimeout(() => emailInput.classList.remove('shake'), 500);
      }
    } catch {
      errorDiv.textContent = 'Erro de conexão. Tente novamente.';
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  };

  // ────────────────────────────────────────────────────────────────
  // AUTH
  // ────────────────────────────────────────────────────────────────
  window.__logout = async function () {
    state.user = null;
    // Try CF Access logout first, fallback to session logout
    try {
      await fetch('/api/auth/login', { method: 'DELETE', credentials: 'include' });
    } catch {}
    window.location.reload();
  };

  // ────────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────────
  async function init() {
    // Fetch current user
    const user = await api.get('/me');

    if (!user) {
      // Not authenticated — show login screen
      showLoginScreen();
      return;
    }

    state.user = user;
    state.loading = false;

    // Render shell and initial route
    renderShell();
    await handleRoute();

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);

    // Set default hash if none
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      navigate('/dashboard');
    }
  }

  // Expose navigate globally
  window.navigate = navigate;

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
