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
   Keys: iit_lessons, iit_cards, iit_sessions, iit_card_results, iit_phase6
   ============================================================ */
const DB = {
  _g: (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(e) { return d; } },
  _s: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  lessons:      () => DB._g('iit_lessons', []),
  saveLessons:  (d) => DB._s('iit_lessons', d),
  cards:        () => DB._g('iit_cards', []),
  saveCards:    (d) => DB._s('iit_cards', d),
  sessions:     () => DB._g('iit_sessions', []),
  saveSessions: (d) => DB._s('iit_sessions', d),
  results:      () => DB._g('iit_card_results', []),
  saveResults:  (d) => DB._s('iit_card_results', d),
  phase6:       () => DB._g('iit_phase6', {}),
  savePhase6:   (d) => DB._s('iit_phase6', d),
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
    for (let i=0; i<30; i++) {
      if (days.includes(cur)) { streak++; streakStart=cur; const d=new Date(cur); d.setDate(d.getDate()-1); cur=d.toISOString().slice(0,10); }
      else break;
    }
    const dailySessions = [];
    for (let i=13; i>=0; i--) {
      const day = new Date(Date.now()-i*86400000).toISOString().slice(0,10);
      const ds = sessions.filter(s=>s.completed_at.slice(0,10)===day);
      if (ds.length>0) {
        const dc=ds.reduce((s,x)=>s+(x.correct_first_try||0),0), dt=ds.reduce((s,x)=>s+(x.total_cards||0),0);
        dailySessions.push({day, count:ds.length, success_rate:dt>0?Math.round(dc/dt*100):0});
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
    return {
      total_lessons:lessons.length, total_cards:cards.length, total_sessions:sessions.length,
      overall_success_rate:results.length?Math.round(results.filter(r=>r.correct).length/results.length*100):null,
      total_duration:totalDuration, streak, streak_start:streakStart, studied_today:studiedToday,
      daily_sessions:dailySessions, lesson_stats:lessonStats, recent_sessions:recentSessions,
      phase6:{due_count:p6E.filter(([,v])=>new Date(v.next_review_at)<=new Date()).length,
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
      return Object.entries(p6)
        .filter(([,v])=>new Date(v.next_review_at)<=new Date())
        .sort((a,b)=>new Date(a[1].next_review_at)-new Date(b[1].next_review_at))
        .slice(0,limit)
        .map(([cid])=>{
          const c=cards.find(x=>x.id===parseInt(cid)); if(!c) return null;
          return {...c, phase:p6[parseInt(cid)].phase};
        }).filter(Boolean);
    }
    if (sub === 'stats') {
      const p6E=Object.entries(p6);
      return {due_count:p6E.filter(([,v])=>new Date(v.next_review_at)<=new Date()).length,
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
        <input type="text" class="form-input card-back" placeholder="Italiano…" value="${escHtml(card.back || '')}" />
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
    id: 'modalverben',
    title: 'Modalverben',
    icon: '💡',
    color: '#009246',
    lessonIds: [8, 9, 10, 11],
    intro: 'Modalverben drücken aus, ob jemand etwas kann, will, muss oder darf. Sie stehen immer zusammen mit dem Infinitiv eines anderen Verbs.',
    sections: [
      {
        heading: 'Die 4 Modalverben',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>potere</th><th>dovere</th><th>volere</th><th>sapere</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>posso</td><td>devo</td><td>voglio</td><td>so</td></tr>
            <tr><td class="person">tu</td><td>puoi</td><td>devi</td><td>vuoi</td><td>sai</td></tr>
            <tr><td class="person">lui/lei</td><td>pu\u00f2</td><td>deve</td><td>vuole</td><td>sa</td></tr>
            <tr><td class="person">noi</td><td>possiamo</td><td>dobbiamo</td><td>vogliamo</td><td>sappiamo</td></tr>
            <tr><td class="person">voi</td><td>potete</td><td>dovete</td><td>volete</td><td>sapete</td></tr>
            <tr><td class="person">loro</td><td>possono</td><td>devono</td><td>vogliono</td><td>sanno</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Verwendung',
        content: `<ul class="grammar-list">
          <li><strong>potere</strong> (k\u00f6nnen/dürfen): <em>Posso entrare?</em> \u2013 Darf ich reinkommen?</li>
          <li><strong>dovere</strong> (müssen/sollen): <em>Devo studiare.</em> \u2013 Ich muss lernen.</li>
          <li><strong>volere</strong> (wollen): <em>Voglio un caff\u00e8.</em> \u2013 Ich will einen Kaffee.</li>
          <li><strong>sapere</strong> (wissen/k\u00f6nnen): <em>Sai nuotare?</em> \u2013 Kannst du schwimmen?</li>
        </ul>
        <div class="grammar-note">\u2139\ufe0f <strong>sapere</strong> vs. <strong>potere</strong>: <em>sapere</em> = gelernte Fähigkeit, <em>potere</em> = M\u00f6glichkeit/Erlaubnis.</div>`
      }
    ]
  },
  {
    id: 'articoli',
    title: 'Bestimmte Artikel (Articoli determinativi)',
    icon: '📝',
    color: '#CE2B37',
    lessonIds: [],
    intro: 'Die bestimmten Artikel im Italienischen hängen vom Geschlecht, der Zahl und dem Anfangsbuchstaben des folgenden Wortes ab.',
    sections: [
      {
        heading: '\u00dcbersicht',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Singular</th><th>Plural</th></tr></thead>
          <tbody>
            <tr><td class="person">männlich<br>(Konsonant)</td><td><strong>il</strong> libro</td><td><strong>i</strong> libri</td></tr>
            <tr><td class="person">männlich<br>(s+Kons., z, gn, ps)</td><td><strong>lo</strong> studente</td><td><strong>gli</strong> studenti</td></tr>
            <tr><td class="person">männlich<br>(Vokal)</td><td><strong>l\u2019</strong>amico</td><td><strong>gli</strong> amici</td></tr>
            <tr><td class="person">weiblich<br>(Konsonant)</td><td><strong>la</strong> casa</td><td><strong>le</strong> case</td></tr>
            <tr><td class="person">weiblich<br>(Vokal)</td><td><strong>l\u2019</strong>amica</td><td><strong>le</strong> amiche</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Tipps',
        content: `<ul class="grammar-list">
          <li><strong>lo</strong> steht vor <em>s + Konsonant</em> (lo sport), <em>z</em> (lo zaino), <em>gn</em> (lo gnocco), <em>ps</em> (lo psicologo).</li>
          <li><strong>l\u2019</strong> (Elision) vor Vokalen, sowohl männlich als auch weiblich im Singular.</li>
          <li>Im Plural: <strong>gli</strong> für männlich, <strong>le</strong> für weiblich \u2013 keine Elision.</li>
        </ul>`
      }
    ]
  },
  {
    id: 'preposizioni',
    title: 'Präpositionen mit Artikeln (Preposizioni articolate)',
    icon: '🔗',
    color: '#0f3460',
    lessonIds: [2, 3, 4, 5, 6, 7],
    intro: 'Wenn Präpositionen auf bestimmte Artikel treffen, verschmelzen sie zu einer Einheit.',
    sections: [
      {
        heading: 'Verschmelzungstabelle',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>il</th><th>lo</th><th>la</th><th>l\u2019</th><th>i</th><th>gli</th><th>le</th></tr></thead>
          <tbody>
            <tr><td class="person">a</td><td>al</td><td>allo</td><td>alla</td><td>all\u2019</td><td>ai</td><td>agli</td><td>alle</td></tr>
            <tr><td class="person">di</td><td>del</td><td>dello</td><td>della</td><td>dell\u2019</td><td>dei</td><td>degli</td><td>delle</td></tr>
            <tr><td class="person">da</td><td>dal</td><td>dallo</td><td>dalla</td><td>dall\u2019</td><td>dai</td><td>dagli</td><td>dalle</td></tr>
            <tr><td class="person">in</td><td>nel</td><td>nello</td><td>nella</td><td>nell\u2019</td><td>nei</td><td>negli</td><td>nelle</td></tr>
            <tr><td class="person">su</td><td>sul</td><td>sullo</td><td>sulla</td><td>sull\u2019</td><td>sui</td><td>sugli</td><td>sulle</td></tr>
            <tr><td class="person">con</td><td>col</td><td colspan="6">(con + Artikel wird selten verschmolzen, au\u00dfer \u201ecol\u201c)</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Beispiele',
        content: `<ul class="grammar-list">
          <li><strong>Vado al cinema.</strong> \u2013 Ich gehe ins Kino. (a + il = al)</li>
          <li><strong>Il libro della professoressa.</strong> \u2013 Das Buch der Professorin. (di + la = della)</li>
          <li><strong>Vengo dalla Germania.</strong> \u2013 Ich komme aus Deutschland. (da + la = dalla)</li>
          <li><strong>Siamo nella macchina.</strong> \u2013 Wir sind im Auto. (in + la = nella)</li>
          <li><strong>Il gatto \u00e8 sul tavolo.</strong> \u2013 Die Katze ist auf dem Tisch. (su + il = sul)</li>
        </ul>`
      }
    ]
  },
  {
    id: 'presente',
    title: 'Presente (Gegenwart)',
    icon: '⏰',
    color: '#C8963E',
    lessonIds: [12, 14, 16, 18, 20, 25, 27, 29, 31, 33],
    intro: 'Das Presente entspricht dem deutschen Präsens. Die Endungen hängen von der Verb-Gruppe ab (-are, -ere, -ire).',
    sections: [
      {
        heading: 'Regelmä\u00dfige Konjugation',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>-are<br>(parlare)</th><th>-ere<br>(scrivere)</th><th>-ire<br>(dormire)</th><th>-ire (isc)<br>(capire)</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>parl<strong>o</strong></td><td>scriv<strong>o</strong></td><td>dorm<strong>o</strong></td><td>cap<strong>isco</strong></td></tr>
            <tr><td class="person">tu</td><td>parl<strong>i</strong></td><td>scriv<strong>i</strong></td><td>dorm<strong>i</strong></td><td>cap<strong>isci</strong></td></tr>
            <tr><td class="person">lui/lei</td><td>parl<strong>a</strong></td><td>scriv<strong>e</strong></td><td>dorm<strong>e</strong></td><td>cap<strong>isce</strong></td></tr>
            <tr><td class="person">noi</td><td>parl<strong>iamo</strong></td><td>scriv<strong>iamo</strong></td><td>dorm<strong>iamo</strong></td><td>cap<strong>iamo</strong></td></tr>
            <tr><td class="person">voi</td><td>parl<strong>ate</strong></td><td>scriv<strong>ete</strong></td><td>dorm<strong>ite</strong></td><td>cap<strong>ite</strong></td></tr>
            <tr><td class="person">loro</td><td>parl<strong>ano</strong></td><td>scriv<strong>ono</strong></td><td>dorm<strong>ono</strong></td><td>cap<strong>iscono</strong></td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Wichtige unregelmä\u00dfige Verben',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>essere</th><th>avere</th><th>andare</th><th>fare</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>sono</td><td>ho</td><td>vado</td><td>faccio</td></tr>
            <tr><td class="person">tu</td><td>sei</td><td>hai</td><td>vai</td><td>fai</td></tr>
            <tr><td class="person">lui/lei</td><td>\u00e8</td><td>ha</td><td>va</td><td>fa</td></tr>
            <tr><td class="person">noi</td><td>siamo</td><td>abbiamo</td><td>andiamo</td><td>facciamo</td></tr>
            <tr><td class="person">voi</td><td>siete</td><td>avete</td><td>andate</td><td>fate</td></tr>
            <tr><td class="person">loro</td><td>sono</td><td>hanno</td><td>vanno</td><td>fanno</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'Weitere unregelm\u00e4\u00dfige Verben',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>volere</th><th>venire</th><th>sapere</th><th>dire</th><th>dare</th><th>stare</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>voglio</td><td>vengo</td><td>so</td><td>dico</td><td>do</td><td>sto</td></tr>
            <tr><td class="person">tu</td><td>vuoi</td><td>vieni</td><td>sai</td><td>dici</td><td>dai</td><td>stai</td></tr>
            <tr><td class="person">lui/lei</td><td>vuole</td><td>viene</td><td>sa</td><td>dice</td><td>d\u00e0</td><td>sta</td></tr>
            <tr><td class="person">noi</td><td>vogliamo</td><td>veniamo</td><td>sappiamo</td><td>diciamo</td><td>diamo</td><td>stiamo</td></tr>
            <tr><td class="person">voi</td><td>volete</td><td>venite</td><td>sapete</td><td>dite</td><td>date</td><td>state</td></tr>
            <tr><td class="person">loro</td><td>vogliono</td><td>vengono</td><td>sanno</td><td>dicono</td><td>danno</td><td>stanno</td></tr>
          </tbody>
        </table></div>`
      }
    ]
  },
  {
    id: 'passato',
    title: 'Passato Prossimo (Vergangenheit)',
    icon: '⏪',
    color: '#8B4513',
    lessonIds: [13, 15, 17, 19, 21, 26, 28, 30, 32, 34],
    intro: 'Das Passato Prossimo entspricht dem deutschen Perfekt. Es wird mit <strong>avere</strong> oder <strong>essere</strong> + Partizip Perfekt gebildet.',
    sections: [
      {
        heading: 'Bildung',
        content: `<div class="grammar-note">📐 <strong>Formel:</strong> avere/essere (konjugiert) + Partizip Perfekt</div>
        <div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Verb-Typ</th><th>Partizip-Endung</th><th>Beispiel</th></tr></thead>
          <tbody>
            <tr><td>-are</td><td>-<strong>ato</strong></td><td>parlare \u2192 parl<strong>ato</strong></td></tr>
            <tr><td>-ere</td><td>-<strong>uto</strong></td><td>avere \u2192 av<strong>uto</strong></td></tr>
            <tr><td>-ire</td><td>-<strong>ito</strong></td><td>dormire \u2192 dorm<strong>ito</strong></td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'avere oder essere?',
        content: `<ul class="grammar-list">
          <li><strong>avere</strong>: Die meisten Verben \u2013 <em>Ho mangiato una pizza.</em></li>
          <li><strong>essere</strong>: Bewegungsverben (andare, venire, partire, arrivare\u2026), Zustandsverben (essere, restare, diventare\u2026), reflexive Verben.</li>
        </ul>
        <div class="grammar-note">⚠️ Bei <strong>essere</strong> muss das Partizip in Geschlecht und Zahl angeglichen werden:<br>
        <em>Lei \u00e8 andat<strong>a</strong></em> (w.) vs. <em>Lui \u00e8 andat<strong>o</strong></em> (m.)<br>
        <em>Loro sono andat<strong>i</strong></em> (m./gem.) vs. <em>andat<strong>e</strong></em> (nur w.)</div>`
      },
      {
        heading: 'Unregelmä\u00dfige Partizipien',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th>Verb</th><th>Partizip</th><th>Verb</th><th>Partizip</th></tr></thead>
          <tbody>
            <tr><td>fare</td><td><strong>fatto</strong></td><td>scrivere</td><td><strong>scritto</strong></td></tr>
            <tr><td>essere</td><td><strong>stato</strong></td><td>leggere</td><td><strong>letto</strong></td></tr>
            <tr><td>avere</td><td><strong>avuto</strong></td><td>dire</td><td><strong>detto</strong></td></tr>
            <tr><td>vedere</td><td><strong>visto</strong></td><td>aprire</td><td><strong>aperto</strong></td></tr>
            <tr><td>prendere</td><td><strong>preso</strong></td><td>mettere</td><td><strong>messo</strong></td></tr>
            <tr><td>venire</td><td><strong>venuto</strong></td><td>sapere</td><td><strong>saputo</strong></td></tr>
            <tr><td>dare</td><td><strong>dato</strong></td><td>stare</td><td><strong>stato</strong></td></tr>
          </tbody>
        </table></div>`
      }
    ]
  },
  {
    id: 'konjugation-verben',
    title: 'Die 10 wichtigsten Verben',
    icon: '⭐',
    color: '#6B4C9A',
    lessonIds: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34],
    intro: 'Diese zehn Verben sind die Grundlage für alltägliches Italienisch. Sie sind alle unregelmä\u00dfig und müssen auswendig gelernt werden.',
    sections: [
      {
        heading: 'andare (gehen/fahren)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>vado</td><td>sono andato/a</td></tr>
            <tr><td class="person">tu</td><td>vai</td><td>sei andato/a</td></tr>
            <tr><td class="person">lui/lei</td><td>va</td><td>\u00e8 andato/a</td></tr>
            <tr><td class="person">noi</td><td>andiamo</td><td>siamo andati/e</td></tr>
            <tr><td class="person">voi</td><td>andate</td><td>siete andati/e</td></tr>
            <tr><td class="person">loro</td><td>vanno</td><td>sono andati/e</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\ud83d\udea8 <strong>andare</strong> nutzt <strong>essere</strong> im Passato Prossimo! Partizip wird angeglichen.</div>`
      },
      {
        heading: 'essere (sein)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>sono</td><td>sono stato/a</td></tr>
            <tr><td class="person">tu</td><td>sei</td><td>sei stato/a</td></tr>
            <tr><td class="person">lui/lei</td><td>\u00e8</td><td>\u00e8 stato/a</td></tr>
            <tr><td class="person">noi</td><td>siamo</td><td>siamo stati/e</td></tr>
            <tr><td class="person">voi</td><td>siete</td><td>siete stati/e</td></tr>
            <tr><td class="person">loro</td><td>sono</td><td>sono stati/e</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'avere (haben)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>ho</td><td>ho avuto</td></tr>
            <tr><td class="person">tu</td><td>hai</td><td>hai avuto</td></tr>
            <tr><td class="person">lui/lei</td><td>ha</td><td>ha avuto</td></tr>
            <tr><td class="person">noi</td><td>abbiamo</td><td>abbiamo avuto</td></tr>
            <tr><td class="person">voi</td><td>avete</td><td>avete avuto</td></tr>
            <tr><td class="person">loro</td><td>hanno</td><td>hanno avuto</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'fare (machen/tun)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>faccio</td><td>ho fatto</td></tr>
            <tr><td class="person">tu</td><td>fai</td><td>hai fatto</td></tr>
            <tr><td class="person">lui/lei</td><td>fa</td><td>ha fatto</td></tr>
            <tr><td class="person">noi</td><td>facciamo</td><td>abbiamo fatto</td></tr>
            <tr><td class="person">voi</td><td>fate</td><td>avete fatto</td></tr>
            <tr><td class="person">loro</td><td>fanno</td><td>hanno fatto</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\u2139\ufe0f Unregelmä\u00dfiges Partizip: <strong>fatto</strong> (nicht *facuto)</div>`
      },
      {
        heading: 'volere (wollen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>voglio</td><td>ho voluto</td></tr>
            <tr><td class="person">tu</td><td>vuoi</td><td>hai voluto</td></tr>
            <tr><td class="person">lui/lei</td><td>vuole</td><td>ha voluto</td></tr>
            <tr><td class="person">noi</td><td>vogliamo</td><td>abbiamo voluto</td></tr>
            <tr><td class="person">voi</td><td>volete</td><td>avete voluto</td></tr>
            <tr><td class="person">loro</td><td>vogliono</td><td>hanno voluto</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'venire (kommen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>vengo</td><td>sono venuto/a</td></tr>
            <tr><td class="person">tu</td><td>vieni</td><td>sei venuto/a</td></tr>
            <tr><td class="person">lui/lei</td><td>viene</td><td>\u00e8 venuto/a</td></tr>
            <tr><td class="person">noi</td><td>veniamo</td><td>siamo venuti/e</td></tr>
            <tr><td class="person">voi</td><td>venite</td><td>siete venuti/e</td></tr>
            <tr><td class="person">loro</td><td>vengono</td><td>sono venuti/e</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\ud83d\udea8 <strong>venire</strong> nutzt <strong>essere</strong> im Passato Prossimo! Partizip wird angeglichen.</div>`
      },
      {
        heading: 'sapere (wissen/k\u00f6nnen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>so</td><td>ho saputo</td></tr>
            <tr><td class="person">tu</td><td>sai</td><td>hai saputo</td></tr>
            <tr><td class="person">lui/lei</td><td>sa</td><td>ha saputo</td></tr>
            <tr><td class="person">noi</td><td>sappiamo</td><td>abbiamo saputo</td></tr>
            <tr><td class="person">voi</td><td>sapete</td><td>avete saputo</td></tr>
            <tr><td class="person">loro</td><td>sanno</td><td>hanno saputo</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\u2139\ufe0f Im Passato Prossimo bedeutet <strong>ho saputo</strong> = ich habe erfahren.</div>`
      },
      {
        heading: 'dire (sagen)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>dico</td><td>ho detto</td></tr>
            <tr><td class="person">tu</td><td>dici</td><td>hai detto</td></tr>
            <tr><td class="person">lui/lei</td><td>dice</td><td>ha detto</td></tr>
            <tr><td class="person">noi</td><td>diciamo</td><td>abbiamo detto</td></tr>
            <tr><td class="person">voi</td><td>dite</td><td>avete detto</td></tr>
            <tr><td class="person">loro</td><td>dicono</td><td>hanno detto</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\u2139\ufe0f Unregelm\u00e4\u00dfiges Partizip: <strong>detto</strong> (nicht *dito)</div>`
      },
      {
        heading: 'dare (geben)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>do</td><td>ho dato</td></tr>
            <tr><td class="person">tu</td><td>dai</td><td>hai dato</td></tr>
            <tr><td class="person">lui/lei</td><td>d\u00e0</td><td>ha dato</td></tr>
            <tr><td class="person">noi</td><td>diamo</td><td>abbiamo dato</td></tr>
            <tr><td class="person">voi</td><td>date</td><td>avete dato</td></tr>
            <tr><td class="person">loro</td><td>danno</td><td>hanno dato</td></tr>
          </tbody>
        </table></div>`
      },
      {
        heading: 'stare (bleiben/sich befinden)',
        content: `<div class="grammar-table-wrap"><table class="grammar-table">
          <thead><tr><th></th><th>Presente</th><th>Passato P.</th></tr></thead>
          <tbody>
            <tr><td class="person">io</td><td>sto</td><td>sono stato/a</td></tr>
            <tr><td class="person">tu</td><td>stai</td><td>sei stato/a</td></tr>
            <tr><td class="person">lui/lei</td><td>sta</td><td>\u00e8 stato/a</td></tr>
            <tr><td class="person">noi</td><td>stiamo</td><td>siamo stati/e</td></tr>
            <tr><td class="person">voi</td><td>state</td><td>siete stati/e</td></tr>
            <tr><td class="person">loro</td><td>stanno</td><td>sono stati/e</td></tr>
          </tbody>
        </table></div>
        <div class="grammar-note">\ud83d\udea8 <strong>stare</strong> nutzt <strong>essere</strong> im Passato Prossimo! Auch wichtig f\u00fcr: <em>Come stai?</em> (Wie geht es dir?)</div>`
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
      ? `<div class="grammar-practice-wrap"><button class="btn btn-primary btn-sm grammar-practice-btn" data-unit-id="${unit.id}">🎓 5 Karten üben</button></div>`
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

async function startPhase6Session() {
  if (state.phase6DueCards.length === 0) {
    showToast('Keine Karten fällig', 'info');
    return;
  }

  // Use up to 20 cards per session
  const cards = state.phase6DueCards.slice(0, 20);

  state.sessionMode = 'phase6';
  state.sessionLessonId = null;
  // Collect unique lesson IDs from due cards
  state.sessionLessonIds = [...new Set(cards.map(c => c.lesson_id))];
  state.sessionIsWeakMode = false;
  state.learnQuestionCount = 'all';

  // Hide Phase-6 view, start session
  $('learnPhase6View').style.display = 'none';
  startSession(cards, cards[0]?.lesson_id || null);
}

function initPhase6() {
  $('startPhase6Btn').addEventListener('click', startPhase6Session);
}

/* ============================================================
   DATA IMPORT
   ============================================================ */
function initImport() {
  const overlay  = $('importOverlay');
  const titleEl  = $('importTitle');
  const descEl   = $('importDesc');
  const input    = $('importInput');
  const okBtn    = $('importOk');
  const cancelBtn= $('importCancel');
  if (!overlay) return;

  let importMode = null; // 'quiz' | 'app'

  function openImport(mode) {
    importMode = mode;
    input.value = '';
    if (mode === 'quiz') {
      titleEl.textContent = 'Quiz-Fortschritt importieren';
      descEl.innerHTML = 'Führe in der alten App folgendes in der Browser-Konsole aus und füge das Ergebnis hier ein:<br>' +
        '<code style="background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-size:0.75rem">' +
        'localStorage.getItem(\'impara_mastery\')</code>';
    } else {
      titleEl.textContent = 'Lektionen & Karten importieren';
      descEl.innerHTML = 'Führe in der alten App folgendes in der Browser-Konsole aus und füge das Ergebnis hier ein:<br>' +
        '<code style="background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-size:0.75rem">' +
        'JSON.stringify({l:localStorage.getItem(\'iit_lessons\'),c:localStorage.getItem(\'iit_cards\'),' +
        's:localStorage.getItem(\'iit_sessions\'),r:localStorage.getItem(\'iit_card_results\'),' +
        'p:localStorage.getItem(\'iit_phase6\')})</code>';
    }
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
  }

  function closeImport() { overlay.style.display = 'none'; }

  // File picker: read file into textarea
  const fileInput = $('importFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        let text = e.target.result.trim();
        // Strip ===EXPORT=== / ===ENDE=== markers if present
        const m = text.match(/===EXPORT===\s*([\s\S]*?)\s*===ENDE===/);
        if (m) text = m[1].trim();
        input.value = text;
        showToast('Datei geladen — jetzt auf Importieren klicken', 'info');
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  $('importQuizBtn').addEventListener('click', () => openImport('quiz'));
  $('importAppBtn').addEventListener('click',  () => openImport('app'));
  cancelBtn.addEventListener('click', closeImport);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeImport(); });

  okBtn.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { showToast('Kein Inhalt eingefügt', 'error'); return; }
    try {
      if (importMode === 'quiz') {
        const data = JSON.parse(raw);
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Ungültiges Format');
        // Merge: keep higher value for each word
        let existing = {};
        try { existing = JSON.parse(localStorage.getItem('impara_mastery') || '{}'); } catch(e) {}
        for (const [k,v] of Object.entries(data)) {
          existing[k] = Math.max(existing[k] || 0, parseInt(v) || 0);
        }
        localStorage.setItem('impara_mastery', JSON.stringify(existing));
        showToast(`${Object.keys(data).length} Vokabeln importiert`, 'success');
        closeImport();
      } else {
        const pkg = JSON.parse(raw);
        let count = 0;

        // Lessons, cards, sessions, card_results (array merge by id)
        const arrayKeys = {l:'iit_lessons', c:'iit_cards', s:'iit_sessions', r:'iit_card_results'};
        for (const [short, key] of Object.entries(arrayKeys)) {
          if (pkg[short]) {
            const existing = DB._g(key, []);
            const incoming = JSON.parse(pkg[short]);
            const existingIds = new Set(existing.map(x=>x.id));
            DB._s(key, [...existing, ...incoming.filter(x=>!existingIds.has(x.id))]);
            count++;
          }
        }

        // Phase-6: accept either old {card_id: {...}} dict (key "p")
        // or new array format from card_phase6_state table (key "p6_raw")
        if (pkg.p6_raw) {
          const existing = DB.phase6();
          const rows = JSON.parse(pkg.p6_raw);
          // rows: [{card_id, phase, next_review_at, last_reviewed_at, correct_streak}]
          rows.forEach(r => {
            existing[r.card_id] = {
              phase: r.phase,
              correct_streak: r.correct_streak || 0,
              next_review_at: r.next_review_at,
              last_reviewed_at: r.last_reviewed_at || '',
            };
          });
          DB.savePhase6(existing);
          count++;
        } else if (pkg.p) {
          const existing = DB.phase6();
          DB.savePhase6({...existing, ...JSON.parse(pkg.p)});
          count++;
        }

        const lessons = DB._g('iit_lessons', []).length;
        const cards   = DB._g('iit_cards', []).length;
        const p6count = Object.keys(DB.phase6()).length;
        showToast(`Importiert: ${lessons} Lektionen · ${cards} Karten · ${p6count} Phase-6-Einträge`, 'success', 5000);
        closeImport();
        loadStats();
      }
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
        { de: 'die Familie',        it: 'la famiglia',       alt: ['famiglia'] },
        { de: 'der Vater',          it: 'il padre',          alt: ['padre'] },
        { de: 'die Mutter',         it: 'la madre',          alt: ['madre'] },
        { de: 'der Sohn',           it: 'il figlio',         alt: ['figlio'] },
        { de: 'die Tochter',        it: 'la figlia',         alt: ['figlia'] },
        { de: 'der Bruder',         it: 'il fratello',       alt: ['fratello'] },
        { de: 'die Schwester',      it: 'la sorella',        alt: ['sorella'] },
        { de: 'der Ehemann',        it: 'il marito',         alt: ['marito'] },
        { de: 'die Ehefrau',        it: 'la moglie',         alt: ['moglie'] },
        { de: 'der Großvater',      it: 'il nonno',          alt: ['nonno'] },
        { de: 'die Großmutter',     it: 'la nonna',          alt: ['nonna'] },
        { de: 'der Onkel',          it: 'lo zio',            alt: ['zio'] },
        { de: 'die Tante',          it: 'la zia',            alt: ['zia'] },
        { de: 'der Cousin',         it: 'il cugino',         alt: ['cugino'] },
        { de: 'die Cousine',        it: 'la cugina',         alt: ['cugina'] },
        { de: 'das Kind (Junge)',   it: 'il bambino',        alt: ['bambino'] },
        { de: 'das Kind (Mädchen)', it: 'la bambina',        alt: ['bambina'] },
        { de: 'der Freund',         it: "l'amico",           alt: ['amico'] },
        { de: 'die Freundin',       it: "l'amica",           alt: ['amica'] },
        { de: 'der Nachbar',        it: 'il vicino',         alt: ['vicino'] },
        { de: 'die Nachbarin',      it: 'la vicina',         alt: ['vicina'] },
        { de: 'die Person',         it: 'la persona',        alt: ['persona'] },
        { de: 'der Mann',           it: "l'uomo",            alt: ['uomo'] },
        { de: 'die Frau',           it: 'la donna',          alt: ['donna'] },
        { de: 'das Baby',           it: 'il bambino piccolo',alt: ['bambino piccolo','neonato'] },
        { de: 'der Schwiegervater', it: 'il suocero',        alt: ['suocero'] },
        { de: 'die Schwiegermutter',it: 'la suocera',        alt: ['suocera'] },
        { de: 'der Neffe',          it: 'il nipote',         alt: ['nipote'] },
        { de: 'die Nichte',         it: 'la nipote',         alt: ['nipote'] },
        { de: 'das Pärchen',        it: 'la coppia',         alt: ['coppia'] },
        { de: 'der Bekannte',       it: 'il conoscente',     alt: ['conoscente'] },
        { de: 'der Kollege',        it: 'il collega',        alt: ['collega'] },
        { de: 'der Zwilling',       it: 'il gemello',        alt: ['gemello'] },
        { de: 'der Einzelkind',     it: 'il figlio unico',   alt: ['figlio unico'] },
        { de: 'die Verwandten',     it: 'i parenti',         alt: ['parenti'] },
        { de: 'die Geschwister',    it: 'i fratelli',        alt: ['fratelli'] },
        { de: 'der Vorname',        it: 'il nome',           alt: ['nome'] },
        { de: 'der Nachname',       it: 'il cognome',        alt: ['cognome'] },
      ]
    },
    {
      name: 'Essen & Trinken',
      words: [
        { de: 'das Wasser',         it: "l'acqua",           alt: ['acqua'] },
        { de: 'der Wein',           it: 'il vino',           alt: ['vino'] },
        { de: 'das Bier',           it: 'la birra',          alt: ['birra'] },
        { de: 'der Kaffee',         it: 'il caffè',          alt: ['caffe','caffè'] },
        { de: 'der Tee',            it: 'il tè',             alt: ['te','tè'] },
        { de: 'das Brot',           it: 'il pane',           alt: ['pane'] },
        { de: 'die Pasta',          it: 'la pasta',          alt: ['pasta'] },
        { de: 'die Pizza',          it: 'la pizza',          alt: ['pizza'] },
        { de: 'das Fleisch',        it: 'la carne',          alt: ['carne'] },
        { de: 'der Fisch',          it: 'il pesce',          alt: ['pesce'] },
        { de: 'das Gemüse',         it: 'la verdura',        alt: ['verdura'] },
        { de: 'das Obst',           it: 'la frutta',         alt: ['frutta'] },
        { de: 'der Käse',           it: 'il formaggio',      alt: ['formaggio'] },
        { de: 'das Ei',             it: "l'uovo",            alt: ['uovo'] },
        { de: 'die Milch',          it: 'il latte',          alt: ['latte'] },
        { de: 'die Butter',         it: 'il burro',          alt: ['burro'] },
        { de: 'der Zucker',         it: 'lo zucchero',       alt: ['zucchero'] },
        { de: 'das Salz',           it: 'il sale',           alt: ['sale'] },
        { de: 'der Pfeffer',        it: 'il pepe',           alt: ['pepe'] },
        { de: 'die Tomate',         it: 'il pomodoro',       alt: ['pomodoro'] },
        { de: 'die Kartoffel',      it: 'la patata',         alt: ['patata'] },
        { de: 'der Apfel',          it: 'la mela',           alt: ['mela'] },
        { de: 'die Orange',         it: "l'arancia",         alt: ['arancia'] },
        { de: 'die Zitrone',        it: 'il limone',         alt: ['limone'] },
        { de: 'das Eis',            it: 'il gelato',         alt: ['gelato'] },
        { de: 'die Suppe',          it: 'la zuppa',          alt: ['zuppa','minestra'] },
        { de: 'der Salat',          it: "l'insalata",        alt: ['insalata'] },
        { de: 'das Frühstück',      it: 'la colazione',      alt: ['colazione'] },
        { de: 'das Mittagessen',    it: 'il pranzo',         alt: ['pranzo'] },
        { de: 'das Abendessen',     it: 'la cena',           alt: ['cena'] },
        { de: 'der Saft',           it: 'il succo',          alt: ['succo'] },
        { de: 'die Schokolade',     it: 'il cioccolato',     alt: ['cioccolato','cioccolata'] },
        { de: 'der Kuchen',         it: 'la torta',          alt: ['torta'] },
        { de: 'das Risotto',        it: 'il risotto',        alt: ['risotto'] },
        { de: 'der Espresso',       it: "l'espresso",        alt: ['espresso'] },
        { de: 'das Mineralwasser',  it: "l'acqua minerale",  alt: ['acqua minerale'] },
        { de: 'die Vorspeise',      it: "l'antipasto",       alt: ['antipasto'] },
        { de: 'das Dessert',        it: 'il dolce',          alt: ['dolce','dessert'] },
      ]
    },
    {
      name: 'Reisen & Verkehr',
      words: [
        { de: 'das Auto',           it: "l'automobile",      alt: ['automobile','macchina','auto'] },
        { de: 'der Zug',            it: 'il treno',          alt: ['treno'] },
        { de: 'das Flugzeug',       it: "l'aereo",           alt: ['aereo'] },
        { de: 'das Schiff',         it: 'la nave',           alt: ['nave'] },
        { de: 'der Bus',            it: 'il bus',            alt: ['bus','autobus'] },
        { de: 'das Fahrrad',        it: 'la bicicletta',     alt: ['bicicletta','bici'] },
        { de: 'der Bahnhof',        it: 'la stazione',       alt: ['stazione'] },
        { de: 'der Flughafen',      it: "l'aeroporto",       alt: ['aeroporto'] },
        { de: 'das Hotel',          it: "l'hotel",           alt: ['hotel','albergo'] },
        { de: 'das Ticket',         it: 'il biglietto',      alt: ['biglietto'] },
        { de: 'die Reise',          it: 'il viaggio',        alt: ['viaggio'] },
        { de: 'der Urlaub',         it: 'le vacanze',        alt: ['vacanze'] },
        { de: 'die Karte (Landkarte)',it: 'la mappa',        alt: ['mappa','carta'] },
        { de: 'die Straße',         it: 'la strada',         alt: ['strada'] },
        { de: 'die Brücke',         it: 'il ponte',          alt: ['ponte'] },
        { de: 'der Hafen',          it: 'il porto',          alt: ['porto'] },
        { de: 'die U-Bahn',         it: 'la metropolitana',  alt: ['metropolitana','metro'] },
        { de: 'das Taxi',           it: 'il taxi',           alt: ['taxi'] },
        { de: 'der Pass',           it: 'il passaporto',     alt: ['passaporto'] },
        { de: 'der Koffer',         it: 'la valigia',        alt: ['valigia'] },
        { de: 'der Rucksack',       it: 'lo zaino',          alt: ['zaino'] },
        { de: 'die Grenze',         it: 'il confine',        alt: ['confine'] },
        { de: 'die Ankunft',        it: "l'arrivo",          alt: ['arrivo'] },
        { de: 'die Abfahrt',        it: 'la partenza',       alt: ['partenza'] },
        { de: 'der Umstieg',        it: 'il cambio',         alt: ['cambio','coincidenza'] },
        { de: 'die Autobahn',       it: "l'autostrada",      alt: ['autostrada'] },
        { de: 'das Motorrad',       it: 'la moto',           alt: ['moto','motocicletta'] },
        { de: 'die Tankstelle',     it: 'il distributore',   alt: ['distributore','benzinai'] },
        { de: 'das Gepäck',         it: 'il bagaglio',       alt: ['bagaglio'] },
        { de: 'der Reiseführer',    it: 'la guida turistica',alt: ['guida turistica','guida'] },
        { de: 'die Fahrkarte',      it: 'il biglietto del treno',alt:['biglietto del treno','biglietto'] },
        { de: 'der Stau',           it: 'il traffico',       alt: ['traffico','ingorgo'] },
        { de: 'der Parkplatz',      it: 'il parcheggio',     alt: ['parcheggio'] },
        { de: 'die Haltestelle',    it: 'la fermata',        alt: ['fermata'] },
        { de: 'der Ausflug',        it: "l'escursione",      alt: ['escursione','gita'] },
        { de: 'das Zimmer',         it: 'la camera',         alt: ['camera'] },
        { de: 'die Rezeption',      it: 'la reception',      alt: ['reception'] },
        { de: 'die Sehenswürdigkeit',it: 'il monumento',     alt: ['monumento','attrazione'] },
      ]
    },
    {
      name: 'Haus & Wohnen',
      words: [
        { de: 'das Haus',           it: 'la casa',           alt: ['casa'] },
        { de: 'die Wohnung',        it: "l'appartamento",    alt: ['appartamento'] },
        { de: 'das Zimmer',         it: 'la stanza',         alt: ['stanza'] },
        { de: 'die Küche',          it: 'la cucina',         alt: ['cucina'] },
        { de: 'das Badezimmer',     it: 'il bagno',          alt: ['bagno'] },
        { de: 'das Schlafzimmer',   it: 'la camera da letto',alt: ['camera da letto'] },
        { de: 'das Wohnzimmer',     it: 'il salotto',        alt: ['salotto','soggiorno'] },
        { de: 'die Tür',            it: 'la porta',          alt: ['porta'] },
        { de: 'das Fenster',        it: 'la finestra',       alt: ['finestra'] },
        { de: 'die Treppe',         it: 'la scala',          alt: ['scala'] },
        { de: 'der Garten',         it: 'il giardino',       alt: ['giardino'] },
        { de: 'der Balkon',         it: 'il balcone',        alt: ['balcone'] },
        { de: 'der Tisch',          it: 'il tavolo',         alt: ['tavolo'] },
        { de: 'der Stuhl',          it: 'la sedia',          alt: ['sedia'] },
        { de: 'das Bett',           it: 'il letto',          alt: ['letto'] },
        { de: 'der Schrank',        it: "l'armadio",         alt: ['armadio'] },
        { de: 'das Sofa',           it: 'il divano',         alt: ['divano'] },
        { de: 'der Kühlschrank',    it: 'il frigorifero',    alt: ['frigorifero','frigo'] },
        { de: 'der Herd',           it: 'il fornello',       alt: ['fornello','cucina'] },
        { de: 'die Waschmaschine',  it: 'la lavatrice',      alt: ['lavatrice'] },
        { de: 'die Lampe',          it: 'la lampada',        alt: ['lampada'] },
        { de: 'der Spiegel',        it: 'lo specchio',       alt: ['specchio'] },
        { de: 'das Dach',           it: 'il tetto',          alt: ['tetto'] },
        { de: 'der Keller',         it: 'la cantina',        alt: ['cantina'] },
        { de: 'die Garage',         it: 'il garage',         alt: ['garage'] },
        { de: 'die Miete',          it: "l'affitto",         alt: ['affitto'] },
        { de: 'der Vermieter',      it: 'il proprietario',   alt: ['proprietario'] },
        { de: 'der Nachbar',        it: 'il vicino di casa', alt: ['vicino di casa','vicino'] },
        { de: 'die Etage',          it: 'il piano',          alt: ['piano'] },
        { de: 'der Aufzug',         it: "l'ascensore",       alt: ['ascensore'] },
        { de: 'der Teppich',        it: 'il tappeto',        alt: ['tappeto'] },
        { de: 'der Vorhang',        it: 'la tenda',          alt: ['tenda'] },
        { de: 'das Handtuch',       it: "l'asciugamano",     alt: ['asciugamano'] },
        { de: 'die Dusche',         it: 'la doccia',         alt: ['doccia'] },
        { de: 'die Badewanne',      it: 'la vasca da bagno', alt: ['vasca da bagno','vasca'] },
        { de: 'der Eingang',        it: "l'ingresso",        alt: ['ingresso'] },
        { de: 'das Schloss',        it: 'la serratura',      alt: ['serratura'] },
        { de: 'der Schlüssel',      it: 'la chiave',         alt: ['chiave'] },
      ]
    },
    {
      name: 'Arbeit & Beruf',
      words: [
        { de: 'die Arbeit',         it: 'il lavoro',         alt: ['lavoro'] },
        { de: 'das Büro',           it: "l'ufficio",         alt: ['ufficio'] },
        { de: 'der Chef',           it: 'il capo',           alt: ['capo'] },
        { de: 'der Kollege',        it: 'il collega',        alt: ['collega'] },
        { de: 'das Meeting',        it: 'la riunione',       alt: ['riunione'] },
        { de: 'der Vertrag',        it: 'il contratto',      alt: ['contratto'] },
        { de: 'das Gehalt',         it: 'lo stipendio',      alt: ['stipendio'] },
        { de: 'der Urlaub (Arbeit)',it: 'le ferie',          alt: ['ferie'] },
        { de: 'die Stelle',         it: 'il posto di lavoro',alt: ['posto di lavoro','impiego'] },
        { de: 'der Arzt',           it: 'il medico',         alt: ['medico','dottore'] },
        { de: 'der Lehrer',         it: "l'insegnante",      alt: ['insegnante'] },
        { de: 'der Anwalt',         it: "l'avvocato",        alt: ['avvocato'] },
        { de: 'der Ingenieur',      it: "l'ingegnere",       alt: ['ingegnere'] },
        { de: 'der Verkäufer',      it: 'il commesso',       alt: ['commesso'] },
        { de: 'der Koch',           it: 'il cuoco',          alt: ['cuoco'] },
        { de: 'die Firma',          it: "l'azienda",         alt: ['azienda','ditta'] },
        { de: 'die Bewerbung',      it: 'la candidatura',    alt: ['candidatura','domanda'] },
        { de: 'das Interview',      it: 'il colloquio',      alt: ['colloquio'] },
        { de: 'die Erfahrung',      it: "l'esperienza",      alt: ['esperienza'] },
        { de: 'die Ausbildung',     it: 'la formazione',     alt: ['formazione'] },
        { de: 'das Projekt',        it: 'il progetto',       alt: ['progetto'] },
        { de: 'die Deadline',       it: 'la scadenza',       alt: ['scadenza'] },
        { de: 'der Kunde',          it: 'il cliente',        alt: ['cliente'] },
        { de: 'die Rechnung',       it: 'la fattura',        alt: ['fattura'] },
        { de: 'der Computer',       it: 'il computer',       alt: ['computer'] },
        { de: 'die E-Mail',         it: "l'email",           alt: ['email'] },
        { de: 'der Drucker',        it: 'la stampante',      alt: ['stampante'] },
        { de: 'die Besprechung',    it: 'la conferenza',     alt: ['conferenza','riunione'] },
        { de: 'der Praktikant',     it: 'il tirocinante',    alt: ['tirocinante','stagista'] },
        { de: 'die Kündigung',      it: 'il licenziamento',  alt: ['licenziamento'] },
        { de: 'der Architekt',      it: "l'architetto",      alt: ['architetto'] },
        { de: 'der Buchhalter',     it: 'il contabile',      alt: ['contabile'] },
        { de: 'die Sekretärin',     it: 'la segretaria',     alt: ['segretaria'] },
        { de: 'der Polizist',       it: 'il poliziotto',     alt: ['poliziotto'] },
        { de: 'der Feuerwehrmann',  it: 'il pompiere',       alt: ['pompiere','vigile del fuoco'] },
        { de: 'der Krankenpfleger', it: "l'infermiere",      alt: ['infermiere'] },
        { de: 'die Überstunde',     it: "l'ora di straordinario",alt:['straordinario','ore extra'] },
        { de: 'die Beförderung',    it: 'la promozione',     alt: ['promozione'] },
      ]
    },
    {
      name: 'Körper & Gesundheit',
      words: [
        { de: 'der Kopf',           it: 'la testa',          alt: ['testa'] },
        { de: 'das Gesicht',        it: 'il viso',           alt: ['viso','faccia'] },
        { de: 'das Auge',           it: "l'occhio",          alt: ['occhio'] },
        { de: 'die Nase',           it: 'il naso',           alt: ['naso'] },
        { de: 'der Mund',           it: 'la bocca',          alt: ['bocca'] },
        { de: 'das Ohr',            it: "l'orecchio",        alt: ['orecchio'] },
        { de: 'der Hals',           it: 'il collo',          alt: ['collo'] },
        { de: 'die Schulter',       it: 'la spalla',         alt: ['spalla'] },
        { de: 'der Arm',            it: 'il braccio',        alt: ['braccio'] },
        { de: 'die Hand',           it: 'la mano',           alt: ['mano'] },
        { de: 'der Finger',         it: 'il dito',           alt: ['dito'] },
        { de: 'der Rücken',         it: 'la schiena',        alt: ['schiena'] },
        { de: 'der Bauch',          it: 'la pancia',         alt: ['pancia','stomaco'] },
        { de: 'das Bein',           it: 'la gamba',          alt: ['gamba'] },
        { de: 'der Fuß',            it: 'il piede',          alt: ['piede'] },
        { de: 'das Herz',           it: 'il cuore',          alt: ['cuore'] },
        { de: 'die Lunge',          it: 'il polmone',        alt: ['polmone'] },
        { de: 'das Blut',           it: 'il sangue',         alt: ['sangue'] },
        { de: 'der Schmerz',        it: 'il dolore',         alt: ['dolore'] },
        { de: 'das Fieber',         it: 'la febbre',         alt: ['febbre'] },
        { de: 'die Erkältung',      it: 'il raffreddore',    alt: ['raffreddore'] },
        { de: 'das Krankenhaus',    it: "l'ospedale",        alt: ['ospedale'] },
        { de: 'der Arzt',           it: 'il dottore',        alt: ['dottore','medico'] },
        { de: 'die Apotheke',       it: 'la farmacia',       alt: ['farmacia'] },
        { de: 'das Medikament',     it: 'la medicina',       alt: ['medicina','medicinale'] },
        { de: 'die Allergie',       it: "l'allergia",        alt: ['allergia'] },
        { de: 'der Knochen',        it: "l'osso",            alt: ['osso'] },
        { de: 'der Muskel',         it: 'il muscolo',        alt: ['muscolo'] },
        { de: 'die Haut',           it: 'la pelle',          alt: ['pelle'] },
        { de: 'das Haar',           it: 'il capello',        alt: ['capello','capelli'] },
        { de: 'der Zahn',           it: 'il dente',          alt: ['dente'] },
        { de: 'der Arzttermin',     it: "l'appuntamento dal medico",alt:['appuntamento dal medico','visita medica'] },
        { de: 'die Operation',      it: "l'operazione",      alt: ['operazione','intervento'] },
        { de: 'das Rezept',         it: 'la ricetta',        alt: ['ricetta'] },
        { de: 'die Verletzung',     it: 'il ferito',         alt: ['ferito','lesione'] },
        { de: 'der Sport',          it: 'lo sport',          alt: ['sport'] },
        { de: 'die Diät',           it: 'la dieta',          alt: ['dieta'] },
        { de: 'der Schlaf',         it: 'il sonno',          alt: ['sonno'] },
      ]
    },
    {
      name: 'Natur & Wetter',
      words: [
        { de: 'die Sonne',          it: 'il sole',           alt: ['sole'] },
        { de: 'der Mond',           it: 'la luna',           alt: ['luna'] },
        { de: 'der Stern',          it: 'la stella',         alt: ['stella'] },
        { de: 'der Himmel',         it: 'il cielo',          alt: ['cielo'] },
        { de: 'die Wolke',          it: 'la nuvola',         alt: ['nuvola'] },
        { de: 'der Regen',          it: 'la pioggia',        alt: ['pioggia'] },
        { de: 'der Schnee',         it: 'la neve',           alt: ['neve'] },
        { de: 'der Wind',           it: 'il vento',          alt: ['vento'] },
        { de: 'das Gewitter',       it: 'il temporale',      alt: ['temporale'] },
        { de: 'der Blitz',          it: 'il fulmine',        alt: ['fulmine'] },
        { de: 'die Hitze',          it: 'il caldo',          alt: ['caldo'] },
        { de: 'die Kälte',          it: 'il freddo',         alt: ['freddo'] },
        { de: 'der Berg',           it: 'la montagna',       alt: ['montagna'] },
        { de: 'das Meer',           it: 'il mare',           alt: ['mare'] },
        { de: 'der See',            it: 'il lago',           alt: ['lago'] },
        { de: 'der Fluss',          it: 'il fiume',          alt: ['fiume'] },
        { de: 'der Wald',           it: 'il bosco',          alt: ['bosco','foresta'] },
        { de: 'das Feld',           it: 'il campo',          alt: ['campo'] },
        { de: 'die Wiese',          it: 'il prato',          alt: ['prato'] },
        { de: 'der Strand',         it: 'la spiaggia',       alt: ['spiaggia'] },
        { de: 'die Insel',          it: "l'isola",           alt: ['isola'] },
        { de: 'der Baum',           it: "l'albero",          alt: ['albero'] },
        { de: 'die Blume',          it: 'il fiore',          alt: ['fiore'] },
        { de: 'das Tier',           it: "l'animale",         alt: ['animale'] },
        { de: 'der Hund',           it: 'il cane',           alt: ['cane'] },
        { de: 'die Katze',          it: 'il gatto',          alt: ['gatto'] },
        { de: 'der Vogel',          it: "l'uccello",         alt: ['uccello'] },
        { de: 'der Fisch',          it: 'il pesce',          alt: ['pesce'] },
        { de: 'die Temperaturen',   it: 'le temperature',    alt: ['temperature'] },
        { de: 'der Frühling',       it: 'la primavera',      alt: ['primavera'] },
        { de: 'der Sommer',         it: "l'estate",          alt: ['estate'] },
        { de: 'der Herbst',         it: "l'autunno",         alt: ['autunno'] },
        { de: 'der Winter',         it: "l'inverno",         alt: ['inverno'] },
        { de: 'die Natur',          it: 'la natura',         alt: ['natura'] },
        { de: 'die Umwelt',         it: "l'ambiente",        alt: ['ambiente'] },
        { de: 'das Erdbeben',       it: 'il terremoto',      alt: ['terremoto'] },
        { de: 'der Vulkan',         it: 'il vulcano',        alt: ['vulcano'] },
        { de: 'die Wüste',          it: 'il deserto',        alt: ['deserto'] },
      ]
    },
    {
      name: 'Alltag & Freizeit',
      words: [
        { de: 'der Morgen',         it: 'il mattino',        alt: ['mattino','mattina'] },
        { de: 'der Mittag',         it: 'il mezzogiorno',    alt: ['mezzogiorno'] },
        { de: 'der Abend',          it: 'la sera',           alt: ['sera'] },
        { de: 'die Nacht',          it: 'la notte',          alt: ['notte'] },
        { de: 'heute',              it: 'oggi',              alt: ['oggi'] },
        { de: 'gestern',            it: 'ieri',              alt: ['ieri'] },
        { de: 'morgen',             it: 'domani',            alt: ['domani'] },
        { de: 'die Woche',          it: 'la settimana',      alt: ['settimana'] },
        { de: 'der Monat',          it: 'il mese',           alt: ['mese'] },
        { de: 'das Jahr',           it: "l'anno",            alt: ['anno'] },
        { de: 'die Uhr',            it: "l'orologio",        alt: ['orologio'] },
        { de: 'die Minute',         it: 'il minuto',         alt: ['minuto'] },
        { de: 'die Stunde',         it: "l'ora",             alt: ['ora'] },
        { de: 'das Handy',          it: 'il cellulare',      alt: ['cellulare','telefonino'] },
        { de: 'der Fernseher',      it: 'la televisione',    alt: ['televisione','tv','tele'] },
        { de: 'das Internet',       it: 'internet',          alt: ['internet'] },
        { de: 'das Buch',           it: 'il libro',          alt: ['libro'] },
        { de: 'die Zeitung',        it: 'il giornale',       alt: ['giornale'] },
        { de: 'der Film',           it: 'il film',           alt: ['film'] },
        { de: 'die Musik',          it: 'la musica',         alt: ['musica'] },
        { de: 'der Sport',          it: 'lo sport',          alt: ['sport'] },
        { de: 'das Spiel',          it: 'il gioco',          alt: ['gioco'] },
        { de: 'der Markt',          it: 'il mercato',        alt: ['mercato'] },
        { de: 'der Supermarkt',     it: 'il supermercato',   alt: ['supermercato'] },
        { de: 'die Schule',         it: 'la scuola',         alt: ['scuola'] },
        { de: 'die Universität',    it: "l'università",      alt: ['università'] },
        { de: 'die Bibliothek',     it: 'la biblioteca',     alt: ['biblioteca'] },
        { de: 'das Museum',         it: 'il museo',          alt: ['museo'] },
        { de: 'das Kino',           it: 'il cinema',         alt: ['cinema'] },
        { de: 'das Theater',        it: 'il teatro',         alt: ['teatro'] },
        { de: 'das Restaurant',     it: 'il ristorante',     alt: ['ristorante'] },
        { de: 'der Friseur',        it: 'il parrucchiere',   alt: ['parrucchiere'] },
        { de: 'die Post',           it: 'la posta',          alt: ['posta'] },
        { de: 'die Bank',           it: 'la banca',          alt: ['banca'] },
        { de: 'die Kirche',         it: 'la chiesa',         alt: ['chiesa'] },
        { de: 'der Park',           it: 'il parco',          alt: ['parco'] },
        { de: 'die Reise',          it: 'il viaggio',        alt: ['viaggio'] },
        { de: 'das Foto',           it: 'la foto',           alt: ['foto','fotografia'] },
      ]
    },
  ];

  /* ---------- Mastery ---------- */
  var qMastery = {};
  try { qMastery = JSON.parse(localStorage.getItem('impara_mastery') || '{}'); } catch(e) {}
  function qIsMastered(w) { return (qMastery[w.it] || 0) >= 3; }
  function qSaveMastery() { try { localStorage.setItem('impara_mastery', JSON.stringify(qMastery)); } catch(e) {} }

  function qRenderStats() {
    var total = 0, seen = {};
    var lvl = [0,0,0,0];
    Q_CATEGORIES.forEach(function(c) {
      c.words.forEach(function(w) {
        if (!seen[w.it]) { seen[w.it]=1; total++; lvl[Math.min(qMastery[w.it]||0,3)]++; }
      });
    });
    var open = lvl[0]+lvl[1]+lvl[2];
    function pips(filled) {
      var h='<span class="q-stp">';
      for (var i=0;i<3;i++) h+='<span'+(i<filled?' class="on"':'')+' ></span>';
      return h+'</span>';
    }
    var el = document.getElementById('q-stats-bar');
    if (!el) return;
    el.innerHTML = '<b>'+open+'</b> offen &nbsp;·&nbsp; <b>'+lvl[3]+'</b> gemeistert &nbsp;·&nbsp; '+
      pips(1)+'&nbsp;<b>'+lvl[1]+'</b>&nbsp; '+pips(2)+'&nbsp;<b>'+lvl[2]+'</b>';
  }

  /* ---------- State ---------- */
  var qCurrentRound = [];
  var qQueue = [], qCorrectSet = {}, qWrongCounts = {}, qCurrent = null;
  var qTimerInterval = null, qTimeLeft = 5;
  var qRecognition = null, qQuizActive = false, qAnswered = false;
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
      btn.onclick = (function(idx) { return function() { qPickCategory(idx); }; })(i);
      grid.appendChild(btn);
    });
  }

  var mixBtn = qEl('q-mix-btn');
  if (mixBtn) mixBtn.onclick = function() { qPickCategory(-1); };

  /* ---------- Answer input enter key ---------- */
  var answerInput = qEl('q-answer');
  if (answerInput) {
    answerInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') qOnEnter();
    });
  }

  /* ---------- Joker FAB ---------- */
  var jokerFab = qEl('q-joker-fab');
  if (jokerFab) jokerFab.addEventListener('click', qUseJoker);

  /* ---------- Next / back button ---------- */
  var nextBtn = qEl('q-next-btn');
  if (nextBtn) nextBtn.addEventListener('click', qShowCategoryScreen);

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

  function qPickCategory(idx) {
    var pool;
    if (idx === -1) {
      var seen = {};
      pool = [];
      Q_CATEGORIES.forEach(function(c) {
        c.words.forEach(function(w) { if (!seen[w.it]) { seen[w.it]=1; pool.push(w); } });
      });
    } else {
      pool = Q_CATEGORIES[idx].words;
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
    qCurrent = qQueue.shift();

    var elW = qEl('q-word');
    if (elW) elW.textContent = qCurrent.de;
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
      if (elF) { elF.textContent = 'Corretto!'; elF.className = 'q-correct'; }
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
      if (elF) { elF.textContent = 'Sbagliato – '+qCurrent.it; elF.className = 'q-wrong'; }
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
      rec.lang = 'it-IT';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = function() {
        if (qWordToken !== token) return;
        qSetMicStatus('Microfono attivo');
        qLaunchTimerOnce(token);
      };

      rec.onresult = function(e) {
        if (qWordToken !== token || qAnswered) return;
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
        if (qWordToken !== token || qAnswered) return;
        if (e.error === 'not-allowed') {
          QSpeechAPI = null;
          qSetMicStatus('Texteingabe');
          qLaunchTimerOnce(token);
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
          qSetMicStatus('Mikrofon-Fehler');
        }
      };

      rec.onend = function() {
        if (qWordToken !== token || qAnswered) return;
        try { rec.start(); } catch(ex) {
          setTimeout(function() {
            if (qWordToken === token && !qAnswered) qStartWordRecognition(token);
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
