
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showMessage(message, error = false) {
  let element = document.getElementById('message');
  if (!element) {
    element = document.createElement('p');
    element.id = 'message';
    element.setAttribute('role', 'status');
    document.querySelector('main')?.prepend(element);
  }

  element.textContent = message;
  element.style.color = error ? '#b91c1c' : '#166534';
}

async function loadCurrentUser() {
  try {
    return (await api('/api/users/me')).user;
  } catch {
    return null;
  }
}

async function logout() {
  try {
    await api('/api/users/logout', { method: 'POST' });
    location.href = '/login.html';
  } catch (error) {
    showMessage(error.message, true);
  }
}

function money(value) {
  return value == null ? '—' : Number(value).toFixed(2);
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}