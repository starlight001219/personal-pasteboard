const state = {
  csrfToken: null,
  pastes: [],
  activeId: null,
  saveTimer: null,
  dirty: false
};

const els = {
  appView: document.querySelector('#appView'),
  bgMusic: document.querySelector('#bgMusic'),
  contentInput: document.querySelector('#contentInput'),
  copyButton: document.querySelector('#copyButton'),
  deleteButton: document.querySelector('#deleteButton'),
  loginForm: document.querySelector('#loginForm'),
  loginMessage: document.querySelector('#loginMessage'),
  loginView: document.querySelector('#loginView'),
  logoutButton: document.querySelector('#logoutButton'),
  musicButton: document.querySelector('#musicButton'),
  settingsButton: document.querySelector('#settingsButton'),
  previewWallpaperButton: document.querySelector('#previewWallpaperButton'),
  settingsDialog: document.querySelector('#settingsDialog'),
  closeSettingsButton: document.querySelector('#closeSettingsButton'),
  settingsMessage: document.querySelector('#settingsMessage'),
  backgroundFileInput: document.querySelector('#backgroundFileInput'),
  musicFileInput: document.querySelector('#musicFileInput'),
  newPasteButton: document.querySelector('#newPasteButton'),
  pasteCount: document.querySelector('#pasteCount'),
  pasteList: document.querySelector('#pasteList'),
  password: document.querySelector('#password'),
  pinButton: document.querySelector('#pinButton'),
  saveState: document.querySelector('#saveState'),
  searchInput: document.querySelector('#searchInput'),
  tagsInput: document.querySelector('#tagsInput'),
  titleInput: document.querySelector('#titleInput'),
  updatedAt: document.querySelector('#updatedAt')
};

async function api(route, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
    headers['x-csrf-token'] = state.csrfToken;
  }
  if (options.body && typeof options.body !== 'string') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(route, {
    credentials: 'same-origin',
    ...options,
    headers
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'REQUEST_FAILED');
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function refreshSession() {
  const payload = await api('/api/session', { method: 'GET' });
  state.csrfToken = payload.csrfToken;
  if (!payload.authenticated) {
    showApp(false);
    throw new Error('AUTH_REQUIRED');
  }
  return payload;
}

function applySettings(settings) {
  if (settings.backgroundUrl) {
    document.querySelector('.backdrop').style.backgroundImage =
      `linear-gradient(120deg, rgba(13, 28, 38, 0.36), rgba(255, 255, 255, 0.2) 48%, rgba(23, 42, 55, 0.18)), url("${settings.backgroundUrl}")`;
  }
  if (settings.musicUrl) {
    const wasPlaying = !els.bgMusic.paused;
    els.bgMusic.src = settings.musicUrl;
    if (wasPlaying) {
      els.bgMusic.play().catch(() => {});
    }
  }
}

async function loadSettings() {
  const payload = await apiWithSessionRetry('/api/settings', { method: 'GET' });
  applySettings(payload.settings);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.split(',')[1] : value);
    });
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });
}

async function uploadSettingAsset(kind, file) {
  if (!file) {
    return;
  }
  if (kind === 'music' && file.name.toLowerCase().endsWith('.ncm')) {
    els.settingsMessage.textContent = 'NCM 是加密格式，浏览器不能直接播放；请先转换为 MP3/M4A/FLAC 后上传';
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    els.settingsMessage.textContent = '文件不能超过 12 MB';
    return;
  }
  els.settingsMessage.textContent = '上传中';
  const payload = await apiWithSessionRetry(`/api/settings/${kind}`, {
    method: 'POST',
    body: {
      filename: file.name,
      contentType: file.type,
      data: await fileToBase64(file)
    }
  });
  applySettings(payload.settings);
  els.settingsMessage.textContent = '已保存设置';
}

async function apiWithSessionRetry(route, options = {}) {
  try {
    return await api(route, options);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      await refreshSession();
      return api(route, options);
    }
    throw error;
  }
}

function showApp(authenticated) {
  els.loginView.classList.toggle('is-hidden', authenticated);
  els.appView.classList.toggle('is-hidden', !authenticated);
}

function activePaste() {
  return state.pastes.find((paste) => paste.id === state.activeId) || null;
}

function formatTime(value) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function pasteSummary(paste) {
  return paste.content.replace(/\s+/g, ' ').trim().slice(0, 100) || '空白内容';
}

function renderList() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const pastes = state.pastes.filter((paste) => {
    const haystack = `${paste.title}\n${paste.content}\n${paste.tags.join(',')}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });

  els.pasteCount.textContent = `${state.pastes.length} 条`;
  els.pasteList.innerHTML = '';

  for (const paste of pastes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `paste-item${paste.id === state.activeId ? ' is-active' : ''}`;
    button.innerHTML = `
      <span class="paste-item-title">
        <span></span>
        <span>${paste.pinned ? 'PIN' : formatTime(paste.updatedAt)}</span>
      </span>
      <span class="paste-item-preview"></span>
      <span class="paste-item-tags"></span>
    `;
    button.querySelector('.paste-item-title span:first-child').textContent = paste.title;
    button.querySelector('.paste-item-preview').textContent = pasteSummary(paste);
    button.querySelector('.paste-item-tags').textContent = paste.tags.map((tag) => `#${tag}`).join(' ');
    button.addEventListener('click', () => selectPaste(paste.id));
    els.pasteList.append(button);
  }
}

function renderEditor() {
  const paste = activePaste();
  const disabled = !paste;
  els.titleInput.disabled = disabled;
  els.tagsInput.disabled = disabled;
  els.contentInput.disabled = disabled;
  els.copyButton.disabled = disabled;
  els.pinButton.disabled = disabled;
  els.deleteButton.disabled = disabled;

  if (!paste) {
    els.titleInput.value = '';
    els.tagsInput.value = '';
    els.contentInput.value = '';
    els.updatedAt.textContent = '';
    els.saveState.textContent = '未选择';
    return;
  }

  els.titleInput.value = paste.title;
  els.tagsInput.value = paste.tags.join(', ');
  els.contentInput.value = paste.content;
  els.pinButton.textContent = paste.pinned ? '取消置顶' : '置顶';
  els.updatedAt.textContent = `更新于 ${formatTime(paste.updatedAt)}`;
  els.saveState.textContent = state.dirty ? '待保存' : '已保存';
}

function selectPaste(id) {
  state.activeId = id;
  state.dirty = false;
  renderList();
  renderEditor();
}

async function loadPastes() {
  const payload = await apiWithSessionRetry('/api/pastes', { method: 'GET' });
  state.pastes = payload.pastes;
  if (!state.activeId && state.pastes[0]) {
    state.activeId = state.pastes[0].id;
  }
  if (state.activeId && !state.pastes.some((paste) => paste.id === state.activeId)) {
    state.activeId = state.pastes[0] ? state.pastes[0].id : null;
  }
  renderList();
  renderEditor();
}

function readEditor() {
  return {
    title: els.titleInput.value,
    content: els.contentInput.value,
    tags: els.tagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    pinned: activePaste() ? activePaste().pinned : false
  };
}

async function saveActive() {
  const paste = activePaste();
  if (!paste) {
    return;
  }
  els.saveState.textContent = '保存中';
  const payload = await apiWithSessionRetry(`/api/pastes/${paste.id}`, {
    method: 'PUT',
    body: readEditor()
  });
  const index = state.pastes.findIndex((item) => item.id === paste.id);
  state.pastes[index] = payload.paste;
  state.dirty = false;
  renderList();
  renderEditor();
}

function queueSave() {
  state.dirty = true;
  els.saveState.textContent = '待保存';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveActive().catch(() => {
      els.saveState.textContent = '保存失败，请刷新后重试';
    });
  }, 450);
}

async function createPaste() {
  const payload = await apiWithSessionRetry('/api/pastes', {
    method: 'POST',
    body: { title: '新粘贴', content: '', tags: [], pinned: false }
  });
  state.pastes.unshift(payload.paste);
  selectPaste(payload.paste.id);
  els.titleInput.focus();
  els.titleInput.select();
}

async function deleteActive() {
  const paste = activePaste();
  if (!paste) {
    return;
  }
  await apiWithSessionRetry(`/api/pastes/${paste.id}`, { method: 'DELETE' });
  state.pastes = state.pastes.filter((item) => item.id !== paste.id);
  state.activeId = state.pastes[0] ? state.pastes[0].id : null;
  renderList();
  renderEditor();
}

async function togglePin() {
  const paste = activePaste();
  if (!paste) {
    return;
  }
  const next = readEditor();
  next.pinned = !paste.pinned;
  const payload = await apiWithSessionRetry(`/api/pastes/${paste.id}`, {
    method: 'PUT',
    body: next
  });
  const index = state.pastes.findIndex((item) => item.id === paste.id);
  state.pastes[index] = payload.paste;
  renderList();
  renderEditor();
}

async function login(event) {
  event.preventDefault();
  els.loginMessage.textContent = '';
  try {
    const payload = await api('/api/login', {
      method: 'POST',
      body: { password: els.password.value }
    });
    state.csrfToken = payload.csrfToken;
    showApp(true);
    await loadSettings();
    await loadPastes();
  } catch (error) {
    els.loginMessage.textContent = error.status === 429 ? '尝试过多，请稍后再试。' : '密码不正确。';
  }
}

async function resumeSession() {
  const payload = await api('/api/session', { method: 'GET' });
  state.csrfToken = payload.csrfToken;
  showApp(payload.authenticated);
  if (payload.authenticated) {
    await loadSettings();
    await loadPastes();
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.csrfToken = null;
  state.pastes = [];
  state.activeId = null;
  showApp(false);
}

els.loginForm.addEventListener('submit', login);
els.newPasteButton.addEventListener('click', () => createPaste().catch(() => {}));
els.searchInput.addEventListener('input', renderList);
els.titleInput.addEventListener('input', queueSave);
els.tagsInput.addEventListener('input', queueSave);
els.contentInput.addEventListener('input', queueSave);
els.copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.contentInput.value);
  els.saveState.textContent = '已复制';
});
els.deleteButton.addEventListener('click', () => deleteActive().catch(() => {}));
els.pinButton.addEventListener('click', () => togglePin().catch(() => {}));
els.logoutButton.addEventListener('click', () => logout().catch(() => {}));
els.settingsButton.addEventListener('click', () => {
  els.settingsMessage.textContent = '';
  els.settingsDialog.showModal();
});
els.previewWallpaperButton.addEventListener('click', () => {
  document.body.classList.add('wallpaper-preview');
});
document.addEventListener('click', (event) => {
  if (document.body.classList.contains('wallpaper-preview') && event.target !== els.previewWallpaperButton) {
    document.body.classList.remove('wallpaper-preview');
  }
});
els.closeSettingsButton.addEventListener('click', () => els.settingsDialog.close());
els.backgroundFileInput.addEventListener('change', () => {
  uploadSettingAsset('background', els.backgroundFileInput.files[0]).catch(() => {
    els.settingsMessage.textContent = '背景图片保存失败';
  });
});
els.musicFileInput.addEventListener('change', () => {
  uploadSettingAsset('music', els.musicFileInput.files[0]).catch(() => {
    els.settingsMessage.textContent = '背景音乐保存失败';
  });
});
els.musicButton.addEventListener('click', async () => {
  if (els.bgMusic.paused) {
    await els.bgMusic.play();
    els.musicButton.textContent = 'Mute';
  } else {
    els.bgMusic.pause();
    els.musicButton.textContent = 'Music';
  }
});

resumeSession().catch(() => showApp(false));
