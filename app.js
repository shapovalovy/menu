// =============================================
//  СЕМЕЙНОЕ МЕНЮ — App Logic
// =============================================

const DAYS = ['Понеділок','Вівторок','Середа','Четвер','П\'ятниця','Субота','Неділя'];
const MEALS = ['breakfast','lunch','dinner'];
const MEAL_LABELS = { breakfast: 'Сніданок', lunch: 'Обід', dinner: 'Вечеря' };

// ── STATE ──────────────────────────────────────
let state = {
  menu: {},      // { "Mon-breakfast": { name, notes, ingredients } }
  grocery: {}    // { produce: [{text, checked},...], protein: [...], ... }
};

const GROCERY_CATS = ['produce','protein','dairy','grains','other'];

// ── INIT ───────────────────────────────────────
function init() {
  loadState();
  buildWeekGrid();
  buildGroceryUI();
  bindEvents();
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function dayKey(i) { return DAYS[i].slice(0,3); }

// ── BUILD WEEK GRID ────────────────────────────
function buildWeekGrid() {
  const grid = document.querySelector('.week-grid');
  grid.innerHTML = '';
  const monday = getMonday();

  DAYS.forEach((day, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

    const col = document.createElement('div');
    col.className = 'day-col';
    col.innerHTML = `<div class="day-header">${day}<span class="day-date">${dateStr}</span></div>`;

    MEALS.forEach(meal => {
      const key = `${dayKey(i)}-${meal}`;
      const data = state.menu[key] || {};
      const card = createMealCard(meal, data, key);
      col.appendChild(card);
    });

    grid.appendChild(col);
  });
}

function createMealCard(meal, data, key) {
  const card = document.createElement('div');
  card.className = `meal-card ${meal}`;
  card.dataset.key = key;

  const hasData = !!data.name;
  card.innerHTML = `
    <div class="meal-type">${MEAL_LABELS[meal]}</div>
    ${hasData
      ? `<div class="meal-name">${escHtml(data.name)}</div>
         ${data.notes ? `<div class="meal-notes">${escHtml(data.notes)}</div>` : ''}`
      : `<div class="meal-empty">Натисніть, щоб додати</div>`
    }
    <span class="meal-add-icon">${hasData ? '✎' : '＋'}</span>
  `;

  card.addEventListener('click', () => openModal(key, meal));
  return card;
}

// ── MODAL ──────────────────────────────────────
let currentKey = null;

function openModal(key, meal) {
  currentKey = key;
  const data = state.menu[key] || {};
  const parts = key.split('-');
  const dayIdx = DAYS.findIndex(d => d.startsWith(parts[0]));
  const dayName = DAYS[dayIdx] || parts[0];

  document.getElementById('modalTitle').textContent = `${MEAL_LABELS[meal]} — ${dayName}`;
  document.getElementById('mealName').value = data.name || '';
  document.getElementById('mealNotes').value = data.notes || '';
  document.getElementById('mealIngredients').value = data.ingredients || '';

  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('mealName').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  currentKey = null;
}

function saveMeal() {
  if (!currentKey) return;
  const name = document.getElementById('mealName').value.trim();
  const notes = document.getElementById('mealNotes').value.trim();
  const ingredients = document.getElementById('mealIngredients').value.trim();

  if (name) {
    state.menu[currentKey] = { name, notes, ingredients };
  } else {
    delete state.menu[currentKey];
  }

  saveState();
  buildWeekGrid();
  closeModal();
}

function deleteMeal() {
  if (!currentKey) return;
  delete state.menu[currentKey];
  saveState();
  buildWeekGrid();
  closeModal();
}

// ── GROCERY ────────────────────────────────────
function buildGroceryUI() {
  GROCERY_CATS.forEach(cat => {
    const list = document.getElementById(`list-${cat}`);
    if (!list) return;
    list.innerHTML = '';
    const items = state.grocery[cat] || [];
    items.forEach((item, idx) => {
      list.appendChild(createGroceryItem(cat, item, idx));
    });
  });
}

function createGroceryItem(cat, item, idx) {
  const li = document.createElement('li');
  if (item.checked) li.classList.add('checked');
  li.innerHTML = `
    <input type="checkbox" ${item.checked ? 'checked' : ''} />
    <span>${escHtml(item.text)}</span>
    <button class="del-item" title="Удалить">✕</button>
  `;
  li.querySelector('input').addEventListener('change', () => {
    state.grocery[cat][idx].checked = !state.grocery[cat][idx].checked;
    saveState();
    buildGroceryUI();
  });
  li.querySelector('.del-item').addEventListener('click', () => {
    state.grocery[cat].splice(idx, 1);
    saveState();
    buildGroceryUI();
  });
  return li;
}

function addGroceryItem(cat, text) {
  if (!text.trim()) return;
  if (!state.grocery[cat]) state.grocery[cat] = [];
  state.grocery[cat].push({ text: text.trim(), checked: false });
  saveState();
  buildGroceryUI();
}

function generateFromMenu() {
  // Collect all ingredients from menu
  const raw = [];
  Object.values(state.menu).forEach(meal => {
    if (meal.ingredients) {
      meal.ingredients.split(',').forEach(i => {
        const t = i.trim();
        if (t) raw.push(t);
      });
    }
  });

  if (!raw.length) {
    alert('Спочатку додайте страви з інгредієнтами у планувальнику!');
    return;
  }

  // Naive auto-categorisation by keywords
  const catKeywords = {
    produce: ['помідор','огірок','морква','цибул','часник','перець','картопл','капуст','яблук','банан','лимон','зелень','кріп','петрушк','шпинат','броколі','цукін','баклажан','буряк','апельс'],
    protein: ['курка','курятин','яловичин','свинин','фарш','риба','лосось','тунець','яйц','бекон','ковбас','сосиск','індичк','креветк'],
    dairy:   ['молоко','кефір','сметан','сир','масло','йогурт','вершк','ряжанк','творог'],
    grains:  ['хліб','борошн','рис','гречк','макарон','вівсянка','кіноа','перловк','булгур','локшин','батон','багет'],
  };

  raw.forEach(item => {
    const lower = item.toLowerCase();
    let placed = false;
    for (const [cat, keys] of Object.entries(catKeywords)) {
      if (keys.some(k => lower.includes(k))) {
        if (!state.grocery[cat]) state.grocery[cat] = [];
        // avoid duplicates
        if (!state.grocery[cat].some(g => g.text.toLowerCase() === lower)) {
          state.grocery[cat].push({ text: item, checked: false });
        }
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (!state.grocery['other']) state.grocery['other'] = [];
      if (!state.grocery['other'].some(g => g.text.toLowerCase() === lower)) {
        state.grocery['other'].push({ text: item, checked: false });
      }
    }
  });

  saveState();
  buildGroceryUI();
}

// ── EVENTS ─────────────────────────────────────
function bindEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Modal buttons
  document.getElementById('modalSave').addEventListener('click', saveMeal);
  document.getElementById('modalDelete').addEventListener('click', deleteMeal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Modal save on Enter
  document.getElementById('mealName').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveMeal();
  });

  // Grocery inputs
  document.querySelectorAll('.add-item').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        addGroceryItem(input.dataset.cat, input.value);
        input.value = '';
      }
    });
  });

  document.getElementById('generateGrocery').addEventListener('click', generateFromMenu);
  document.getElementById('clearGrocery').addEventListener('click', () => {
    if (confirm('Очистити весь список покупок?')) {
      state.grocery = {};
      saveState();
      buildGroceryUI();
    }
  });
}

// ── PERSISTENCE ────────────────────────────────
function saveState() {
  try { localStorage.setItem('simeyneMenu', JSON.stringify(state)); } catch(e) {}
}
function loadState() {
  try {
    const saved = localStorage.getItem('simeyneMenu');
    if (saved) state = JSON.parse(saved);
  } catch(e) {}
}

// ── UTILS ──────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── START ──────────────────────────────────────
init();
