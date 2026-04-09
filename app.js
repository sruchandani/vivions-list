// -------------------------------------------------------
// SUPABASE CONFIG — paste your values from Project Settings → API
// -------------------------------------------------------
const SUPABASE_URL = 'https://thiyvrnprpzfyfxmgubd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoaXl2cm5wcnB6ZnlmeG1ndWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTUyNjUsImV4cCI6MjA5MTMzMTI2NX0.djxGQXdaoyylEoEBAHFvoA8juoZUSNQcT4bgmaZAArk';

// -------------------------------------------------------
// Minimal Supabase REST client (no npm needed)
// -------------------------------------------------------
const db = {
  async getAll() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractors?order=created_at.desc`, {
      headers: headers(),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async insert(row) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractors`, {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async remove(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractors?id=eq.${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (!res.ok) throw await res.json();
  },
};

function headers() {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

// -------------------------------------------------------
// App state
// -------------------------------------------------------
let contractors = [];
let selectedTags = [];
let activeFilterTag = null;

// --- DOM refs ---
const searchInput = document.getElementById('searchInput');
const contractorList = document.getElementById('contractorList');
const emptyState = document.getElementById('emptyState');
const resultsInfo = document.getElementById('resultsInfo');
const contractorForm = document.getElementById('contractorForm');
const toggleFormBtn = document.getElementById('toggleFormBtn');
const cancelBtn = document.getElementById('cancelBtn');
const addTagBtn = document.getElementById('addTagBtn');
const tagSelect = document.getElementById('tagSelect');
const customTagInput = document.getElementById('customTag');
const selectedTagsContainer = document.getElementById('selectedTags');
const tagFiltersContainer = document.getElementById('tagFilters');

// --- Form toggle ---
toggleFormBtn.addEventListener('click', () => {
  contractorForm.classList.remove('hidden');
  toggleFormBtn.classList.add('hidden');
});

cancelBtn.addEventListener('click', resetForm);

// --- Tag management in form ---
addTagBtn.addEventListener('click', () => {
  const val = (tagSelect.value || customTagInput.value).trim();
  if (val && !selectedTags.includes(val)) {
    selectedTags.push(val);
    renderSelectedTags();
  }
  tagSelect.value = '';
  customTagInput.value = '';
});

function renderSelectedTags() {
  selectedTagsContainer.innerHTML = selectedTags.map(tag => `
    <span class="tag-chip">
      ${escHtml(tag)}
      <button type="button" aria-label="Remove ${escHtml(tag)}" onclick="removeTag('${escHtml(tag)}')">&times;</button>
    </span>
  `).join('');
}

function removeTag(tag) {
  selectedTags = selectedTags.filter(t => t !== tag);
  renderSelectedTags();
}

// --- Form submit ---
contractorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (selectedTags.length === 0) {
    alert('Please add at least one service tag.');
    return;
  }

  const submitBtn = contractorForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const row = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim() || null,
      email: document.getElementById('email').value.trim() || null,
      website: document.getElementById('website').value.trim() || null,
      tags: [...selectedTags],
      notes: document.getElementById('notes').value.trim() || null,
      added_by: document.getElementById('addedBy').value.trim() || null,
      added_on: new Date().toLocaleDateString(),
    };
    const [saved] = await db.insert(row);
    contractors.unshift(saved);
    resetForm();
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Failed to save. Check your Supabase config.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Contractor';
  }
});

function resetForm() {
  contractorForm.reset();
  selectedTags = [];
  renderSelectedTags();
  contractorForm.classList.add('hidden');
  toggleFormBtn.classList.remove('hidden');
}

// --- Delete ---
async function deleteContractor(id) {
  if (!confirm('Remove this contractor?')) return;
  try {
    await db.remove(id);
    contractors = contractors.filter(c => c.id !== id);
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Failed to delete.');
  }
}

// --- Search & filter ---
function getFiltered() {
  const query = searchInput.value.toLowerCase().trim();
  return contractors.filter(c => {
    const matchesTag = !activeFilterTag || c.tags.some(t => t.toLowerCase() === activeFilterTag.toLowerCase());
    if (!query) return matchesTag;
    const haystack = [c.name, c.phone, c.email, c.website, c.notes, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return matchesTag && haystack.includes(query);
  });
}

searchInput.addEventListener('input', renderAll);

// --- Tag filter buttons ---
function renderTagFilters() {
  const allTags = [...new Set(contractors.flatMap(c => c.tags || []))].sort();
  tagFiltersContainer.innerHTML = allTags.map(tag => `
    <button
      class="tag-filter-btn ${activeFilterTag === tag ? 'active' : ''}"
      onclick="setTagFilter('${escHtml(tag)}')"
      aria-pressed="${activeFilterTag === tag}"
    >${escHtml(tag)}</button>
  `).join('');
}

function setTagFilter(tag) {
  activeFilterTag = activeFilterTag === tag ? null : tag;
  renderAll();
}

// --- Render cards ---
function renderAll() {
  renderTagFilters();
  const filtered = getFiltered();
  resultsInfo.textContent = contractors.length
    ? `Showing ${filtered.length} of ${contractors.length} contractor${contractors.length !== 1 ? 's' : ''}`
    : '';

  if (filtered.length === 0) {
    contractorList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  contractorList.innerHTML = filtered.map(c => `
    <article class="contractor-card">
      <div class="card-header">
        <span class="card-name">${escHtml(c.name)}</span>
        <button class="btn-danger" onclick="deleteContractor(${c.id})" aria-label="Delete ${escHtml(c.name)}">✕</button>
      </div>
      <div class="card-tags">
        ${(c.tags || []).map(t => `<span class="card-tag">${escHtml(t)}</span>`).join('')}
      </div>
      <div class="card-contacts">
        ${c.phone ? `<span>📞 <a href="tel:${escHtml(c.phone)}">${escHtml(c.phone)}</a></span>` : ''}
        ${c.email ? `<span>✉️ <a href="mailto:${escHtml(c.email)}">${escHtml(c.email)}</a></span>` : ''}
        ${c.website ? `<span>🌐 <a href="${escHtml(c.website)}" target="_blank" rel="noopener">Website</a></span>` : ''}
      </div>
      ${c.notes ? `<p class="card-notes">"${escHtml(c.notes)}"</p>` : ''}
      <div class="card-footer">
        <span>${c.added_by ? `Added by ${escHtml(c.added_by)}` : ''}</span>
        <span>${c.added_on || ''}</span>
      </div>
    </article>
  `).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Loading state ---
function setLoading(on) {
  contractorList.innerHTML = on ? '<p style="color:#b2bec3;padding:2rem;grid-column:1/-1">Loading...</p>' : '';
  emptyState.classList.add('hidden');
}

// --- Init ---
async function init() {
  setLoading(true);
  try {
    contractors = await db.getAll();
  } catch (err) {
    console.error(err);
    contractorList.innerHTML = '<p style="color:#d63031;padding:2rem;grid-column:1/-1">Could not load data. Check your Supabase config in app.js.</p>';
    return;
  }
  renderAll();
}

init();
