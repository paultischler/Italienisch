/* ============================================================
   IMPARA ITALIANO — App.js
   Full SPA with OCR, Flashcards, Library, Stats
   ============================================================ */

const API = 'cgi-bin/api.py';

/* ============================================================
   STATE
   ============================================================ */
const state = {
  currentTab: 'learn',
  lessons: [],
  currentLesson: null,
  currentLessonCards: [],
  // Learning
  learnDirection: 'DE2IT',  // or 'IT2DE'
  sessionCards: [],        // current shuffled queue
  sessionOriginalCards: [], // full set (for weak cards mode)
  sessionIndex: 0,
  sessionRound: 1,
  sessionFlipped: false,
  sessionStartTime: null,
  sessionResults: {},  // cardId -> { correct: bool, attempts: int }
  sessionLessonId: null,
  sessionLessonIds: [],    // multi-select lesson IDs
  sessionIsWeakMode: false,
  selectedLearnLessons: new Set(), // IDs of selected lessons in picker
  learnQuestionCount: 'all',      // 10, 15, 20, or 'all'
  // Library filter
  libraryFilter: 'all',
  librarySearch: '',
  // Charts
  charts: {},
  // Phase-6
  phase6DueCards: [],
  phase6Stats: null,
};

/* ============================================================
   UTILITIES
   ============================================================ */
function $(id) { return document.getElementById(id); }

function showToast(message, type = 'info', duration = 3000) {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

function confirmDialog(title, message) {
  return new Promise(resolve => {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmOverlay').style.display = 'flex';
    const ok = $('confirmOk');
    const cancel = $('confirmCancel');
    function cleanup(result) {
      $('confirmOverlay').style.display = 'none';
      ok.removeEventListener('click', handleOk);
      cancel.removeEventListener('click', handleCancel);
      resolve(result);
    }
    function handleOk() { cleanup(true); }
    function handleCancel() { cleanup(false); }
    ok.addEventListener('click', handleOk);
    cancel.addEventListener('click', handleCancel);
    $('confirmOverlay').addEventListener('click', e => {
      if (e.target === $('confirmOverlay')) cleanup(false);
    }, { once: true });
  });
}

/* ============================================================
   LOCALSTORAGE DATABASE  (replaces Python CGI backend)
   Keys: hun_lessons, hun_cards, hun_sessions, hun_card_results, hun_phase6
   ============================================================ */
const DB = {
  _g: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(e) { return d; } },
  _s: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  lessons:      () => DB._g('hun_lessons', []),
  saveLessons:  (d) => DB._s('hun_lessons', d),
  cards:        () => DB._g('hun_cards', []),
  saveCards:    (d) => DB._s('hun_cards', d),
  sessions:     () => DB._g('hun_sessions', []),
  saveSessions: (d) => DB._s('hun_sessions', d),
  results:      () => DB._g('hun_card_results', []),
  saveResults:  (d) => DB._s('hun_card_results', d),
  phase6:       () => DB._g('hun_phase6', {}),
  savePhase6:   (d) => DB._s('hun_phase6', d),
  nextId: (arr) => arr.length > 0 ? Math.max(...arr.map(x => x.id || 0)) + 1 : 1,
};

const PHASE6_INTERVALS_DB = {1:0, 2:1, 3:3, 4:10, 5:30, 6:90};

function dbUpdatePhase6(cardId, isCorrect) {
  const p6 = DB.phase6();
  const st = p6[cardId] || {phase:1, correct_streak:0};
  const newPhase = isCorrect ? Math.min(st.phase + 1, 6) : 1;
  const newStreak = isCorrect ? st.correct_streak + 1 : 0;
  const next = new Date();
  if (!isCorrect) next.setHours(next.getHours() + 4);
  else next.setDate(next.getDate() + (PHASE6_INTERVALS_DB[newPhase] || 0));
  p6[cardId] = {phase: newPhase, correct_streak: newStreak,
                next_review_at: next.toISOString(), last_reviewed_at: new Date().toISOString()};
  DB.savePhase6(p6);
}

/* How many cards Phase 6 offers at once: due reviews first, then topped up
   with random not-yet-learned cards until this target is reached. As new
   cards get studied they leave the "new" pool, so the queue refills over
   several sessions until every card has been introduced. */
const PHASE6_NEW_TARGET = 20;

function computePhase6Due(p6, cards) {
  const now = new Date();
  const reviews = [];
  const newPool = [];
  cards.forEach(c => {
    const e = p6[c.id];
    if (e) { if (new Date(e.next_review_at) <= now) reviews.push(c); }
    else { newPool.push(c); }
  });
  reviews.sort((a, b) => new Date(p6[a.id].next_review_at) - new Date(p6[b.id].next_review_at));
  const slots = Math.max(0, PHASE6_NEW_TARGET - reviews.length);
  // Fisher–Yates shuffle so the new cards are picked at random
  for (let i = newPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newPool[i], newPool[j]] = [newPool[j], newPool[i]];
  }
  return { reviews, newCards: newPool.slice(0, slots) };
}

async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;
  const qpos = url.indexOf('?');
  const params = new URLSearchParams(qpos >= 0 ? url.slice(qpos + 1) : '');
  const action = params.get('action');
  const id = params.get('id') ? parseInt(params.get('id')) : null;
  const now = new Date().toISOString();

  /* ---- LESSONS ---- */
  if (action === 'lessons') {
    const lessons = DB.lessons();
    if (method === 'GET') {
      const cards = DB.cards(); const sessions = DB.sessions(); const results = DB.results();
      return lessons.map(l => {
        const lCards = cards.filter(c => c.lesson_id === l.id);
        const lResults = results.filter(r => lCards.some(c => c.id === r.card_id));
        const lSess = sessions.filter(s => s.lesson_id === l.id).sort((a,b) => b.completed_at > a.completed_at ? 1 : -1);
        return { ...l, card_count: lCards.length,
          success_rate: lResults.length ? Math.round(lResults.filter(r=>r.correct).length/lResults.length*100) : null,
          last_studied: lSess[0] ? lSess[0].completed_at : null };
      });
    }
    if (method === 'POST') {
      const nL = {id: DB.nextId(lessons), title: body.title, category: body.category||'vokabeln', description: body.description||'', created_at: now, updated_at: now};
      lessons.push(nL); DB.saveLessons(lessons);
      return {...nL, card_count:0, success_rate:null, last_studied:null};
    }
    if (method === 'PUT' && id) {
      const i = lessons.findIndex(l=>l.id===id);
      if (i<0) throw new Error('Lektion nicht gefunden');
      lessons[i] = {...lessons[i], title:body.title, category:body.category, description:body.description||'', updated_at:now};
      DB.saveLessons(lessons); return lessons[i];
    }
    if (method === 'DELETE' && id) {
      const cardIds = DB.cards().filter(c=>c.lesson_id===id).map(c=>c.id);
      DB.saveLessons(lessons.filter(l=>l.id!==id));
      DB.saveCards(DB.cards().filter(c=>c.lesson_id!==id));
      DB.saveSessions(DB.sessions().filter(s=>s.lesson_id!==id));
      DB.saveResults(DB.results().filter(r=>!cardIds.includes(r.card_id)));
      return {ok:true};
    }
  }

  /* ---- CARDS ---- */
  if (action === 'cards') {
    const cards = DB.cards(); const p6 = DB.phase6();
    const lessonId = params.get('lesson_id') ? parseInt(params.get('lesson_id')) : null;
    if (method === 'GET' && lessonId) {
      return cards.filter(c=>c.lesson_id===lessonId).map(c=>({...c, phase:p6[c.id]?p6[c.id].phase:null}));
    }
    if (method === 'POST') {
      const nC = {id:DB.nextId(cards), lesson_id:parseInt(body.lesson_id), front:body.front, back:body.back, example:body.example||'', notes:body.notes||'', created_at:now};
      cards.push(nC); DB.saveCards(cards); return {...nC, phase:null};
    }
    if (method === 'PUT' && id) {
      const i = cards.findIndex(c=>c.id===id);
      if (i<0) throw new Error('Karte nicht gefunden');
      cards[i] = {...cards[i], front:body.front, back:body.back, example:body.example||'', notes:body.notes||''};
      DB.saveCards(cards); return {...cards[i], phase:p6[id]?p6[id].phase:null};
    }
    if (method === 'DELETE' && id) {
      DB.saveCards(cards.filter(c=>c.id!==id));
      DB.saveResults(DB.results().filter(r=>r.card_id!==id));
      return {ok:true};
    }
  }

  /* ---- SESSIONS ---- */
  if (action === 'sessions' && method === 'POST') {
    const sessions = DB.sessions();
    const nS = {id:DB.nextId(sessions), lesson_id:body.lesson_id, total_cards:body.total_cards,
                correct_first_try:body.correct_first_try, total_rounds:body.total_rounds,
                duration_seconds:body.duration_seconds, completed_at:now};
    sessions.push(nS); DB.saveSessions(sessions);
    if (body.card_results && body.card_results.length > 0) {
      const existing = DB.results();
      let nextRid = existing.length > 0 ? Math.max(...existing.map(x=>x.id||0)) + 1 : 1;
      const newR = body.card_results.map((r,i) => ({id:nextRid+i, session_id:nS.id, card_id:r.card_id, correct:r.correct, attempts:r.attempts, answered_at:now}));
      DB.saveResults([...existing, ...newR]);
      body.card_results.forEach(r => dbUpdatePhase6(r.card_id, r.correct));
    }
    return nS;
  }

  /* ---- STATS ---- */
  if (action === 'stats') {
    const lessons = DB.lessons(); const cards = DB.cards();
    const sessions = DB.sessions(); const results = DB.results(); const p6 = DB.phase6();
    const totalDuration = sessions.reduce((s,x)=>s+(x.duration_seconds||0),0);
    const days = [...new Set(sessions.map(s=>s.completed_at.slice(0,10)))].sort().reverse();
    const today = new Date().toISOString().slice(0,10);
    const studiedToday = days.includes(today);
    let streak = 0, streakStart = null, cur = studiedToday ? today : new Date(Date.now()-86400000).toISOString().slice(0,10);
    for (let i=0; i<400; i++) {
      if (days.includes(cur)) { streak++; streakStart=cur; const d=new Date(cur); d.setDate(d.getDate()-1); cur=d.toISOString().slice(0,10); }
      else break;
    }
    const dailySessions = [];
    for (let i=13; i>=0; i--) {
      const day = new Date(Date.now()-i*86400000).toISOString().slice(0,10);
      const ds = sessions.filter(s=>s.completed_at.slice(0,10)===day);
      if (ds.length>0) {
        const dc=ds.reduce((s,x)=>s+(x.correct_first_try||0),0), dt=ds.reduce((s,x)=>s+(x.total_cards||0),0);
        const dur=ds.reduce((s,x)=>s+(x.duration_seconds||0),0);
        dailySessions.push({day, count:ds.length, duration:dur, success_rate:dt>0?Math.round(dc/dt*100):0});
      }
    }
    const lessonStats = lessons.map(l=>{
      const lC=cards.filter(c=>c.lesson_id===l.id), lS=sessions.filter(s=>s.lesson_id===l.id);
      const lR=results.filter(r=>lC.some(c=>c.id===r.card_id));
      return {id:l.id, title:l.title, category:l.category, card_count:lC.length, session_count:lS.length,
              success_rate:lR.length?Math.round(lR.filter(r=>r.correct).length/lR.length*100):null};
    }).filter(ls=>ls.session_count>0);
    const recentSessions = sessions.slice().sort((a,b)=>b.completed_at>a.completed_at?1:-1).slice(0,5).map(s=>{
      const l=lessons.find(x=>x.id===s.lesson_id);
      return {...s, lesson_title:l?l.title:'Unbekannt', score_pct:s.total_cards>0?Math.round((s.correct_first_try||0)/s.total_cards*100):0};
    });
    const p6E=Object.entries(p6);
    const p6due=computePhase6Due(p6, cards);
    return {
      total_lessons:lessons.length, total_cards:cards.length, total_sessions:sessions.length,
      overall_success_rate:results.length?Math.round(results.filter(r=>r.correct).length/results.length*100):null,
      total_duration:totalDuration, streak, streak_start:streakStart, studied_today:studiedToday,
      daily_sessions:dailySessions, lesson_stats:lessonStats, recent_sessions:recentSessions,
      phase6:{due_count:p6due.reviews.length + p6due.newCards.length,
               mastered_count:p6E.filter(([,v])=>v.phase===6).length, total_cards:p6E.length,
               phase_distribution:[1,2,3,4,5,6].map(ph=>({phase:ph,count:p6E.filter(([,v])=>v.phase===ph).length}))},
    };
  }

  /* ---- WEAK CARDS ---- */
  if (action === 'weak_cards') {
    const cards = DB.cards(); const results = DB.results(); const lessons = DB.lessons();
    const failCounts = {};
    results.filter(r=>!r.correct).forEach(r=>{ failCounts[r.card_id]=(failCounts[r.card_id]||0)+1; });
    const cutoff = new Date(Date.now()-7*86400000).toISOString();
    const recent = new Set(results.filter(r=>r.answered_at>cutoff).map(r=>r.card_id));
    return Object.entries(failCounts)
      .filter(([cid,cnt])=>cnt>=2&&recent.has(parseInt(cid)))
      .sort((a,b)=>b[1]-a[1]).slice(0,20)
      .map(([cid])=>{
        const c=cards.find(x=>x.id===parseInt(cid)); if(!c) return null;
        const l=lessons.find(x=>x.id===c.lesson_id);
        return {...c, lesson_title:l?l.title:'', fail_count:failCounts[parseInt(cid)]};
      }).filter(Boolean);
  }

  /* ---- PHASE-6 ---- */
  if (action === 'phase6') {
    const sub = params.get('sub'); const p6 = DB.phase6(); const cards = DB.cards();
    if (sub === 'due_cards') {
      const limit = parseInt(params.get('limit')||'50');
      const d = computePhase6Due(p6, cards);
      const list = d.reviews.map(c => ({...c, phase: p6[c.id].phase}))
        .concat(d.newCards.map(c => ({...c, phase: 1})));
      return list.slice(0, limit);
    }
    if (sub === 'stats') {
      const p6E=Object.entries(p6);
      const d = computePhase6Due(p6, cards);
      return {due_count:d.reviews.length + d.newCards.length,
              mastered_count:p6E.filter(([,v])=>v.phase===6).length, total_cards:p6E.length,
              phase_distribution:[1,2,3,4,5,6].map(ph=>({phase:ph,count:p6E.filter(([,v])=>v.phase===ph).length}))};
    }
  }

  throw new Error('Unknown action: ' + action);
}

function categoryLabel(cat) {
  const map = { vokabeln: 'Vokabeln', konjugation: 'Konjugation', grammatik: 'Grammatik', redewendungen: 'Redewendungen' };
  return map[cat] || cat;
}

function categoryBadgeClass(cat) {
  const map = { vokabeln: 'badge--vokabeln', konjugation: 'badge--konjugation', grammatik: 'badge--grammatik', redewendungen: 'badge--redewendungen' };
  return map[cat] || 'badge--vokabeln';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds === 0) return '0:00 h';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} h`;
  return `${m} Min.`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
window.switchTab = function(tab) {
  if (state.currentTab === tab) return;
  state.currentTab = tab;

  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-item--active'));

  $(`tab-${tab}`).style.display = 'block';
  document.querySelector(`[data-tab="${tab}"]`).classList.add('nav-item--active');

  // Lazy-load tab data
  if (tab === 'library') loadLibrary();
  if (tab === 'learn') loadLearnTab();
  if (tab === 'stats') loadStats();
  if (tab === 'new') { /* no lazy-load needed */ }
};

/* ============================================================
   UPLOAD TAB — OCR & Lesson Builder
   ============================================================ */
function initUploadTab() {
  const uploadZone = $('uploadZone');
  const fileInput = $('fileInput');
  const uploadBtn = $('uploadBtn');
  const removeBtn = $('removeImageBtn');

  uploadBtn.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('click', e => {
    if (e.target === uploadBtn) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleImageFile(e.target.files[0]);
  });

  // Drag & Drop
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  });

  removeBtn.addEventListener('click', () => {
    $('uploadPreview').style.display = 'none';
    $('ocrResult').style.display = 'none';
    $('lessonBuilder').style.display = 'none';
    $('ocrProgress').style.display = 'none';
    $('uploadZone').style.display = 'block';
    fileInput.value = '';
  });

  $('parseTextBtn').addEventListener('click', parseOCRText);
  $('builderAddCardBtn').addEventListener('click', () => addBuilderCard('builderCards', updateBuilderCardCount));
  $('saveUploadLessonBtn').addEventListener('click', saveUploadLesson);
}

async function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    $('previewImg').src = e.target.result;
    $('uploadPreview').style.display = 'flex';
    $('uploadZone').style.display = 'none';
    $('ocrResult').style.display = 'none';
    $('lessonBuilder').style.display = 'none';
    runOCR(e.target.result);
  };
  reader.readAsDataURL(file);
}

async function runOCR(imageSrc) {
  $('ocrProgress').style.display = 'block';
  $('ocrProgressLabel').textContent = 'OCR wird initialisiert…';
  $('ocrProgressBar').style.width = '0%';

  try {
    const worker = await Tesseract.createWorker('ita', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round(m.progress * 100);
          $('ocrProgressBar').style.width = pct + '%';
          $('ocrProgressLabel').textContent = `Text wird erkannt… ${pct}%`;
        } else if (m.status === 'loading language traineddata') {
          $('ocrProgressLabel').textContent = 'Sprachdaten werden geladen…';
          $('ocrProgressBar').style.width = '15%';
        } else if (m.status === 'initializing api') {
          $('ocrProgressLabel').textContent = 'OCR-Engine startet…';
          $('ocrProgressBar').style.width = '30%';
        }
      }
    });

    const result = await worker.recognize(imageSrc);
    await worker.terminate();

    $('ocrProgressBar').style.width = '100%';
    $('ocrProgressLabel').textContent = '✓ Fertig!';

    setTimeout(() => {
      $('ocrProgress').style.display = 'none';
      $('ocrText').value = result.data.text;
      $('ocrResult').style.display = 'block';
      showToast('Text erfolgreich erkannt!', 'success');
    }, 500);

  } catch (err) {
    $('ocrProgress').style.display = 'none';
    showToast('OCR fehlgeschlagen: ' + err.message, 'error');
    console.error(err);
  }
}

function parseOCRText() {
  const text = $('ocrText').value.trim();
  if (!text) { showToast('Kein Text vorhanden', 'error'); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const cards = [];

  for (const line of lines) {
    // Try various separator patterns
    let front = '', back = '';
    const sepMatch = line.match(/^(.+?)\s*[=\-:–|→]\s*(.+)$/);
    if (sepMatch) {
      front = sepMatch[1].trim();
      back = sepMatch[2].trim();
    } else {
      // Try tab-separated
      const parts = line.split('\t');
      if (parts.length >= 2) {
        front = parts[0].trim();
        back = parts[1].trim();
      } else {
        continue; // Skip lines that don't look like flashcard pairs
      }
    }
    if (front && back) cards.push({ front, back, example: '', notes: '' });
  }

  if (cards.length === 0) {
    showToast('Keine Kartenpaare erkannt. Bearbeite den Text manuell.', 'info');
  }

  $('lessonBuilder').style.display = 'block';
  renderBuilderCards('builderCards', cards, updateBuilderCardCount);
  updateBuilderCardCount();
  $('lessonBuilder').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderBuilderCards(containerId, cards, countUpdater) {
  const container = $(containerId);
  container.innerHTML = '';
  cards.forEach((card, i) => {
    container.appendChild(createBuilderCardEl(card, countUpdater));
  });
}

function createBuilderCardEl(card = {}, countUpdater) {
  const div = document.createElement('div');
  div.className = 'builder-card-item';
  div.innerHTML = `
    <button class="builder-card-del" title="Karte entfernen">✕</button>
    <div class="builder-card-row">
      <div class="form-group">
        <label class="form-label">DE</label>
        <input type="text" class="form-input card-front" placeholder="Deutsch…" value="${escHtml(card.front || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">IT</label>
        <input type="text" class="form-input card-back" placeholder="Magyarul…" value="${escHtml(card.back || '')}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Beispiel</label>
      <input type="text" class="form-input card-example" placeholder="Beispielsatz…" value="${escHtml(card.example || '')}" />
    </div>
  `;
  div.querySelector('.builder-card-del').addEventListener('click', () => {
    div.remove();
    if (countUpdater) countUpdater();
  });
  div.querySelector('.card-front').addEventListener('input', countUpdater || (() => {}));
  return div;
}

function addBuilderCard(containerId, countUpdater) {
  const container = $(containerId);
  const el = createBuilderCardEl({}, countUpdater);
  container.appendChild(el);
  el.querySelector('.card-front').focus();
  if (countUpdater) countUpdater();
}

function updateBuilderCardCount() {
  const count = $('builderCards').querySelectorAll('.builder-card-item').length;
  $('builderCardCount').textContent = `${count} Karte${count !== 1 ? 'n' : ''}`;
}

function getBuilderCards(containerId) {
  const cards = [];
  const container = $(containerId);
  container.querySelectorAll('.builder-card-item').forEach(item => {
    const front = item.querySelector('.card-front').value.trim();
    const back = item.querySelector('.card-back').value.trim();
    const example = item.querySelector('.card-example')?.value.trim() || '';
    if (front && back) cards.push({ front, back, example, notes: '' });
  });
  return cards;
}

async function saveUploadLesson() {
  const title = $('builderTitle').value.trim();
  if (!title) { showToast('Bitte gib einen Titel ein', 'error'); $('builderTitle').focus(); return; }

  const cards = getBuilderCards('builderCards');
  if (cards.length === 0) { showToast('Mindestens eine Karte mit DE und IT ist erforderlich', 'error'); return; }

  const btn = $('saveUploadLessonBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';

  try {
    const lesson = await apiFetch(`${API}?action=lessons`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        category: $('builderCategory').value,
        description: $('builderDescription').value.trim(),
      }),
    });

    for (const card of cards) {
      await apiFetch(`${API}?action=cards`, {
        method: 'POST',
        body: JSON.stringify({ lesson_id: lesson.id, ...card }),
      });
    }

    showToast(`Lektion "${title}" mit ${cards.length} Karten gespeichert!`, 'success');
    // Reset form
    $('builderTitle').value = '';
    $('builderDescription').value = '';
    $('builderCards').innerHTML = '';
    updateBuilderCardCount();
    $('lessonBuilder').style.display = 'none';
    $('ocrResult').style.display = 'none';
    $('uploadPreview').style.display = 'none';
    $('uploadZone').style.display = 'block';
    $('previewImg').src = '';
  } catch (err) {
    showToast('Fehler beim Speichern: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>💾 Lektion speichern</span>';
  }
}

/* ============================================================
   LIBRARY TAB
   ============================================================ */
async function loadLibrary() {
  const grid = $('lessonsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lektionen werden geladen…</p></div>';
  try {
    state.lessons = await apiFetch(`${API}?action=lessons`);
    $('librarySubtitle').textContent = `${state.lessons.length} Lektion${state.lessons.length !== 1 ? 'en' : ''}`;
    renderLessonsGrid(grid, state.lessons, 'library');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p class="empty-title">Fehler beim Laden</p><p class="empty-subtitle">${err.message}</p></div>`;
  }
}

function renderLessonsGrid(container, lessons, context = 'library') {
  const search = state.librarySearch.toLowerCase();
  const filter = state.libraryFilter;

  let filtered = lessons;
  if (filter !== 'all') filtered = filtered.filter(l => l.category === filter);
  if (search) filtered = filtered.filter(l => l.title.toLowerCase().includes(search));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p class="empty-title">Keine Lektionen gefunden</p>
        <p class="empty-subtitle">${lessons.length === 0 ? 'Erstelle deine erste Lektion über den Upload oder den Neu-Tab.' : 'Keine Lektionen passen zum Filter.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(lesson => {
    const card = document.createElement('div');
    card.className = 'lesson-card';
    card.dataset.cat = lesson.category || 'vokabeln';
    card.dataset.id = lesson.id;

    const rate = lesson.success_rate != null ? `<span><span class="success-dot"></span> ${lesson.success_rate}%</span>` : '';
    const lastStudied = lesson.last_studied ? `<span>🕐 ${formatDate(lesson.last_studied)}</span>` : '';

    card.innerHTML = `
      <div class="lesson-card-header">
        <span class="lesson-card-title">${escHtml(lesson.title)}</span>
        <span class="category-badge ${categoryBadgeClass(lesson.category)}">${categoryLabel(lesson.category)}</span>
      </div>
      <div class="lesson-card-meta">
        <span>🃏 ${lesson.card_count || 0} Karten</span>
        ${lastStudied}
        ${rate}
      </div>
    `;

    card.addEventListener('click', () => {
      if (context === 'library') openLessonDetail(lesson);
      else if (context === 'learn') startSessionFromLesson(lesson);
    });

    container.appendChild(card);
  });
}

function initLibraryTab() {
  // Category filter
  $('libraryCategoryFilter').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#libraryCategoryFilter .chip').forEach(c => c.classList.remove('chip--active'));
    chip.classList.add('chip--active');
    state.libraryFilter = chip.dataset.cat;
    renderLessonsGrid($('lessonsGrid'), state.lessons, 'library');
  });

  // Search
  $('librarySearch').addEventListener('input', e => {
    state.librarySearch = e.target.value;
    renderLessonsGrid($('lessonsGrid'), state.lessons, 'library');
  });

  $('backToLibraryBtn').addEventListener('click', () => {
    $('lessonDetail').style.display = 'none';
    $('lessonsGrid').style.display = '';
    $('librarySearch').style.display = '';
    document.querySelector('.library-controls').style.display = '';
    document.querySelector('#tab-library .section-header').style.display = '';
    loadLibrary();
  });

  $('editLessonMetaBtn').addEventListener('click', () => {
    const lesson = state.currentLesson;
    $('editLessonTitle').value = lesson.title;
    $('editLessonCategory').value = lesson.category || 'vokabeln';
    $('editLessonDescription').value = lesson.description || '';
    $('lessonMetaEdit').style.display = 'block';
    $('editLessonMetaBtn').style.display = 'none';
  });

  $('cancelLessonMetaBtn').addEventListener('click', () => {
    $('lessonMetaEdit').style.display = 'none';
    $('editLessonMetaBtn').style.display = 'inline-flex';
  });

  $('saveLessonMetaBtn').addEventListener('click', saveLessonMeta);
  $('deleteLessonBtn').addEventListener('click', deleteCurrentLesson);
  $('startLearningFromDetailBtn').addEventListener('click', () => {
    if (state.currentLesson) {
      switchTab('learn');
      setTimeout(() => startSessionFromLesson(state.currentLesson), 100);
    }
  });

  $('addCardToLessonBtn').addEventListener('click', () => {
    $('addCardInlineForm').style.display = $('addCardInlineForm').style.display === 'none' ? 'block' : 'none';
    if ($('addCardInlineForm').style.display !== 'none') $('newCardFront').focus();
  });

  $('cancelNewCardBtn').addEventListener('click', () => {
    $('addCardInlineForm').style.display = 'none';
  });

  $('saveNewCardBtn').addEventListener('click', saveNewCardToLesson);
}

async function openLessonDetail(lesson) {
  state.currentLesson = lesson;
  document.querySelector('.library-controls').style.display = 'none';
  $('lessonsGrid').style.display = 'none';
  document.querySelector('#tab-library .section-header').style.display = 'none';
  $('librarySearch').style.display = 'none';
  $('lessonDetail').style.display = 'block';
  $('lessonMetaEdit').style.display = 'none';
  $('editLessonMetaBtn').style.display = 'inline-flex';
  $('addCardInlineForm').style.display = 'none';

  $('detailLessonTitle').textContent = lesson.title;
  $('detailCategoryBadge').textContent = categoryLabel(lesson.category);
  $('detailCategoryBadge').className = `category-badge ${categoryBadgeClass(lesson.category)}`;
  $('detailDescription').textContent = lesson.description || '';
  $('detailCardCount').textContent = `🃏 ${lesson.card_count || 0} Karten`;
  $('detailLastStudied').textContent = lesson.last_studied ? `🕐 ${formatDate(lesson.last_studied)}` : '';

  await loadDetailCards(lesson.id);
}

async function loadDetailCards(lessonId) {
  const container = $('detailCardsList');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Karten werden geladen…</p></div>';
  try {
    state.currentLessonCards = await apiFetch(`${API}?action=cards&lesson_id=${lessonId}`);
    renderDetailCards();
  } catch (err) {
    container.innerHTML = `<p>Fehler: ${err.message}</p>`;
  }
}

function renderDetailCards() {
  const container = $('detailCardsList');
  if (state.currentLessonCards.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🃏</div><p class="empty-title">Keine Karten</p><p class="empty-subtitle">Füge Karten über den Button oben hinzu.</p></div>`;
    return;
  }

  container.innerHTML = '';
  state.currentLessonCards.forEach(card => {
    const div = document.createElement('div');
    div.className = 'detail-card-item';
    div.dataset.id = card.id;
    div.innerHTML = `
      <div class="detail-card-front">${escHtml(card.front)}</div>
      <div class="detail-card-back">${escHtml(card.back)}</div>
      ${card.example ? `<div class="detail-card-example">„${escHtml(card.example)}"</div>` : ''}
      <div class="detail-card-actions">
        <button class="btn btn-ghost btn-sm edit-card-btn">✏️ Bearbeiten</button>
        <button class="btn btn-danger btn-sm del-card-btn">🗑 Löschen</button>
      </div>
      <div class="detail-card-edit-form" style="display:none">
        <div class="card-edit-row">
          <div class="form-group">
            <label class="form-label">DE</label>
            <input type="text" class="form-input edit-front" value="${escHtml(card.front)}" />
          </div>
          <div class="form-group">
            <label class="form-label">IT</label>
            <input type="text" class="form-input edit-back" value="${escHtml(card.back)}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Beispiel</label>
          <input type="text" class="form-input edit-example" value="${escHtml(card.example || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Notizen</label>
          <input type="text" class="form-input edit-notes" value="${escHtml(card.notes || '')}" />
        </div>
        <div class="form-row-btns">
          <button class="btn btn-primary btn-sm save-edit-btn">Speichern</button>
          <button class="btn btn-ghost btn-sm cancel-edit-btn">Abbrechen</button>
        </div>
      </div>
    `;

    div.querySelector('.edit-card-btn').addEventListener('click', () => {
      const form = div.querySelector('.detail-card-edit-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    div.querySelector('.cancel-edit-btn').addEventListener('click', () => {
      div.querySelector('.detail-card-edit-form').style.display = 'none';
    });

    div.querySelector('.save-edit-btn').addEventListener('click', () => saveCardEdit(card.id, div));

    div.querySelector('.del-card-btn').addEventListener('click', () => deleteCard(card.id, div));

    container.appendChild(div);
  });
}

async function saveCardEdit(cardId, div) {
  const front = div.querySelector('.edit-front').value.trim();
  const back = div.querySelector('.edit-back').value.trim();
  const example = div.querySelector('.edit-example').value.trim();
  const notes = div.querySelector('.edit-notes').value.trim();

  if (!front || !back) { showToast('DE und IT sind erforderlich', 'error'); return; }

  try {
    const updated = await apiFetch(`${API}?action=cards&id=${cardId}`, {
      method: 'PUT',
      body: JSON.stringify({ front, back, example, notes }),
    });
    // Update local state
    const idx = state.currentLessonCards.findIndex(c => c.id === cardId);
    if (idx >= 0) state.currentLessonCards[idx] = updated;
    renderDetailCards();
    showToast('Karte gespeichert', 'success');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function deleteCard(cardId, div) {
  const ok = await confirmDialog('Karte löschen?', 'Diese Karte wird unwiderruflich gelöscht.');
  if (!ok) return;
  try {
    await apiFetch(`${API}?action=cards&id=${cardId}`, { method: 'DELETE' });
    state.currentLessonCards = state.currentLessonCards.filter(c => c.id !== cardId);
    div.remove();
    if (state.currentLesson) state.currentLesson.card_count = Math.max(0, (state.currentLesson.card_count || 1) - 1);
    $('detailCardCount').textContent = `🃏 ${state.currentLessonCards.length} Karten`;
    showToast('Karte gelöscht', 'success');
    if (state.currentLessonCards.length === 0) renderDetailCards();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function saveLessonMeta() {
  const title = $('editLessonTitle').value.trim();
  if (!title) { showToast('Titel erforderlich', 'error'); return; }
  try {
    const updated = await apiFetch(`${API}?action=lessons&id=${state.currentLesson.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        category: $('editLessonCategory').value,
        description: $('editLessonDescription').value.trim(),
      }),
    });
    state.currentLesson = { ...state.currentLesson, ...updated };
    $('detailLessonTitle').textContent = updated.title;
    $('detailCategoryBadge').textContent = categoryLabel(updated.category);
    $('detailCategoryBadge').className = `category-badge ${categoryBadgeClass(updated.category)}`;
    $('detailDescription').textContent = updated.description || '';
    $('lessonMetaEdit').style.display = 'none';
    $('editLessonMetaBtn').style.display = 'inline-flex';
    showToast('Lektion aktualisiert', 'success');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function deleteCurrentLesson() {
  const ok = await confirmDialog(
    'Lektion löschen?',
    `"${state.currentLesson.title}" und alle zugehörigen Karten werden unwiderruflich gelöscht.`
  );
  if (!ok) return;
  try {
    await apiFetch(`${API}?action=lessons&id=${state.currentLesson.id}`, { method: 'DELETE' });
    showToast('Lektion gelöscht', 'success');
    $('backToLibraryBtn').click();
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function saveNewCardToLesson() {
  const front = $('newCardFront').value.trim();
  const back = $('newCardBack').value.trim();
  if (!front || !back) { showToast('DE und IT sind erforderlich', 'error'); return; }

  try {
    const card = await apiFetch(`${API}?action=cards`, {
      method: 'POST',
      body: JSON.stringify({
        lesson_id: state.currentLesson.id,
        front,
        back,
        example: $('newCardExample').value.trim(),
        notes: $('newCardNotes').value.trim(),
      }),
    });
    state.currentLessonCards.push(card);
    if (state.currentLesson) state.currentLesson.card_count = (state.currentLesson.card_count || 0) + 1;
    $('detailCardCount').textContent = `🃏 ${state.currentLessonCards.length} Karten`;
    renderDetailCards();
    $('newCardFront').value = '';
    $('newCardBack').value = '';
    $('newCardExample').value = '';
    $('newCardNotes').value = '';
    $('addCardInlineForm').style.display = 'none';
    showToast('Karte hinzugefügt', 'success');
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

/* ============================================================
   LEARN TAB
   ============================================================ */
async function loadLearnTab() {
  // Render grammar units (default view)
  renderGrammarUnits();

  const grid = $('learnLessonsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Lektionen werden geladen…</p></div>';
  state.selectedLearnLessons.clear();
  state.learnQuestionCount = 'all';
  updateLearnStartBar();
  // Reset count buttons
  document.querySelectorAll('#countOptions .count-btn').forEach(b => {
    b.classList.toggle('count-btn--active', b.dataset.count === 'all');
  });

  try {
    state.lessons = await apiFetch(`${API}?action=lessons`);
    renderLearnSelectGrid(grid, state.lessons);

    // Check for weak cards
    try {
      const weak = await apiFetch(`${API}?action=weak_cards`);
      if (weak.length > 0) {
        $('weakCardsBanner').style.display = 'flex';
      } else {
        $('weakCardsBanner').style.display = 'none';
      }
    } catch (_) {}
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p class="empty-title">Fehler</p><p class="empty-subtitle">${err.message}</p></div>`;
  }
}

function renderLearnSelectGrid(container, lessons) {
  if (lessons.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p class="empty-title">Keine Lektionen</p>
        <p class="empty-subtitle">Erstelle deine erste Lektion über den Upload oder den Neu-Tab.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  lessons.forEach(lesson => {
    const card = document.createElement('div');
    card.className = 'lesson-card lesson-card--selectable';
    card.dataset.cat = lesson.category || 'vokabeln';
    card.dataset.id = lesson.id;

    const isSelected = state.selectedLearnLessons.has(lesson.id);
    if (isSelected) card.classList.add('lesson-card--selected');

    const rate = lesson.success_rate != null ? `<span><span class="success-dot"></span> ${lesson.success_rate}%</span>` : '';
    const lastStudied = lesson.last_studied ? `<span>🕐 ${formatDate(lesson.last_studied)}</span>` : '';

    card.innerHTML = `
      <div class="lesson-select-check">
        <span class="check-icon">${isSelected ? '✓' : ''}</span>
      </div>
      <div class="lesson-card-body">
        <div class="lesson-card-header">
          <span class="lesson-card-title">${escHtml(lesson.title)}</span>
          <span class="category-badge ${categoryBadgeClass(lesson.category)}">${categoryLabel(lesson.category)}</span>
        </div>
        <div class="lesson-card-meta">
          <span>🃏 ${lesson.card_count || 0} Karten</span>
          ${lastStudied}
          ${rate}
        </div>
      </div>
    `;

    card.addEventListener('click', () => toggleLearnLesson(lesson, card));
    container.appendChild(card);
  });
}

function toggleLearnLesson(lesson, cardEl) {
  if (state.selectedLearnLessons.has(lesson.id)) {
    state.selectedLearnLessons.delete(lesson.id);
    cardEl.classList.remove('lesson-card--selected');
    cardEl.querySelector('.check-icon').textContent = '';
  } else {
    state.selectedLearnLessons.add(lesson.id);
    cardEl.classList.add('lesson-card--selected');
    cardEl.querySelector('.check-icon').textContent = '✓';
  }
  updateLearnStartBar();
}

function updateLearnStartBar() {
  const count = state.selectedLearnLessons.size;
  const bar = $('learnStartBar');
  if (count === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';

  const selectedLessons = state.lessons.filter(l => state.selectedLearnLessons.has(l.id));
  const totalCards = selectedLessons.reduce((sum, l) => sum + (l.card_count || 0), 0);

  $('learnSelectedCount').textContent = `${count} Lektion${count !== 1 ? 'en' : ''} gew\u00E4hlt`;
  $('learnTotalCards').textContent = `${totalCards} Karten`;

  // Update count button states based on total cards
  document.querySelectorAll('#countOptions .count-btn').forEach(btn => {
    const val = btn.dataset.count;
    if (val !== 'all') {
      btn.disabled = parseInt(val) > totalCards;
    }
  });
}

function initLearnTab() {
  // Sub-navigation: Lernkarten vs. Lerneinheiten
  document.querySelectorAll('.learn-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.learn-subnav-btn').forEach(b => b.classList.remove('learn-subnav-btn--active'));
      btn.classList.add('learn-subnav-btn--active');
      const view = btn.dataset.view;
      // Hide all learn sub-views
      $('learnLessonPicker').style.display = 'none';
      $('learnUnitsView').style.display = 'none';
      $('learnPhase6View').style.display = 'none';
      $('learnSession').style.display = 'none';
      $('learnSummary').style.display = 'none';

      if (view === 'cards') {
        $('learnLessonPicker').style.display = 'block';
      } else if (view === 'phase6') {
        $('learnPhase6View').style.display = 'block';
        loadPhase6Dashboard();
      } else {
        $('learnUnitsView').style.display = 'block';
        renderGrammarUnits();
      }
    });
  });

  $('dirDE2IT').addEventListener('click', () => {
    state.learnDirection = 'DE2IT';
    $('dirDE2IT').classList.add('toggle-btn--active');
    $('dirIT2DE').classList.remove('toggle-btn--active');
  });
  $('dirIT2DE').addEventListener('click', () => {
    state.learnDirection = 'IT2DE';
    $('dirIT2DE').classList.add('toggle-btn--active');
    $('dirDE2IT').classList.remove('toggle-btn--active');
  });

  // Question count selector
  $('countOptions').addEventListener('click', e => {
    const btn = e.target.closest('.count-btn');
    if (!btn || btn.disabled) return;
    document.querySelectorAll('#countOptions .count-btn').forEach(b => b.classList.remove('count-btn--active'));
    btn.classList.add('count-btn--active');
    state.learnQuestionCount = btn.dataset.count;
  });

  // Multi-lesson start button
  $('startMultiLessonBtn').addEventListener('click', startMultiLessonSession);

  $('startWeakCardsBtn').addEventListener('click', startWeakCardSession);
  $('exitSessionBtn').addEventListener('click', exitSession);
  $('showAnswerBtn').addEventListener('click', showAnswer);
  $('correctBtn').addEventListener('click', () => gradeCard(true));
  $('wrongBtn').addEventListener('click', () => gradeCard(false));

  $('sessionEditToggle').addEventListener('click', () => {
    const card = state.sessionCards[state.sessionIndex];
    if (!card) return;
    $('editCardFront').value = card.front || '';
    $('editCardBack').value = card.back || '';
    $('editCardExample').value = card.example || '';
    $('editCardNotes').value = card.notes || '';
    $('sessionEditForm').style.display = 'block';
    $('sessionEditToggle').style.display = 'none';
  });

  $('cancelSessionEditBtn').addEventListener('click', () => {
    $('sessionEditForm').style.display = 'none';
    $('sessionEditToggle').style.display = '';
  });

  $('saveSessionCardBtn').addEventListener('click', () => {
    const card = state.sessionCards[state.sessionIndex];
    if (!card) return;
    card.front = $('editCardFront').value.trim();
    card.back = $('editCardBack').value.trim();
    card.example = $('editCardExample').value.trim();
    card.notes = $('editCardNotes').value.trim();
    const allCards = DB.cards();
    const idx = allCards.findIndex(c => c.id === card.id);
    if (idx !== -1) { allCards[idx] = { ...allCards[idx], ...card }; DB.saveCards(allCards); }
    showCurrentCard();
    $('sessionEditForm').style.display = 'none';
    $('sessionEditToggle').style.display = '';
    showToast('Karte gespeichert ✓', 'success');
  });
  $('flipCard').addEventListener('click', () => {
    if (!state.sessionFlipped) {
      showAnswer();
    } else {
      // Toggle flip back and forth after answer is revealed
      $('flipCardInner').classList.toggle('flipped');
    }
  });
  $('repeatLessonBtn').addEventListener('click', () => {
    if (state.sessionIsWeakMode) startWeakCardSession();
    else if (state.sessionLessonIds.length > 0) {
      // Repeat multi-lesson session with same selections
      repeatMultiLessonSession();
    } else if (state.sessionLessonId) {
      const lesson = state.lessons.find(l => l.id === state.sessionLessonId);
      if (lesson) startSessionFromLesson(lesson);
    }
  });
  $('backToPickerBtn').addEventListener('click', () => {
    $('learnSummary').style.display = 'none';
    if (state.sessionMode === 'phase6') {
      // Return to Phase-6 dashboard
      $('learnPhase6View').style.display = 'block';
      document.querySelectorAll('.learn-subnav-btn').forEach(b => b.classList.remove('learn-subnav-btn--active'));
      $('learnSubnavPhase6').classList.add('learn-subnav-btn--active');
      loadPhase6Dashboard();
    } else {
      $('learnLessonPicker').style.display = 'block';
      loadLearnTab();
    }
  });
}

async function startSessionFromLesson(lesson) {
  let cards;
  try {
    cards = await apiFetch(`${API}?action=cards&lesson_id=${lesson.id}`);
  } catch (err) {
    showToast('Fehler beim Laden der Karten: ' + err.message, 'error');
    return;
  }

  if (cards.length === 0) {
    showToast('Diese Lektion hat keine Karten', 'error');
    return;
  }

  state.sessionLessonId = lesson.id;
  state.sessionLessonIds = [lesson.id];
  state.sessionIsWeakMode = false;
  state.sessionMode = 'classic';
  startSession(cards, lesson.id);
}

async function startMultiLessonSession() {
  const lessonIds = [...state.selectedLearnLessons];
  if (lessonIds.length === 0) {
    showToast('Bitte w\u00E4hle mindestens eine Lektion', 'error');
    return;
  }

  // Show loading state on start button
  const btn = $('startMultiLessonBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';

  try {
    // Fetch cards from all selected lessons
    const allCards = [];
    for (const id of lessonIds) {
      const cards = await apiFetch(`${API}?action=cards&lesson_id=${id}`);
      allCards.push(...cards);
    }

    if (allCards.length === 0) {
      showToast('Die ausgew\u00E4hlten Lektionen haben keine Karten', 'error');
      return;
    }

    // Apply question count limit
    let sessionCards = allCards;
    if (state.learnQuestionCount !== 'all') {
      const limit = parseInt(state.learnQuestionCount);
      if (limit < allCards.length) {
        sessionCards = shuffle(allCards).slice(0, limit);
      }
    }

    state.sessionLessonId = lessonIds.length === 1 ? lessonIds[0] : lessonIds[0];
    state.sessionLessonIds = lessonIds;
    state.sessionIsWeakMode = false;
    state.sessionMode = 'classic';
    startSession(sessionCards, lessonIds[0]);
  } catch (err) {
    showToast('Fehler beim Laden der Karten: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '\ud83c\udf93 Lernen starten';
  }
}

async function repeatMultiLessonSession() {
  const lessonIds = state.sessionLessonIds;
  if (!lessonIds || lessonIds.length === 0) return;

  try {
    const allCards = [];
    for (const id of lessonIds) {
      const cards = await apiFetch(`${API}?action=cards&lesson_id=${id}`);
      allCards.push(...cards);
    }
    if (allCards.length === 0) {
      showToast('Keine Karten gefunden', 'error');
      return;
    }
    // Re-apply same question count
    let sessionCards = allCards;
    if (state.learnQuestionCount !== 'all') {
      const limit = parseInt(state.learnQuestionCount);
      if (limit < allCards.length) {
        sessionCards = shuffle(allCards).slice(0, limit);
      }
    }
    state.sessionIsWeakMode = false;
    state.sessionMode = 'classic';
    startSession(sessionCards, lessonIds[0]);
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

async function startWeakCardSession() {
  try {
    const cards = await apiFetch(`${API}?action=weak_cards`);
    if (cards.length === 0) { showToast('Keine schwierigen Karten gefunden', 'info'); return; }
    state.sessionLessonId = null;
    state.sessionIsWeakMode = true;
    state.sessionMode = 'classic';
    startSession(cards, null);
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}

function startSession(cards, lessonId) {
  state.sessionCards = shuffle(cards);
  state.sessionOriginalCards = [...cards];
  state.sessionIndex = 0;
  state.sessionRound = 1;
  state.sessionFlipped = false;
  state.sessionStartTime = Date.now();
  state.sessionMode = state.sessionMode || 'classic';
  state.sessionResults = {};
  state.sessionActiveTime = 0;  // accumulated capped time in ms
  state.sessionCardShownAt = Date.now();
  cards.forEach(c => {
    state.sessionResults[c.id] = { correct: false, attempts: 0, firstTry: null };
  });

  $('learnLessonPicker').style.display = 'none';
  $('learnSummary').style.display = 'none';
  $('learnUnitsView').style.display = 'none';
  $('learnSession').style.display = 'block';

  // Scroll to top of session so user sees the cards immediately
  $('learnSession').scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  updateSessionProgress();
  showCurrentCard();
}

function showCurrentCard() {
  const card = state.sessionCards[state.sessionIndex];
  if (!card) return;

  state.sessionFlipped = false;
  $('flipCardInner').classList.remove('flipped');
  $('showAnswerBtn').style.display = 'block';
  $('gradeBtns').style.display = 'none';
  $('sessionRoundLabel').textContent = `Runde ${state.sessionRound}`;

  const isDE2IT = state.learnDirection === 'DE2IT';
  $('cardQuestion').textContent = isDE2IT ? card.front : card.back;
  $('cardAnswer').textContent = isDE2IT ? card.back : card.front;
  $('cardExample').textContent = card.example || '';
  $('cardNotes').textContent = card.notes || '';
  $('sessionScratch').value = '';

  // Track when this card was shown (for time cap)
  state.sessionCardShownAt = Date.now();

  // Show phase badge on both sides of the card
  const phase = card.phase || null;
  const frontBadge = $('cardPhaseFront');
  const backBadge = $('cardPhaseBack');
  if (phase && frontBadge && backBadge) {
    const label = 'P' + phase;
    frontBadge.textContent = label;
    frontBadge.className = 'card-phase-badge card-phase-badge--' + phase;
    backBadge.textContent = label;
    backBadge.className = 'card-phase-badge card-phase-badge--' + phase;
    frontBadge.style.display = '';
    backBadge.style.display = '';
  } else if (frontBadge && backBadge) {
    frontBadge.style.display = 'none';
    backBadge.style.display = 'none';
  }
  // Reset edit form when card changes
  if ($('sessionEditForm')) $('sessionEditForm').style.display = 'none';
  if ($('sessionEditToggle')) $('sessionEditToggle').style.display = '';
}

function updateSessionProgress() {
  const totalOriginal = state.sessionOriginalCards.length;
  const remaining = state.sessionCards.length - state.sessionIndex;
  const done = totalOriginal - Object.values(state.sessionResults).filter(r => !r.correct).length;
  const pct = totalOriginal > 0 ? Math.round((done / totalOriginal) * 100) : 0;
  $('sessionProgressFill').style.width = pct + '%';
  $('sessionProgressLabel').textContent = `${done} / ${totalOriginal}`;
}

function showAnswer() {
  state.sessionFlipped = true;
  $('flipCardInner').classList.add('flipped');
  $('showAnswerBtn').style.display = 'none';
  $('gradeBtns').style.display = 'flex';
}

function gradeCard(correct) {
  const card = state.sessionCards[state.sessionIndex];
  const result = state.sessionResults[card.id];

  if (correct && typeof CelebrationFX !== 'undefined') {
    const flipCard = $('flipCard');
    if (flipCard) CelebrationFX.celebrate(flipCard);
  }

  // Accumulate time for this card, capped at 180 seconds (3 min)
  const cardTime = Date.now() - (state.sessionCardShownAt || Date.now());
  state.sessionActiveTime += Math.min(cardTime, 180000);

  result.attempts++;

  if (correct) {
    result.correct = true;
    if (result.attempts === 1 && result.firstTry === null) result.firstTry = true;
    // Update phase locally: move up (max 6)
    if (card.phase && result.firstTry === true) {
      card.phase = Math.min((card.phase || 1) + 1, 6);
    }
    state.sessionIndex++;
  } else {
    if (result.firstTry === null) result.firstTry = false;
    // Update phase locally: drop to 1
    card.phase = 1;
    // Move to end of queue
    const remaining = state.sessionCards.splice(state.sessionIndex, 1)[0];
    state.sessionCards.push(remaining);
    // Don't increment index
  }

  updateSessionProgress();

  if (state.sessionIndex >= state.sessionCards.length) {
    // Check if there are still wrong cards
    const stillWrong = Object.values(state.sessionResults).filter(r => !r.correct);
    if (stillWrong.length === 0) {
      finishSession();
    } else {
      // Shouldn't happen with Duolingo-style, but safety check
      finishSession();
    }
    return;
  }

  // Check if all remaining are done (all correct)
  const allDone = Object.values(state.sessionResults).every(r => r.correct);
  if (allDone) {
    finishSession();
    return;
  }

  // Check if we've looped through all remaining → new round
  const anyWrong = state.sessionCards.slice(state.sessionIndex).some(c => !state.sessionResults[c.id]?.correct);
  if (!anyWrong) {
    finishSession();
    return;
  }

  // Animate transition
  const flip = $('flipCard');
  flip.style.opacity = '0';
  flip.style.transform = 'translateX(20px)';
  setTimeout(() => {
    flip.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    flip.style.opacity = '1';
    flip.style.transform = 'translateX(0)';
    showCurrentCard();
  }, 150);
  flip.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
}

async function finishSession() {
  const elapsed = Math.floor(state.sessionActiveTime / 1000);
  const totalCards = state.sessionOriginalCards.length;
  const correctFirstTry = Object.values(state.sessionResults).filter(r => r.firstTry === true).length;
  const scorePct = totalCards > 0 ? Math.round((correctFirstTry / totalCards) * 100) : 0;

  // Show summary
  $('learnSession').style.display = 'none';
  $('learnSummary').style.display = 'block';

  $('summaryCorrect').textContent = correctFirstTry;
  $('summaryTotal').textContent = totalCards;
  // Calculate actual rounds = max attempts any single card needed
  const maxRounds = Math.max(1, ...Object.values(state.sessionResults).map(r => r.attempts));
  $('summaryRounds').textContent = maxRounds;
  $('summaryTime').textContent = formatTime(elapsed);
  $('summaryScorePct').textContent = scorePct + '%';

  // Per-attempt breakdown: how many cards needed N attempts
  const attemptBuckets = {};
  Object.values(state.sessionResults).forEach(r => {
    const att = r.attempts;
    if (!attemptBuckets[att]) attemptBuckets[att] = 0;
    attemptBuckets[att]++;
  });
  const sortedAttempts = Object.keys(attemptBuckets).map(Number).sort((a, b) => a - b);
  let breakdownHtml = '';
  sortedAttempts.forEach(att => {
    const count = attemptBuckets[att];
    const label = att === 1 ? '1. Versuch' : att + '. Versuch';
    const icon = att === 1 ? '\u2713' : att <= 2 ? '\u21bb' : '\u2026';
    const cls = att === 1 ? 'attempt-first' : att <= 2 ? 'attempt-second' : 'attempt-multi';
    breakdownHtml += `
      <div class="attempt-row ${cls}">
        <span class="attempt-icon">${icon}</span>
        <span class="attempt-label">${count} Karte${count !== 1 ? 'n' : ''} beim ${label}</span>
      </div>`;
  });
  const breakdownEl = $('summaryAttemptBreakdown');
  if (breakdownEl) {
    breakdownEl.innerHTML = breakdownHtml;
    breakdownEl.style.display = sortedAttempts.length > 0 ? 'block' : 'none';
  }

  // Animate score arc
  const circumference = 264;
  const offset = circumference - (circumference * scorePct / 100);
  setTimeout(() => {
    $('scoreArc').style.strokeDashoffset = offset;
    $('scoreArc').style.stroke = scorePct >= 70 ? 'var(--green)' : scorePct >= 40 ? 'var(--gold)' : 'var(--red)';
  }, 200);

  $('summaryIcon').textContent = scorePct === 100 ? '🏆' : scorePct >= 70 ? '🎉' : scorePct >= 40 ? '💪' : '📖';

  // Save to backend — ONE session per learning run
  const lessonIds = state.sessionLessonIds.length > 0 ? state.sessionLessonIds : (state.sessionLessonId ? [state.sessionLessonId] : []);
  const primaryLessonId = lessonIds[0] || state.sessionOriginalCards[0]?.lesson_id || null;

  if (primaryLessonId || state.sessionIsWeakMode) {
    const cardResultsArr = Object.entries(state.sessionResults).map(([cardId, r]) => ({
      card_id: parseInt(cardId),
      correct: r.firstTry === true,
      attempts: r.attempts,
    }));

    const effectiveLessonId = primaryLessonId || state.sessionOriginalCards[0]?.lesson_id;

    try {
      await apiFetch(`${API}?action=sessions`, {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: effectiveLessonId,
          total_cards: totalCards,
          correct_first_try: correctFirstTry,
          total_rounds: Math.max(1, ...Object.values(state.sessionResults).map(r => r.attempts)),
          duration_seconds: elapsed,
          card_results: cardResultsArr,
          lesson_ids: lessonIds.length > 1 ? lessonIds : undefined,
        }),
      });
    } catch (err) {
      console.warn('Could not save session', err);
    }
  }
}

function exitSession() {
  $('learnSession').style.display = 'none';
  $('learnSummary').style.display = 'none';
  $('learnLessonPicker').style.display = 'none';
  $('learnPhase6View').style.display = 'none';
  // Reset subnav to Lerneinheiten
  document.querySelectorAll('.learn-subnav-btn').forEach(b => b.classList.remove('learn-subnav-btn--active'));
  $('learnSubnavUnits').classList.add('learn-subnav-btn--active');
  $('learnUnitsView').style.display = 'block';
  loadLearnTab();
}

/* ============================================================
   GRAMMAR UNITS (Lerneinheiten)
   ============================================================ */
const GRAMMAR_UNITS = [
  {
    id: 'nevelok',
    title: 'Artikel (a, az, egy)',
    icon: '📝',
    color: '#CD2A3E',
    lessonIds: [],
    intro: 'Das Ungarische kennt einen bestimmten Artikel (a / az) und einen unbestimmten Artikel (egy). Sie verändern sich nicht nach Geschlecht – ein grammatisches Geschlecht gibt es im Ungarischen nicht.',
    sections: [
      {
        heading: 'Bestimmter Artikel: a / az',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Form</th><th>Verwendung</th><th>Beispiel</th></tr></thead>
          <tbody>
            <tr><td class="person"><strong>a</strong></td><td>vor Konsonant</td><td><strong>a</strong> ház (das Haus)</td></tr>
            <tr><td class="person"><strong>a</strong></td><td>vor Konsonant</td><td><strong>a</strong> kutya (der Hund)</td></tr>
            <tr><td class="person"><strong>az</strong></td><td>vor Vokal</td><td><strong>az</strong> alma (der Apfel)</td></tr>
            <tr><td class="person"><strong>az</strong></td><td>vor Vokal</td><td><strong>az</strong> ember (der Mensch)</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ Der Artikel hängt nur vom <strong>Anfangslaut</strong> des nächsten Wortes ab – nicht vom Geschlecht.</div>`
      },
      {
        heading: 'Unbestimmter Artikel: egy',
        content: `<ul class="grammar-list">
          <li><strong>egy</strong> heißt „ein/eine" und ist zugleich das Wort für „eins": <em>egy ház</em> (ein Haus), <em>egy alma</em> (ein Apfel).</li>
          <li>Im Plural und bei allgemeinen Aussagen wird <strong>egy</strong> meist weggelassen: <em>Almát eszem.</em> (Ich esse [einen] Apfel.)</li>
        </ul>
        <div class="grammar-note">ℹ️ Auch der Plural braucht keinen besonderen Artikel: <em>a házak</em> = die Häuser.</div>`
      }
    ]
  },
  {
    id: 'maganhangzo-harmonia',
    title: 'Vokalharmonie (Magánhangzó-harmónia)',
    icon: '🎵',
    color: '#436F4D',
    lessonIds: [],
    intro: 'Endungen (Suffixe) richten sich nach den Vokalen des Wortstamms. Man unterscheidet dunkle (hintere) und helle (vordere) Vokale. Das ist der Schlüssel zur ganzen ungarischen Grammatik.',
    sections: [
      {
        heading: 'Dunkle und helle Vokale',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Gruppe</th><th>Vokale</th></tr></thead>
          <tbody>
            <tr><td class="person">dunkel (hinten)</td><td><strong>a · á · o · ó · u · ú</strong></td></tr>
            <tr><td class="person">hell (vorne)</td><td><strong>e · é · i · í · ö · ő · ü · ű</strong></td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ <strong>i, í, e, é</strong> sind „neutral" und verhalten sich meist wie helle Vokale.</div>`
      },
      {
        heading: 'Suffixe passen sich an',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Endung</th><th>dunkel</th><th>hell</th><th>hell gerundet</th></tr></thead>
          <tbody>
            <tr><td class="person">„in" (-ban/-ben)</td><td>ház → ház<strong>ban</strong></td><td>kert → kert<strong>ben</strong></td><td>–</td></tr>
            <tr><td class="person">„zu" (-hoz/-hez/-höz)</td><td>ház → ház<strong>hoz</strong></td><td>kert → kert<strong>hez</strong></td><td>kör → kör<strong>höz</strong></td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">⚠️ Zweiteilige Endungen wählen zwischen dunkel/hell, dreiteilige Endungen haben zusätzlich eine gerundete Variante (ö/ő/ü/ű im Stamm → -höz).</div>`
      }
    ]
  },
  {
    id: 'esetek',
    title: 'Fälle & Endungen (Esetek)',
    icon: '🔗',
    color: '#0f3460',
    lessonIds: [],
    intro: 'Statt Präpositionen hängt das Ungarische Endungen an das Wort an. Alle Endungen folgen der Vokalharmonie.',
    sections: [
      {
        heading: 'Die wichtigsten Endungen',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Funktion</th><th>Endung</th><th>Beispiel</th></tr></thead>
          <tbody>
            <tr><td class="person">Akkusativ (wen/was)</td><td>-t</td><td>kávé → kávé<strong>t</strong> (den Kaffee)</td></tr>
            <tr><td class="person">Dativ (wem)</td><td>-nak / -nek</td><td>Anna → Anná<strong>nak</strong></td></tr>
            <tr><td class="person">in (wo)</td><td>-ban / -ben</td><td>ház<strong>ban</strong> (im Haus)</td></tr>
            <tr><td class="person">hinein (wohin)</td><td>-ba / -be</td><td>ház<strong>ba</strong> (ins Haus)</td></tr>
            <tr><td class="person">aus (woher)</td><td>-ból / -ből</td><td>ház<strong>ból</strong> (aus dem Haus)</td></tr>
            <tr><td class="person">auf (wo)</td><td>-on / -en / -ön</td><td>asztal<strong>on</strong> (auf dem Tisch)</td></tr>
            <tr><td class="person">bei (wo)</td><td>-nál / -nél</td><td>Péter<strong>nél</strong> (bei Peter)</td></tr>
            <tr><td class="person">zu (wohin)</td><td>-hoz / -hez / -höz</td><td>orvos<strong>hoz</strong> (zum Arzt)</td></tr>
            <tr><td class="person">mit</td><td>-val / -vel</td><td>busz → busz<strong>szal</strong> (mit dem Bus)</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Beispiele',
        content: `<ul class="grammar-list">
          <li><strong>Kérek egy kávét.</strong> – Ich möchte einen Kaffee. (kávé + -t)</li>
          <li><strong>A házban vagyok.</strong> – Ich bin im Haus. (ház + -ban)</li>
          <li><strong>Budapestre megyek.</strong> – Ich fahre nach Budapest. (Budapest + -re)</li>
          <li><strong>Annának adom.</strong> – Ich gebe es Anna. (Anna + -nak)</li>
          <li><strong>Busszal megyek.</strong> – Ich fahre mit dem Bus. (busz + -val → -szal)</li>
        </ul>
        <div class="grammar-note">⚠️ Bei <strong>-val/-vel</strong> verschmilzt das v mit dem letzten Konsonanten: busz + val → <em>busszal</em>, vonat + val → <em>vonattal</em>.</div>`
      }
    ]
  },
  {
    id: 'jelen-ido',
    title: 'Präsens – allgemeine Konjugation (Jelen idő)',
    icon: '⏰',
    color: '#C8963E',
    lessonIds: [],
    intro: 'Die allgemeine (unbestimmte) Konjugation nutzt man, wenn es kein Objekt oder ein unbestimmtes Objekt gibt. Die Endungen folgen der Vokalharmonie.',
    sections: [
      {
        heading: 'Regelmäßige Endungen',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>dunkel<br>(tanul – lernen)</th><th>hell<br>(kér – bitten)</th><th>hell ger.<br>(ül – sitzen)</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>tanul<strong>ok</strong></td><td>kér<strong>ek</strong></td><td>ül<strong>ök</strong></td></tr>
            <tr><td class="person">te</td><td>tanul<strong>sz</strong></td><td>kér<strong>sz</strong></td><td>ül<strong>sz</strong></td></tr>
            <tr><td class="person">ő</td><td>tanul</td><td>kér</td><td>ül</td></tr>
            <tr><td class="person">mi</td><td>tanul<strong>unk</strong></td><td>kér<strong>ünk</strong></td><td>ül<strong>ünk</strong></td></tr>
            <tr><td class="person">ti</td><td>tanul<strong>tok</strong></td><td>kér<strong>tek</strong></td><td>ül<strong>tök</strong></td></tr>
            <tr><td class="person">ők</td><td>tanul<strong>nak</strong></td><td>kér<strong>nek</strong></td><td>ül<strong>nek</strong></td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ Die 3. Person Singular (<strong>ő</strong>) ist meist der reine Wortstamm – ohne Endung.</div>`
      },
      {
        heading: 'Hinweise',
        content: `<ul class="grammar-list">
          <li>Personalpronomen (én, te, ő …) werden meist weggelassen, weil die Endung schon zeigt, wer gemeint ist: <em>Tanulok.</em> = Ich lerne.</li>
          <li>Nach Zischlauten (s, sz, z) wird die „te"-Endung <strong>-sz</strong> zu <strong>-ol/-el/-öl</strong>: <em>olvasol</em> (du liest), <em>nézel</em> (du schaust).</li>
        </ul>`
      }
    ]
  },
  {
    id: 'targyas',
    title: 'Bestimmte Konjugation (Tárgyas ragozás)',
    icon: '🎯',
    color: '#6B4C9A',
    lessonIds: [],
    intro: 'Eine Besonderheit des Ungarischen: Das Verb wird unterschiedlich konjugiert, je nachdem ob das Objekt bestimmt oder unbestimmt ist.',
    sections: [
      {
        heading: 'Wann bestimmt, wann unbestimmt?',
        content: `<ul class="grammar-list">
          <li><strong>Unbestimmt</strong> (allgemeine Konj.): kein Objekt oder unbestimmtes Objekt (egy …): <em>Olvasok egy könyvet.</em> – Ich lese ein Buch.</li>
          <li><strong>Bestimmt</strong> (Objekt-Konj.): bestimmtes Objekt – mit Artikel <em>a/az</em>, Eigenname oder 3. Person: <em>Olvasom a könyvet.</em> – Ich lese das Buch.</li>
        </ul>`
      },
      {
        heading: 'Vergleich: lát (sehen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>unbestimmt</th><th>bestimmt</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>lát<strong>ok</strong></td><td>lát<strong>om</strong></td></tr>
            <tr><td class="person">te</td><td>lát<strong>sz</strong></td><td>lát<strong>od</strong></td></tr>
            <tr><td class="person">ő</td><td>lát</td><td>lát<strong>ja</strong></td></tr>
            <tr><td class="person">mi</td><td>lát<strong>unk</strong></td><td>lát<strong>juk</strong></td></tr>
            <tr><td class="person">ti</td><td>lát<strong>tok</strong></td><td>lát<strong>játok</strong></td></tr>
            <tr><td class="person">ők</td><td>lát<strong>nak</strong></td><td>lát<strong>ják</strong></td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ Bei hellen Verben: kér<strong>em</strong>, kér<strong>ed</strong>, kér<strong>i</strong>, kér<strong>jük</strong>, kér<strong>itek</strong>, kér<strong>ik</strong>.</div>`
      }
    ]
  },
  {
    id: 'fontos-igek',
    title: 'Die wichtigsten Verben',
    icon: '⭐',
    color: '#CD2A3E',
    lessonIds: [],
    intro: 'Diese häufigen Verben sind teils unregelmäßig und bilden die Grundlage des Alltagsungarischen (Präsens, allgemeine Konjugation).',
    sections: [
      {
        heading: 'lenni (sein)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>vagyok</td></tr>
            <tr><td class="person">te</td><td>vagy</td></tr>
            <tr><td class="person">ő</td><td>van</td></tr>
            <tr><td class="person">mi</td><td>vagyunk</td></tr>
            <tr><td class="person">ti</td><td>vagytok</td></tr>
            <tr><td class="person">ők</td><td>vannak</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">⚠️ Bei Eigenschaft/Beruf in der 3. Person entfällt „van": <em>Anna tanár.</em> (Anna ist Lehrerin.)</div>`
      },
      {
        heading: 'menni (gehen/fahren)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>megyek</td></tr>
            <tr><td class="person">te</td><td>mész</td></tr>
            <tr><td class="person">ő</td><td>megy</td></tr>
            <tr><td class="person">mi</td><td>megyünk</td></tr>
            <tr><td class="person">ti</td><td>mentek</td></tr>
            <tr><td class="person">ők</td><td>mennek</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'jönni (kommen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>jövök</td></tr>
            <tr><td class="person">te</td><td>jössz</td></tr>
            <tr><td class="person">ő</td><td>jön</td></tr>
            <tr><td class="person">mi</td><td>jövünk</td></tr>
            <tr><td class="person">ti</td><td>jöttök</td></tr>
            <tr><td class="person">ők</td><td>jönnek</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'enni (essen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>eszem</td></tr>
            <tr><td class="person">te</td><td>eszel</td></tr>
            <tr><td class="person">ő</td><td>eszik</td></tr>
            <tr><td class="person">mi</td><td>eszünk</td></tr>
            <tr><td class="person">ti</td><td>esztek</td></tr>
            <tr><td class="person">ők</td><td>esznek</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ <strong>enni</strong> ist ein „ik-Verb" – die 3. Person endet auf <em>-ik</em>.</div>`
      },
      {
        heading: 'inni (trinken)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>iszom</td></tr>
            <tr><td class="person">te</td><td>iszol</td></tr>
            <tr><td class="person">ő</td><td>iszik</td></tr>
            <tr><td class="person">mi</td><td>iszunk</td></tr>
            <tr><td class="person">ti</td><td>isztok</td></tr>
            <tr><td class="person">ők</td><td>isznak</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'tudni (wissen/können)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>tudok</td></tr>
            <tr><td class="person">te</td><td>tudsz</td></tr>
            <tr><td class="person">ő</td><td>tud</td></tr>
            <tr><td class="person">mi</td><td>tudunk</td></tr>
            <tr><td class="person">ti</td><td>tudtok</td></tr>
            <tr><td class="person">ők</td><td>tudnak</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ <strong>tudni</strong> + Infinitiv = können: <em>Tudok úszni.</em> (Ich kann schwimmen.)</div>`
      },
      {
        heading: 'akarni (wollen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>akarok</td></tr>
            <tr><td class="person">te</td><td>akarsz</td></tr>
            <tr><td class="person">ő</td><td>akar</td></tr>
            <tr><td class="person">mi</td><td>akarunk</td></tr>
            <tr><td class="person">ti</td><td>akartok</td></tr>
            <tr><td class="person">ők</td><td>akarnak</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'beszélni (sprechen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>beszélek</td></tr>
            <tr><td class="person">te</td><td>beszélsz</td></tr>
            <tr><td class="person">ő</td><td>beszél</td></tr>
            <tr><td class="person">mi</td><td>beszélünk</td></tr>
            <tr><td class="person">ti</td><td>beszéltek</td></tr>
            <tr><td class="person">ők</td><td>beszélnek</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">ℹ️ <em>Beszélsz magyarul?</em> – Sprichst du Ungarisch?</div>`
      },
      {
        heading: 'csinálni (machen/tun)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Präsens</th></tr></thead>
          <tbody>
            <tr><td class="person">én</td><td>csinálok</td></tr>
            <tr><td class="person">te</td><td>csinálsz</td></tr>
            <tr><td class="person">ő</td><td>csinál</td></tr>
            <tr><td class="person">mi</td><td>csinálunk</td></tr>
            <tr><td class="person">ti</td><td>csináltok</td></tr>
            <tr><td class="person">ők</td><td>csinálnak</td></tr>
          </tbody>
        </table></div>`
      }
    ]
  }
];

function renderGrammarUnits() {
  const container = $('grammarUnitsContainer');
  if (container.children.length > 0) return; // Already rendered

  container.innerHTML = '';
  GRAMMAR_UNITS.forEach(unit => {
    const el = document.createElement('div');
    el.className = 'grammar-unit';

    const hasCards = unit.lessonIds && unit.lessonIds.length > 0;
    const practiceHtml = hasCards
      ? `<div class="grammar-practice-wrap"><button class="btn btn-primary btn-sm grammar-practice-btn" data-unit-id="${unit.id}">5 Karten üben</button></div>`
      : '';

    el.innerHTML = `
      <div class="grammar-unit-header" style="--unit-color: ${unit.color}">
        <div class="grammar-unit-icon">${unit.icon}</div>
        <div class="grammar-unit-title-wrap">
          <h3 class="grammar-unit-title">${escHtml(unit.title)}</h3>
          <p class="grammar-unit-intro">${unit.intro}</p>
        </div>
        <span class="grammar-unit-chevron">▾</span>
      </div>
      <div class="grammar-unit-body" style="display:none">
        ${unit.sections.map(s => `
          <div class="grammar-section">
            <h4 class="grammar-section-heading">${escHtml(s.heading)}</h4>
            ${s.content}
          </div>
        `).join('')}
        ${practiceHtml}
      </div>
    `;

    const header = el.querySelector('.grammar-unit-header');
    const body = el.querySelector('.grammar-unit-body');
    const chevron = el.querySelector('.grammar-unit-chevron');

    header.addEventListener('click', () => {
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      chevron.textContent = isOpen ? '▾' : '▴';
      el.classList.toggle('grammar-unit--open', !isOpen);
    });

    const pBtn = el.querySelector('.grammar-practice-btn');
    if (pBtn) {
      pBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startGrammarUnitPractice(unit);
      });
    }

    container.appendChild(el);
  });
}

async function startGrammarUnitPractice(unit) {
  try {
    const allCards = [];
    for (const lid of unit.lessonIds) {
      const cards = await apiFetch(`${API}?action=cards&lesson_id=${lid}`);
      allCards.push(...cards);
    }
    if (allCards.length === 0) {
      showToast('Keine Karten in dieser Lerneinheit gefunden.', 'error');
      return;
    }
    const shuffled = shuffle([...allCards]);
    const picked = shuffled.slice(0, 5);
    state.sessionLessonId = null;
    state.sessionLessonIds = unit.lessonIds;
    state.sessionIsWeakMode = false;
    state.sessionMode = 'classic';
    state.learnQuestionCount = 'all';
    startSession(picked, null);
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
  }
}


/* ============================================================
   STATISTICS TAB
   ============================================================ */
async function loadStats() {
  const content = $('statsContent');
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Statistiken werden geladen…</p></div>';

  try {
    const [stats, weakCards] = await Promise.all([
      apiFetch(`${API}?action=stats`),
      apiFetch(`${API}?action=weak_cards`),
    ]);

    // Destroy old charts
    Object.values(state.charts).forEach(c => c.destroy());
    state.charts = {};

    renderStats(stats, weakCards);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p class="empty-title">Fehler beim Laden</p><p class="empty-subtitle">${err.message}</p></div>`;
  }
}

function renderStats(stats, weakCards) {
  const content = $('statsContent');
  const rate = stats.overall_success_rate != null ? stats.overall_success_rate + '%' : '—';

  let html = `
    <div class="stats-overview">
      <div class="stat-card">
        <span class="stat-card-icon">📚</span>
        <span class="stat-card-value">${stats.total_lessons}</span>
        <span class="stat-card-label">Lektionen</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-icon">🃏</span>
        <span class="stat-card-value">${stats.total_cards}</span>
        <span class="stat-card-label">Karten gesamt</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-icon">🎓</span>
        <span class="stat-card-value">${stats.total_sessions}</span>
        <span class="stat-card-label">Lerneinheiten</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-icon">✓</span>
        <span class="stat-card-value">${rate}</span>
        <span class="stat-card-label">Erfolgsquote</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-icon">🔥</span>
        <span class="stat-card-value" style="${!stats.studied_today ? 'color:#CE2B37' : ''}">${stats.streak || 0}</span>
        <span class="stat-card-label">Tage-Streak${stats.streak_start ? ', seit ' + new Date(stats.streak_start).toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'2-digit'}) : ''}</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-icon">⏱</span>
        <span class="stat-card-value">${formatDuration(stats.total_duration || 0)}</span>
        <span class="stat-card-label">Gesamte Lernzeit</span>
      </div>
    </div>
  `;

  // Daily sessions chart
  if (stats.daily_sessions && stats.daily_sessions.length > 0) {
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Lernaktivität (14 Tage)</h3>
        <div class="chart-wrap">
          <canvas id="dailyChart"></canvas>
        </div>
      </div>
    `;
  }

  // Phase-6 stats (right after activity chart)
  if (stats.phase6) {
    const p6 = stats.phase6;
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Phase-6 Lernstand</h3>
        <div class="phase6-stats-grid">
          <div class="phase6-stat">
            <span class="phase6-stat-value">${p6.due_count}</span>
            <span class="phase6-stat-label">Fällig</span>
          </div>
          <div class="phase6-stat">
            <span class="phase6-stat-value">${p6.mastered_count}</span>
            <span class="phase6-stat-label">Langzeit (P6)</span>
          </div>
          <div class="phase6-stat">
            <span class="phase6-stat-value">${p6.total_cards}</span>
            <span class="phase6-stat-label">Gesamt</span>
          </div>
        </div>
        <div class="phase6-mini-bars" id="statsPhase6Bars"></div>
      </div>
    `;
  }

  // Erfolgsquote chart (before the lesson list)
  if (stats.lesson_stats && stats.lesson_stats.length > 0) {
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Erfolgsquote je Kategorie</h3>
        <div class="chart-wrap">
          <canvas id="lessonChart"></canvas>
        </div>
      </div>
    `;
  }

  // Per-lesson breakdown (list)
  if (stats.lesson_stats && stats.lesson_stats.length > 0) {
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Lektionen-Übersicht</h3>
    `;
    stats.lesson_stats.forEach(ls => {
      const r = ls.success_rate != null ? ls.success_rate + '%' : '—';
      html += `
        <div class="lesson-stat-row">
          <span class="category-badge ${categoryBadgeClass(ls.category)}">${categoryLabel(ls.category)}</span>
          <div class="lesson-stat-info">
            <div class="lesson-stat-title">${escHtml(ls.title)}</div>
            <div class="lesson-stat-meta">${ls.card_count} Karten · ${ls.session_count} Einheiten</div>
          </div>
          <div class="lesson-stat-rate">${r}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  // Weak cards
  if (weakCards && weakCards.length > 0) {
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Schwierige Karten</h3>
    `;
    weakCards.forEach(wc => {
      html += `
        <div class="weak-card-row">
          <div class="weak-card-content">
            <div class="weak-card-front">${escHtml(wc.front)}</div>
            <div class="weak-card-back">${escHtml(wc.back)}</div>
            <div class="weak-card-lesson">${escHtml(wc.lesson_title)}</div>
          </div>
          <span class="fail-badge">${wc.fail_count}x falsch</span>
        </div>
      `;
    });

    html += `
        <button class="btn btn-primary" onclick="switchTab('learn')">
          Schwierige Karten üben
        </button>
      </div>
    `;
  }

  // Recent sessions
  if (stats.recent_sessions && stats.recent_sessions.length > 0) {
    html += `
      <div class="stats-section">
        <h3 class="stats-section-title">Letzte Lerneinheiten</h3>
    `;
    stats.recent_sessions.forEach(s => {
      const pct = s.score_pct != null ? s.score_pct + '%' : '—';
      html += `
        <div class="recent-session-row">
          <div>
            <div class="session-lesson-title">${escHtml(s.lesson_title)}</div>
            <div class="session-date">${formatDate(s.completed_at)} · ${s.total_cards} Karten</div>
          </div>
          <div class="session-score">${pct}</div>
        </div>
      `;
    });
    html += `</div>`;
  }

  if (stats.total_sessions === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p class="empty-title">Noch keine Statistiken</p>
        <p class="empty-subtitle">Absolviere deine erste Lerneinheit um Statistiken zu sehen.</p>
      </div>
    `;
  }

  content.innerHTML = html;

  // Render Charts after DOM update
  requestAnimationFrame(() => {
    const chartDefaults = {
      font: { family: "'DM Sans', sans-serif", size: 12 },
      color: '#5a5772',
    };
    Chart.defaults.font = chartDefaults.font;
    Chart.defaults.color = chartDefaults.color;

    // Daily sessions chart
    if (stats.daily_sessions && stats.daily_sessions.length > 0) {
      const dailyEl = document.getElementById('dailyChart');
      if (dailyEl) {
        state.charts.daily = new Chart(dailyEl, {
          type: 'bar',
          data: {
            labels: stats.daily_sessions.map(d => {
              const date = new Date(d.day);
              return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            }),
            datasets: [
              {
                label: 'Lerneinheiten',
                data: stats.daily_sessions.map(d => d.count),
                backgroundColor: 'rgba(26,26,46,0.8)',
                borderRadius: 6,
                borderSkipped: false,
                yAxisID: 'y',
              },
              {
                label: 'Lernzeit (Min.)',
                data: stats.daily_sessions.map(d => Math.round((d.duration || 0) / 60)),
                backgroundColor: 'rgba(177,198,154,0.7)',
                borderRadius: 6,
                borderSkipped: false,
                yAxisID: 'y2',
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: function(ctx) {
                    if (ctx.datasetIndex === 1) return ctx.dataset.label + ': ' + ctx.raw + ' Min.';
                    return ctx.dataset.label + ': ' + ctx.raw;
                  }
                }
              }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' }, title: { display: false } },
              y2: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + ' Min.' }, title: { display: false } },
              x: { grid: { display: false } },
            },
          },
        });
      }
    }

    // Category success chart (grouped by category)
    if (stats.lesson_stats && stats.lesson_stats.length > 0) {
      const lessonEl = document.getElementById('lessonChart');
      if (lessonEl) {
        const validLessons = stats.lesson_stats.filter(ls => ls.success_rate != null);
        if (validLessons.length > 0) {
          const catColors = {
            vokabeln: 'rgba(200,150,62,0.8)',
            konjugation: 'rgba(0,146,70,0.8)',
            grammatik: 'rgba(206,43,55,0.8)',
            redewendungen: 'rgba(15,52,96,0.8)',
          };
          const catLabels = {
            vokabeln: 'Vokabeln',
            konjugation: 'Konjugation',
            grammatik: 'Grammatik',
            redewendungen: 'Redewendungen',
          };
          // Group by category and compute weighted average
          const catMap = {};
          validLessons.forEach(ls => {
            const cat = ls.category || 'vokabeln';
            if (!catMap[cat]) catMap[cat] = { totalCorrect: 0, totalAttempts: 0 };
            const attempts = ls.card_count * (ls.session_count || 1);
            catMap[cat].totalCorrect += (ls.success_rate / 100) * attempts;
            catMap[cat].totalAttempts += attempts;
          });
          const categories = Object.keys(catMap);
          const catRates = categories.map(c => Math.round(catMap[c].totalCorrect / catMap[c].totalAttempts * 100 * 10) / 10);
          state.charts.lesson = new Chart(lessonEl, {
            type: 'bar',
            data: {
              labels: categories.map(c => catLabels[c] || c),
              datasets: [{
                label: 'Erfolgsquote %',
                data: catRates,
                backgroundColor: categories.map(c => catColors[c] || catColors.vokabeln),
                borderRadius: 6,
                borderSkipped: false,
              }],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: {
                  beginAtZero: true, max: 100,
                  ticks: { callback: v => v + '%' },
                  grid: { color: 'rgba(0,0,0,0.05)' },
                },
                x: { grid: { display: false } },
              },
            },
          });
        }
      }
    }
  });

  // Render Phase-6 mini distribution in stats
  if (stats.phase6 && stats.phase6.phase_distribution) {
    const miniContainer = document.getElementById('statsPhase6Bars');
    if (miniContainer) {
      const total = stats.phase6.total_cards || 1;
      const phaseCounts = {};
      for (let i = 1; i <= 6; i++) phaseCounts[i] = 0;
      stats.phase6.phase_distribution.forEach(p => { phaseCounts[p.phase] = p.count; });
      let barsHtml = '';
      for (let phase = 1; phase <= 6; phase++) {
        const count = phaseCounts[phase];
        const pct = Math.round((count / total) * 100);
        const w = Math.max(pct, 2);
        barsHtml += `<div class="phase6-bar-row"><span class="phase6-bar-label">P${phase}</span><div class="phase6-bar-track"><div class="phase6-bar-fill phase6-bar--${phase}" style="width:${w}%"></div></div><span class="phase6-bar-count">${count}</span></div>`;
      }
      miniContainer.innerHTML = barsHtml;
    }
  }
}

/* ============================================================
   NEW LESSON TAB
   ============================================================ */
function initNewLessonTab() {
  $('newLessonAddCardBtn').addEventListener('click', () => {
    addBuilderCard('newLessonCards', updateNewLessonCardCount);
  });
  $('saveNewLessonBtn').addEventListener('click', saveNewLesson);

  // Add first empty card by default
  addBuilderCard('newLessonCards', updateNewLessonCardCount);
}

function updateNewLessonCardCount() {
  const count = $('newLessonCards').querySelectorAll('.builder-card-item').length;
  $('newLessonCardCount').textContent = `${count} Karte${count !== 1 ? 'n' : ''}`;
}

async function saveNewLesson() {
  const title = $('newLessonTitle').value.trim();
  if (!title) { showToast('Bitte gib einen Titel ein', 'error'); $('newLessonTitle').focus(); return; }

  const cards = getBuilderCards('newLessonCards');
  if (cards.length === 0) { showToast('Mindestens eine Karte ist erforderlich', 'error'); return; }

  const btn = $('saveNewLessonBtn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 auto"></div>';

  try {
    const lesson = await apiFetch(`${API}?action=lessons`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        category: $('newLessonCategory').value,
        description: $('newLessonDescription').value.trim(),
      }),
    });

    for (const card of cards) {
      await apiFetch(`${API}?action=cards`, {
        method: 'POST',
        body: JSON.stringify({ lesson_id: lesson.id, ...card }),
      });
    }

    showToast(`Lektion "${title}" mit ${cards.length} Karten gespeichert!`, 'success');

    // Reset form
    $('newLessonTitle').value = '';
    $('newLessonDescription').value = '';
    $('newLessonCards').innerHTML = '';
    addBuilderCard('newLessonCards', updateNewLessonCardCount);
    updateNewLessonCardCount();

    // Switch to library after a moment
    setTimeout(() => switchTab('library'), 1200);
  } catch (err) {
    showToast('Fehler beim Speichern: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>💾 Lektion speichern</span>';
  }
}

/* ============================================================
   NEU TAB — Sub-Navigation (Manuell / Screenshot)
   ============================================================ */
function initNewTabSubnav() {
  document.querySelectorAll('#tab-new .learn-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-new .learn-subnav-btn').forEach(b => b.classList.remove('learn-subnav-btn--active'));
      btn.classList.add('learn-subnav-btn--active');
      const view = btn.dataset.newview;
      if (view === 'manual') {
        $('newManualView').style.display = 'block';
        $('newUploadView').style.display = 'none';
      } else {
        $('newManualView').style.display = 'none';
        $('newUploadView').style.display = 'block';
      }
    });
  });
}


/* ============================================================
   PHASE-6 SPACED REPETITION
   ============================================================ */

const PHASE6_LABELS = {
  1: 'Phase 1 — sofort',
  2: 'Phase 2 — 1 Tag',
  3: 'Phase 3 — 3 Tage',
  4: 'Phase 4 — 10 Tage',
  5: 'Phase 5 — 30 Tage',
  6: 'Phase 6 — 90 Tage',
};

const PHASE6_COLORS = {
  1: '#CE2B37',  // red — needs work
  2: '#E8734A',  // orange
  3: '#C8963E',  // gold
  4: '#7BAE4E',  // light green
  5: '#009246',  // green
  6: '#0f3460',  // deep blue — mastered
};

async function loadPhase6Dashboard() {
  const dashboard = $('phase6Dashboard');
  try {
    const [dueCards, statsData] = await Promise.all([
      apiFetch(`${API}?action=phase6&sub=due_cards&limit=50`),
      apiFetch(`${API}?action=phase6&sub=stats`),
    ]);

    state.phase6DueCards = dueCards;
    state.phase6Stats = statsData;

    // Update due count
    $('phase6DueCount').textContent = statsData.due_count;
    $('phase6Subtitle').textContent = `${statsData.due_count} Karten fällig · ${statsData.mastered_count} im Langzeitgedächtnis`;

    // Show/hide elements
    const hasDue = statsData.due_count > 0;
    $('phase6DueBanner').style.display = hasDue ? 'flex' : 'none';
    $('phase6Empty').style.display = hasDue ? 'none' : 'block';
    $('startPhase6Btn').disabled = !hasDue;

    // Render phase distribution
    renderPhase6Distribution(statsData);

  } catch (err) {
    dashboard.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p class="empty-title">Fehler beim Laden</p><p class="empty-subtitle">${err.message}</p></div>`;
  }
}

function renderPhase6Distribution(stats) {
  const container = $('phase6Bars');
  const total = stats.total_cards || 1;

  // Build a map phase -> count
  const phaseCounts = {};
  for (let i = 1; i <= 6; i++) phaseCounts[i] = 0;
  (stats.phase_distribution || []).forEach(p => {
    phaseCounts[p.phase] = p.count;
  });

  let html = '';
  for (let phase = 1; phase <= 6; phase++) {
    const count = phaseCounts[phase];
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const width = Math.max(pct, 2); // min 2% so it's visible
    html += `
      <div class="phase6-bar-row">
        <span class="phase6-bar-label">P${phase}</span>
        <div class="phase6-bar-track">
          <div class="phase6-bar-fill phase6-bar--${phase}" style="width: ${width}%"></div>
        </div>
        <span class="phase6-bar-count">${count}</span>
      </div>`;
  }
  container.innerHTML = html;
}

async function startPhase6Session(cardCount) {
  cardCount = cardCount || 20;
  if (state.phase6DueCards.length === 0) { showToast('Keine Karten fällig', 'info'); return; }
  const cards = state.phase6DueCards.slice(0, cardCount);
  state.sessionMode = 'phase6';
  state.sessionLessonId = null;
  state.sessionLessonIds = [...new Set(cards.map(c => c.lesson_id))];
  state.sessionIsWeakMode = false;
  state.learnQuestionCount = 'all';
  $('learnPhase6View').style.display = 'none';
  startSession(cards, cards[0]?.lesson_id || null);
}

function initPhase6() {
  var p6CardCount = 20;

  $('startPhase6Btn').addEventListener('click', function() {
    if (state.phase6DueCards.length === 0) { showToast('Keine Karten fällig', 'info'); return; }
    $('phase6CountPicker').style.display = 'block';
    $('startPhase6Btn').style.display = 'none';
  });

  var picker = $('phase6CountPicker');
  if (picker) {
    picker.querySelectorAll('.count-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        picker.querySelectorAll('.count-btn').forEach(function(b) { b.classList.remove('count-btn--active'); });
        btn.classList.add('count-btn--active');
        p6CardCount = parseInt(btn.dataset.p6count, 10);
      });
    });
  }

  $('startPhase6ConfirmBtn').addEventListener('click', function() {
    $('phase6CountPicker').style.display = 'none';
    $('startPhase6Btn').style.display = '';
    startPhase6Session(p6CardCount);
  });
}

/* ============================================================
   EXPORT & IMPORT
   ============================================================ */
function initImport() {
  const overlay   = $('importOverlay');
  const titleEl   = $('importTitle');
  const descEl    = $('importDesc');
  const input     = $('importInput');
  const okBtn     = $('importOk');
  const cancelBtn = $('importCancel');
  if (!overlay) return;

  /* ---- EXPORT ---- */
  function doExport() {
    const pkg = {
      _version: 2,
      _exported: new Date().toISOString(),
      l: localStorage.getItem('hun_lessons')   || '[]',
      c: localStorage.getItem('hun_cards')     || '[]',
      s: localStorage.getItem('hun_sessions')  || '[]',
      r: localStorage.getItem('hun_card_results') || '[]',
      p: localStorage.getItem('hun_phase6')    || '{}',
      q: localStorage.getItem('hun_mastery') || '{}',
    };
    const json = JSON.stringify(pkg, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0,10);
    a.href     = url;
    a.download = `magyar-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup heruntergeladen', 'success');
  }

  const exportBtn = $('exportAllBtn');
  if (exportBtn) exportBtn.addEventListener('click', doExport);

  /* ---- IMPORT MODAL ---- */
  function openImport() {
    input.value = '';
    titleEl.textContent = 'Backup importieren';
    descEl.textContent  = 'Wähle eine Backup-Datei aus oder füge den JSON-Inhalt ein.';
    overlay.style.display = 'flex';
  }

  function closeImport() { overlay.style.display = 'none'; }

  const importAllBtn = $('importAllBtn');
  if (importAllBtn) importAllBtn.addEventListener('click', openImport);

  cancelBtn.addEventListener('click', closeImport);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeImport(); });

  // File picker
  const fileInput = $('importFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        let text = e.target.result.trim();
        const m = text.match(/===EXPORT===\s*([\s\S]*?)\s*===ENDE===/);
        if (m) text = m[1].trim();
        input.value = text;
        showToast('Datei geladen — jetzt auf Importieren klicken', 'info');
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  okBtn.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { showToast('Kein Inhalt eingefügt', 'error'); return; }
    try {
      const pkg = JSON.parse(raw);

      // Array tables: merge by id (no duplicates)
      const arrayKeys = {l:'hun_lessons', c:'hun_cards', s:'hun_sessions', r:'hun_card_results'};
      for (const [short, key] of Object.entries(arrayKeys)) {
        if (!pkg[short]) continue;
        const existing   = DB._g(key, []);
        const incoming   = JSON.parse(pkg[short]);
        const existingIds = new Set(existing.map(x => x.id));
        DB._s(key, [...existing, ...incoming.filter(x => !existingIds.has(x.id))]);
      }

      // Phase-6: native backup format (key "p") or Perplexity array format (key "p6_raw")
      if (pkg.p6_raw) {
        const existing = DB.phase6();
        JSON.parse(pkg.p6_raw).forEach(r => {
          existing[r.card_id] = {phase: r.phase, correct_streak: r.correct_streak || 0,
                                  next_review_at: r.next_review_at, last_reviewed_at: r.last_reviewed_at || ''};
        });
        DB.savePhase6(existing);
      } else if (pkg.p) {
        DB.savePhase6({...DB.phase6(), ...JSON.parse(pkg.p)});
      }

      // Quiz mastery
      if (pkg.q) {
        let existing = {};
        try { existing = JSON.parse(localStorage.getItem('hun_mastery') || '{}'); } catch(e) {}
        const incoming = JSON.parse(pkg.q);
        for (const [k,v] of Object.entries(incoming)) {
          existing[k] = Math.max(existing[k] || 0, parseInt(v) || 0);
        }
        localStorage.setItem('hun_mastery', JSON.stringify(existing));
      }

      const lessons = DB._g('hun_lessons', []).length;
      const cards   = DB._g('hun_cards', []).length;
      const p6count = Object.keys(DB.phase6()).length;
      const qcount  = Object.keys(JSON.parse(localStorage.getItem('hun_mastery') || '{}')).length;
      showToast(
        `Importiert: ${lessons} Lektionen · ${cards} Karten · ${p6count} Phase-6 · ${qcount} Quiz-Wörter`,
        'success', 5000
      );
      closeImport();
      loadStats();
    } catch(e) {
      showToast('Fehler beim Parsen: ' + e.message, 'error');
    }
  });
}

/* ============================================================
   HTML ESCAPE
   ============================================================ */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   INIT
   ============================================================ */
window.toggleDarkMode = function() {
  const isDark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('hun_dark', isDark ? '1' : '0'); } catch(e) {}
};

document.addEventListener('DOMContentLoaded', () => {
  initUploadTab();
  initLibraryTab();
  initLearnTab();
  initNewLessonTab();
  initNewTabSubnav();
  initPhase6();
  initImport();
  initQuizTab();
  // Load learn tab data on startup since it's the default tab
  loadLearnTab();
});

/* ============================================================
   QUIZ TAB  — Vocabolario Game
   All DOM IDs prefixed with q- to avoid collision
   ============================================================ */

function initQuizTab() {

  /* ---------- Vocabulary data ---------- */
  var Q_CATEGORIES = [
    {
      name: 'Personen & Familie',
      words: [
        { de: 'die Familie',        it: 'család',         alt: ['a család'] },
        { de: 'der Vater',          it: 'apa',            alt: ['az apa','édesapa'] },
        { de: 'die Mutter',         it: 'anya',           alt: ['az anya','édesanya'] },
        { de: 'der Sohn',           it: 'fiú',            alt: ['a fiú','fia'] },
        { de: 'die Tochter',        it: 'lány',           alt: ['a lány','lánya'] },
        { de: 'der Bruder',         it: 'fivér',          alt: ['báty','öcs','fiútestvér'] },
        { de: 'die Schwester',      it: 'nővér',          alt: ['húg','lánytestvér'] },
        { de: 'der Ehemann',        it: 'férj',           alt: ['a férj'] },
        { de: 'die Ehefrau',        it: 'feleség',        alt: ['a feleség'] },
        { de: 'der Großvater',      it: 'nagyapa',        alt: ['nagypapa','a nagyapa'] },
        { de: 'die Großmutter',     it: 'nagymama',       alt: ['nagyanya','a nagymama'] },
        { de: 'der Onkel',          it: 'nagybácsi',      alt: ['bácsi'] },
        { de: 'die Tante',          it: 'nagynéni',       alt: ['néni'] },
        { de: 'der Cousin',         it: 'unokatestvér',   alt: ['unokafivér'] },
        { de: 'die Cousine',        it: 'unokatestvér',   alt: ['unokanővér'] },
        { de: 'das Kind (Junge)',   it: 'kisfiú',         alt: ['fiú','gyerek'] },
        { de: 'das Kind (Mädchen)', it: 'kislány',        alt: ['lány','gyerek'] },
        { de: 'der Freund',         it: 'barát',          alt: ['a barát'] },
        { de: 'die Freundin',       it: 'barátnő',        alt: ['a barátnő'] },
        { de: 'der Nachbar',        it: 'szomszéd',       alt: ['a szomszéd'] },
        { de: 'die Nachbarin',      it: 'szomszédasszony',alt: ['szomszéd'] },
        { de: 'die Person',         it: 'személy',        alt: ['a személy'] },
        { de: 'der Mann',           it: 'férfi',          alt: ['a férfi'] },
        { de: 'die Frau',           it: 'nő',             alt: ['a nő','asszony'] },
        { de: 'das Baby',           it: 'baba',           alt: ['csecsemő'] },
        { de: 'der Schwiegervater', it: 'após',           alt: ['az após'] },
        { de: 'die Schwiegermutter',it: 'anyós',          alt: ['az anyós'] },
        { de: 'der Neffe',          it: 'unokaöcs',       alt: [] },
        { de: 'die Nichte',         it: 'unokahúg',       alt: [] },
        { de: 'das Pärchen',        it: 'pár',            alt: ['a pár'] },
        { de: 'der Bekannte',       it: 'ismerős',        alt: ['az ismerős'] },
        { de: 'der Kollege',        it: 'kolléga',        alt: ['munkatárs'] },
        { de: 'der Zwilling',       it: 'iker',           alt: ['ikertestvér'] },
        { de: 'der Einzelkind',     it: 'egyke',          alt: ['egyetlen gyermek'] },
        { de: 'die Verwandten',     it: 'rokonok',        alt: ['a rokonok','rokonság'] },
        { de: 'die Geschwister',    it: 'testvérek',      alt: ['a testvérek'] },
        { de: 'der Vorname',        it: 'keresztnév',     alt: ['utónév'] },
        { de: 'der Nachname',       it: 'vezetéknév',     alt: ['családnév'] },
      ]
    },
    {
      name: 'Essen & Trinken',
      words: [
        { de: 'das Wasser',         it: 'víz',            alt: ['a víz'] },
        { de: 'der Wein',           it: 'bor',            alt: ['a bor'] },
        { de: 'das Bier',           it: 'sör',            alt: ['a sör'] },
        { de: 'der Kaffee',         it: 'kávé',           alt: ['a kávé'] },
        { de: 'der Tee',            it: 'tea',            alt: ['a tea'] },
        { de: 'das Brot',           it: 'kenyér',         alt: ['a kenyér'] },
        { de: 'die Pasta',          it: 'tészta',         alt: ['a tészta'] },
        { de: 'die Pizza',          it: 'pizza',          alt: ['a pizza'] },
        { de: 'das Fleisch',        it: 'hús',            alt: ['a hús'] },
        { de: 'der Fisch',          it: 'hal',            alt: ['a hal'] },
        { de: 'das Gemüse',         it: 'zöldség',        alt: ['a zöldség'] },
        { de: 'das Obst',           it: 'gyümölcs',       alt: ['a gyümölcs'] },
        { de: 'der Käse',           it: 'sajt',           alt: ['a sajt'] },
        { de: 'das Ei',             it: 'tojás',          alt: ['a tojás'] },
        { de: 'die Milch',          it: 'tej',            alt: ['a tej'] },
        { de: 'die Butter',         it: 'vaj',            alt: ['a vaj'] },
        { de: 'der Zucker',         it: 'cukor',          alt: ['a cukor'] },
        { de: 'das Salz',           it: 'só',             alt: ['a só'] },
        { de: 'der Pfeffer',        it: 'bors',           alt: ['a bors'] },
        { de: 'die Tomate',         it: 'paradicsom',     alt: ['a paradicsom'] },
        { de: 'die Kartoffel',      it: 'krumpli',        alt: ['burgonya'] },
        { de: 'der Apfel',          it: 'alma',           alt: ['az alma'] },
        { de: 'die Orange',         it: 'narancs',        alt: ['a narancs'] },
        { de: 'die Zitrone',        it: 'citrom',         alt: ['a citrom'] },
        { de: 'das Eis',            it: 'fagylalt',       alt: ['fagyi','jégkrém'] },
        { de: 'die Suppe',          it: 'leves',          alt: ['a leves'] },
        { de: 'der Salat',          it: 'saláta',         alt: ['a saláta'] },
        { de: 'das Frühstück',      it: 'reggeli',        alt: ['a reggeli'] },
        { de: 'das Mittagessen',    it: 'ebéd',           alt: ['az ebéd'] },
        { de: 'das Abendessen',     it: 'vacsora',        alt: ['a vacsora'] },
        { de: 'der Saft',           it: 'gyümölcslé',     alt: ['lé','dzsúsz'] },
        { de: 'die Schokolade',     it: 'csokoládé',      alt: ['csoki'] },
        { de: 'der Kuchen',         it: 'sütemény',       alt: ['torta','süti'] },
        { de: 'das Risotto',        it: 'rizottó',        alt: ['rizs'] },
        { de: 'der Espresso',       it: 'eszpresszó',     alt: ['presszókávé'] },
        { de: 'das Mineralwasser',  it: 'ásványvíz',      alt: ['az ásványvíz'] },
        { de: 'die Vorspeise',      it: 'előétel',        alt: ['az előétel'] },
        { de: 'das Dessert',        it: 'desszert',       alt: ['édesség'] },
      ]
    },
    {
      name: 'Reisen & Verkehr',
      words: [
        { de: 'das Auto',           it: 'autó',           alt: ['kocsi','az autó'] },
        { de: 'der Zug',            it: 'vonat',          alt: ['a vonat'] },
        { de: 'das Flugzeug',       it: 'repülőgép',      alt: ['repülő'] },
        { de: 'das Schiff',         it: 'hajó',           alt: ['a hajó'] },
        { de: 'der Bus',            it: 'busz',           alt: ['autóbusz','a busz'] },
        { de: 'das Fahrrad',        it: 'bicikli',        alt: ['kerékpár'] },
        { de: 'der Bahnhof',        it: 'pályaudvar',     alt: ['vasútállomás','állomás'] },
        { de: 'der Flughafen',      it: 'repülőtér',      alt: ['a repülőtér'] },
        { de: 'das Hotel',          it: 'szálloda',       alt: ['hotel'] },
        { de: 'das Ticket',         it: 'jegy',           alt: ['a jegy'] },
        { de: 'die Reise',          it: 'utazás',         alt: ['út'] },
        { de: 'der Urlaub',         it: 'nyaralás',       alt: ['vakáció','szabadság'] },
        { de: 'die Karte (Landkarte)',it: 'térkép',       alt: ['a térkép'] },
        { de: 'die Straße',         it: 'utca',           alt: ['út'] },
        { de: 'die Brücke',         it: 'híd',            alt: ['a híd'] },
        { de: 'der Hafen',          it: 'kikötő',         alt: ['a kikötő'] },
        { de: 'die U-Bahn',         it: 'metró',          alt: ['a metró'] },
        { de: 'das Taxi',           it: 'taxi',           alt: ['a taxi'] },
        { de: 'der Pass',           it: 'útlevél',        alt: ['az útlevél'] },
        { de: 'der Koffer',         it: 'bőrönd',         alt: ['koffer'] },
        { de: 'der Rucksack',       it: 'hátizsák',       alt: ['a hátizsák'] },
        { de: 'die Grenze',         it: 'határ',          alt: ['a határ'] },
        { de: 'die Ankunft',        it: 'érkezés',        alt: ['az érkezés'] },
        { de: 'die Abfahrt',        it: 'indulás',        alt: ['az indulás'] },
        { de: 'der Umstieg',        it: 'átszállás',      alt: ['az átszállás'] },
        { de: 'die Autobahn',       it: 'autópálya',      alt: ['az autópálya'] },
        { de: 'das Motorrad',       it: 'motor',          alt: ['motorkerékpár'] },
        { de: 'die Tankstelle',     it: 'benzinkút',      alt: ['a benzinkút'] },
        { de: 'das Gepäck',         it: 'poggyász',       alt: ['csomag'] },
        { de: 'der Reiseführer',    it: 'útikönyv',       alt: ['útikalauz','idegenvezető'] },
        { de: 'die Fahrkarte',      it: 'menetjegy',      alt: ['jegy','vonatjegy'] },
        { de: 'der Stau',           it: 'forgalmi dugó',  alt: ['dugó'] },
        { de: 'der Parkplatz',      it: 'parkoló',        alt: ['parkolóhely'] },
        { de: 'die Haltestelle',    it: 'megálló',        alt: ['a megálló'] },
        { de: 'der Ausflug',        it: 'kirándulás',     alt: ['a kirándulás'] },
        { de: 'das Zimmer',         it: 'szoba',          alt: ['a szoba'] },
        { de: 'die Rezeption',      it: 'recepció',       alt: ['a recepció'] },
        { de: 'die Sehenswürdigkeit',it: 'látnivaló',     alt: ['nevezetesség'] },
      ]
    },
    {
      name: 'Haus & Wohnen',
      words: [
        { de: 'das Haus',           it: 'ház',            alt: ['a ház'] },
        { de: 'die Wohnung',        it: 'lakás',          alt: ['a lakás'] },
        { de: 'das Zimmer',         it: 'szoba',          alt: ['a szoba'] },
        { de: 'die Küche',          it: 'konyha',         alt: ['a konyha'] },
        { de: 'das Badezimmer',     it: 'fürdőszoba',     alt: ['fürdő'] },
        { de: 'das Schlafzimmer',   it: 'hálószoba',      alt: ['háló'] },
        { de: 'das Wohnzimmer',     it: 'nappali',        alt: ['a nappali'] },
        { de: 'die Tür',            it: 'ajtó',           alt: ['az ajtó'] },
        { de: 'das Fenster',        it: 'ablak',          alt: ['az ablak'] },
        { de: 'die Treppe',         it: 'lépcső',         alt: ['a lépcső'] },
        { de: 'der Garten',         it: 'kert',           alt: ['a kert'] },
        { de: 'der Balkon',         it: 'erkély',         alt: ['balkon'] },
        { de: 'der Tisch',          it: 'asztal',         alt: ['az asztal'] },
        { de: 'der Stuhl',          it: 'szék',           alt: ['a szék'] },
        { de: 'das Bett',           it: 'ágy',            alt: ['az ágy'] },
        { de: 'der Schrank',        it: 'szekrény',       alt: ['a szekrény'] },
        { de: 'das Sofa',           it: 'kanapé',         alt: ['dívány','szófa'] },
        { de: 'der Kühlschrank',    it: 'hűtőszekrény',   alt: ['hűtő'] },
        { de: 'der Herd',           it: 'tűzhely',        alt: ['a tűzhely'] },
        { de: 'die Waschmaschine',  it: 'mosógép',        alt: ['a mosógép'] },
        { de: 'die Lampe',          it: 'lámpa',          alt: ['a lámpa'] },
        { de: 'der Spiegel',        it: 'tükör',          alt: ['a tükör'] },
        { de: 'das Dach',           it: 'tető',           alt: ['a tető'] },
        { de: 'der Keller',         it: 'pince',          alt: ['a pince'] },
        { de: 'die Garage',         it: 'garázs',         alt: ['a garázs'] },
        { de: 'die Miete',          it: 'lakbér',         alt: ['bérleti díj','bér'] },
        { de: 'der Vermieter',      it: 'háziúr',         alt: ['főbérlő','tulajdonos'] },
        { de: 'der Nachbar',        it: 'szomszéd',       alt: ['a szomszéd'] },
        { de: 'die Etage',          it: 'emelet',         alt: ['az emelet'] },
        { de: 'der Aufzug',         it: 'lift',           alt: ['a lift'] },
        { de: 'der Teppich',        it: 'szőnyeg',        alt: ['a szőnyeg'] },
        { de: 'der Vorhang',        it: 'függöny',        alt: ['a függöny'] },
        { de: 'das Handtuch',       it: 'törölköző',      alt: ['a törölköző'] },
        { de: 'die Dusche',         it: 'zuhany',         alt: ['zuhanyzó'] },
        { de: 'die Badewanne',      it: 'fürdőkád',       alt: ['kád'] },
        { de: 'der Eingang',        it: 'bejárat',        alt: ['a bejárat'] },
        { de: 'das Schloss',        it: 'zár',            alt: ['a zár'] },
        { de: 'der Schlüssel',      it: 'kulcs',          alt: ['a kulcs'] },
      ]
    },
    {
      name: 'Arbeit & Beruf',
      words: [
        { de: 'die Arbeit',         it: 'munka',          alt: ['a munka'] },
        { de: 'das Büro',           it: 'iroda',          alt: ['az iroda'] },
        { de: 'der Chef',           it: 'főnök',          alt: ['a főnök'] },
        { de: 'der Kollege',        it: 'kolléga',        alt: ['munkatárs'] },
        { de: 'das Meeting',        it: 'értekezlet',     alt: ['megbeszélés','meeting'] },
        { de: 'der Vertrag',        it: 'szerződés',      alt: ['a szerződés'] },
        { de: 'das Gehalt',         it: 'fizetés',        alt: ['bér'] },
        { de: 'der Urlaub (Arbeit)',it: 'szabadság',      alt: ['a szabadság'] },
        { de: 'die Stelle',         it: 'állás',          alt: ['munkahely'] },
        { de: 'der Arzt',           it: 'orvos',          alt: ['doktor'] },
        { de: 'der Lehrer',         it: 'tanár',          alt: ['tanító'] },
        { de: 'der Anwalt',         it: 'ügyvéd',         alt: ['az ügyvéd'] },
        { de: 'der Ingenieur',      it: 'mérnök',         alt: ['a mérnök'] },
        { de: 'der Verkäufer',      it: 'eladó',          alt: ['az eladó'] },
        { de: 'der Koch',           it: 'szakács',        alt: ['a szakács'] },
        { de: 'die Firma',          it: 'cég',            alt: ['vállalat'] },
        { de: 'die Bewerbung',      it: 'jelentkezés',    alt: ['pályázat'] },
        { de: 'das Interview',      it: 'interjú',        alt: ['állásinterjú'] },
        { de: 'die Erfahrung',      it: 'tapasztalat',    alt: ['a tapasztalat'] },
        { de: 'die Ausbildung',     it: 'képzés',         alt: ['oktatás','szakképzés'] },
        { de: 'das Projekt',        it: 'projekt',        alt: ['a projekt'] },
        { de: 'die Deadline',       it: 'határidő',       alt: ['a határidő'] },
        { de: 'der Kunde',          it: 'ügyfél',         alt: ['vevő','vásárló'] },
        { de: 'die Rechnung',       it: 'számla',         alt: ['a számla'] },
        { de: 'der Computer',       it: 'számítógép',     alt: ['komputer','gép'] },
        { de: 'die E-Mail',         it: 'e-mail',         alt: ['email','elektronikus levél'] },
        { de: 'der Drucker',        it: 'nyomtató',       alt: ['a nyomtató'] },
        { de: 'die Besprechung',    it: 'megbeszélés',    alt: ['értekezlet'] },
        { de: 'der Praktikant',     it: 'gyakornok',      alt: ['a gyakornok'] },
        { de: 'die Kündigung',      it: 'felmondás',      alt: ['a felmondás'] },
        { de: 'der Architekt',      it: 'építész',        alt: ['az építész'] },
        { de: 'der Buchhalter',     it: 'könyvelő',       alt: ['a könyvelő'] },
        { de: 'die Sekretärin',     it: 'titkárnő',       alt: ['titkár'] },
        { de: 'der Polizist',       it: 'rendőr',         alt: ['a rendőr'] },
        { de: 'der Feuerwehrmann',  it: 'tűzoltó',        alt: ['a tűzoltó'] },
        { de: 'der Krankenpfleger', it: 'ápoló',          alt: ['betegápoló'] },
        { de: 'die Überstunde',     it: 'túlóra',         alt: ['a túlóra'] },
        { de: 'die Beförderung',    it: 'előléptetés',    alt: ['az előléptetés'] },
      ]
    },
    {
      name: 'Körper & Gesundheit',
      words: [
        { de: 'der Kopf',           it: 'fej',            alt: ['a fej'] },
        { de: 'das Gesicht',        it: 'arc',            alt: ['az arc'] },
        { de: 'das Auge',           it: 'szem',           alt: ['a szem'] },
        { de: 'die Nase',           it: 'orr',            alt: ['az orr'] },
        { de: 'der Mund',           it: 'száj',           alt: ['a száj'] },
        { de: 'das Ohr',            it: 'fül',            alt: ['a fül'] },
        { de: 'der Hals',           it: 'nyak',           alt: ['torok'] },
        { de: 'die Schulter',       it: 'váll',           alt: ['a váll'] },
        { de: 'der Arm',            it: 'kar',            alt: ['a kar'] },
        { de: 'die Hand',           it: 'kéz',            alt: ['a kéz'] },
        { de: 'der Finger',         it: 'ujj',            alt: ['az ujj'] },
        { de: 'der Rücken',         it: 'hát',            alt: ['a hát'] },
        { de: 'der Bauch',          it: 'has',            alt: ['pocak','gyomor'] },
        { de: 'das Bein',           it: 'láb',            alt: ['a láb'] },
        { de: 'der Fuß',            it: 'lábfej',         alt: ['láb'] },
        { de: 'das Herz',           it: 'szív',           alt: ['a szív'] },
        { de: 'die Lunge',          it: 'tüdő',           alt: ['a tüdő'] },
        { de: 'das Blut',           it: 'vér',            alt: ['a vér'] },
        { de: 'der Schmerz',        it: 'fájdalom',       alt: ['a fájdalom'] },
        { de: 'das Fieber',         it: 'láz',            alt: ['a láz'] },
        { de: 'die Erkältung',      it: 'megfázás',       alt: ['nátha'] },
        { de: 'das Krankenhaus',    it: 'kórház',         alt: ['a kórház'] },
        { de: 'der Arzt',           it: 'orvos',          alt: ['doktor'] },
        { de: 'die Apotheke',       it: 'gyógyszertár',   alt: ['patika'] },
        { de: 'das Medikament',     it: 'gyógyszer',      alt: ['orvosság'] },
        { de: 'die Allergie',       it: 'allergia',       alt: ['az allergia'] },
        { de: 'der Knochen',        it: 'csont',          alt: ['a csont'] },
        { de: 'der Muskel',         it: 'izom',           alt: ['az izom'] },
        { de: 'die Haut',           it: 'bőr',            alt: ['a bőr'] },
        { de: 'das Haar',           it: 'haj',            alt: ['a haj'] },
        { de: 'der Zahn',           it: 'fog',            alt: ['a fog'] },
        { de: 'der Arzttermin',     it: 'orvosi időpont', alt: ['időpont','rendelés'] },
        { de: 'die Operation',      it: 'műtét',          alt: ['operáció'] },
        { de: 'das Rezept',         it: 'recept',         alt: ['vény'] },
        { de: 'die Verletzung',     it: 'sérülés',        alt: ['a sérülés'] },
        { de: 'der Sport',          it: 'sport',          alt: ['a sport'] },
        { de: 'die Diät',           it: 'diéta',          alt: ['a diéta'] },
        { de: 'der Schlaf',         it: 'alvás',          alt: ['álom'] },
      ]
    },
    {
      name: 'Natur & Wetter',
      words: [
        { de: 'die Sonne',          it: 'nap',            alt: ['a nap'] },
        { de: 'der Mond',           it: 'hold',           alt: ['a hold'] },
        { de: 'der Stern',          it: 'csillag',        alt: ['a csillag'] },
        { de: 'der Himmel',         it: 'ég',             alt: ['égbolt'] },
        { de: 'die Wolke',          it: 'felhő',          alt: ['a felhő'] },
        { de: 'der Regen',          it: 'eső',            alt: ['az eső'] },
        { de: 'der Schnee',         it: 'hó',             alt: ['a hó'] },
        { de: 'der Wind',           it: 'szél',           alt: ['a szél'] },
        { de: 'das Gewitter',       it: 'vihar',          alt: ['zivatar'] },
        { de: 'der Blitz',          it: 'villám',         alt: ['a villám'] },
        { de: 'die Hitze',          it: 'hőség',          alt: ['meleg'] },
        { de: 'die Kälte',          it: 'hideg',          alt: ['a hideg'] },
        { de: 'der Berg',           it: 'hegy',           alt: ['a hegy'] },
        { de: 'das Meer',           it: 'tenger',         alt: ['a tenger'] },
        { de: 'der See',            it: 'tó',             alt: ['a tó'] },
        { de: 'der Fluss',          it: 'folyó',          alt: ['a folyó'] },
        { de: 'der Wald',           it: 'erdő',           alt: ['az erdő'] },
        { de: 'das Feld',           it: 'mező',           alt: ['szántóföld'] },
        { de: 'die Wiese',          it: 'rét',            alt: ['a rét'] },
        { de: 'der Strand',         it: 'strand',         alt: ['tengerpart','part'] },
        { de: 'die Insel',          it: 'sziget',         alt: ['a sziget'] },
        { de: 'der Baum',           it: 'fa',             alt: ['a fa'] },
        { de: 'die Blume',          it: 'virág',          alt: ['a virág'] },
        { de: 'das Tier',           it: 'állat',          alt: ['az állat'] },
        { de: 'der Hund',           it: 'kutya',          alt: ['a kutya'] },
        { de: 'die Katze',          it: 'macska',         alt: ['a macska'] },
        { de: 'der Vogel',          it: 'madár',          alt: ['a madár'] },
        { de: 'der Fisch',          it: 'hal',            alt: ['a hal'] },
        { de: 'die Temperaturen',   it: 'hőmérséklet',    alt: ['a hőmérséklet'] },
        { de: 'der Frühling',       it: 'tavasz',         alt: ['a tavasz'] },
        { de: 'der Sommer',         it: 'nyár',           alt: ['a nyár'] },
        { de: 'der Herbst',         it: 'ősz',            alt: ['az ősz'] },
        { de: 'der Winter',         it: 'tél',            alt: ['a tél'] },
        { de: 'die Natur',          it: 'természet',      alt: ['a természet'] },
        { de: 'die Umwelt',         it: 'környezet',      alt: ['a környezet'] },
        { de: 'das Erdbeben',       it: 'földrengés',     alt: ['a földrengés'] },
        { de: 'der Vulkan',         it: 'vulkán',         alt: ['tűzhányó'] },
        { de: 'die Wüste',          it: 'sivatag',        alt: ['a sivatag'] },
      ]
    },
    {
      name: 'Alltag & Freizeit',
      words: [
        { de: 'der Morgen',         it: 'reggel',         alt: ['a reggel'] },
        { de: 'der Mittag',         it: 'dél',            alt: ['a dél'] },
        { de: 'der Abend',          it: 'este',           alt: ['az este'] },
        { de: 'die Nacht',          it: 'éjszaka',        alt: ['éj'] },
        { de: 'heute',              it: 'ma',             alt: [] },
        { de: 'gestern',            it: 'tegnap',         alt: [] },
        { de: 'morgen',             it: 'holnap',         alt: [] },
        { de: 'die Woche',          it: 'hét',            alt: ['a hét'] },
        { de: 'der Monat',          it: 'hónap',          alt: ['a hónap'] },
        { de: 'das Jahr',           it: 'év',             alt: ['esztendő'] },
        { de: 'die Uhr',            it: 'óra',            alt: ['az óra'] },
        { de: 'die Minute',         it: 'perc',           alt: ['a perc'] },
        { de: 'die Stunde',         it: 'óra',            alt: ['az óra'] },
        { de: 'das Handy',          it: 'mobiltelefon',   alt: ['mobil','telefon'] },
        { de: 'der Fernseher',      it: 'televízió',      alt: ['tévé','tv'] },
        { de: 'das Internet',       it: 'internet',       alt: ['az internet'] },
        { de: 'das Buch',           it: 'könyv',          alt: ['a könyv'] },
        { de: 'die Zeitung',        it: 'újság',          alt: ['az újság'] },
        { de: 'der Film',           it: 'film',           alt: ['a film'] },
        { de: 'die Musik',          it: 'zene',           alt: ['a zene'] },
        { de: 'der Sport',          it: 'sport',          alt: ['a sport'] },
        { de: 'das Spiel',          it: 'játék',          alt: ['a játék'] },
        { de: 'der Markt',          it: 'piac',           alt: ['a piac'] },
        { de: 'der Supermarkt',     it: 'szupermarket',   alt: ['élelmiszerbolt'] },
        { de: 'die Schule',         it: 'iskola',         alt: ['az iskola'] },
        { de: 'die Universität',    it: 'egyetem',        alt: ['az egyetem'] },
        { de: 'die Bibliothek',     it: 'könyvtár',       alt: ['a könyvtár'] },
        { de: 'das Museum',         it: 'múzeum',         alt: ['a múzeum'] },
        { de: 'das Kino',           it: 'mozi',           alt: ['a mozi'] },
        { de: 'das Theater',        it: 'színház',        alt: ['a színház'] },
        { de: 'das Restaurant',     it: 'étterem',        alt: ['vendéglő'] },
        { de: 'der Friseur',        it: 'fodrász',        alt: ['a fodrász'] },
        { de: 'die Post',           it: 'posta',          alt: ['a posta'] },
        { de: 'die Bank',           it: 'bank',           alt: ['a bank'] },
        { de: 'die Kirche',         it: 'templom',        alt: ['a templom'] },
        { de: 'der Park',           it: 'park',           alt: ['a park'] },
        { de: 'die Reise',          it: 'utazás',         alt: ['út'] },
        { de: 'das Foto',           it: 'fénykép',        alt: ['fotó','kép'] },
      ]
    },
    {
      name: 'Adverbien & Ausdrücke',
      words: [
        { de: 'manchmal',           it: 'néha',           alt: ['olykor'] },
        { de: 'normalerweise',      it: 'általában',      alt: ['rendszerint'] },
        { de: 'immer',              it: 'mindig',         alt: [] },
        { de: 'nie',                it: 'soha',           alt: ['sosem'] },
        { de: 'oft',                it: 'gyakran',        alt: ['sűrűn'] },
        { de: 'selten',             it: 'ritkán',         alt: [] },
        { de: 'jeden Tag',          it: 'minden nap',     alt: ['mindennap','naponta'] },
        { de: 'ab und zu',          it: 'időnként',       alt: ['olykor-olykor'] },
        { de: 'sofort',             it: 'azonnal',        alt: ['rögtön'] },
        { de: 'bald',               it: 'hamarosan',      alt: ['nemsokára'] },
        { de: 'endlich',            it: 'végre',          alt: [] },
        { de: 'schon',              it: 'már',            alt: [] },
        { de: 'noch nicht',         it: 'még nem',        alt: [] },
        { de: 'vielleicht',         it: 'talán',          alt: ['esetleg'] },
        { de: 'wahrscheinlich',     it: 'valószínűleg',   alt: [] },
        { de: 'natürlich',          it: 'természetesen',  alt: ['persze'] },
        { de: 'leider',             it: 'sajnos',         alt: [] },
        { de: 'zum Glück',          it: 'szerencsére',    alt: [] },
        { de: 'ungefähr',           it: 'körülbelül',     alt: ['nagyjából','kb.'] },
        { de: 'fast',               it: 'majdnem',        alt: ['csaknem'] },
        { de: 'genug',              it: 'elég',           alt: [] },
        { de: 'ein bisschen',       it: 'egy kicsit',     alt: ['kicsit','egy kevés'] },
        { de: 'besonders',          it: 'különösen',      alt: ['főleg'] },
        { de: 'zusammen',           it: 'együtt',         alt: [] },
        { de: 'alleine',            it: 'egyedül',        alt: [] },
        { de: 'trotzdem',           it: 'mégis',          alt: ['ennek ellenére'] },
        { de: 'außerdem',           it: 'ráadásul',       alt: ['azonkívül'] },
        { de: 'also / deshalb',     it: 'tehát',          alt: ['ezért','így'] },
        { de: 'wenigstens',         it: 'legalább',       alt: [] },
        { de: 'übrigens',           it: 'egyébként',      alt: ['amúgy'] },
      ]
    },
  ];

  /* ---------- Grammar categories ---------- */
  var Q_GRAMMAR_CATEGORIES = [
    {
      name: 'Modalverben',
      words: [
        { de: 'ich will (akarni)',           it: 'akarok',    alt: [] },
        { de: 'du willst (akarni)',          it: 'akarsz',    alt: [] },
        { de: 'er/sie will (akarni)',        it: 'akar',      alt: [] },
        { de: 'wir wollen (akarni)',         it: 'akarunk',   alt: [] },
        { de: 'ihr wollt (akarni)',          it: 'akartok',   alt: [] },
        { de: 'sie wollen (akarni)',         it: 'akarnak',   alt: [] },
        { de: 'ich kann (tudni)',            it: 'tudok',     alt: [] },
        { de: 'du kannst (tudni)',           it: 'tudsz',     alt: [] },
        { de: 'er/sie kann (tudni)',         it: 'tud',       alt: [] },
        { de: 'wir können (tudni)',          it: 'tudunk',    alt: [] },
        { de: 'ihr könnt (tudni)',           it: 'tudtok',    alt: [] },
        { de: 'sie können (tudni)',          it: 'tudnak',    alt: [] },
        { de: 'ich muss (kell)',             it: 'nekem kell',  alt: ['kell nekem'] },
        { de: 'du musst (kell)',             it: 'neked kell',  alt: ['kell neked'] },
        { de: 'er/sie muss (kell)',          it: 'neki kell',   alt: ['kell neki'] },
        { de: 'wir müssen (kell)',           it: 'nekünk kell', alt: ['kell nekünk'] },
        { de: 'ihr müsst (kell)',            it: 'nektek kell', alt: ['kell nektek'] },
        { de: 'sie müssen (kell)',           it: 'nekik kell',  alt: ['kell nekik'] },
      ]
    },
    {
      name: 'Fälle & Endungen',
      words: [
        { de: 'im Haus (ház + ?)',           it: 'házban',    alt: ['a házban'] },
        { de: 'ins Haus (ház + ?)',          it: 'házba',     alt: ['a házba'] },
        { de: 'aus dem Haus (ház + ?)',      it: 'házból',    alt: ['a házból'] },
        { de: 'im Garten (kert + ?)',        it: 'kertben',   alt: ['a kertben'] },
        { de: 'in der Stadt (város + ?)',    it: 'városban',  alt: ['a városban'] },
        { de: 'in die Stadt (város + ?)',    it: 'városba',   alt: ['a városba'] },
        { de: 'auf dem Tisch (asztal + ?)',  it: 'asztalon',  alt: ['az asztalon'] },
        { de: 'auf den Tisch (asztal + ?)',  it: 'asztalra',  alt: ['az asztalra'] },
        { de: 'vom Tisch (asztal + ?)',      it: 'asztalról', alt: ['az asztalról'] },
        { de: 'bei Peter (Péter + ?)',       it: 'Péternél',  alt: [] },
        { de: 'zu Peter (Péter + ?)',        it: 'Péterhez',  alt: [] },
        { de: 'den Kaffee (Akk., kávé + ?)', it: 'kávét',     alt: ['a kávét'] },
        { de: 'das Buch (Akk., könyv + ?)',  it: 'könyvet',   alt: ['a könyvet'] },
        { de: 'mit dem Bus (busz + ?)',      it: 'busszal',   alt: ['a busszal'] },
        { de: 'mit dem Zug (vonat + ?)',     it: 'vonattal',  alt: ['a vonattal'] },
        { de: 'Anna (Dativ, wem?)',          it: 'Annának',   alt: [] },
        { de: 'mir (Dativ)',                 it: 'nekem',     alt: [] },
        { de: 'in Budapest (wo?)',           it: 'Budapesten',alt: [] },
        { de: 'nach Budapest (wohin?)',      it: 'Budapestre',alt: [] },
        { de: 'aus Budapest (woher?)',       it: 'Budapestről',alt: [] },
      ]
    },
    {
      name: 'Präsens',
      words: [
        { de: 'ich lerne (tanulni)',         it: 'tanulok',   alt: [] },
        { de: 'du lernst (tanulni)',         it: 'tanulsz',   alt: [] },
        { de: 'er/sie lernt (tanulni)',      it: 'tanul',     alt: [] },
        { de: 'wir lernen (tanulni)',        it: 'tanulunk',  alt: [] },
        { de: 'ihr lernt (tanulni)',         it: 'tanultok',  alt: [] },
        { de: 'sie lernen (tanulni)',        it: 'tanulnak',  alt: [] },
        { de: 'ich spreche (beszélni)',      it: 'beszélek',  alt: [] },
        { de: 'du sprichst (beszélni)',      it: 'beszélsz',  alt: [] },
        { de: 'er/sie spricht (beszélni)',   it: 'beszél',    alt: [] },
        { de: 'wir sprechen (beszélni)',     it: 'beszélünk', alt: [] },
        { de: 'ihr sprecht (beszélni)',      it: 'beszéltek', alt: [] },
        { de: 'sie sprechen (beszélni)',     it: 'beszélnek', alt: [] },
        { de: 'ich bitte (kérni)',           it: 'kérek',     alt: [] },
        { de: 'du bittest (kérni)',          it: 'kérsz',     alt: [] },
        { de: 'er/sie bittet (kérni)',       it: 'kér',       alt: [] },
        { de: 'wir bitten (kérni)',          it: 'kérünk',    alt: [] },
        { de: 'ihr bittet (kérni)',          it: 'kértek',    alt: [] },
        { de: 'sie bitten (kérni)',          it: 'kérnek',    alt: [] },
        { de: 'ich schreibe (írni)',         it: 'írok',      alt: [] },
        { de: 'du schreibst (írni)',         it: 'írsz',      alt: [] },
        { de: 'er/sie schreibt (írni)',      it: 'ír',        alt: [] },
        { de: 'wir schreiben (írni)',        it: 'írunk',     alt: [] },
        { de: 'ihr schreibt (írni)',         it: 'írtok',     alt: [] },
        { de: 'sie schreiben (írni)',        it: 'írnak',     alt: [] },
        { de: 'ich sitze (ülni)',            it: 'ülök',      alt: [] },
        { de: 'du sitzt (ülni)',             it: 'ülsz',      alt: [] },
        { de: 'er/sie sitzt (ülni)',         it: 'ül',        alt: [] },
        { de: 'wir sitzen (ülni)',           it: 'ülünk',     alt: [] },
        { de: 'ihr sitzt (ülni)',            it: 'ültök',     alt: [] },
        { de: 'sie sitzen (ülni)',           it: 'ülnek',     alt: [] },
      ]
    },
    {
      name: 'Bestimmte Konjugation',
      words: [
        { de: 'ich sehe es (látni, best.)',     it: 'látom',     alt: [] },
        { de: 'du siehst es (látni, best.)',    it: 'látod',     alt: [] },
        { de: 'er/sie sieht es (látni, best.)', it: 'látja',     alt: [] },
        { de: 'wir sehen es (látni, best.)',    it: 'látjuk',    alt: [] },
        { de: 'ihr seht es (látni, best.)',     it: 'látjátok',  alt: [] },
        { de: 'sie sehen es (látni, best.)',    it: 'látják',    alt: [] },
        { de: 'ich bitte es (kérni, best.)',    it: 'kérem',     alt: [] },
        { de: 'du bittest es (kérni, best.)',   it: 'kéred',     alt: [] },
        { de: 'er/sie bittet es (kérni, best.)',it: 'kéri',      alt: [] },
        { de: 'wir bitten es (kérni, best.)',   it: 'kérjük',    alt: [] },
        { de: 'ihr bittet es (kérni, best.)',   it: 'kéritek',   alt: [] },
        { de: 'sie bitten es (kérni, best.)',   it: 'kérik',     alt: [] },
        { de: 'ich lese es (olvasni, best.)',   it: 'olvasom',   alt: [] },
        { de: 'du liest es (olvasni, best.)',   it: 'olvasod',   alt: [] },
        { de: 'er/sie liest es (olvasni, best.)',it: 'olvassa',  alt: [] },
        { de: 'wir lesen es (olvasni, best.)',  it: 'olvassuk',  alt: [] },
        { de: 'ihr lest es (olvasni, best.)',   it: 'olvassátok',alt: [] },
        { de: 'sie lesen es (olvasni, best.)',  it: 'olvassák',  alt: [] },
      ]
    },
  ];

  /* ---------- One-time auto-seed of the flashcard library ----------
     On first launch (empty library, never seeded) the built-in vocabulary
     is turned into lessons + cards so the app is usable out of the box.
     Respects the user afterwards: if they delete everything it won't refill. */
  try {
    if (!localStorage.getItem('hun_seeded') && DB.lessons().length === 0) {
      var _now = new Date().toISOString();
      var _lessons = [], _cards = [], _lid = 1, _cid = 1;
      [].concat(Q_CATEGORIES, Q_GRAMMAR_CATEGORIES).forEach(function(cat) {
        var _cat = /Konjugation|Präsens|Präsenz|Vergangenheit|Modalverben/i.test(cat.name) ? 'konjugation'
                 : (/Präposition|Fälle|Endungen|Vokalharmonie|Artikel/i.test(cat.name) ? 'grammatik' : 'vokabeln');
        _lessons.push({ id: _lid, title: cat.name, category: _cat,
          description: cat.words.length + ' Karten', created_at: _now, updated_at: _now });
        cat.words.forEach(function(w) {
          _cards.push({ id: _cid, lesson_id: _lid, front: w.de, back: w.it, example: '',
            notes: (w.alt && w.alt.length ? 'auch: ' + w.alt.join(', ') : ''), created_at: _now });
          _cid++;
        });
        _lid++;
      });
      DB.saveLessons(_lessons);
      DB.saveCards(_cards);
      localStorage.setItem('hun_seeded', '1');
    }
  } catch (e) {}

  /* ---------- Mastery ---------- */
  var qMastery = {};
  try { qMastery = JSON.parse(localStorage.getItem('hun_mastery') || '{}'); } catch(e) {}
  function qIsMastered(w) { return (qMastery[w.it] || 0) >= 3; }
  function qSaveMastery() { try { localStorage.setItem('hun_mastery', JSON.stringify(qMastery)); } catch(e) {} }

  function qRenderStats() {
    function pips(filled) {
      var h='<span class="q-stp">';
      for (var i=0;i<3;i++) h+='<span'+(i<filled?' class="on"':'')+' ></span>';
      return h+'</span>';
    }
    function renderBar(id, categories) {
      var seen = {}, lvl = [0,0,0,0];
      categories.forEach(function(c) {
        c.words.forEach(function(w) {
          var key = w.it+'\x00'+w.de;
          if (!seen[key]) { seen[key]=1; lvl[Math.min(qMastery[w.it]||0,3)]++; }
        });
      });
      var open = lvl[0]+lvl[1]+lvl[2];
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<b>'+open+'</b> offen &nbsp;·&nbsp; <b>'+lvl[3]+'</b> gemeistert &nbsp;·&nbsp; '+
        '<b>'+lvl[1]+'</b>&nbsp;'+pips(1)+'&nbsp;&nbsp;&nbsp;<b>'+lvl[2]+'</b>&nbsp;'+pips(2);
    }
    renderBar('q-stats-bar', Q_CATEGORIES);
    renderBar('q-grammar-stats-bar', Q_GRAMMAR_CATEGORIES);
  }

  /* ---------- State ---------- */
  var qCurrentRound = [];
  var qLastType = 'vocab', qLastIdx = 0;
  var qQueue = [], qCorrectSet = {}, qWrongCounts = {}, qCurrent = null;
  var qTimerInterval = null, qTimeLeft = 5;
  var qRecognition = null, qQuizActive = false, qAnswered = false;
  var qSessionStart = null;
  var qTypingMode = false;
  var qWordToken = 0;
  var qJokersLeft = 3;
  var qTimerLaunched = false;

  /* ---------- Elements (looked up once tab is active) ---------- */
  function qEl(id) { return document.getElementById(id); }

  /* ---------- Screen helpers ---------- */
  function qShowScreen(name) {
    ['q-screen-start','q-screen-quiz','q-screen-result'].forEach(function(id) {
      var el = qEl(id);
      if (el) el.style.display = (id === 'q-screen-'+name) ? 'block' : 'none';
    });
  }

  /* ---------- SpeechRecognition ---------- */
  var QSpeechAPI = (typeof SpeechRecognition !== 'undefined') ? SpeechRecognition :
                   (typeof webkitSpeechRecognition !== 'undefined') ? webkitSpeechRecognition : null;

  /* ---------- Build category grid ---------- */
  var grid = qEl('q-category-grid');
  if (grid) {
    Q_CATEGORIES.forEach(function(cat, i) {
      var btn = document.createElement('button');
      btn.className = 'q-cat-btn';
      btn.textContent = cat.name;
      btn.onclick = (function(idx) { return function() { qPickCategory('vocab', idx); }; })(i);
      grid.appendChild(btn);
    });
  }
  var grammarGrid = qEl('q-grammar-grid');
  if (grammarGrid) {
    Q_GRAMMAR_CATEGORIES.forEach(function(cat, i) {
      var btn = document.createElement('button');
      btn.className = 'q-cat-btn q-cat-btn--grammar';
      btn.textContent = cat.name;
      btn.onclick = (function(idx) { return function() { qPickCategory('grammar', idx); }; })(i);
      grammarGrid.appendChild(btn);
    });
  }

  var mixVocabBtn = qEl('q-mix-vocab-btn');
  if (mixVocabBtn) mixVocabBtn.onclick = function() { qPickCategory('vocab', -1); };
  var mixGrammarBtn = qEl('q-mix-grammar-btn');
  if (mixGrammarBtn) mixGrammarBtn.onclick = function() { qPickCategory('grammar', -1); };
  var mixAllBtn = qEl('q-mix-all-btn');
  if (mixAllBtn) mixAllBtn.onclick = function() { qPickCategory('mix', -1); };

  /* ---------- Answer input: keyboard entry ---------- */
  function qEnterTypingMode() {
    if (qAnswered || !qQuizActive || qTypingMode) return;
    qTypingMode = true;
    clearInterval(qTimerInterval);
    qStopRecognition();
    qRenderTimer('✎', 'grace');
    qSetMicStatus('Tastatur — tippen & prüfen');
  }
  var answerInput = qEl('q-answer');
  if (answerInput) {
    answerInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') qOnEnter();
    });
    // Tapping or typing switches to keyboard mode: pause timer, free the mic
    answerInput.addEventListener('focus', qEnterTypingMode);
    answerInput.addEventListener('input', qEnterTypingMode);
  }
  var submitBtn = qEl('q-submit-btn');
  if (submitBtn) submitBtn.addEventListener('click', qOnEnter);

  /* ---------- Abort round ---------- */
  var abortBtn = qEl('q-abort-btn');
  if (abortBtn) abortBtn.addEventListener('click', qShowCategoryScreen);

  /* ---------- Joker FAB ---------- */
  var jokerFab = qEl('q-joker-fab');
  if (jokerFab) jokerFab.addEventListener('click', qUseJoker);

  /* ---------- Next / back button ---------- */
  var nextBtn = qEl('q-next-btn');
  if (nextBtn) nextBtn.addEventListener('click', function() { qPickCategory(qLastType, qLastIdx); });
  var menuBtn = qEl('q-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', qShowCategoryScreen);

  /* ---------- Show start screen ---------- */
  qRenderStats();
  qShowScreen('start');

  /* ======================================================
     QUIZ FLOW
     ====================================================== */

  function qShowCategoryScreen() {
    qQuizActive = false;
    qStopRecognition();
    clearInterval(qTimerInterval);
    var fab = qEl('q-joker-fab');
    if (fab) { fab.style.display='none'; fab.classList.remove('visible'); }
    qRenderStats();
    qShowScreen('start');
  }

  function qPickCategory(type, idx) {
    qLastType = type; qLastIdx = idx;
    var pool = [];
    var seen = {};
    function addWords(arr) {
      arr.forEach(function(w) { if (!seen[w.it+w.de]) { seen[w.it+w.de]=1; pool.push(w); } });
    }
    if (type === 'vocab') {
      if (idx === -1) { Q_CATEGORIES.forEach(function(c) { addWords(c.words); }); }
      else { addWords(Q_CATEGORIES[idx].words); }
    } else if (type === 'grammar') {
      if (idx === -1) { Q_GRAMMAR_CATEGORIES.forEach(function(c) { addWords(c.words); }); }
      else { addWords(Q_GRAMMAR_CATEGORIES[idx].words); }
    } else { // mix all
      Q_CATEGORIES.forEach(function(c) { addWords(c.words); });
      Q_GRAMMAR_CATEGORIES.forEach(function(c) { addWords(c.words); });
    }
    var active = pool.filter(function(w) { return !qIsMastered(w); });
    if (active.length === 0) {
      showToast('Alle Wörter gemeistert! 🎉', 'success');
      return;
    }
    var selected = qShuffle(active.slice()).slice(0, 5);
    qStartQuiz(selected);
  }

  function qStartQuiz(words) {
    qCurrentRound = words;
    qSessionStart = Date.now();
    qQueue = words.slice();
    qCorrectSet = {}; qWrongCounts = {};
    words.forEach(function(v) { qWrongCounts[v.de] = 0; });
    qJokersLeft = 3;
    qQuizActive = true;
    qShowScreen('quiz');
    qRenderJokers();
    var fab = qEl('q-joker-fab');
    if (fab) { fab.style.display=''; fab.classList.add('visible'); fab.disabled=false; }
    qNextWord();
  }

  function qNextWord() {
    if (qQueue.length === 0) { qFinishQuiz(); return; }
    qWordToken++;
    var token = qWordToken;
    qTimerLaunched = false;
    qAnswered = false;
    qTypingMode = false;
    qCurrent = qQueue.shift();

    var elW = qEl('q-word');
    if (elW) {
      if (qCurrent.sentence) {
        elW.classList.add('q-word--sentence');
        elW.innerHTML = escHtml(qCurrent.de) +
          (qCurrent.hint ? '<span class="q-word-hint">' + escHtml(qCurrent.hint) + '</span>' : '');
      } else {
        elW.classList.remove('q-word--sentence');
        elW.textContent = qCurrent.de;
      }
    }
    var inp = qEl('q-answer');
    if (inp) inp.value = '';
    var elH = qEl('q-heard');
    if (elH) elH.textContent = '';
    var elF = qEl('q-feedback');
    if (elF) { elF.textContent = ''; elF.className = ''; }
    qSetMicStatus('');
    qUpdateProgress();
    qUpdateDots();
    qRenderTimer(5, '');

    qStartWordRecognition(token);
  }

  function qLaunchTimerOnce(token) {
    if (qTimerLaunched || qWordToken !== token) return;
    qTimerLaunched = true;
    qStartTimer(token);
  }

  function qUseJoker() {
    if (qJokersLeft <= 0) return;
    qJokersLeft--;
    if (qTimeLeft > 0) {
      qTimeLeft += 3;
      qRenderTimer(qTimeLeft, qTimeLeft<=2?'urgent':qTimeLeft<=3?'warn':'');
    }
    qRenderJokers();
    var fab = qEl('q-joker-fab');
    if (fab) fab.disabled = (qJokersLeft === 0);
  }

  function qRenderJokers() {
    var labelEl = qEl('q-joker-label');
    if (labelEl) labelEl.textContent = '+3s';
    var pipsEl = qEl('q-joker-pips');
    if (pipsEl) {
      var h = '';
      for (var i=0; i<3; i++) h += '<span class="q-pip'+(i<qJokersLeft?' active':'')+'" ></span>';
      pipsEl.innerHTML = h;
    }
  }

  function qStartTimer(token) {
    clearInterval(qTimerInterval);
    qTimeLeft = 5;
    qRenderTimer(5, '');
    qTimerInterval = setInterval(function() {
      if (qWordToken !== token) { clearInterval(qTimerInterval); return; }
      qTimeLeft--;
      if (qTimeLeft > 0) {
        qRenderTimer(qTimeLeft, qTimeLeft<=2?'urgent':qTimeLeft<=3?'warn':'');
      } else {
        clearInterval(qTimerInterval);
        qRenderTimer('...', 'grace');
        setTimeout(function() {
          if (qWordToken === token && !qAnswered) qTimeOut();
        }, 1500);
      }
    }, 1000);
  }

  function qRenderTimer(val, cls) {
    var el = qEl('q-timer');
    if (!el) return;
    el.textContent = val;
    el.className = cls || '';
  }

  /* ---------- Answers ---------- */
  function qTimeOut() {
    if (qAnswered) return;
    qAnswered = true;
    qStopRecognition();
    if (qWrongCounts[qCurrent.de] === 0 && (qMastery[qCurrent.it]||0) > 0) {
      qMastery[qCurrent.it] = 0; qSaveMastery();
    }
    qWrongCounts[qCurrent.de]++;
    qQueue.push(qCurrent);
    var elF = qEl('q-feedback');
    if (elF) { elF.textContent = 'Zeit! – '+qCurrent.it; elF.className = 'q-wrong'; }
    setTimeout(qNextWord, 1900);
  }

  function qOnEnter() {
    if (qAnswered) return;
    var inp = qEl('q-answer');
    if (!inp) return;
    var val = inp.value.replace(/^\s+|\s+$/g,'').toLowerCase();
    if (!val) return;
    qAnswered = true;
    clearInterval(qTimerInterval);
    qEvaluate(val);
  }

  function qEvaluate(text) {
    var ok = [qCurrent.it.toLowerCase()]
      .concat(qCurrent.alt.map(function(a){return a.toLowerCase();}))
      .some(function(a){return text.indexOf(a)!==-1;});

    var elF = qEl('q-feedback');
    if (ok) {
      qCorrectSet[qCurrent.de] = true;
      if (elF) { elF.textContent = 'Helyes!'; elF.className = 'q-correct'; }
      if (qWrongCounts[qCurrent.de] === 0) {
        qMastery[qCurrent.it] = Math.min((qMastery[qCurrent.it]||0)+1, 3);
        qSaveMastery();
      }
    } else {
      if (qWrongCounts[qCurrent.de] === 0 && (qMastery[qCurrent.it]||0) > 0) {
        qMastery[qCurrent.it] = 0; qSaveMastery();
      }
      qWrongCounts[qCurrent.de]++;
      qQueue.push(qCurrent);
      if (elF) { elF.textContent = 'Hibás – '+qCurrent.it; elF.className = 'q-wrong'; }
    }
    qUpdateDots();
    setTimeout(qNextWord, 1700);
  }

  /* ---------- Finish ---------- */
  function qFinishQuiz() {
    qQuizActive = false;
    qStopRecognition();
    clearInterval(qTimerInterval);
    var fab = qEl('q-joker-fab');
    if (fab) { fab.classList.remove('visible'); fab.style.display='none'; }

    var html = '<h2 style="font-family:Quicksand,sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:1rem">Fatto!</h2>';
    qCurrentRound.forEach(function(v) {
      var c = qWrongCounts[v.de], cls = c===0?'ok':'some';
      var m = qMastery[v.it]||0;
      var pips = '<span class="q-mpips">';
      for (var j=0;j<3;j++) pips+='<span class="q-mpip'+(j<m?(m>=3?' max':' done'):'')+'" ></span>';
      pips += '</span>';
      html += '<div class="q-ri '+cls+'"><span>'+v.de+'</span>';
      html += '<span style="display:flex;align-items:center">'+v.it;
      if (c>0) html+='<span class="q-wrong-count">('+c+'x falsch)</span>';
      html+=pips+'</span></div>';
    });
    var rb = qEl('q-result-box');
    if (rb) rb.innerHTML = html;
    qRenderStats();
    if (qSessionStart) {
      var qElapsed = Math.round((Date.now() - qSessionStart) / 1000);
      var qTotal = qCurrentRound.length;
      var qCorrect = qCurrentRound.filter(function(v) { return qWrongCounts[v.de] === 0; }).length;
      var qSessions = DB.sessions();
      var qNextId = qSessions.length > 0 ? Math.max.apply(null, qSessions.map(function(x){return x.id||0})) + 1 : 1;
      qSessions.push({ id: qNextId, lesson_id: null, type: 'quiz',
        completed_at: new Date().toISOString(), duration_seconds: qElapsed,
        total_cards: qTotal, correct_first_try: qCorrect });
      DB.saveSessions(qSessions);
      qSessionStart = null;
    }
    qShowScreen('result');
  }

  /* ---------- Progress / dots ---------- */
  function qUpdateProgress() {
    var el = qEl('q-progress');
    if (el) el.textContent = Object.keys(qCorrectSet).length+' / '+qCurrentRound.length+' Richtig';
  }

  function qUpdateDots() {
    var el = qEl('q-dots');
    if (!el) return;
    var h='';
    qCurrentRound.forEach(function(v){
      var cls = qCorrectSet[v.de]?'q-dot done':(qCurrent&&v.de===qCurrent.de?'q-dot current':'q-dot');
      h+='<div class="'+cls+'" title="'+v.de+'"></div>';
    });
    el.innerHTML = h;
  }

  /* ---------- Speech Recognition ---------- */
  function qStartWordRecognition(token) {
    if (!QSpeechAPI) { qSetMicStatus('Texteingabe'); qLaunchTimerOnce(token); return; }
    try {
      var rec = new QSpeechAPI();
      rec.lang = 'hu-HU';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = function() {
        if (qWordToken !== token || qTypingMode) return;
        qSetMicStatus('Mikrofon aktív');
        qLaunchTimerOnce(token);
      };

      rec.onresult = function(e) {
        if (qWordToken !== token || qAnswered || qTypingMode) return;
        var last = e.results[e.results.length-1];
        var t = last[0].transcript.toLowerCase().replace(/^\s+|\s+$/g,'');
        var inp = qEl('q-answer'); if (inp) inp.value = t;
        var elH = qEl('q-heard'); if (elH) elH.textContent = '„'+t+'“';
        if (last.isFinal) {
          qAnswered = true;
          clearInterval(qTimerInterval);
          qStopRecognition();
          qEvaluate(t);
        }
      };

      rec.onerror = function(e) {
        if (qWordToken !== token || qAnswered || qTypingMode) return;
        if (e.error === 'not-allowed') {
          QSpeechAPI = null;
          qSetMicStatus('Texteingabe');
          qLaunchTimerOnce(token);
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          qSetMicStatus('Mikrofon-Fehler');
        }
      };

      rec.onend = function() {
        if (qWordToken !== token || qAnswered || qTypingMode) return;
        try { rec.start(); } catch(ex) {
          setTimeout(function() {
            if (qWordToken === token && !qAnswered && !qTypingMode) qStartWordRecognition(token);
          }, 150);
        }
      };

      rec.start();
      qRecognition = rec;
    } catch(e) {
      QSpeechAPI = null;
      qSetMicStatus('Texteingabe');
      qLaunchTimerOnce(token);
    }
  }

  function qStopRecognition() {
    if (qRecognition) {
      var r = qRecognition; qRecognition = null;
      try { r.stop(); } catch(e) {}
    }
  }

  function qSetMicStatus(msg) {
    var el = qEl('q-mic-status'); if (el) el.textContent = msg;
  }

  /* ---------- Helpers ---------- */
  function qShuffle(arr) {
    for (var i=arr.length-1;i>0;i--) {
      var j=Math.floor(Math.random()*(i+1));
      var tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp;
    }
    return arr;
  }

} // end initQuizTab

/* ============================================================
   PULL-TO-REFRESH
   ============================================================ */
(function() {
  var THRESHOLD = 72;
  var startY = 0, curDY = 0, active = false;

  var ind = document.createElement('div');
  ind.id = 'ptr-indicator';
  ind.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>';
  document.body.appendChild(ind);

  document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0) { startY = e.touches[0].clientY; active = true; }
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!active) return;
    curDY = e.touches[0].clientY - startY;
    if (curDY <= 0) { ind.className = ''; return; }
    var pct = Math.min(curDY / THRESHOLD, 1);
    var travel = Math.min(curDY * 0.45, 44);
    ind.style.opacity = pct;
    ind.style.transform = 'translateX(-50%) translateY(' + travel + 'px) rotate(' + (pct * 270) + 'deg)';
    ind.className = curDY >= THRESHOLD ? 'ptr-ready' : '';
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (!active) return;
    active = false;
    if (curDY >= THRESHOLD) {
      ind.className = 'ptr-spinning';
      setTimeout(function() { location.reload(); }, 200);
    } else {
      ind.style.opacity = '0';
      ind.style.transform = 'translateX(-50%) translateY(0)';
      ind.className = '';
    }
    curDY = 0;
  });
})();
