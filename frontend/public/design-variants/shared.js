const API = '/api/v1/tenants/directory/';

async function loadInstitutions() {
  const response = await fetch(API, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error(`Directory request failed (${response.status})`);
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function renderDirectory(
  items,
  target,
  emptyMessage = 'No active institutions are listed yet.',
) {
  const node = document.querySelector(target);
  if (!node) return;
  node.innerHTML = '';
  if (!items.length) {
    node.innerHTML = `<p class="data-empty">${emptyMessage}</p>`;
    return;
  }
  items.slice(0, 6).forEach((institution) => {
    const item = document.createElement('a');
    item.href = '/signup';
    item.className = 'institution-row';
    item.innerHTML = `<span class="institution-mark">${(institution.name || '?').slice(0, 1)}</span><span><b>${institution.name || 'Unnamed institution'}</b><small>/${institution.slug || 'unknown'}</small></span><i>Join</i>`;
    node.appendChild(item);
  });
}

function showDataError(target) {
  const node = document.querySelector(target);
  if (node)
    node.innerHTML =
      '<p class="data-error">Live institution data is unavailable. Start the API to preview this section.</p>';
}

loadInstitutions()
  .then((items) => {
    document.querySelectorAll('[data-institution-count]').forEach((node) => {
      node.textContent = String(items.length);
    });
    document.querySelectorAll('[data-live-status]').forEach((node) => {
      node.textContent = 'Live directory connected';
    });
    renderDirectory(items, '#directory');
  })
  .catch(() => {
    document.querySelectorAll('[data-live-status]').forEach((node) => {
      node.textContent = 'API connection required';
    });
    showDataError('#directory');
  });
