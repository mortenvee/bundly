/* ════════════════════════════════════
   TAB SYSTEM
════════════════════════════════════ */
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  const tc = document.getElementById('tab-' + name);
  if (tc) tc.classList.add('active');
  // Find matching btn
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes("'" + name + "'"))
      btn.classList.add('active');
  });
  if (name === 'dashboard') renderDashboard();
  if (name === 'budget')    renderBudget();
  if (name === 'gantt')     renderGantt();
  if (name === 'suppliers') renderSuppliers();
  if (name === 'decisions') renderDecisions();
  if (name === 'progress')  renderProgressPhotos();
  if (name === 'docs')      { renderDocuments(); initDocDropzone(); }
  if (name === 'team')      renderTeam();
}

/* ════════════════════════════════════
   CONSTANTS & DATA
════════════════════════════════════ */
const GANTT_START = new Date('2026-04-10'); GANTT_START.setHours(0,0,0,0);
const GANTT_END   = new Date('2026-09-01'); GANTT_END.setHours(0,0,0,0);
const GANTT_DAYS  = Math.round((GANTT_END - GANTT_START) / 86400000);

const TAG_COLORS = {
  budsjett:  { bg: 'rgba(234,179,8,0.2)',  color: '#fde047' },
  material:  { bg: 'rgba(34,197,94,0.2)', color: '#86efac' },
  håndverker:{ bg: 'rgba(99,102,241,0.2)',color: '#a5b4fc' },
};
const PRIORITY_LABELS = { lav:'🟢 Lav', middels:'🟡 Middels', høy:'🟠 Høy', kritisk:'🔴 Kritisk' };
const COL_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
const NO_MONTHS = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];

function cid() { return Math.random().toString(36).slice(2,10); }

let columns = [
  { id: cid(), title: 'Ideer',   color: COL_COLORS[0], cards: [] },
  { id: cid(), title: 'Planlagt',color: COL_COLORS[1], cards: [] },
  { id: cid(), title: 'Pågår',   color: COL_COLORS[2], cards: [] },
  { id: cid(), title: 'Ferdig',  color: COL_COLORS[3], cards: [] },
];

let dragCardId = null, dragColId = null;
let editCardId = null, editColId = null;

/* ── New feature data ── */
let suppliers = [];
let decisions = [];
let progressPhotos = [];
let milestones = [];
let activityLog = [];
let archiveDocs  = [];  // [{ id, name, category, description, size, type, url, uploadedBy, date }]

/* ══════════════════════════════════════
   DOKUMENTARKIV
══════════════════════════════════════ */
const DOC_CATEGORIES = ['Kontrakter','Tilbud','Tegninger','Tillatelser','Forsikring','Kvitteringer','Annet'];

const DOC_CAT_STYLES = {
  Kontrakter:   { bg: 'rgba(99,102,241,0.2)',  color: '#a5b4fc', icon: '📜' },
  Tilbud:       { bg: 'rgba(251,191,36,0.18)', color: '#fde047', icon: '💬' },
  Tegninger:    { bg: 'rgba(34,211,238,0.18)', color: '#67e8f9', icon: '📐' },
  Tillatelser:  { bg: 'rgba(52,211,153,0.18)', color: '#6ee7b7', icon: '🏛' },
  Forsikring:   { bg: 'rgba(16,185,129,0.18)', color: '#34d399', icon: '🛡' },
  Kvitteringer: { bg: 'rgba(245,158,11,0.18)', color: '#fcd34d', icon: '🧾' },
  Annet:        { bg: 'rgba(148,163,184,0.14)',color: '#94a3b8', icon: '📦' },
};

let docFilter  = '';

function docFileIcon(type, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (type.startsWith('image/')) return { emoji: '🖼', bg: 'rgba(236,72,153,0.15)',  color: '#f9a8d4', ext };
  if (ext === 'pdf')             return { emoji: '📄', bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5', ext: 'PDF' };
  if (['doc','docx'].includes(ext)) return { emoji: '📝', bg: 'rgba(59,130,246,0.15)', color: '#93c5fd', ext: ext.toUpperCase() };
  if (['xls','xlsx'].includes(ext)) return { emoji: '📊', bg: 'rgba(34,197,94,0.15)',  color: '#86efac', ext: ext.toUpperCase() };
  return { emoji: '📎', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', ext: ext.toUpperCase() };
}

function fmtFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function setDocFilter(cat) {
  docFilter = cat;
  document.querySelectorAll('#docCatPills .cat-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.dcat === cat));
  renderDocuments();
}

function renderDocuments() {
  const search = (document.getElementById('docSearch')?.value || '').toLowerCase();
  const list   = archiveDocs.filter(d => {
    if (docFilter && d.category !== docFilter) return false;
    if (search && !d.name.toLowerCase().includes(search) &&
        !d.description?.toLowerCase().includes(search)) return false;
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const grid = document.getElementById('docsGrid');
  if (!grid) return;

  const count = document.getElementById('docsCount');
  if (count) count.textContent = `${archiveDocs.length} dokument${archiveDocs.length !== 1 ? 'er' : ''}`;

  if (!list.length) {
    grid.innerHTML = `<div class="doc-empty">
      ${archiveDocs.length ? '🔍 Ingen dokumenter matcher filteret.' : '📁 Ingen dokumenter ennå — last opp det første!'}
    </div>`;
    return;
  }

  grid.innerHTML = list.map(d => {
    const fi  = docFileIcon(d.type || '', d.name);
    const cat = DOC_CAT_STYLES[d.category] || DOC_CAT_STYLES.Annet;
    const dato = d.date ? new Date(d.date).toLocaleDateString('nb-NO', { day:'numeric', month:'short', year:'numeric' }) : '';
    const isImg = (d.type||'').startsWith('image/');
    return `
    <div class="doc-card">
      <div class="doc-icon-row">
        ${isImg
          ? `<div class="doc-file-icon" style="background:${fi.bg};overflow:hidden;padding:0">
               <img src="${d.url}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" />
             </div>`
          : `<div class="doc-file-icon" style="background:${fi.bg};color:${fi.color}">
               ${fi.emoji}
               <span class="doc-ext" style="color:${fi.color}">${fi.ext}</span>
             </div>`}
        <div class="doc-meta">
          <div class="doc-name" title="${esc(d.name)}">${esc(d.name)}</div>
          <div class="doc-date">${dato}</div>
          ${d.size ? `<div class="doc-size">${fmtFileSize(d.size)}</div>` : ''}
        </div>
      </div>
      ${d.description ? `<div class="doc-desc">${esc(d.description)}</div>` : ''}
      <div>
        <span class="doc-cat-badge" style="background:${cat.bg};color:${cat.color}">${cat.icon} ${d.category}</span>
        ${d.uploadedBy ? `<span style="font-size:0.68rem;color:#475569;margin-left:6px">av ${esc(d.uploadedBy)}</span>` : ''}
      </div>
      <div class="doc-actions">
        <a class="doc-action-btn" href="${d.url}" target="_blank" rel="noopener">
          ${isImg ? '🔍 Vis' : '📂 Åpne'}
        </a>
        <a class="doc-action-btn" href="${d.url}" download="${esc(d.name)}">⬇ Last ned</a>
        <button class="doc-action-btn del" onclick="deleteDoc('${d.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Upload flow ── */
let pendingDocFiles = [];   // File objects waiting for metadata

function handleDocUpload(event) {
  const files = [...(event?.target?.files || [])];
  if (!files.length) return;
  if (event?.target) event.target.value = '';
  openDocUploadModal(files);
}

function openDocUploadModal(files) {
  pendingDocFiles = files;
  const body = document.getElementById('docUploadBody');
  if (!body) return;

  body.innerHTML = `
    <div class="doc-pending-list">
      ${files.map((f, i) => `
      <div class="doc-pending-item">
        <div class="doc-pending-name">${esc(f.name)}</div>
        <div class="doc-pending-size">${fmtFileSize(f.size)}</div>
        <div class="doc-pending-controls">
          <select id="docCat_${i}">
            ${DOC_CATEGORIES.map(c => `<option value="${c}">${DOC_CAT_STYLES[c].icon} ${c}</option>`).join('')}
          </select>
          <input type="text" id="docDesc_${i}" placeholder="Beskrivelse (valgfritt)" />
        </div>
        <div class="doc-upload-progress" id="docProg_${i}">
          <div class="doc-upload-progress-bar" id="docProgBar_${i}"></div>
        </div>
      </div>`).join('')}
    </div>
    <div style="margin-top:4px">
      <div class="budget-field-label">Ditt navn (valgfritt)</div>
      <input type="text" id="docUploader" placeholder="Navn…" value="${forumLastAuthor||''}"
        style="width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
               border-radius:8px;padding:8px 10px;color:#e2e8f0;font-size:0.83rem;
               outline:none;font-family:inherit;box-sizing:border-box;" />
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn-cancel" onclick="closeDocUploadModal()">Avbryt</button>
      <button class="btn-primary" style="flex:1" onclick="confirmDocUpload()">⬆ Last opp</button>
    </div>`;

  document.getElementById('docUploadOverlay').classList.add('open');
}

function closeDocUploadModal() {
  document.getElementById('docUploadOverlay').classList.remove('open');
  pendingDocFiles = [];
}

async function confirmDocUpload() {
  const uploader = document.getElementById('docUploader')?.value.trim() || '';
  if (uploader) forumLastAuthor = uploader;

  for (let i = 0; i < pendingDocFiles.length; i++) {
    const file  = pendingDocFiles[i];
    const cat   = document.getElementById(`docCat_${i}`)?.value || 'Annet';
    const desc  = document.getElementById(`docDesc_${i}`)?.value.trim() || '';
    const progBar = document.getElementById(`docProgBar_${i}`);
    if (progBar) progBar.style.width = '30%';

    let url = '';
    try {
      if (supabaseReady) {
        const ext  = file.name.split('.').pop() || 'bin';
        const path = `dokumenter/${cat}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type });
        if (!error) {
          const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
          url = data.publicUrl;
        }
      }
      if (!url) {
        // Fallback: base64 (images only, PDFs are too big — warn user)
        if (file.type.startsWith('image/')) {
          url = await new Promise(res => {
            const fr = new FileReader();
            fr.onload = e => res(e.target.result);
            fr.readAsDataURL(file);
          });
        } else {
          url = '#ingen-storage'; // Kan ikke lagre uten Supabase
        }
      }
    } catch(e) { console.warn('Doc upload error', e); }

    if (progBar) progBar.style.width = '80%';

    if (url && url !== '#ingen-storage') {
      archiveDocs.push({
        id:         cid(),
        name:       file.name,
        category:   cat,
        description: desc,
        size:       file.size,
        type:       file.type,
        url,
        uploadedBy: uploader,
        date:       new Date().toISOString(),
      });
      logActivity('📁', `Dokument lastet opp: ${file.name}`);
    } else if (url === '#ingen-storage') {
      alert(`«${file.name}» kunne ikke lagres uten Supabase Storage (kun bilder støttes uten).`);
    }

    if (progBar) progBar.style.width = '100%';
  }

  closeDocUploadModal();
  renderDocuments();
  saveState();
}

function deleteDoc(id) {
  if (!confirm('Slett dette dokumentet fra arkivet?')) return;
  archiveDocs = archiveDocs.filter(d => d.id !== id);
  renderDocuments();
  saveState();
}

/* ── Drag-and-drop upload på dropzone ── */
function initDocDropzone() {
  const zone = document.getElementById('docsDropzone');
  if (!zone) return;
  zone.addEventListener('click', () => document.getElementById('docFileInput').click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = [...e.dataTransfer.files].filter(f =>
      /\.(pdf|doc|docx|xlsx|xls|jpg|jpeg|png|gif|webp)$/i.test(f.name));
    if (files.length) openDocUploadModal(files);
  });
}

document.getElementById('docUploadOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDocUploadModal();
});

/* ── Supplier rating state ── */
let supRatingValue = 0;

/* ── Current receipt post ── */
let currentReceiptPostId = null;

/* ── Milestone color ── */
const MILESTONE_COLORS = ['#ef4444','#10b981','#6366f1','#f59e0b','#8b5cf6'];
let selectedMsColor = MILESTONE_COLORS[0];

/* ── Decision category colors ── */
const DEC_CAT_COLORS = {
  Materialer: { bg:'rgba(99,102,241,0.2)', color:'#a5b4fc' },
  Design:     { bg:'rgba(16,185,129,0.2)', color:'#34d399' },
  Økonomi:    { bg:'rgba(245,158,11,0.2)', color:'#fbbf24' },
  Leverandør: { bg:'rgba(236,72,153,0.2)', color:'#f9a8d4' },
  Annet:      { bg:'rgba(100,116,139,0.2)',color:'#94a3b8' },
};

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function dayOffset(dateStr) {
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - GANTT_START) / 86400000);
}
function pct(days) { return (days / GANTT_DAYS * 100).toFixed(4) + '%'; }
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('nb-NO', { day:'numeric', month:'short' });
}
function renderDue(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr); due.setHours(0,0,0,0);
  const diff  = Math.round((due - today) / 86400000);
  let cls, label;
  if      (diff < 0)  { cls='overdue'; label=`⚠ Forfalt ${formatDate(dateStr)}`; }
  else if (diff===0)  { cls='today';   label=`🔥 I dag`; }
  else if (diff <= 3) { cls='soon';    label=`⏳ ${diff}d igjen`; }
  else                { cls='ok';      label=`📅 ${formatDate(dateStr)}`; }
  return `<span class="due-chip ${cls}">${label}</span>`;
}

/* ════════════════════════════════════
   AKTIVITETSFEED
════════════════════════════════════ */
function logActivity(icon, text) {
  activityLog.unshift({ id: cid(), icon, text, date: new Date().toISOString() });
  if (activityLog.length > 100) activityLog = activityLog.slice(0, 100);
}

/* ════════════════════════════════════
   KANBAN RENDER
════════════════════════════════════ */
function render() {
  const board = document.getElementById('board');
  const btn   = document.getElementById('addColumnBtn');
  board.querySelectorAll('.column').forEach(el => el.remove());

  columns.forEach(col => {
    const el = document.createElement('div');
    el.className = 'column';
    el.dataset.colId = col.id;
    el.innerHTML = `
      <div class="column-header">
        <div class="column-dot" style="background:${col.color}"></div>
        <input class="column-title" value="${esc(col.title)}" onchange="renameCol('${col.id}',this.value)" />
        <span class="card-count">${col.cards.length}</span>
        <button class="delete-col-btn" onclick="deleteColumn('${col.id}')" title="Slett kolonne">×</button>
      </div>
      <div class="cards-list" id="list-${col.id}">
        ${col.cards.map(c => renderCard(c, col.id)).join('')}
      </div>
      <button class="add-card-btn" onclick="showCardForm('${col.id}')">＋ Legg til kort</button>
      <div class="card-form" id="form-${col.id}" style="display:none;">
        <input type="text" placeholder="Tittel på kort..." id="newTitle-${col.id}" />
        <textarea rows="2" placeholder="Beskrivelse (valgfritt)..." id="newDesc-${col.id}"></textarea>
        <div class="card-form-row">
          <select id="newPriority-${col.id}">
            <option value="">Viktighet…</option>
            <option value="lav">🟢 Lav</option>
            <option value="middels">🟡 Middels</option>
            <option value="høy">🟠 Høy</option>
            <option value="kritisk">🔴 Kritisk</option>
          </select>
          <input type="text" placeholder="Ansvarlig…" id="newAssignee-${col.id}" />
        </div>
        <div class="card-form-row">
          <div>
            <div class="card-form-label">Startdato</div>
            <input type="date" id="newStart-${col.id}" />
          </div>
          <div>
            <div class="card-form-label">Frist</div>
            <input type="date" id="newDue-${col.id}" />
          </div>
        </div>
        <div class="card-form-actions">
          <button class="btn-primary" onclick="addCard('${col.id}')">Legg til</button>
          <button class="btn-cancel" onclick="hideCardForm('${col.id}')">Avbryt</button>
        </div>
      </div>
    `;
    board.insertBefore(el, btn);
    el.addEventListener('dragover',  e => onDragOver(e, col.id));
    el.addEventListener('drop',      e => onDrop(e, col.id));
    el.addEventListener('dragleave', onDragLeave);
  });

  renderGantt();
  // Refresh dashboard if active
  if (document.getElementById('tab-dashboard')?.classList.contains('active')) renderDashboard();
  saveState();
}

function renderCard(card, colId) {
  const tag = card.tag && TAG_COLORS[card.tag]
    ? `<span class="card-tag" style="background:${TAG_COLORS[card.tag].bg};color:${TAG_COLORS[card.tag].color}">${esc(card.tag)}</span>` : '';
  const priority = card.priority
    ? `<span class="priority-badge ${esc(card.priority)}">${PRIORITY_LABELS[card.priority]}</span>` : '';
  const initials = card.assignee ? card.assignee.trim().split(/\s+/).map(w=>w[0].toUpperCase()).slice(0,2).join('') : '';
  const assignee = card.assignee
    ? `<span class="assignee-chip"><span class="assignee-avatar">${initials}</span>${esc(card.assignee)}</span>` : '';
  const due = card.due ? renderDue(card.due) : '';
  const attachCount = (card.attachments||[]).length;
  const attachBadge = attachCount ? `<span class="attach-badge">📎 ${attachCount}</span>` : '';
  const meta = (priority||assignee||due||attachBadge) ? `<div class="card-meta">${priority}${assignee}${due}${attachBadge}</div>` : '';

  return `
    <div class="card" id="card-${card.id}" draggable="true"
      data-priority="${esc(card.priority||'')}"
      ondragstart="onDragStart(event,'${card.id}','${colId}')"
      ondragend="onDragEnd()">
      ${tag ? `<div class="card-top-row">${tag}</div>` : ''}
      <div class="card-title">${esc(card.title)}</div>
      ${card.desc ? `<div class="card-desc">${esc(card.desc)}</div>` : ''}
      ${meta}
      <div class="card-actions">
        <button class="card-btn" onclick="openEdit('${card.id}','${colId}')">Rediger</button>
        <button class="card-btn del" onclick="deleteCard('${card.id}','${colId}')">Slett</button>
      </div>
    </div>`;
}

/* ════════════════════════════════════
   GANTT RENDER
════════════════════════════════════ */
function renderGantt() {
  const body = document.getElementById('ganttBody');
  document.getElementById('ganttRange').textContent =
    `${formatDate('2026-04-10')} – ${formatDate('2026-09-01')}`;

  // Build months list
  const months = [];
  let cur = new Date(GANTT_START);
  while (cur <= GANTT_END) {
    const mo = cur.getMonth(), yr = cur.getFullYear();
    const firstDay = new Date(yr, mo, 1);
    const lastDay  = new Date(yr, mo+1, 0);
    const startD   = Math.max(0, dayOffset(firstDay.toISOString().slice(0,10)));
    const endD     = Math.min(GANTT_DAYS, dayOffset(lastDay.toISOString().slice(0,10)) + 1);
    months.push({ label: NO_MONTHS[mo], startD, widthD: endD - startD });
    cur = new Date(yr, mo+1, 1);
  }

  // Build week ticks
  const weeks = [];
  let wd = new Date(GANTT_START);
  // Align to next Monday
  while (wd.getDay() !== 1) wd = new Date(wd.getTime() + 86400000);
  while (wd <= GANTT_END) {
    const off = dayOffset(wd.toISOString().slice(0,10));
    if (off >= 0 && off <= GANTT_DAYS)
      weeks.push({ off, label: wd.getDate() + '.' });
    wd = new Date(wd.getTime() + 7*86400000);
  }

  // Today
  const today = new Date(); today.setHours(0,0,0,0);
  const todayOff = dayOffset(today.toISOString().slice(0,10));
  const todayInRange = todayOff >= 0 && todayOff <= GANTT_DAYS;

  // Build rows data: group cards by column
  const allRows = []; // { type:'group'|'card', col, card? }
  columns.forEach(col => {
    if (!col.cards.length) return;
    allRows.push({ type:'group', col });
    col.cards.forEach(card => allRows.push({ type:'card', col, card }));
  });

  if (!allRows.length) {
    body.innerHTML = '<div class="gantt-empty">Ingen kort å vise ennå. Legg til kort i tavlen over.</div>';
    return;
  }

  // ── Build HTML ──
  // Labels column
  let labelsHtml = `<div class="gantt-labels-header">Oppgave</div>`;
  allRows.forEach(row => {
    if (row.type === 'group') {
      labelsHtml += `<div class="gantt-group-label">
        <div class="gantt-group-dot" style="background:${row.col.color}"></div>
        ${esc(row.col.title)}
      </div>`;
    } else {
      const hasBar = row.card.start || row.card.due;
      labelsHtml += `<div class="gantt-row-label ${hasBar?'':'no-date'}" title="${esc(row.card.title)}">
        ${esc(row.card.title)}
      </div>`;
    }
  });

  // Chart column - month headers
  let monthsHtml = months.map(m =>
    `<div class="gantt-month" style="left:${pct(m.startD)};width:${pct(m.widthD)}">${m.label}</div>`
  ).join('');

  // Week ticks
  let weeksHtml = weeks.map(w =>
    `<div class="gantt-week-tick" style="left:${pct(w.off)}"><span class="gantt-week-label">${w.label}</span></div>`
  ).join('');

  // Today line (rendered once, spans all rows - we do it per-row as overlay)
  const todayLineHtml = todayInRange
    ? `<div class="gantt-today-line" style="left:${pct(todayOff)}">
         <div class="gantt-today-label">I dag</div>
       </div>` : '';

  // Chart rows
  let chartRowsHtml = '';
  allRows.forEach(row => {
    // Vertical grid lines for every row
    const vlines = weeks.map(w =>
      `<div class="gantt-vline" style="left:${pct(w.off)}"></div>`
    ).join('');
    const todayLine = todayInRange
      ? `<div class="gantt-today-line" style="left:${pct(todayOff)}"></div>` : '';

    if (row.type === 'group') {
      chartRowsHtml += `<div class="gantt-chart-group-label">${vlines}${todayLine}</div>`;
    } else {
      const card = row.card;
      let barHtml = '';
      const hasStart = card.start, hasDue = card.due;

      if (hasStart && hasDue) {
        // Full bar: start → due
        const s = Math.max(0, dayOffset(card.start));
        const e = Math.min(GANTT_DAYS, dayOffset(card.due) + 1);
        const w = Math.max(e - s, 1);
        const tooltipData = JSON.stringify({
          title: card.title,
          assignee: card.assignee||'',
          priority: card.priority ? PRIORITY_LABELS[card.priority] : '',
          start: formatDate(card.start),
          due: formatDate(card.due),
        }).replace(/'/g, '&#39;');
        barHtml = `<div class="gantt-bar"
          style="left:${pct(s)};width:${pct(w)};background:${row.col.color};opacity:0.88"
          onclick="openEdit('${card.id}','${row.col.id}')"
          onmouseenter="showTooltip(event,'${tooltipData.replace(/"/g,'&quot;')}')"
          onmouseleave="hideTooltip()"
          >${esc(card.title)}</div>`;

      } else if (hasDue) {
        // Milestone diamond
        const s = Math.max(0, Math.min(GANTT_DAYS, dayOffset(card.due)));
        const tooltipData = JSON.stringify({
          title: card.title, assignee: card.assignee||'',
          priority: card.priority ? PRIORITY_LABELS[card.priority] : '',
          start: '–', due: formatDate(card.due),
        }).replace(/'/g,"&#39;");
        barHtml = `<div class="gantt-milestone"
          style="left:calc(${pct(s)} - 8px);background:${row.col.color}"
          onclick="openEdit('${card.id}','${row.col.id}')"
          onmouseenter="showTooltip(event,'${tooltipData.replace(/"/g,'&quot;')}')"
          onmouseleave="hideTooltip()"></div>`;

      } else if (hasStart) {
        // Start flag only
        const s = Math.max(0, Math.min(GANTT_DAYS, dayOffset(card.start)));
        barHtml = `<div class="gantt-bar"
          style="left:${pct(s)};width:${pct(3)};background:${row.col.color};opacity:0.5"
          onclick="openEdit('${card.id}','${row.col.id}')"></div>`;
      }

      chartRowsHtml += `<div class="gantt-chart-row">${vlines}${todayLine}${barHtml}</div>`;
    }
  });

  // Milestone lines HTML — rendered as absolute overlays on the chart
  const milestoneOverlays = milestones.map(ms => {
    const msOff = dayOffset(ms.date);
    if (msOff < 0 || msOff > GANTT_DAYS) return '';
    return `<div class="gantt-milestone-line" style="left:${pct(msOff)};border-color:${ms.color};opacity:0.7"></div>
            <div class="gantt-milestone-label" style="left:${pct(msOff)};color:${ms.color}">${esc(ms.title)}</div>`;
  }).join('');

  body.innerHTML = `
    <div class="gantt-scroll">
      <div class="gantt-inner">
        <div class="gantt-labels">${labelsHtml}</div>
        <div class="gantt-chart" style="position:relative">
          ${milestoneOverlays}
          <div class="gantt-months" style="position:relative">${monthsHtml}</div>
          <div class="gantt-weeks"  style="position:relative">${weeksHtml}</div>
          ${chartRowsHtml}
        </div>
      </div>
    </div>`;

  // Oppdater milepæl-listen alltid når grafen rendres (inkl. realtime-sync)
  renderMilestoneList();
}

/* ── Tooltip ── */
function showTooltip(e, jsonStr) {
  const data = JSON.parse(jsonStr.replace(/&quot;/g,'"').replace(/&#39;/g,"'"));
  const tt = document.getElementById('ganttTooltip');
  tt.innerHTML = `
    <div class="tt-title">${esc(data.title)}</div>
    ${data.assignee ? `<div class="tt-row"><span class="tt-key">👤</span>${esc(data.assignee)}</div>` : ''}
    ${data.priority ? `<div class="tt-row"><span class="tt-key">⚡</span>${esc(data.priority)}</div>` : ''}
    <div class="tt-row"><span class="tt-key">🟢 Start</span>${esc(data.start)}</div>
    <div class="tt-row"><span class="tt-key">🔴 Frist</span>${esc(data.due)}</div>`;
  tt.style.display = 'block';
  moveTooltip(e);
}
function moveTooltip(e) {
  const tt = document.getElementById('ganttTooltip');
  const x = e.clientX + 14, y = e.clientY - 10;
  tt.style.left = (x + 230 > window.innerWidth ? x - 250 : x) + 'px';
  tt.style.top  = y + 'px';
}
function hideTooltip() {
  document.getElementById('ganttTooltip').style.display = 'none';
}
document.addEventListener('mousemove', e => {
  if (document.getElementById('ganttTooltip').style.display === 'block') moveTooltip(e);
});

/* ════════════════════════════════════
   DRAG & DROP
════════════════════════════════════ */
function onDragStart(e, cardId, colId) {
  dragCardId = cardId; dragColId = colId;
  setTimeout(() => document.getElementById('card-'+cardId)?.classList.add('dragging'), 0);
  e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd() {
  document.querySelectorAll('.card.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drop-placeholder').forEach(el => el.remove());
  document.querySelectorAll('.column.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function onDragOver(e, colId) {
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.column.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelector(`.column[data-col-id="${colId}"]`).classList.add('drag-over');
  const list = document.getElementById('list-'+colId);
  let ph = document.querySelector('.drop-placeholder');
  if (!ph) { ph = document.createElement('div'); ph.className = 'drop-placeholder'; }
  const after = getDragAfterElement(list, e.clientY);
  if (after) list.insertBefore(ph, after); else list.appendChild(ph);
}
function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget))
    e.currentTarget.classList.remove('drag-over');
}
function getDragAfterElement(container, y) {
  return [...container.querySelectorAll('.card:not(.dragging)')].reduce((closest, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    return (offset < 0 && offset > closest.offset) ? { offset, el } : closest;
  }, { offset: Number.NEGATIVE_INFINITY }).el;
}
function onDrop(e, targetColId) {
  e.preventDefault(); e.stopPropagation();
  if (!dragCardId) return;
  const srcCol = columns.find(c => c.id === dragColId);
  const tgtCol = columns.find(c => c.id === targetColId);
  if (!srcCol || !tgtCol) return;
  const list = document.getElementById('list-'+targetColId);
  const ph   = list.querySelector('.drop-placeholder');
  let insertBeforeCard = null;
  if (ph) {
    let next = ph.nextElementSibling;
    while (next && !next.classList.contains('card')) next = next.nextElementSibling;
    if (next) insertBeforeCard = next.id.replace('card-','');
  }
  const cardIdx = srcCol.cards.findIndex(c => c.id === dragCardId);
  if (cardIdx === -1) return;
  const [card] = srcCol.cards.splice(cardIdx, 1);
  if (insertBeforeCard) {
    const idx = tgtCol.cards.findIndex(c => c.id === insertBeforeCard);
    tgtCol.cards.splice(idx === -1 ? tgtCol.cards.length : idx, 0, card);
  } else { tgtCol.cards.push(card); }
  if (srcCol.id !== tgtCol.id) logActivity('➡', `${card.title} flyttet til ${tgtCol.title}`);
  dragCardId = null; dragColId = null;
  render();
}

/* ════════════════════════════════════
   KORT
════════════════════════════════════ */
function showCardForm(colId) {
  document.getElementById('form-'+colId).style.display = 'flex';
  document.getElementById('newTitle-'+colId).focus();
}
function hideCardForm(colId) {
  ['newTitle','newDesc','newAssignee','newStart','newDue'].forEach(k => {
    document.getElementById(k+'-'+colId).value = '';
  });
  document.getElementById('newPriority-'+colId).value = '';
  document.getElementById('form-'+colId).style.display = 'none';
}
function addCard(colId) {
  const titleEl = document.getElementById('newTitle-'+colId);
  const title   = titleEl.value.trim();
  if (!title) { titleEl.focus(); return; }
  const col = columns.find(c => c.id === colId);
  col.cards.push({
    id:          cid(), title,
    desc:        document.getElementById('newDesc-'+colId).value.trim(),
    priority:    document.getElementById('newPriority-'+colId).value,
    assignee:    document.getElementById('newAssignee-'+colId).value.trim(),
    start:       document.getElementById('newStart-'+colId).value,
    due:         document.getElementById('newDue-'+colId).value,
    tag:         '',
    attachments: [],
  });
  logActivity('🗂', `Kort lagt til: ${title}`);
  render();
}
function deleteCard(cardId, colId) {
  const col = columns.find(c => c.id === colId);
  col.cards = col.cards.filter(c => c.id !== cardId);
  render();
}

/* ════════════════════════════════════
   REDIGER
════════════════════════════════════ */
function openEdit(cardId, colId) {
  editCardId = cardId; editColId = colId;
  const card = columns.find(c => c.id === colId).cards.find(c => c.id === cardId);
  document.getElementById('editTitle').value    = card.title;
  document.getElementById('editDesc').value     = card.desc     || '';
  document.getElementById('editTag').value      = card.tag      || '';
  document.getElementById('editPriority').value = card.priority || '';
  document.getElementById('editAssignee').value = card.assignee || '';
  document.getElementById('editStart').value    = card.start    || '';
  document.getElementById('editDue').value      = card.due      || '';
  renderAttachList(card);
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('editTitle').focus();
}

function renderAttachList(card) {
  const list = document.getElementById('editAttachList');
  if (!list) return;
  const atts = card.attachments || [];
  list.innerHTML = atts.map((a, i) => {
    const isImg = a.type === 'image';
    const thumbOrIcon = isImg
      ? `<img class="attach-thumb" src="${a.url}" alt="${esc(a.name)}" onclick="openLightbox('${a.url}')" />`
      : `<span class="attach-icon">${a.name.endsWith('.pdf') ? '📄' : '📎'}</span>`;
    return `<div class="attach-item">
      ${thumbOrIcon}
      <span class="attach-name">${esc(a.name)}</span>
      <a class="attach-link" href="${a.url}" target="_blank" download="${esc(a.name)}">Last ned</a>
      <button class="attach-del" onclick="deleteAttachment(${i})" title="Slett vedlegg">🗑</button>
    </div>`;
  }).join('');
}

function deleteAttachment(idx) {
  if (!editCardId || !editColId) return;
  const card = columns.find(c => c.id === editColId)?.cards.find(c => c.id === editCardId);
  if (!card) return;
  if (!card.attachments) card.attachments = [];
  card.attachments.splice(idx, 1);
  renderAttachList(card);
  saveState();
}

async function handleAttachUpload() {
  const input = document.getElementById('editAttachInput');
  if (!input || !editCardId || !editColId) return;
  const card = columns.find(c => c.id === editColId)?.cards.find(c => c.id === editCardId);
  if (!card) return;
  if (!card.attachments) card.attachments = [];

  for (const file of input.files) {
    const isImg = file.type.startsWith('image/');
    try {
      const dataUrl = await readFileAsDataURL(file);
      let url = dataUrl;
      if (supabaseReady) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const ext = file.name.split('.').pop() || 'bin';
          const path = `vedlegg/${editCardId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: file.type });
          if (!error) {
            const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            url = data.publicUrl;
          }
        } catch(e) { console.warn('Vedlegg-opplasting feilet:', e); }
      }
      card.attachments.push({ name: file.name, url, type: isImg ? 'image' : 'file' });
    } catch(e) { console.warn(e); }
  }
  input.value = '';
  renderAttachList(card);
  saveState();
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editCardId = null; editColId = null;
}
function saveEdit() {
  const title = document.getElementById('editTitle').value.trim();
  if (!title) return;
  const card = columns.find(c => c.id === editColId).cards.find(c => c.id === editCardId);
  card.title    = title;
  card.desc     = document.getElementById('editDesc').value.trim();
  card.tag      = document.getElementById('editTag').value;
  card.priority = document.getElementById('editPriority').value;
  card.assignee = document.getElementById('editAssignee').value.trim();
  card.start    = document.getElementById('editStart').value;
  card.due      = document.getElementById('editDue').value;
  closeModal(); render();
}

/* ════════════════════════════════════
   KOLONNER
════════════════════════════════════ */
function renameCol(colId, val) {
  const col = columns.find(c => c.id === colId); if (col) col.title = val;
  renderGantt();
  saveState();
}
function deleteColumn(colId) {
  if (!confirm('Slett denne kolonnen og alle kortene i den?')) return;
  columns = columns.filter(c => c.id !== colId); render();
}
function addColumn() {
  columns.push({ id: cid(), title: 'Ny kolonne', color: COL_COLORS[columns.length % COL_COLORS.length], cards: [] });
  render();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.column-title');
    const last = inputs[inputs.length-1];
    if (last) { last.focus(); last.select(); }
  }, 50);
}

document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target===e.currentTarget) closeModal(); });
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

/* ════════════════════════════════════
   BUDSJETT
════════════════════════════════════ */
const CAT_STYLES = {
  material:   { bg: 'rgba(34,197,94,0.15)',  color: '#86efac', icon: '🧱' },
  håndverker: { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', icon: '🔧' },
  inventar:   { bg: 'rgba(236,72,153,0.15)', color: '#f9a8d4', icon: '🛋' },
  elektro:    { bg: 'rgba(250,204,21,0.15)', color: '#fde047', icon: '⚡' },
  diverse:    { bg: 'rgba(148,163,184,0.12)',color: '#94a3b8', icon: '📦' },
};

/* ── Egendefinerte kategorier ── */
let customCategories = []; // [{ id, name, icon, color }]

const CUSTOM_PALETTE = [
  { hex: '#f87171', bg: 'rgba(248,113,113,0.18)' },
  { hex: '#fb923c', bg: 'rgba(251,146,60,0.18)'  },
  { hex: '#fbbf24', bg: 'rgba(251,191,36,0.18)'  },
  { hex: '#a3e635', bg: 'rgba(163,230,53,0.18)'  },
  { hex: '#34d399', bg: 'rgba(52,211,153,0.18)'  },
  { hex: '#22d3ee', bg: 'rgba(34,211,238,0.18)'  },
  { hex: '#818cf8', bg: 'rgba(129,140,248,0.18)' },
  { hex: '#e879f9', bg: 'rgba(232,121,249,0.18)' },
  { hex: '#f472b6', bg: 'rgba(244,114,182,0.18)' },
  { hex: '#94a3b8', bg: 'rgba(148,163,184,0.14)' },
];
let selectedCatColor = CUSTOM_PALETTE[0].hex;

function getCatStyle(catId) {
  if (CAT_STYLES[catId]) return CAT_STYLES[catId];
  const c = customCategories.find(x => x.id === catId);
  if (c) {
    const pal = CUSTOM_PALETTE.find(p => p.hex === c.color) || CUSTOM_PALETTE[9];
    return { bg: pal.bg, color: c.color, icon: c.icon || '🏷' };
  }
  return CAT_STYLES.diverse;
}

function getAllCats() {
  const builtin = [
    { id: 'material',   name: 'Material',   icon: '🧱', builtin: true },
    { id: 'håndverker', name: 'Håndverker', icon: '🔧', builtin: true },
    { id: 'inventar',   name: 'Inventar',   icon: '🛋', builtin: true },
    { id: 'elektro',    name: 'Elektro',    icon: '⚡', builtin: true },
    { id: 'diverse',    name: 'Diverse',    icon: '📦', builtin: true },
  ];
  return [...builtin, ...customCategories.map(c => ({ ...c, builtin: false }))];
}

function renderCatPills() {
  const el = document.getElementById('catFilterPills');
  if (!el) return;
  el.innerHTML = getAllCats().map(c =>
    `<button class="cat-pill${budgetFilterCat === c.id ? ' active' : ''}"
       data-cat="${c.id}" onclick="setBudgetCatFilter('${c.id}')">
       ${c.icon} ${c.name}
     </button>`
  ).join('');
  // "Alle"-pill foran
  el.insertAdjacentHTML('afterbegin',
    `<button class="cat-pill${budgetFilterCat === '' ? ' active' : ''}"
       data-cat="" onclick="setBudgetCatFilter('')">Alle</button>`);
}

function renderCatSelects() {
  const opts = getAllCats().map(c =>
    `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  ['bCat'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = opts;
    sel.value = cur || getAllCats()[0].id;
  });
}

/* ── Kategori-modal ── */
let _catModalOpen = false;

function openCatModal() {
  renderCustomCatList();
  renderColorSwatches();
  document.getElementById('catIconInput').value = '';
  document.getElementById('catNameInput').value = '';
  selectedCatColor = CUSTOM_PALETTE[0].hex;
  document.getElementById('catModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('catNameInput').focus(), 50);
}

function closeCatModal() {
  document.getElementById('catModalOverlay').classList.remove('open');
}

function renderCustomCatList() {
  const el = document.getElementById('customCatList');
  if (!customCategories.length) {
    el.innerHTML = '<p style="font-size:0.75rem;color:#475569;margin:0">Ingen egendefinerte kategorier ennå.</p>';
    return;
  }
  el.innerHTML = `
    <p style="font-size:0.7rem;color:#64748b;margin:0 0 6px">Dine kategorier</p>
    <div class="custom-cat-list">
      ${customCategories.map(c => {
        const st = getCatStyle(c.id);
        return `<div class="custom-cat-row">
          <span class="cat-row-badge" style="background:${st.bg};color:${st.color}">${c.icon||'🏷'} ${c.name}</span>
          <span class="cat-row-name"></span>
          <button class="cat-row-del" onclick="deleteCat('${c.id}')" title="Slett kategori">🗑</button>
        </div>`;
      }).join('')}
    </div>`;
}

function renderColorSwatches() {
  const el = document.getElementById('catColorSwatches');
  if (!el) return;
  el.innerHTML = CUSTOM_PALETTE.map(p =>
    `<div class="color-swatch${p.hex === selectedCatColor ? ' selected' : ''}"
       style="background:${p.hex}"
       onclick="selectCatColor('${p.hex}')"></div>`
  ).join('');
}

function selectCatColor(hex) {
  selectedCatColor = hex;
  renderColorSwatches();
}

function saveCat() {
  const name = document.getElementById('catNameInput').value.trim();
  if (!name) { document.getElementById('catNameInput').focus(); return; }
  const icon = document.getElementById('catIconInput').value.trim() || '🏷';
  const id = 'cat_' + name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
  const chosenColor = selectedCatColor;
  customCategories.push({ id, name, icon, color: chosenColor });
  document.getElementById('catNameInput').value = '';
  document.getElementById('catIconInput').value = '';
  selectedCatColor = CUSTOM_PALETTE[0].hex;
  renderCustomCatList();
  renderColorSwatches();
  renderCatPills();
  renderCatSelects();
  // Oppdater donut-chart farger
  CHART_COLORS[id] = chosenColor;
  saveState();
}

function deleteCat(id) {
  // Sjekk om kategorien er i bruk
  const inUse = budgetPosts.some(p => p.cat === id);
  if (inUse && !confirm('Denne kategorien er i bruk av noen poster. Vil du slette den likevel? Postene beholder kategori-ID-en.')) return;
  customCategories = customCategories.filter(c => c.id !== id);
  if (budgetFilterCat === id) budgetFilterCat = '';
  renderCustomCatList();
  renderCatPills();
  renderCatSelects();
  saveState();
}

document.getElementById('catModalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCatModal();
});

let budgetPosts = [];

function nok(val) {
  return Number(val||0).toLocaleString('nb-NO') + ' kr';
}

function addBudgetPost() {
  const name = document.getElementById('bName').value.trim();
  if (!name) { document.getElementById('bName').focus(); return; }
  budgetPosts.push({
    id:       cid(),
    name,
    cat:      document.getElementById('bCat').value,
    status:   document.getElementById('bStatus').value,
    est:      parseFmt('bEst'),
    act:      parseFmt('bAct'),
    receipts: [],
  });
  logActivity('💰', `Budsjettpost: ${name}`);
  document.getElementById('bName').value = '';
  document.getElementById('bEst').value  = '';
  document.getElementById('bAct').value  = '';
  renderBudget();
}

function deleteBudgetPost(id) {
  budgetPosts = budgetPosts.filter(p => p.id !== id);
  renderBudget();
}

function editBudgetPost(id) {
  const p = budgetPosts.find(p => p.id === id);
  if (!p) return;
  // Inline edit: repopulate form fields and remove from list temporarily
  document.getElementById('bName').value   = p.name;
  document.getElementById('bCat').value    = p.cat;
  document.getElementById('bStatus').value = p.status;
  document.getElementById('bEst').value    = p.est ? p.est.toLocaleString('nb-NO').replace(/\u00a0/g,' ') : '';
  document.getElementById('bAct').value    = p.act ? p.act.toLocaleString('nb-NO').replace(/\u00a0/g,' ') : '';
  budgetPosts = budgetPosts.filter(x => x.id !== id);
  renderBudget();
  document.getElementById('bName').focus();
}

function updateBudgetStatus(id, val) {
  const p = budgetPosts.find(p => p.id === id);
  if (p) { p.status = val; renderBudget(); }
}

/* ── Tusenskilletegn-hjelper ── */
function fmtField(el) {
  const raw  = el.value.replace(/\s/g, '').replace(/[^0-9]/g, '');
  const num  = parseInt(raw, 10);
  // Behold cursor-posisjon (antall siffer til høyre for markøren)
  const selEnd  = el.selectionEnd;
  const oldLen  = el.value.length;
  el.value = raw === '' ? '' : num.toLocaleString('nb-NO').replace(/\u00a0/g, ' ');
  // Flytt cursor: tell nye tegn lagt til venstre
  const diff = el.value.length - oldLen;
  try { el.setSelectionRange(selEnd + diff, selEnd + diff); } catch(e) {}
}
function parseFmt(id) {
  const v = document.getElementById(id)?.value.replace(/\s/g,'') || '0';
  return parseInt(v, 10) || 0;
}

/* ── Budget drag & drop ── */
let budgetDragId = null;

function attachBudgetDrag() {
  const tbody = document.getElementById('budgetTableBody');
  tbody.querySelectorAll('tr[data-budget-id]').forEach(row => {
    row.addEventListener('dragstart', e => {
      budgetDragId = row.dataset.budgetId;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('budget-dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      budgetDragId = null;
      tbody.querySelectorAll('tr').forEach(r => {
        r.classList.remove('budget-dragging', 'budget-drop-above', 'budget-drop-below');
      });
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (!budgetDragId || row.dataset.budgetId === budgetDragId) return;
      tbody.querySelectorAll('tr').forEach(r =>
        r.classList.remove('budget-drop-above', 'budget-drop-below'));
      const box = row.getBoundingClientRect();
      const mid = box.top + box.height / 2;
      row.classList.add(e.clientY < mid ? 'budget-drop-above' : 'budget-drop-below');
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('budget-drop-above', 'budget-drop-below');
    });

    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!budgetDragId || row.dataset.budgetId === budgetDragId) return;

      const fromIdx = budgetPosts.findIndex(p => p.id === budgetDragId);
      const toIdx   = budgetPosts.findIndex(p => p.id === row.dataset.budgetId);
      if (fromIdx === -1 || toIdx === -1) return;

      const box = row.getBoundingClientRect();
      const dropAfter = e.clientY >= box.top + box.height / 2;

      const [moved] = budgetPosts.splice(fromIdx, 1);
      const insertAt = dropAfter ? toIdx : toIdx;
      // Recalculate toIdx after splice
      const newToIdx = budgetPosts.findIndex(p => p.id === row.dataset.budgetId);
      budgetPosts.splice(dropAfter ? newToIdx + 1 : newToIdx, 0, moved);

      renderBudget();
    });
  });
}

function renderBudget() {
  const pot    = parseFmt('potInput');
  const totEst = budgetPosts.reduce((s, p) => s + (p.est||0), 0);
  const totAct = budgetPosts.reduce((s, p) => s + (p.act||0), 0);
  const remaining = pot - totEst;
  const usedPct   = pot > 0 ? Math.min(totAct  / pot * 100, 100) : 0;
  const estPct    = pot > 0 ? Math.min(totEst  / pot * 100, 100) : 0;
  const actColor  = totAct > pot ? '#f87171' : totAct > pot * 0.85 ? '#facc15' : '#4ade80';

  // ── Summary stats ──
  const remClass = remaining < 0 ? 'over' : remaining < pot * 0.1 ? 'warn' : 'under';
  document.getElementById('budgetSummary').innerHTML = `
    <div class="budget-stat">
      <div class="budget-stat-label">Total pott</div>
      <div class="budget-stat-value">${nok(pot)}</div>
    </div>
    <div class="budget-stat">
      <div class="budget-stat-label">Totalt estimert</div>
      <div class="budget-stat-value ${totEst > pot ? 'over' : ''}">${nok(totEst)}</div>
    </div>
    <div class="budget-stat">
      <div class="budget-stat-label">Totalt betalt</div>
      <div class="budget-stat-value">${nok(totAct)}</div>
    </div>
    <div class="budget-stat">
      <div class="budget-stat-label">Gjenstår (pott − est.)</div>
      <div class="budget-stat-value ${remClass}">${remaining < 0 ? '−' : ''}${nok(Math.abs(remaining))}</div>
    </div>
  `;

  // ── Progress bar ──
  document.getElementById('progEst').style.width = estPct + '%';
  document.getElementById('progAct').style.width = usedPct + '%';
  document.getElementById('progAct').style.background = actColor;
  document.getElementById('progressPct').textContent =
    pot > 0 ? Math.round(estPct) + '% av potten estimert' : '';

  // ── Dynamiske kategorier ──
  renderCatPills();
  renderCatSelects();

  // ── Analytics ──
  drawBudgetDonut();

  // ── Table rows (filtered) ──
  const visiblePosts = getFilteredPosts();
  const tbody = document.getElementById('budgetTableBody');
  tbody.innerHTML = visiblePosts.map(p => {
    const cat  = getCatStyle(p.cat);
    const diff = (p.act||0) - (p.est||0);
    const diffHtml = p.act
      ? `<span class="${diff > 0 ? 'diff-neg' : diff < 0 ? 'diff-pos' : 'diff-zero'}">
           ${diff > 0 ? '+' : ''}${nok(diff)}
         </span>`
      : `<span class="diff-zero">–</span>`;

    const recCount = (p.receipts||[]).length;
    const recLabel = recCount ? `📷 ${recCount}` : '📷';
    return `<tr draggable="true" data-budget-id="${p.id}">
      <td style="padding-left:8px;width:32px">
        <span class="budget-drag-handle" title="Dra for å endre rekkefølge">⠿</span>
      </td>
      <td>${esc(p.name)}</td>
      <td><span class="budget-cat-badge" style="background:${cat.bg};color:${cat.color}">${cat.icon} ${esc(p.cat)}</span></td>
      <td>
        <select class="budget-status-badge status-${p.status}"
          onchange="updateBudgetStatus('${p.id}',this.value)"
          style="background:transparent;border:none;color:inherit;font:inherit;cursor:pointer;outline:none;padding:2px 4px;">
          <option value="planlagt" ${p.status==='planlagt'?'selected':''}>📋 Planlagt</option>
          <option value="bestilt"  ${p.status==='bestilt' ?'selected':''}>📦 Bestilt</option>
          <option value="betalt"   ${p.status==='betalt'  ?'selected':''}>✅ Betalt</option>
        </select>
      </td>
      <td class="num">${p.est ? nok(p.est) : '–'}</td>
      <td class="num">${p.act ? nok(p.act) : '–'}</td>
      <td class="num">${diffHtml}</td>
      <td>
        <div class="budget-table-actions">
          <button class="budget-row-btn" onclick="openReceiptModal('${p.id}')" title="Kvitteringer" style="color:${recCount?'#a5b4fc':'#64748b'}">${recLabel}</button>
          <button class="budget-row-btn" onclick="editBudgetPost('${p.id}')">Rediger</button>
          <button class="budget-row-btn del" onclick="deleteBudgetPost('${p.id}')">Slett</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Attach drag listeners to rows
  attachBudgetDrag();

  // ── Totals footer (bruker filtrerte summer hvis filter er aktivt) ──
  const filtEst = visiblePosts.reduce((s, p) => s + (p.est||0), 0);
  const filtAct = visiblePosts.reduce((s, p) => s + (p.act||0), 0);
  const filtDiff = filtAct - filtEst;
  const isFiltered = visiblePosts.length !== budgetPosts.length;
  document.getElementById('budgetTableFoot').innerHTML = `
    <tr class="budget-total-row">
      <td></td>
      <td colspan="3">
        <strong>Totalt${isFiltered ? ` (${visiblePosts.length} av ${budgetPosts.length} poster)` : ''}</strong>
      </td>
      <td class="num">${nok(filtEst)}</td>
      <td class="num">${nok(filtAct)}</td>
      <td class="num">
        <span class="${filtDiff > 0 ? 'diff-neg' : filtDiff < 0 ? 'diff-pos' : 'diff-zero'}">
          ${filtDiff > 0 ? '+' : ''}${nok(filtDiff)}
        </span>
      </td>
      <td></td>
    </tr>`;
  saveState();
}

/* ════════════════════════════════════
   BUDSJETT — FILTER, ANALYTICS, EXCEL
════════════════════════════════════ */
let budgetFilterCat = '';
let budgetFilterMin = null;
let budgetFilterMax = null;

function setBudgetCatFilter(cat) {
  budgetFilterCat = cat;
  document.querySelectorAll('#catFilterPills .cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderBudget();
}

function clearBudgetFilter() {
  budgetFilterCat = '';
  budgetFilterMin = null;
  budgetFilterMax = null;
  document.querySelectorAll('#catFilterPills .cat-pill').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.cat === ''));
  const fMin = document.getElementById('filterMin');
  const fMax = document.getElementById('filterMax');
  if (fMin) fMin.value = '';
  if (fMax) fMax.value = '';
  renderBudget();
}

function getFilteredPosts() {
  const rawMin = document.getElementById('filterMin')?.value.replace(/\s/g,'') || '';
  const rawMax = document.getElementById('filterMax')?.value.replace(/\s/g,'') || '';
  const minVal = rawMin ? parseInt(rawMin, 10) : null;
  const maxVal = rawMax ? parseInt(rawMax, 10) : null;

  return budgetPosts.filter(p => {
    if (budgetFilterCat && p.cat !== budgetFilterCat) return false;
    const amount = Math.max(p.est || 0, p.act || 0);
    if (minVal !== null && amount < minVal) return false;
    if (maxVal !== null && amount > maxVal) return false;
    return true;
  });
}

/* ── Donut / pie chart ── */
const CHART_COLORS = {
  material:   '#6366f1',
  håndverker: '#f59e0b',
  inventar:   '#10b981',
  elektro:    '#38bdf8',
  diverse:    '#f472b6',
};

function drawBudgetDonut() {
  const canvas = document.getElementById('budgetDonut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Sum by category
  const bycat = {};
  budgetPosts.forEach(p => {
    const v = p.est || 0;
    if (v > 0) bycat[p.cat] = (bycat[p.cat] || 0) + v;
  });
  const cats = Object.keys(bycat);
  const total = cats.reduce((s, c) => s + bycat[c], 0);

  if (total === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(W/2, H/2, 55, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(W/2, H/2, 35, 0, Math.PI*2);
    ctx.fill();
    document.getElementById('budgetLegend').innerHTML =
      '<span style="font-size:0.75rem;color:#475569">Ingen poster ennå</span>';
    return;
  }

  // Draw segments
  let angle = -Math.PI / 2;
  const cx = W/2, cy = H/2, outer = 58, inner = 36;

  cats.forEach(cat => {
    const slice = (bycat[cat] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outer, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[cat] || '#94a3b8';
    ctx.fill();
    angle += slice;
  });

  // Inner circle (donut hole)
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI*2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  // Centre label
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nok(total), cx, cy - 5);
  ctx.fillStyle = '#64748b';
  ctx.font = '9px system-ui';
  ctx.fillText('estimert', cx, cy + 8);

  // Legend
  const legend = document.getElementById('budgetLegend');
  legend.innerHTML = cats.map(cat => {
    const pct = Math.round(bycat[cat] / total * 100);
    const label = { material:'Material', håndverker:'Håndverker',
                    inventar:'Inventar', elektro:'Elektro', diverse:'Diverse' }[cat] || cat;
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${CHART_COLORS[cat]||'#94a3b8'}"></div>
      <span class="legend-name">${label}</span>
      <span class="legend-pct">${pct}%</span>
      <span class="legend-val">${nok(bycat[cat])}</span>
    </div>`;
  }).join('');
}

/* ── Excel export ── */
function exportBudgetExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Excel-biblioteket er ikke lastet ennå. Prøv igjen om et sekund.');
    return;
  }
  const pot    = parseFmt('potInput');
  const totEst = budgetPosts.reduce((s, p) => s + (p.est||0), 0);
  const totAct = budgetPosts.reduce((s, p) => s + (p.act||0), 0);

  const header = ['Beskrivelse', 'Kategori', 'Status', 'Estimert (kr)', 'Faktisk (kr)', 'Avvik (kr)'];
  const dataRows = budgetPosts.map(p => [
    p.name,
    p.cat,
    p.status,
    p.est || 0,
    p.act || 0,
    (p.act || 0) - (p.est || 0),
  ]);
  const footerRows = [
    [],
    ['', '', 'Totalt estimert', totEst, '', ''],
    ['', '', 'Totalt betalt',   '', totAct, ''],
    ['', '', 'Total pott',      pot,  '', ''],
    ['', '', 'Gjenstår (pott − est.)', pot - totEst, '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows, ...footerRows]);

  // Kolonne-bredder
  ws['!cols'] = [
    { wch: 38 }, { wch: 14 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Budsjett');

  const dato = new Date().toLocaleDateString('nb-NO').replace(/\./g, '-');
  XLSX.writeFile(wb, `budsjett_${dato}.xlsx`);
}

/* ════════════════════════════════════
   FORUM
════════════════════════════════════ */
const AVATAR_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#f97316',
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function avatarInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0,2).join('');
}
function timeAgo(isoStr) {
  const diff = Math.round((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)    return 'akkurat nå';
  if (diff < 3600)  return Math.floor(diff/60) + ' min siden';
  if (diff < 86400) return Math.floor(diff/3600) + ' t siden';
  return new Date(isoStr).toLocaleDateString('nb-NO', { day:'numeric', month:'short', year:'numeric' });
}

/* ── Bildehjelpere + Supabase Storage ── */
const STORAGE_BUCKET = 'bilder';

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function uploadToStorage(dataUrl, mimeType) {
  if (!supabaseReady) return dataUrl; // fallback: behold base64
  try {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const ext  = mimeType?.split('/')[1] || 'jpg';
    const path = `forum/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: mimeType });
    if (error) throw error;
    const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch(e) {
    console.warn('Storage-opplasting feilet, bruker base64:', e);
    return dataUrl;
  }
}

// pendingImages[inputId] → [{ dataUrl, mimeType }, ...]
const pendingImages = {};

async function previewImages(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const newImgs = [];
  for (const file of input.files) {
    try {
      const dataUrl = await readFileAsDataURL(file);
      newImgs.push({ dataUrl, mimeType: file.type });
    } catch(e) {}
  }
  pendingImages[inputId] = [...(pendingImages[inputId] || []), ...newImgs];
  input.value = '';
  renderImagePreview(inputId, previewId);
}

function renderImagePreview(inputId, previewId) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  const imgs = pendingImages[inputId] || [];
  preview.innerHTML = imgs.map((img, i) => `
    <div class="img-preview-item">
      <img src="${img.dataUrl}" alt="forhåndsvisning" onclick="openLightbox('${img.dataUrl}')" style="cursor:zoom-in" />
      <button class="img-preview-remove" onclick="removePendingImage('${inputId}','${previewId}',${i})" title="Fjern">✕</button>
    </div>`).join('');
}

function removePendingImage(inputId, previewId, idx) {
  if (pendingImages[inputId]) {
    pendingImages[inputId].splice(idx, 1);
    renderImagePreview(inputId, previewId);
  }
}

async function collectImages(inputId) {
  const imgs = pendingImages[inputId] || [];
  pendingImages[inputId] = [];
  // Last opp til Supabase Storage, fall tilbake til base64
  return Promise.all(imgs.map(img => uploadToStorage(img.dataUrl, img.mimeType)));
}

/* ════════════════════════════════════
   PDF BUDSJETT-IMPORT
════════════════════════════════════ */
// Sett PDF.js worker (lastes fra CDN)
let pdfParsedRows = [];

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

async function openPdfImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  document.getElementById('pdfFileName').textContent = file.name;
  document.getElementById('pdfModalBody').innerHTML = `
    <div class="pdf-loading">
      <div class="spinner"></div>
      <div>Leser PDF og leter etter tall…</div>
    </div>`;
  document.getElementById('pdfModalOverlay').classList.add('open');

  try {
    const rows = await parsePdfBudget(file);
    pdfParsedRows = rows;
    renderPdfPreview(rows);
  } catch(e) {
    document.getElementById('pdfModalBody').innerHTML =
      `<div class="pdf-loading" style="color:#f87171">⚠ Kunne ikke lese PDF-en.<br><small>${e.message}</small></div>`;
  }
}

async function parsePdfBudget(file) {
  // Les PDF med PDF.js
  const arrayBuffer = await file.arrayBuffer();
  const pdf  = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const lines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Grupper tekstelementer i linjer basert på y-posisjon
    const byY = {};
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push(item.str);
    });
    Object.keys(byY).sort((a,b) => b-a).forEach(y => {
      lines.push(byY[y].join(' ').trim());
    });
  }

  // Parser linjer for tall (norsk format: 1 234,56 / 1234 / 1.234,56)
  const NOK_RE = /(\d[\d\s]*(?:[.,]\d{1,3})*(?:[.,]\d{2})?)/g;
  const rows = [];

  lines.forEach(line => {
    if (!line || line.length < 3) return;

    // ── Filtrer ut kontaktinfo ──────────────────────────────────────────────
    // Epost
    if (/@[\w.-]+\.[a-z]{2,}/i.test(line)) return;
    // Telefonnummer-linjer (inneholder nøkkelord eller +47/0047)
    if (/(?:tlf|tel\b|mob\b|phone|\+47|0047)/i.test(line)) return;
    // Org.nr-linjer
    if (/(?:org\.?\s*nr|orgnr|organisasjonsnr)/i.test(line)) return;
    // ───────────────────────────────────────────────────────────────────────

    const matches = [...line.matchAll(NOK_RE)];
    if (!matches.length) return;

    // Finn det største tallet som "beløp"
    let best = null, bestVal = -Infinity;
    matches.forEach(m => {
      const raw = m[1].replace(/\s/g,'').replace(',','.').replace(/\./g,(c,i,s) =>
        i === s.lastIndexOf('.') ? '.' : ''
      );
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0 && val > bestVal) { bestVal = val; best = m; }
    });
    if (!best || bestVal < 10) return; // ignorer tall under 10

    // Norsk telefon = 8 siffer, org.nr = 9 siffer — begge urealistiske som pris
    const rawDigits = best[1].replace(/[\s.,]/g, '');
    if (rawDigits.length === 8 || rawDigits.length === 9) return;

    // Beskrivelse = linjen uten tallene
    let desc = line.replace(NOK_RE, '').replace(/[:\-–|]/g,' ').replace(/\s{2,}/g,' ').trim();
    if (!desc || desc.length < 2) desc = 'Post fra PDF';

    rows.push({
      id:         cid(),
      include:    true,
      desc:       desc.slice(0, 80),
      amount:     Math.round(bestVal),
      baseAmount: Math.round(bestVal),
      mva:        false,
      type:       'est',
      cat:        guessCat(desc),
    });
  });

  if (!rows.length) throw new Error('Fant ingen rader med beløp i dokumentet.');
  return rows;
}

function guessCat(desc) {
  const d = desc.toLowerCase();
  if (/flis|maling|material|trevirke|stål|rør|isolasjon|gips/.test(d)) return 'material';
  if (/elektriker|rørlegger|snekker|håndverk|montør|arbeids/.test(d)) return 'håndverker';
  if (/møbel|kjøkken|bad|sofa|lampe|stol|bord|skap|inventar/.test(d)) return 'inventar';
  if (/elektro|strøm|sikring|kurs/.test(d)) return 'elektro';
  return 'diverse';
}

function renderPdfPreview(rows) {
  if (!rows.length) {
    document.getElementById('pdfModalBody').innerHTML =
      '<div class="pdf-loading">Ingen beløp funnet i PDF-en.</div>';
    return;
  }
  updatePdfCount();

  document.getElementById('pdfModalBody').innerHTML = `
    <table class="pdf-import-table">
      <thead>
        <tr>
          <th style="width:32px">
            <input type="checkbox" checked onchange="toggleAllPdfRows(this.checked)" title="Velg alle" />
          </th>
          <th>Beskrivelse</th>
          <th style="width:120px">Beløp (kr)</th>
          <th style="width:80px;text-align:center">
            MVA 25%<br>
            <label style="font-size:0.68rem;font-weight:400;cursor:pointer;white-space:nowrap">
              <input type="checkbox" onchange="toggleAllPdfMva(this.checked)"> alle
            </label>
          </th>
          <th style="width:110px">Type</th>
          <th style="width:120px">Kategori</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r,i) => `
        <tr id="pdfrow-${i}" class="${r.include?'':'excluded'}">
          <td><input type="checkbox" ${r.include?'checked':''} onchange="togglePdfRow(${i},this.checked)" /></td>
          <td><input type="text" value="${esc(r.desc)}" oninput="pdfParsedRows[${i}].desc=this.value" /></td>
          <td><input type="text" inputmode="numeric" id="pdfamt-${i}" value="${r.amount.toLocaleString('nb-NO')}"
            oninput="fmtField(this);pdfParsedRows[${i}].baseAmount=parseFmtRaw(this.value);applyMvaDisplay(${i})" /></td>
          <td style="text-align:center">
            <input type="checkbox" ${r.mva?'checked':''} onchange="togglePdfMva(${i},this.checked)" />
          </td>
          <td>
            <select onchange="pdfParsedRows[${i}].type=this.value">
              <option value="est"  ${r.type==='est' ?'selected':''}>Estimert</option>
              <option value="act"  ${r.type==='act' ?'selected':''}>Faktisk</option>
            </select>
          </td>
          <td>
            <select onchange="pdfParsedRows[${i}].cat=this.value">
              ${getAllCats().map(c =>
                `<option value="${c.id}" ${r.cat===c.id?'selected':''}>${c.icon} ${c.name}</option>`
              ).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function parseFmtRaw(val) {
  return parseInt(val.replace(/\s/g,''), 10) || 0;
}

function togglePdfRow(idx, checked) {
  pdfParsedRows[idx].include = checked;
  const row = document.getElementById(`pdfrow-${idx}`);
  if (row) row.classList.toggle('excluded', !checked);
  updatePdfCount();
}

function toggleAllPdfRows(checked) {
  pdfParsedRows.forEach((r,i) => {
    r.include = checked;
    const row = document.getElementById(`pdfrow-${i}`);
    if (row) row.classList.toggle('excluded', !checked);
  });
  updatePdfCount();
}

function togglePdfMva(idx, checked) {
  const r = pdfParsedRows[idx];
  r.mva    = checked;
  r.amount = checked ? Math.round(r.baseAmount * 1.25) : r.baseAmount;
  const el = document.getElementById(`pdfamt-${idx}`);
  if (el) el.value = r.amount.toLocaleString('nb-NO');
}

function toggleAllPdfMva(checked) {
  pdfParsedRows.forEach((r, i) => {
    r.mva    = checked;
    r.amount = checked ? Math.round(r.baseAmount * 1.25) : r.baseAmount;
    const el = document.getElementById(`pdfamt-${i}`);
    if (el) el.value = r.amount.toLocaleString('nb-NO');
    // Oppdater også avkrysningsboksen i raden
    const cb = document.querySelector(`#pdfrow-${i} input[type=checkbox]:last-of-type`);
    if (cb) cb.checked = checked;
  });
}

function applyMvaDisplay(idx) {
  // Kalt når brukeren redigerer beløpet manuelt; oppdater amount
  const r = pdfParsedRows[idx];
  r.amount = r.mva ? Math.round(r.baseAmount * 1.25) : r.baseAmount;
}

function updatePdfCount() {
  const sel = pdfParsedRows.filter(r => r.include).length;
  document.getElementById('pdfSelectedCount').textContent =
    `${sel} av ${pdfParsedRows.length} rader valgt`;
}

function importPdfRows() {
  const toAdd = pdfParsedRows.filter(r => r.include);
  if (!toAdd.length) { closePdfModal(); return; }
  toAdd.forEach(r => {
    // r.amount er allerede × 1.25 hvis MVA er valgt
    const finalAmt = r.amount;
    budgetPosts.push({
      id:       cid(),
      name:     r.desc + (r.mva ? ' (inkl. MVA)' : ''),
      cat:      r.cat,
      status:   'planlagt',
      est:      r.type === 'est' ? finalAmt : 0,
      act:      r.type === 'act' ? finalAmt : 0,
      receipts: [],
    });
  });
  closePdfModal();
  showTab('budget');
  saveState();
}

function closePdfModal() {
  document.getElementById('pdfModalOverlay').classList.remove('open');
  pdfParsedRows = [];
}

document.getElementById('pdfModalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closePdfModal();
});

/* ════════════════════════════════════
   CSV / EXCEL BUDSJETT-IMPORT
════════════════════════════════════ */
let csvParsedRows = [];

function openCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  document.getElementById('csvFileName').textContent = file.name;
  document.getElementById('csvModalBody').innerHTML = `
    <div class="pdf-loading"><div class="spinner"></div><div>Leser fil…</div></div>`;
  document.getElementById('csvModalOverlay').classList.add('open');

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const rows = parseCsvBudget(e.target.result, file.name);
      csvParsedRows = rows;
      renderCsvPreview(rows);
    } catch(err) {
      document.getElementById('csvModalBody').innerHTML =
        `<div class="pdf-loading" style="color:#f87171">⚠ Kunne ikke lese filen.<br><small>${err.message}</small></div>`;
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCsvBudget(text, filename) {
  // Detect delimiter: comma, semicolon or tab
  const delimiters = [';', ',', '\t'];
  const firstLine = text.split('\n')[0] || '';
  const delim = delimiters.reduce((best, d) =>
    (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Filen må ha minst én header-rad og én datarad.');

  // Parse header
  const headers = splitCsvLine(lines[0], delim).map(h => h.toLowerCase().trim());

  // Try to map columns: beskrivelse/description/name, estimert/est/budget, faktisk/act/actual/paid, kategori/category/cat
  const colDesc  = findCol(headers, ['beskrivelse','description','name','navn','post','item']);
  const colEst   = findCol(headers, ['estimert','est','budsjett','budget','pris','price','beløp','amount']);
  const colAct   = findCol(headers, ['faktisk','actual','betalt','paid','kostnad','cost']);
  const colCat   = findCol(headers, ['kategori','category','cat','type']);

  if (colDesc === -1) throw new Error('Fant ingen beskrivelse-kolonne. Forventet: Beskrivelse, Name, Post, Item.');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delim);
    if (cells.every(c => !c.trim())) continue;

    const desc = cells[colDesc] ? cells[colDesc].trim() : '';
    if (!desc) continue;

    const estRaw = colEst >= 0 ? parseNok(cells[colEst]) : 0;
    const actRaw = colAct >= 0 ? parseNok(cells[colAct]) : 0;
    const catHint = colCat >= 0 ? (cells[colCat] || '').trim() : '';
    const cat = catHint ? guessCatFromString(catHint) : guessCat(desc);

    rows.push({
      id:      cid(),
      include: true,
      desc:    desc.slice(0, 80),
      est:     estRaw,
      act:     actRaw,
      cat:     cat,
    });
  }
  if (!rows.length) throw new Error('Fant ingen gyldige rader i filen.');
  return rows;
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function splitCsvLine(line, delim) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch === delim) { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

function parseNok(val) {
  if (!val) return 0;
  // Remove currency symbols and whitespace
  const s = val.replace(/[^\d,.\-]/g, '').trim();
  if (!s) return 0;
  // Handle Norwegian format: 1 234,56 or 1.234,56
  const hasDotAndComma = s.includes('.') && s.includes(',');
  let clean;
  if (hasDotAndComma) {
    // Assumes dot is thousands sep and comma is decimal
    clean = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Check if comma is decimal (e.g. 1234,56) or thousands (e.g. 1,234)
    const parts = s.split(',');
    clean = parts[parts.length - 1].length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else {
    clean = s;
  }
  return Math.round(parseFloat(clean)) || 0;
}

function guessCatFromString(str) {
  const s = str.toLowerCase();
  if (/mat|flis|maling|material|tre|stål|rør|isolasjon|gips/.test(s)) return 'material';
  if (/elektr|strøm|sikring/.test(s)) return 'elektro';
  if (/rørlegger|vvs/.test(s)) return 'rørlegger';
  if (/møbel|kjøkken|bad|sofa|stol|bord|skap|inventar/.test(s)) return 'inventar';
  if (/håndverk|snekker|arbeids|arbeider|montør/.test(s)) return 'håndverker';
  return guessCat(str);
}

function renderCsvPreview(rows) {
  if (!rows.length) {
    document.getElementById('csvModalBody').innerHTML =
      '<div class="pdf-loading">Ingen rader funnet i filen.</div>';
    return;
  }
  updateCsvCount();
  document.getElementById('csvModalBody').innerHTML = `
    <table class="pdf-import-table">
      <thead>
        <tr>
          <th style="width:32px">
            <input type="checkbox" checked onchange="toggleAllCsvRows(this.checked)" title="Velg alle" />
          </th>
          <th>Beskrivelse</th>
          <th style="width:110px">Estimert (kr)</th>
          <th style="width:110px">Faktisk (kr)</th>
          <th style="width:130px">Kategori</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
        <tr id="csvrow-${i}" class="${r.include ? '' : 'excluded'}">
          <td><input type="checkbox" ${r.include ? 'checked' : ''} onchange="toggleCsvRow(${i},this.checked)" /></td>
          <td><input type="text" value="${esc(r.desc)}" oninput="csvParsedRows[${i}].desc=this.value" /></td>
          <td><input type="text" inputmode="numeric" value="${r.est ? r.est.toLocaleString('nb-NO') : ''}"
            oninput="fmtField(this);csvParsedRows[${i}].est=parseFmtRaw(this.value)" placeholder="0"/></td>
          <td><input type="text" inputmode="numeric" value="${r.act ? r.act.toLocaleString('nb-NO') : ''}"
            oninput="fmtField(this);csvParsedRows[${i}].act=parseFmtRaw(this.value)" placeholder="0"/></td>
          <td>
            <select onchange="csvParsedRows[${i}].cat=this.value">
              ${getAllCats().map(c =>
                `<option value="${c.id}" ${r.cat === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`
              ).join('')}
            </select>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

function toggleCsvRow(idx, checked) {
  csvParsedRows[idx].include = checked;
  const row = document.getElementById(`csvrow-${idx}`);
  if (row) row.classList.toggle('excluded', !checked);
  updateCsvCount();
}

function toggleAllCsvRows(checked) {
  csvParsedRows.forEach((r, i) => {
    r.include = checked;
    const row = document.getElementById(`csvrow-${i}`);
    if (row) row.classList.toggle('excluded', !checked);
  });
  updateCsvCount();
}

function updateCsvCount() {
  const sel = csvParsedRows.filter(r => r.include).length;
  document.getElementById('csvSelectedCount').textContent =
    `${sel} av ${csvParsedRows.length} rader valgt`;
}

function importCsvRows() {
  const toAdd = csvParsedRows.filter(r => r.include);
  if (!toAdd.length) { closeCsvModal(); return; }
  toAdd.forEach(r => {
    budgetPosts.push({
      id:       cid(),
      name:     r.desc,
      cat:      r.cat,
      status:   'planlagt',
      est:      r.est || 0,
      act:      r.act || 0,
      receipts: [],
    });
  });
  closeCsvModal();
  showTab('budget');
  saveState();
}

function closeCsvModal() {
  document.getElementById('csvModalOverlay').classList.remove('open');
  csvParsedRows = [];
}

document.getElementById('csvModalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCsvModal();
});

/* ── Lightbox ── */
function openLightbox(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

let forumTopics = [];

let forumView = 'list'; // 'list' | topicId
let forumLastAuthor = '';

function renderForum() {
  document.getElementById('forumTopicCount').textContent =
    `${forumTopics.length} tema${forumTopics.length !== 1 ? 'er' : ''}`;

  if (forumView === 'list') renderForumList();
  else renderForumThread(forumView);
  saveState();
}

function renderForumList() {
  const body = document.getElementById('forumBody');
  if (!forumTopics.length) {
    body.innerHTML = '<div class="forum-empty">Ingen temaer ennå — vær den første! 👆</div>';
    return;
  }
  body.innerHTML = `<div class="forum-topic-list">${
    forumTopics.map(t => {
      const lastPost = t.posts[t.posts.length - 1];
      const replyCount = t.posts.length - 1;
      return `<div class="forum-topic-row" onclick="openTopic('${t.id}')">
        <div class="forum-topic-icon">${esc(t.icon)}</div>
        <div class="forum-topic-meta">
          <div class="forum-topic-title">${esc(t.title)}</div>
          <div class="forum-topic-sub">
            <span>av <strong style="color:#94a3b8">${esc(t.author)}</strong></span>
            <span>·</span>
            <span>${timeAgo(t.created)}</span>
            ${lastPost && replyCount > 0
              ? `<span>· Siste svar fra <strong style="color:#94a3b8">${esc(lastPost.author)}</strong> ${timeAgo(lastPost.created)}</span>`
              : ''}
          </div>
        </div>
        <div class="forum-reply-count">
          <span style="font-size:1rem">💬</span>
          <span>${replyCount}</span>
        </div>
        <button class="forum-topic-del" title="Slett tema"
          onclick="event.stopPropagation();deleteForumTopic('${t.id}')">🗑</button>
      </div>`;
    }).join('')
  }</div>`;
}

function renderForumThread(topicId) {
  const topic = forumTopics.find(t => t.id === topicId);
  if (!topic) { forumView = 'list'; renderForumList(); return; }

  const opAuthor = topic.posts[0]?.author || topic.author;

  const postsHtml = topic.posts.map((post, idx) => {
    const isOP = idx === 0;
    const color = avatarColor(post.author);
    const imagesHtml = post.images && post.images.length
      ? `<div class="post-images">${post.images.map(src =>
          `<img class="post-img" src="${src}" alt="bilde" onclick="openLightbox('${src}')" />`
        ).join('')}</div>` : '';
    return `<div class="forum-post ${isOP ? 'op' : ''}">
      <div class="forum-avatar" style="background:${color}">${avatarInitials(post.author)}</div>
      <div class="forum-post-body">
        <div class="forum-post-header">
          <span class="forum-post-author">${esc(post.author)}</span>
          ${isOP ? '<span class="forum-post-op-badge">OP</span>' : ''}
          <span class="forum-post-time">${timeAgo(post.created)}</span>
        </div>
        <div class="forum-post-text">${esc(post.text)}</div>
        ${imagesHtml}
        <div class="forum-post-actions">
          <button class="forum-post-btn del" onclick="deleteForumPost('${topicId}','${post.id}')">Slett innlegg</button>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('forumBody').innerHTML = `
    <button class="forum-back-btn" onclick="backToForum()">← Tilbake til alle temaer</button>
    <div class="forum-thread-header">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:1.5rem;margin-bottom:6px">${esc(topic.icon)}</div>
          <div class="forum-thread-title">${esc(topic.title)}</div>
          <div class="forum-thread-sub">Startet av <strong style="color:#94a3b8">${esc(topic.author)}</strong> · ${timeAgo(topic.created)} · ${topic.posts.length} innlegg</div>
        </div>
        <button class="forum-topic-del" style="font-size:0.82rem;padding:7px 13px;opacity:1"
          onclick="deleteForumTopic('${topicId}')">🗑 Slett tema</button>
      </div>
    </div>
    <div class="forum-posts">${postsHtml}</div>
    <div class="forum-reply-form">
      <div class="forum-reply-row">
        <input class="forum-reply-name" id="replyAuthor" type="text"
          placeholder="Ditt navn…" value="${esc(forumLastAuthor)}" />
      </div>
      <textarea id="replyText" placeholder="Skriv et svar…"></textarea>
      <div class="img-upload-bar">
        <label class="img-upload-btn">
          📷 Legg ved bilder
          <input type="file" id="replyImages" accept="image/*" multiple
            onchange="previewImages('replyImages','replyPreview')" />
        </label>
        <span style="font-size:0.72rem;color:#475569">JPG, PNG, GIF — maks 10 MB per bilde</span>
      </div>
      <div class="img-preview-strip" id="replyPreview"></div>
      <div style="display:flex;justify-content:flex-end">
        <button class="forum-reply-submit" onclick="submitReply('${topicId}')">Send svar</button>
      </div>
    </div>`;
}

function openTopic(id) {
  forumView = id;
  renderForum();
  document.querySelector('.forum-section').scrollIntoView({ behavior:'smooth' });
}

function backToForum() {
  forumView = 'list';
  renderForum();
}

async function submitReply(topicId) {
  const author = document.getElementById('replyAuthor').value.trim();
  const text   = document.getElementById('replyText').value.trim();
  if (!author) { document.getElementById('replyAuthor').focus(); return; }
  if (!text)   { document.getElementById('replyText').focus();   return; }
  forumLastAuthor = author;
  const images = await collectImages('replyImages');
  const topic  = forumTopics.find(t => t.id === topicId);
  topic.posts.push({ id: cid(), author, text, images, created: new Date().toISOString() });
  logActivity('✉', `Svar i ${topic.title}`);
  renderForum();
  setTimeout(() => {
    const posts = document.querySelector('.forum-posts');
    if (posts) posts.lastElementChild?.scrollIntoView({ behavior:'smooth' });
  }, 50);
}

function deleteForumPost(topicId, postId) {
  const topic = forumTopics.find(t => t.id === topicId);
  if (!topic) return;
  if (topic.posts.length === 1) {
    deleteForumTopic(topicId);
  } else {
    if (!confirm('Slett dette innlegget?')) return;
    topic.posts = topic.posts.filter(p => p.id !== postId);
    renderForum();
  }
}

function deleteForumTopic(topicId) {
  if (!confirm('Slett hele temaet og alle innlegg?')) return;
  forumTopics = forumTopics.filter(t => t.id !== topicId);
  forumView = 'list';
  renderForum();
}

/* ── Nytt tema-modal ── */
function openNewTopic() {
  document.getElementById('newTopicModal').classList.add('open');
  document.getElementById('ntAuthor').value = forumLastAuthor;
  setTimeout(() => document.getElementById(forumLastAuthor ? 'ntTitle' : 'ntAuthor').focus(), 50);
}
function closeNewTopic() {
  document.getElementById('newTopicModal').classList.remove('open');
}
async function submitNewTopic() {
  const author = document.getElementById('ntAuthor').value.trim();
  const title  = document.getElementById('ntTitle').value.trim();
  const body2  = document.getElementById('ntBody').value.trim();
  if (!author) { document.getElementById('ntAuthor').focus(); return; }
  if (!title)  { document.getElementById('ntTitle').focus();  return; }
  if (!body2)  { document.getElementById('ntBody').focus();   return; }

  forumLastAuthor = author;
  const images = await collectImages('ntImages');
  const icons  = ['💬','🛠','💡','📦','🎨','🔧','🏗','✨','🪟','🚿','🛋','💰'];
  const newTopic = {
    id: cid(),
    icon: icons[Math.floor(Math.random() * icons.length)],
    title, author,
    created: new Date().toISOString(),
    posts: [{ id: cid(), author, text: body2, images, created: new Date().toISOString() }],
  };
  forumTopics.unshift(newTopic);
  logActivity('💬', `Nytt tema: ${title}`);
  document.getElementById('ntTitle').value = '';
  document.getElementById('ntBody').value  = '';
  document.getElementById('ntPreview').innerHTML = '';
  closeNewTopic();
  forumView = newTopic.id;
  renderForum();
}

document.getElementById('newTopicModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeNewTopic();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeNewTopic();
});

/* ════════════════════════════════════
   PDF EKSPORT
════════════════════════════════════ */
async function exportPDF() {
  const btn = document.getElementById('exportBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span>⏳</span> Genererer…';

  await new Promise(r => setTimeout(r, 60)); // la UI oppdatere seg

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210, ph = 297;
  const ml = 14, mr = 14, cw = pw - ml - mr;
  let y = 0;

  // ── Farger (lyst tema) ──
  const C = {
    bg:      [255, 255, 255],
    surface: [245, 247, 252],
    accent:  [99,  102, 241],
    text:    [15,  23,  42],
    muted:   [100, 116, 139],
    green:   [22,  163, 74],
    yellow:  [202, 138, 4],
    orange:  [234, 88,  12],
    red:     [220, 38,  38],
    border:  [226, 232, 240],
  };

  const COL_RGB = [
    [99,102,241],[245,158,11],[16,185,129],
    [239,68,68], [139,92,246],[236,72,153],[6,182,212]
  ];

  function setFill(rgb)   { doc.setFillColor(...rgb); }
  function setDraw(rgb)   { doc.setDrawColor(...rgb); }
  function setFont(size, style='normal', rgb=C.text) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...rgb);
  }
  function rect(x, yy, w, h, rgb, r=0) {
    setFill(rgb);
    doc.roundedRect(x, yy, w, h, r, r, 'F');
  }
  function line(x1,yy1,x2,yy2,rgb=[200,210,220],lw=0.3) {
    doc.setLineWidth(lw); setDraw(rgb);
    doc.line(x1,yy1,x2,yy2);
  }

  // ════════════════════ SIDE 1: FORSIDE ════════════════════
  rect(0, 0, pw, ph, C.bg);

  // Stor toppblokk
  rect(0, 0, pw, 80, C.surface);
  rect(0, 74, pw, 6, C.accent);

  // Ikon-sirkel
  rect(pw/2-18, 14, 36, 36, C.accent, 18);
  setFont(22, 'bold', [255,255,255]);
  doc.text('🏠', pw/2, 36, { align:'center' });

  setFont(22, 'bold', C.text);
  doc.text('Oppussingsplaner', pw/2, 60, { align:'center' });
  setFont(9, 'normal', C.muted);
  doc.text('Prosjektoversikt · Eksportert ' + new Date().toLocaleDateString('nb-NO', {day:'numeric',month:'long',year:'numeric'}), pw/2, 67, { align:'center' });

  // ── Statistikk-bokser ──
  const totalCards    = columns.reduce((s,c)=>s+c.cards.length,0);
  const totalEst      = budgetPosts.reduce((s,p)=>s+(p.est||0),0);
  const totalAct      = budgetPosts.reduce((s,p)=>s+(p.act||0),0);
  const pot           = parseFmt('potInput');
  const statsData = [
    { label:'Kolonner',  value: columns.length },
    { label:'Oppgaver',  value: totalCards },
    { label:'Budsjettposter', value: budgetPosts.length },
    { label:'Gjenstår',  value: (pot-totalEst).toLocaleString('nb-NO')+' kr' },
  ];
  const bw = (cw-9)/4, bh = 24, by = 88;
  statsData.forEach((s,i) => {
    const bx = ml + i*(bw+3);
    rect(bx, by, bw, bh, C.surface, 3);
    setFont(14, 'bold', C.accent);
    doc.text(String(s.value), bx+bw/2, by+10, { align:'center' });
    setFont(7, 'normal', C.muted);
    doc.text(s.label.toUpperCase(), bx+bw/2, by+17, { align:'center' });
  });

  // ── Kolonne-oversikt på forsiden ──
  y = 124;
  setFont(10, 'bold', C.text);
  doc.text('OPPGAVER PER FASE', ml, y);
  rect(ml, y+2, 24, 1, C.accent);
  y += 10;

  const colsPerRow = Math.min(columns.length, 2);
  const colBoxW = (cw - (colsPerRow-1)*4) / colsPerRow;
  columns.forEach((col, i) => {
    const bx = ml + (i % colsPerRow) * (colBoxW+4);
    const by2 = y + Math.floor(i / colsPerRow) * 42;
    const rgb = COL_RGB[i % COL_RGB.length];
    rect(bx, by2, colBoxW, 38, C.surface, 4);
    rect(bx, by2, 3, 38, rgb, 2);
    setFont(9, 'bold', C.text);
    doc.text(col.title, bx+8, by2+9);
    setFont(20, 'bold', rgb);
    doc.text(String(col.cards.length), bx+8, by2+26);
    setFont(7, 'normal', C.muted);
    doc.text('oppgaver', bx+8, by2+33);

    // Liste kortene (maks 4)
    const preview = col.cards.slice(0,4);
    preview.forEach((card, ci) => {
      setFont(6.5, 'normal', [148,163,184]);
      const txt = doc.splitTextToSize('• ' + card.title, colBoxW - 28);
      doc.text(txt[0], bx + colBoxW - 70, by2 + 9 + ci*6);
    });
    if (col.cards.length > 4) {
      setFont(6, 'normal', C.muted);
      doc.text(`+${col.cards.length-4} til`, bx+colBoxW-70, by2+33);
    }
  });

  y += Math.ceil(columns.length / colsPerRow) * 42 + 6;

  // Bunntekst forside
  setFont(7, 'normal', C.muted);
  doc.text('Konfidensielt dokument · Generert av Oppussingsplaner', pw/2, ph-8, { align:'center' });
  line(ml, ph-12, pw-mr, ph-12);

  // ════════════════════ SIDE 2: OPPGAVER ════════════════════
  doc.addPage();
  rect(0, 0, pw, ph, C.bg);

  // Sideheader
  rect(0, 0, pw, 22, C.surface);
  rect(0, 20, pw, 2, C.accent);
  setFont(11, 'bold', C.text);
  doc.text('Oppgaveliste', ml, 13);
  setFont(7, 'normal', C.muted);
  doc.text('Alle kort gruppert per fase', ml, 18);
  setFont(7, 'normal', C.muted);
  doc.text('Side 2', pw-mr, 13, { align:'right' });

  y = 30;

  const PRIORITY_LABEL = { lav:'Lav', middels:'Middels', høy:'Høy', kritisk:'Kritisk' };

  columns.forEach((col, ci) => {
    if (!col.cards.length) return;
    if (y > ph - 50) { doc.addPage(); rect(0,0,pw,ph,C.bg); y = 18; }

    const rgb = COL_RGB[ci % COL_RGB.length];

    // Gruppeheader
    rect(ml, y, cw, 8, C.surface, 2);
    rect(ml, y, 3, 8, rgb, 1);
    setFont(8, 'bold', C.text);
    doc.text(col.title.toUpperCase(), ml+7, y+5.5);
    setFont(7, 'normal', C.muted);
    doc.text(`${col.cards.length} oppgave${col.cards.length!==1?'r':''}`, pw-mr, y+5.5, {align:'right'});
    y += 11;

    // Kort-tabell
    const rows = col.cards.map(card => [
      card.title,
      card.assignee || '–',
      PRIORITY_LABEL[card.priority] || '–',
      card.start ? new Date(card.start).toLocaleDateString('nb-NO',{day:'numeric',month:'short'}) : '–',
      card.due   ? new Date(card.due  ).toLocaleDateString('nb-NO',{day:'numeric',month:'short'}) : '–',
    ]);

    doc.autoTable({
      startY: y,
      head: [['Tittel','Ansvarlig','Viktighet','Start','Frist']],
      body: rows,
      margin: { left: ml, right: mr },
      styles: {
        fontSize: 7.5, cellPadding: 3,
        fillColor: C.surface, textColor: C.text,
        lineColor: [226,232,240], lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [237,242,247], textColor: C.muted,
        fontSize: 6.5, fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249,250,252] },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
      },
      didDrawCell: (data) => {
        // Viktighet-farge
        if (data.section==='body' && data.column.index===2) {
          const v = data.cell.raw;
          const vc = {Lav:C.green,Middels:C.yellow,Høy:C.orange,Kritisk:C.red}[v];
          if (vc) { doc.setTextColor(...vc); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
            doc.text(v, data.cell.x+data.cell.padding('left'), data.cell.y+data.cell.height/2+2.5);
          }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  });

  // ════════════════════ SIDE 3: TIDSPLAN ════════════════════
  doc.addPage();
  rect(0, 0, pw, ph, C.bg);
  rect(0, 0, pw, 22, C.surface);
  rect(0, 20, pw, 2, C.accent);
  setFont(11, 'bold', C.text);
  doc.text('Tidsplan', ml, 13);

  // Dynamisk datoperiode basert på kortene
  const allDates = [];
  columns.forEach(col => col.cards.forEach(card => {
    if (card.start) allDates.push(new Date(card.start));
    if (card.due)   allDates.push(new Date(card.due));
  }));
  const GANTT_S = allDates.length ? new Date(Math.min(...allDates)) : new Date();
  const GANTT_E = allDates.length ? new Date(Math.max(...allDates)) : new Date(Date.now() + 90*86400000);
  // Legg til litt margin
  GANTT_S.setDate(GANTT_S.getDate() - 7);
  GANTT_E.setDate(GANTT_E.getDate() + 14);
  GANTT_S.setHours(0,0,0,0);
  GANTT_E.setHours(0,0,0,0);
  const ganttFmtOpts = { day: 'numeric', month: 'short', year: 'numeric' };

  setFont(7, 'normal', C.muted);
  doc.text(`${GANTT_S.toLocaleDateString('nb-NO', ganttFmtOpts)} – ${GANTT_E.toLocaleDateString('nb-NO', ganttFmtOpts)}`, ml, 18);
  setFont(7, 'normal', C.muted);
  doc.text('Side 3', pw-mr, 13, { align:'right' });

  y = 30;
  const GTOTAL   = Math.round((GANTT_E - GANTT_S)/86400000);
  const CHART_X  = ml + 52, CHART_W = cw - 52;

  // Måneder
  const months2 = [];
  let cm = new Date(GANTT_S);
  while (cm <= GANTT_E) {
    const mo=cm.getMonth(), yr=cm.getFullYear();
    const s2 = Math.max(0, Math.round((cm - GANTT_S)/86400000));
    const end2 = new Date(yr,mo+1,0); end2.setHours(0,0,0,0);
    const e2 = Math.min(GTOTAL, Math.round((end2-GANTT_S)/86400000)+1);
    const MONTH_LABELS_NO = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
    months2.push({ label: MONTH_LABELS_NO[mo] || '', s:s2, w:e2-s2 });
    cm = new Date(yr, mo+1, 1);
  }
  const mhh = 7;
  rect(CHART_X, y, CHART_W, mhh, C.surface);
  months2.forEach(m => {
    const mx = CHART_X + m.s/GTOTAL*CHART_W;
    const mw = m.w/GTOTAL*CHART_W;
    line(mx, y, mx, y+mhh, [200,210,220], 0.3);
    setFont(6, 'bold', C.muted);
    doc.text(m.label.toUpperCase(), mx + mw/2, y+4.5, { align:'center' });
  });
  y += mhh;

  // I dag-linje
  const todayOff2 = Math.round((new Date()-GANTT_S)/86400000);
  if (todayOff2>=0 && todayOff2<=GTOTAL) {
    const tx = CHART_X + todayOff2/GTOTAL*CHART_W;
    doc.setLineWidth(0.6); setDraw(C.accent);
    doc.line(tx, y, tx, y + columns.reduce((s,c)=>s+c.cards.length,0)*8 + columns.length*6 + 4);
  }

  // Rader
  columns.forEach((col, ci) => {
    if (!col.cards.length) return;
    const rgb = COL_RGB[ci % COL_RGB.length];

    // Gruppe-header rad
    rect(ml, y, cw, 5.5, [240,244,250]);
    rect(ml, y, 2, 5.5, rgb);
    setFont(6.5, 'bold', C.muted);
    doc.text(col.title.toUpperCase(), ml+5, y+3.8);
    y += 5.5;

    col.cards.forEach(card => {
      const rh = 7.5;
      // Etikett
      setFont(7, 'normal', [148,163,184]);
      const lbl = doc.splitTextToSize(card.title, 48);
      doc.text(lbl[0], ml+2, y+rh/2+1.5);

      // Bar
      if (card.start || card.due) {
        const s3 = card.start ? Math.max(0, Math.round((new Date(card.start)-GANTT_S)/86400000)) : todayOff2;
        const e3 = card.due   ? Math.min(GTOTAL, Math.round((new Date(card.due)-GANTT_S)/86400000)) : s3+7;
        const bx = CHART_X + s3/GTOTAL*CHART_W;
        const bw2= Math.max((e3-s3)/GTOTAL*CHART_W, 2);
        doc.setFillColor(...rgb);
        doc.roundedRect(bx, y+1.5, bw2, rh-3, 1, 1, 'F');
      } else {
        // Ingen dato
        setFont(6, 'normal', C.muted);
        doc.text('–', CHART_X+2, y+rh/2+1.5);
      }

      // Skillelinje
      line(ml, y+rh, pw-mr, y+rh, [226,232,240], 0.2);
      y += rh;
    });
  });

  // ════════════════════ SIDE 4: BUDSJETT ════════════════════
  doc.addPage();
  rect(0, 0, pw, ph, C.bg);
  rect(0, 0, pw, 22, C.surface);
  rect(0, 20, pw, 2, C.accent);
  setFont(11, 'bold', C.text);
  doc.text('Budsjett', ml, 13);
  setFont(7, 'normal', C.muted);
  doc.text('Oversikt og budsjettposter', ml, 18);
  setFont(7, 'normal', C.muted);
  doc.text('Side 4', pw-mr, 13, { align:'right' });

  y = 30;

  // Sammendragsbokser
  const summaryItems = [
    { label:'Total pott',      value: pot.toLocaleString('nb-NO')+' kr',        color:C.accent },
    { label:'Totalt estimert', value: totalEst.toLocaleString('nb-NO')+' kr',   color: totalEst>pot ? C.red : C.text },
    { label:'Totalt betalt',   value: totalAct.toLocaleString('nb-NO')+' kr',   color:C.green },
    { label:'Gjenstår',        value: (pot-totalEst).toLocaleString('nb-NO')+' kr', color: pot-totalEst<0 ? C.red : C.green },
  ];
  const sbw = (cw-6)/4;
  summaryItems.forEach((s,i) => {
    const sx = ml + i*(sbw+2);
    rect(sx, y, sbw, 20, C.surface, 3);
    setFont(10, 'bold', s.color);
    doc.text(s.value, sx+sbw/2, y+10, { align:'center' });
    setFont(6.5, 'normal', C.muted);
    doc.text(s.label.toUpperCase(), sx+sbw/2, y+16, { align:'center' });
  });
  y += 26;

  // Fremdriftslinje
  rect(ml, y, cw, 5, [226,232,240], 2);
  const estPct2 = pot>0 ? Math.min(totalEst/pot, 1) : 0;
  const actPct2 = pot>0 ? Math.min(totalAct/pot, 1) : 0;
  rect(ml, y, cw*estPct2, 5, [99,102,241,0.4]||C.accent, 2);
  doc.setFillColor(...(totalAct>pot ? C.red : C.green));
  doc.roundedRect(ml, y, cw*actPct2, 5, 2, 2, 'F');
  setFont(6, 'normal', C.muted);
  doc.text(`Estimert: ${Math.round(estPct2*100)}% av potten`, ml, y+10);
  doc.text(`Betalt: ${Math.round(actPct2*100)}% av potten`, ml+cw/2, y+10);
  y += 16;

  // Budsjett-tabell
  const CAT_LABELS = {
    material:'Material', håndverker:'Håndverker', inventar:'Inventar',
    elektro:'Elektro', diverse:'Diverse'
  };
  const STATUS_LABELS = { planlagt:'Planlagt', bestilt:'Bestilt', betalt:'Betalt' };

  const budgetRows = budgetPosts.map(p => {
    const diff = (p.act||0)-(p.est||0);
    return [
      p.name,
      CAT_LABELS[p.cat]||p.cat,
      STATUS_LABELS[p.status]||p.status,
      p.est ? p.est.toLocaleString('nb-NO')+' kr' : '–',
      p.act ? p.act.toLocaleString('nb-NO')+' kr' : '–',
      p.act ? (diff>0?'+':'')+diff.toLocaleString('nb-NO')+' kr' : '–',
    ];
  });

  // Totalrad
  const totDiff2 = totalAct - totalEst;
  budgetRows.push([
    'TOTALT', '', '',
    totalEst.toLocaleString('nb-NO')+' kr',
    totalAct.toLocaleString('nb-NO')+' kr',
    (totDiff2>0?'+':'')+totDiff2.toLocaleString('nb-NO')+' kr',
  ]);

  doc.autoTable({
    startY: y,
    head: [['Beskrivelse','Kategori','Status','Estimert','Faktisk','Avvik']],
    body: budgetRows,
    margin: { left: ml, right: mr },
    styles: {
      fontSize: 7.5, cellPadding: 3,
      fillColor: C.surface, textColor: C.text,
      lineColor: [226,232,240], lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [237,242,247], textColor: C.muted,
      fontSize: 6.5, fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [249,250,252] },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 28 },
      2: { cellWidth: 24 },
      3: { cellWidth: 30, halign:'right' },
      4: { cellWidth: 30, halign:'right' },
      5: { cellWidth: 28, halign:'right' },
    },
    didParseCell: (data) => {
      // Totalrad
      if (data.row.index === budgetRows.length-1) {
        data.cell.styles.fillColor = [226,232,240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = C.text;
      }
      // Avvik-farge
      if (data.section==='body' && data.column.index===5) {
        const v = data.cell.raw;
        if (v.startsWith('+')) data.cell.styles.textColor = C.red;
        else if (v.startsWith('-') && v!=='–') data.cell.styles.textColor = C.green;
      }
    },
  });

  // ════════════════════ SIDE 5: LEVERANDØRER ════════════════════
  doc.addPage();
  rect(0, 0, pw, ph, C.bg);
  rect(0, 0, pw, 22, C.surface);
  rect(0, 20, pw, 2, C.accent);
  setFont(11, 'bold', C.text);
  doc.text('Leverandører', ml, 13);
  setFont(7, 'normal', C.muted);
  doc.text(`${suppliers.length} leverandør${suppliers.length !== 1 ? 'er' : ''} registrert`, ml, 18);
  setFont(7, 'normal', C.muted);
  doc.text('Side 5', pw - mr, 13, { align: 'right' });
  y = 30;

  if (!suppliers.length) {
    setFont(9, 'normal', C.muted);
    doc.text('Ingen leverandører registrert ennå.', ml, y + 10);
  } else {
    const supRows = suppliers.map(s => [
      s.name || '–',
      s.field || '–',
      s.phone || '–',
      s.email || '–',
      '★'.repeat(s.rating || 0) + '☆'.repeat(5 - (s.rating || 0)),
      s.notes ? s.notes.slice(0, 60) : '–',
    ]);
    doc.autoTable({
      startY: y,
      head: [['Navn', 'Fagfelt', 'Telefon', 'E-post', 'Vurdering', 'Notater']],
      body: supRows,
      margin: { left: ml, right: mr },
      styles: {
        fontSize: 7.5, cellPadding: 3,
        fillColor: C.surface, textColor: C.text,
        lineColor: [226,232,240], lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [237,242,247], textColor: C.muted,
        fontSize: 6.5, fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249,250,252] },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 28 },
        2: { cellWidth: 26 },
        3: { cellWidth: 38 },
        4: { cellWidth: 22 },
        5: { cellWidth: 'auto' },
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ════════════════════ SIDE 6: BESLUTNINGER ════════════════════
  doc.addPage();
  rect(0, 0, pw, ph, C.bg);
  rect(0, 0, pw, 22, C.surface);
  rect(0, 20, pw, 2, C.accent);
  setFont(11, 'bold', C.text);
  doc.text('Beslutningslogg', ml, 13);
  setFont(7, 'normal', C.muted);
  doc.text(`${decisions.length} beslutning${decisions.length !== 1 ? 'er' : ''} registrert`, ml, 18);
  setFont(7, 'normal', C.muted);
  doc.text('Side 6', pw - mr, 13, { align: 'right' });
  y = 30;

  if (!decisions.length) {
    setFont(9, 'normal', C.muted);
    doc.text('Ingen beslutninger registrert ennå.', ml, y + 10);
  } else {
    const decRows = decisions.map(d => [
      d.date ? new Date(d.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '–',
      d.title || '–',
      d.category || '–',
      d.author || '–',
      d.description ? d.description.slice(0, 80) : '–',
    ]);
    doc.autoTable({
      startY: y,
      head: [['Dato', 'Tittel', 'Kategori', 'Ansvarlig', 'Beskrivelse']],
      body: decRows,
      margin: { left: ml, right: mr },
      styles: {
        fontSize: 7.5, cellPadding: 3,
        fillColor: C.surface, textColor: C.text,
        lineColor: [226,232,240], lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [237,242,247], textColor: C.muted,
        fontSize: 6.5, fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249,250,252] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 45 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: 'auto' },
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ════════════════════ SIDE 7: DISKUSJON ════════════════════
  if (forumTopics.length > 0) {
    doc.addPage();
    rect(0, 0, pw, ph, C.bg);
    rect(0, 0, pw, 22, C.surface);
    rect(0, 20, pw, 2, C.accent);
    setFont(11, 'bold', C.text);
    doc.text('Diskusjon', ml, 13);
    setFont(7, 'normal', C.muted);
    doc.text(`${forumTopics.length} tema${forumTopics.length !== 1 ? 'er' : ''}`, ml, 18);
    setFont(7, 'normal', C.muted);
    doc.text('Side 7', pw - mr, 13, { align: 'right' });
    y = 30;

    forumTopics.forEach((topic, ti) => {
      if (y > ph - 40) { doc.addPage(); rect(0, 0, pw, ph, C.bg); y = 18; }

      // Topic header
      rect(ml, y, cw, 8, C.surface, 2);
      rect(ml, y, 3, 8, C.accent, 1);
      setFont(8, 'bold', C.text);
      doc.text(topic.title || 'Uten tittel', ml + 7, y + 5.5);
      setFont(6.5, 'normal', C.muted);
      const topicDate = topic.date ? new Date(topic.date).toLocaleDateString('nb-NO') : '';
      doc.text(topicDate, pw - mr, y + 5.5, { align: 'right' });
      y += 10;

      if (topic.posts && topic.posts.length) {
        const postRows = topic.posts.slice(0, 10).map(p => [
          p.author || '–',
          p.date ? new Date(p.date).toLocaleDateString('nb-NO') : '–',
          p.text ? p.text.slice(0, 120) : '–',
        ]);
        doc.autoTable({
          startY: y,
          head: [['Forfatter', 'Dato', 'Innlegg']],
          body: postRows,
          margin: { left: ml, right: mr },
          styles: {
            fontSize: 7, cellPadding: 2.5,
            fillColor: C.surface, textColor: C.text,
            lineColor: [226,232,240], lineWidth: 0.2,
          },
          headStyles: {
            fillColor: [237,242,247], textColor: C.muted,
            fontSize: 6, fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [249,250,252] },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 22 },
            2: { cellWidth: 'auto' },
          },
        });
        y = doc.lastAutoTable.finalY + 10;
      } else {
        setFont(7, 'normal', C.muted);
        doc.text('Ingen innlegg ennå.', ml + 5, y + 4);
        y += 10;
      }
    });
  }

  // ════════════════════ FREMDRIFTSBILDER ════════════════════
  if (progressPhotos.length > 0) {
    doc.addPage();
    rect(0, 0, pw, ph, C.bg);
    rect(0, 0, pw, 22, C.surface);
    rect(0, 20, pw, 2, C.accent);
    setFont(11, 'bold', C.text);
    doc.text('Fremdriftsbilder', ml, 13);
    setFont(7, 'normal', C.muted);
    doc.text(`${progressPhotos.length} bilde${progressPhotos.length !== 1 ? 'r' : ''}`, ml, 18);
    y = 30;
    const imgW = (cw - 6) / 3;
    const imgH = imgW * 0.65;
    let imgCol = 0;
    for (const photo of progressPhotos) {
      if (!photo.url) continue;
      try {
        const ix = ml + imgCol * (imgW + 3);
        const iy = y;
        doc.addImage(photo.url, 'JPEG', ix, iy, imgW, imgH, '', 'FAST');
        if (photo.caption) {
          setFont(6, 'normal', C.muted);
          const cap = (photo.caption || '').slice(0, 32);
          doc.text(cap, ix + imgW / 2, iy + imgH + 4, { align: 'center' });
        }
        imgCol++;
        if (imgCol >= 3) {
          imgCol = 0;
          y += imgH + 12;
          if (y > ph - imgH - 20) { doc.addPage(); rect(0, 0, pw, ph, C.bg); y = 18; }
        }
      } catch(e) { /* hopp over bilder som ikke kan lastes */ }
    }
  }

  // ════════════════════ DOKUMENTARKIV ════════════════════
  if (archiveDocs.length > 0) {
    doc.addPage();
    rect(0, 0, pw, ph, C.bg);
    rect(0, 0, pw, 22, C.surface);
    rect(0, 20, pw, 2, C.accent);
    setFont(11, 'bold', C.text);
    doc.text('Dokumentarkiv', ml, 13);
    setFont(7, 'normal', C.muted);
    doc.text(`${archiveDocs.length} dokument${archiveDocs.length !== 1 ? 'er' : ''}`, ml, 18);
    y = 30;
    const docRows = archiveDocs.map(d => [
      d.name || '–',
      d.category || '–',
      (d.description || '').slice(0, 60) || '–',
      d.uploadedBy || '–',
      d.date ? new Date(d.date).toLocaleDateString('nb-NO') : '–',
    ]);
    doc.autoTable({
      startY: y,
      head: [['Filnavn', 'Kategori', 'Beskrivelse', 'Lastet opp av', 'Dato']],
      body: docRows,
      margin: { left: ml, right: mr },
      styles: { fontSize: 7.5, cellPadding: 3, fillColor: C.surface, textColor: C.text, lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: [237,242,247], textColor: C.muted, fontSize: 6.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249,250,252] },
      columnStyles: {
        0: { cellWidth: 50 }, 1: { cellWidth: 28 },
        2: { cellWidth: 'auto' }, 3: { cellWidth: 30 }, 4: { cellWidth: 22 },
      },
    });
  }

  // Bunntekst alle sider
  const pageCount = doc.getNumberOfPages();
  for (let i=1; i<=pageCount; i++) {
    doc.setPage(i);
    setFont(6.5, 'normal', C.muted);
    doc.text('Bundly · Konfidensielt', ml, ph-5);
    doc.text(`Side ${i} av ${pageCount}`, pw-mr, ph-5, { align:'right' });
    line(ml, ph-9, pw-mr, ph-9);
  }

  // Lagre
  const dato = new Date().toLocaleDateString('nb-NO').replace(/\./g,'-');
  doc.save(`oppussingsplaner_${dato}.pdf`);

  btn.classList.remove('loading');
  btn.innerHTML = '<span>📄</span> Eksporter PDF';
}
/* ════════════════════════════════════
   SUPABASE — lim inn URL og nøkkel fra
   supabase.com → Project Settings → API
════════════════════════════════════ */
const SUPABASE_URL  = 'https://vvxufkrfeaamycpkzmdr.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eHVma3JmZWFhbXljcGt6bWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDM3NjYsImV4cCI6MjA5MTQ3OTc2Nn0.fqyh1ml4Pi4el6RcEgPmovgIUXVcesXPk3TGL6XyUUI';
const DB_TABLE      = 'app_state';
const DB_ROW_ID     = 'oppussing';

const supabaseReady = SUPABASE_URL !== 'DIN_SUPABASE_URL' && SUPABASE_KEY !== 'DIN_ANON_KEY';
const db = supabaseReady ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Hvis brukeren er et teammedlem, bruk eierens user_id for data
const teamOwnerId    = localStorage.getItem('bundly_team_owner')       || null;
const teamOwnerEmail = localStorage.getItem('bundly_team_owner_email') || '';

/* Statusindikator */
function setDbStatus(status) {
  const el = document.getElementById('dbStatus');
  if (!el) return;
  const cfg = {
    ok:       { dot: '#4ade80', text: 'Synkronisert' },
    saving:   { dot: '#facc15', text: 'Lagrer…'      },
    error:    { dot: '#f87171', text: 'Frakoblet'    },
    offline:  { dot: '#64748b', text: 'Lokal modus'  },
    realtime: { dot: '#6366f1', text: 'Tilkoblet ✦'  },
  }[status] || { dot: '#64748b', text: status };
  el.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cfg.dot};margin-right:5px"></span>${cfg.text}`;
}

/* Debounce — unngår å skrive til DB for hvert tastetrykk */
let saveTimer = null;
function scheduleDbSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDb, 1200);
  setDbStatus('saving');
}

let suppressRealtimeUntil = 0;

async function saveToDb() {
  if (!supabaseReady || !currentUser) { saveToLocalStorage(); return; }
  const effectiveId = teamOwnerId || currentUser.id;
  const state = buildState();
  // Suspender realtime-anvendelse i 3 sek så vi ikke ekko'er over egen endring
  suppressRealtimeUntil = Date.now() + 3000;
  try {
    const { error } = await db.from(DB_TABLE).upsert({
      user_id: effectiveId,
      data: state,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    saveToLocalStorage();
    setDbStatus('ok');
  } catch(e) {
    console.warn('DB-lagring feilet, bruker localStorage:', e);
    saveToLocalStorage();
    setDbStatus('error');
  }
}

async function loadFromDb() {
  if (!supabaseReady || !currentUser) {
    setDbStatus('offline');
    return loadFromLocalStorage();
  }
  const effectiveId = teamOwnerId || currentUser.id;
  try {
    const { data, error } = await db.from(DB_TABLE).select('data').eq('user_id', effectiveId).single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data?.data) {
      applyState(data.data);
      saveToLocalStorage();
      return true;
    }
    return false;
  } catch(e) {
    console.warn('DB-lasting feilet, faller tilbake til localStorage:', e);
    setDbStatus('error');
    return loadFromLocalStorage();
  }
}

/* Sanntidssynkronisering — andre enheter ser endringer umiddelbart */
function startRealtime() {
  if (!supabaseReady || !currentUser) return;
  const effectiveId = teamOwnerId || currentUser.id;
  db.channel('app_state_changes')
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  DB_TABLE,
      filter: `user_id=eq.${effectiveId}`,
    }, payload => {
      if (!payload.new?.data) return;
      // Ignorer ekko fra våre egne nylige lagringer
      if (Date.now() < suppressRealtimeUntil) return;
      applyState(payload.new.data);
      // Re-render alle fanene
      render();             // Kanban-tavle
      renderGantt();        // Gantt
      renderBudget();       // Budsjett
      renderForum();        // Diskusjon
      renderSuppliers();    // Leverandører
      renderDecisions();    // Beslutninger
      renderProgressPhotos();// Fremdrift
      renderDocuments();    // Arkiv
      renderDashboard();    // Dashboard
      setDbStatus('realtime');
      setTimeout(() => setDbStatus('ok'), 2000);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') setDbStatus('ok');
    });
}

/* Bygg og les state-objekt */
function buildState() {
  return {
    _v:               4,
    _saved:           new Date().toISOString(),
    columns,
    budgetPosts,
    budgetPot:        parseFmt('potInput'),
    customCategories,
    forumTopics,
    forumLastAuthor,
    suppliers,
    decisions,
    progressPhotos,
    milestones,
    activityLog,
    archiveDocs,
  };
}
function applyState(s) {
  if (Array.isArray(s.columns)          && s.columns.length) columns           = s.columns;
  if (Array.isArray(s.budgetPosts))                           budgetPosts       = s.budgetPosts;
  if (Array.isArray(s.customCategories))                      customCategories  = s.customCategories;
  if (Array.isArray(s.forumTopics))                           forumTopics       = s.forumTopics;
  if (s.forumLastAuthor)                                      forumLastAuthor   = s.forumLastAuthor;
  if (Array.isArray(s.suppliers))                             suppliers         = s.suppliers;
  if (Array.isArray(s.decisions))                             decisions         = s.decisions;
  if (Array.isArray(s.progressPhotos))                        progressPhotos    = s.progressPhotos;
  if (Array.isArray(s.milestones))                            milestones        = s.milestones;
  if (Array.isArray(s.activityLog))                           activityLog       = s.activityLog;
  if (Array.isArray(s.archiveDocs))                           archiveDocs       = s.archiveDocs;
  if (s.budgetPot != null) {
    const el = document.getElementById('potInput');
    if (el) el.value = Number(s.budgetPot).toLocaleString('nb-NO').replace(/\u00a0/g, ' ');
  }
  // Ensure receipts/attachments arrays exist on existing posts/cards
  budgetPosts.forEach(p => { if (!p.receipts) p.receipts = []; });
  columns.forEach(col => col.cards.forEach(card => { if (!card.attachments) card.attachments = []; }));
  // Oppdater CHART_COLORS for egendefinerte kategorier
  customCategories.forEach(c => { CHART_COLORS[c.id] = c.color; });
}

/* ════════════════════════════════════
   EKSPORT / IMPORT AV DATA
════════════════════════════════════ */
function exportData() {
  const state = {
    _version:  1,
    _exported: new Date().toISOString(),
    columns,
    budgetPosts,
    budgetPot:      parseFmt('potInput'),
    forumTopics,
    forumLastAuthor,
  };
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const dato = new Date().toLocaleDateString('nb-NO').replace(/\./g,'-');
  a.href     = url;
  a.download = `oppussing_data_${dato}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const s = JSON.parse(e.target.result);
      if (!s.columns && !s.budgetPosts && !s.forumTopics)
        throw new Error('Ugyldig datafil');

      if (Array.isArray(s.columns)     && s.columns.length)  columns      = s.columns;
      if (Array.isArray(s.budgetPosts))                       budgetPosts  = s.budgetPosts;
      if (Array.isArray(s.forumTopics))                       forumTopics  = s.forumTopics;
      if (s.forumLastAuthor)                                  forumLastAuthor = s.forumLastAuthor;
      if (s.budgetPot != null) {
        const el = document.getElementById('potInput');
        if (el) el.value = Number(s.budgetPot).toLocaleString('nb-NO').replace(/\u00a0/g,' ');
      }
      render();
      renderBudget();
      renderForum();

      // Bekreftelse
      const btn = event.target.closest('.data-btn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Importert!';
      btn.style.color = '#4ade80';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2500);
    } catch(err) {
      alert('Kunne ikke lese filen. Sjekk at det er en gyldig datafil fra denne appen.');
    }
    event.target.value = ''; // reset slik at samme fil kan importeres igjen
  };
  reader.readAsText(file);
}

/* ════════════════════════════════════
   LOKAL LAGRING (buffer / fallback)
════════════════════════════════════ */
const STATE_KEY_BASE = 'oppussing_v1';
let appReady = false;

function getStateKey() {
  return currentUser ? `${STATE_KEY_BASE}_${currentUser.id}` : STATE_KEY_BASE;
}

function saveToLocalStorage() {
  try { localStorage.setItem(getStateKey(), JSON.stringify(buildState())); } catch(e) {}
}
function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(getStateKey());
    if (!raw) return false;
    applyState(JSON.parse(raw));
    return true;
  } catch(e) { return false; }
}

/* saveState — brukes av render-funksjoner */
function saveState() {
  if (!appReady) return;
  scheduleDbSave();
}

/* ════════════════════════════════════
   AUTH — Supabase innlogging
════════════════════════════════════ */
let currentUser = null;
let authTab     = 'login';

function switchAuthTab(tab) {
  authTab = tab;
  const isLogin = tab === 'login';
  const tl = document.getElementById('tabLogin');
  const ts = document.getElementById('tabSignup');
  tl.style.background = isLogin ? '#6366f1' : 'transparent';
  tl.style.color      = isLogin ? '#fff' : '#64748b';
  ts.style.background = !isLogin ? '#6366f1' : 'transparent';
  ts.style.color      = !isLogin ? '#fff' : '#64748b';
  document.getElementById('authBtn').textContent      = isLogin ? 'Logg inn' : 'Opprett konto';
  document.getElementById('authSubtitle').textContent = isLogin ? 'Logg inn for å fortsette' : 'Opprett din konto';
  document.getElementById('authPassword').placeholder = isLogin ? 'Passord' : 'Passord (min. 6 tegn)';
  clearAuthError();
}

function clearAuthError() {
  document.getElementById('authError').style.opacity = '0';
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent   = msg;
  el.style.opacity = '1';
}

function toggleAuthPw() {
  const input = document.getElementById('authPassword');
  const eye   = document.getElementById('authPwEye');
  if (input.type === 'password') { input.type = 'text';     eye.textContent = '🙈'; }
  else                           { input.type = 'password'; eye.textContent = '👁'; }
}

async function handleAuth() {
  if (!supabaseReady) { showAuthError('Database ikke konfigurert.'); return; }
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn      = document.getElementById('authBtn');
  if (!email || !password) { showAuthError('Fyll inn e-post og passord.'); return; }

  btn.textContent = 'Venter…';
  btn.disabled    = true;

  try {
    let result;
    if (authTab === 'login') {
      result = await db.auth.signInWithPassword({ email, password });
    } else {
      result = await db.auth.signUp({ email, password });
    }
    if (result.error) throw result.error;

    // Signup uten umiddelbar sesjon = e-postbekreftelse er påkrevd
    if (authTab === 'signup' && !result.data?.session) {
      showAuthError('✅ Sjekk e-posten din og klikk bekreftelseslenken!');
      btn.textContent = 'Opprett konto';
      btn.disabled    = false;
      return;
    }

    // Vellyket login — reset knapp, onAuthStateChange tar over
    btn.textContent = 'Logger inn…';
    // Sikkerhetsnett: reset etter 8 sek om noe henger
    setTimeout(() => {
      btn.textContent = authTab === 'login' ? 'Logg inn' : 'Opprett konto';
      btn.disabled    = false;
    }, 8000);
  } catch(err) {
    const msg = err.message?.includes('Invalid login credentials') ? 'Feil e-post eller passord.'
              : err.message?.includes('already registered')        ? 'E-posten er allerede registrert.'
              : err.message || 'Noe gikk galt, prøv igjen.';
    showAuthError(msg);
    btn.textContent = authTab === 'login' ? 'Logg inn' : 'Opprett konto';
    btn.disabled    = false;
  }
}

function toggleMobMenu() {
  const d = document.getElementById('mobDropdown');
  d.classList.toggle('open');
}
function closeMobMenu() {
  document.getElementById('mobDropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#mobDropdown') && !e.target.closest('#mobMenuBtn')) closeMobMenu();
});

async function signOut() {
  await db.auth?.signOut();
  window.location.href = '/';
}

/* ════════════════════════════════════
   TEAM-FANE
════════════════════════════════════ */
async function renderTeam() {
  const listEl    = document.getElementById('teamMembersList');
  const infoEl    = document.getElementById('teamLicenseInfo');
  const barEl     = document.getElementById('teamLicenseBar');
  const labelEl   = document.getElementById('teamLicenseLabel');
  const pctEl     = document.getElementById('teamLicensePct');
  const fillEl    = document.getElementById('teamLicenseFill');
  const inviteBtn = document.getElementById('teamInviteBtn');

  // Teammedlem-visning: hent fersk info fra server
  if (teamOwnerId) {
    infoEl.textContent     = 'Laster teaminfo…';
    barEl.style.display    = 'none';
    inviteBtn.style.display = 'none';

    try {
      const { data: { session } } = await db.auth.getSession();
      const memberRes  = await fetch('/.netlify/functions/check-membership', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const memberData = memberRes.ok ? await memberRes.json() : {};
      const ownerEmail = memberData.ownerEmail || localStorage.getItem('bundly_team_owner_email') || '';

      if (ownerEmail) {
        localStorage.setItem('bundly_team_owner_email', ownerEmail);
      }

      infoEl.textContent = ownerEmail
        ? `Du er med i ${ownerEmail} sitt team`
        : 'Du er med i dette teamet';

      listEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;padding:20px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-radius:12px">
          <div style="width:44px;height:44px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">👑</div>
          <div>
            <div style="font-size:0.92rem;color:#f1f5f9;font-weight:600">${ownerEmail || 'Teamets eier'}</div>
            <div style="font-size:0.78rem;color:#6366f1;margin-top:2px;font-weight:500">Teamets eier</div>
          </div>
        </div>
        <div style="margin-top:16px;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;font-size:0.83rem;color:#64748b">
          Du har tilgang til dette prosjektet via teamet. Kontakt eieren for å gjøre endringer i teamet.
        </div>`;
    } catch(e) {
      infoEl.textContent = 'Du er med i dette teamet';
      listEl.innerHTML = '';
    }
    return;
  }

  listEl.innerHTML = '<div style="color:#64748b;font-size:0.85rem;padding:20px 0">Laster…</div>';

  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;

    const res  = await fetch('/.netlify/functions/get-team', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kunne ikke hente team');

    const { members, plan, maxMembers, used } = data;
    const planName = { trial:'Trial', gratis:'Gratis', starter:'Starter', familie:'Familie', team:'Team' }[plan] || plan;

    // Lisensinfo
    if (maxMembers === 0) {
      infoEl.textContent = `${planName}-plan · Invitasjoner krever Familie- eller Team-plan`;
      barEl.style.display = 'none';
      inviteBtn.style.display = 'none';
    } else {
      infoEl.textContent = `${planName}-plan · ${used} av ${maxMembers} medlemsplasser brukt`;
      barEl.style.display = 'block';
      labelEl.textContent = `${used} / ${maxMembers} medlemmer`;
      pctEl.textContent   = `${Math.round(used / maxMembers * 100)}%`;
      fillEl.style.width  = `${Math.round(used / maxMembers * 100)}%`;
      fillEl.style.background = used >= maxMembers ? '#ef4444' : '#6366f1';
      inviteBtn.style.display = used >= maxMembers ? 'none' : 'inline-flex';
    }

    // Medlemsliste
    if (!members.length) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;color:#475569">
          <div style="font-size:2rem;margin-bottom:12px">👤</div>
          <div style="font-size:0.9rem">Ingen medlemmer ennå — inviter noen!</div>
        </div>`;
      return;
    }

    listEl.innerHTML = members.map(m => `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;color:#fff;flex-shrink:0">
          ${(m.member_email || '?').slice(0,2).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.88rem;color:#f1f5f9;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.member_email}</div>
          <div style="font-size:0.75rem;color:#64748b;margin-top:2px">
            ${m.status === 'active' ? '🟢 Aktiv' : '🟡 Invitasjon sendt'}
            · ${new Date(m.invited_at).toLocaleDateString('nb-NO')}
          </div>
        </div>
        <button onclick="removeMember('${m.id}')"
          style="background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2);border-radius:7px;padding:6px 12px;font-size:0.78rem;cursor:pointer;font-family:inherit;white-space:nowrap">
          🗑 Fjern
        </button>
      </div>`).join('');

  } catch(e) {
    listEl.innerHTML = `<div style="color:#f87171;font-size:0.85rem">${e.message}</div>`;
  }
}

async function removeMember(memberId) {
  if (!confirm('Fjerne dette medlemmet fra teamet?')) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch('/.netlify/functions/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) renderTeam();
    else {
      const d = await res.json();
      alert('Feil: ' + (d.error || 'Ukjent feil'));
    }
  } catch(e) { alert('Noe gikk galt'); }
}

/* ════════════════════════════════════
   INVITASJONSMODAL (bruker-til-bruker)
════════════════════════════════════ */
function openInviteModal() {
  document.getElementById('inviteEmailApp').value = '';
  const r = document.getElementById('inviteAppResult');
  r.style.display = 'none'; r.textContent = '';
  document.getElementById('inviteModalOverlay').classList.add('open');
}
function closeInviteModal() {
  document.getElementById('inviteModalOverlay').classList.remove('open');
}
document.getElementById('inviteModalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeInviteModal();
});

async function sendAppInvite() {
  const email = document.getElementById('inviteEmailApp').value.trim();
  const resultEl = document.getElementById('inviteAppResult');
  if (!email || !email.includes('@')) {
    resultEl.style.cssText = 'display:block;background:rgba(239,68,68,0.15);color:#f87171;padding:7px 10px;border-radius:6px;font-size:0.8rem';
    resultEl.textContent = 'Skriv inn en gyldig e-postadresse.';
    return;
  }
  const btn = document.getElementById('inviteAppBtn');
  btn.textContent = 'Sender…'; btn.disabled = true;

  try {
    const { data: { session } } = await db.auth.getSession();
    const token = session?.access_token;
    const res = await fetch('/.netlify/functions/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (res.ok) {
      resultEl.style.cssText = 'display:block;background:rgba(16,185,129,0.15);color:#4ade80;padding:7px 10px;border-radius:6px;font-size:0.8rem';
      resultEl.textContent = `✅ Invitasjon sendt til ${email}`;
      document.getElementById('inviteEmailApp').value = '';
    } else {
      resultEl.style.cssText = 'display:block;background:rgba(239,68,68,0.15);color:#f87171;padding:7px 10px;border-radius:6px;font-size:0.8rem';
      resultEl.textContent = 'Feil: ' + (data.error || 'Ukjent feil');
    }
  } catch(e) {
    resultEl.style.cssText = 'display:block;background:rgba(239,68,68,0.15);color:#f87171;padding:7px 10px;border-radius:6px;font-size:0.8rem';
    resultEl.textContent = 'Noe gikk galt: ' + e.message;
  }
  btn.textContent = 'Send invitasjon'; btn.disabled = false;
}

function getPendingPayment(userId) {
  try {
    const raw = sessionStorage.getItem(`bundly_paid_${userId}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - p.ts > 2 * 60 * 60 * 1000) { sessionStorage.removeItem(`bundly_paid_${userId}`); return null; }
    return p;
  } catch { return null; }
}

async function checkSubscription(userId) {
  try {
    const { data, error } = await db
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .single();

    if (error?.code === '42P01' || error?.message?.includes('does not exist')) return true;

    if (error?.code === 'PGRST116' || !data) {
      // Ingen rad i Supabase — sjekk om brukeren nettopp betalte (webhook treg)
      const pending = getPendingPayment(userId);
      if (pending) {
        if (pending.plan === 'starter') {
          const chosen = localStorage.getItem(`bundly_chosen_${userId}`);
          return chosen === 'oppussing';
        }
        return true; // familie/team
      }
      return false;
    }

    if (error) return true;

    const isActive = data.status === 'active' && data.plan !== 'gratis';
    if (!isActive) return false;

    // Starter-plan: sjekk at brukeren har valgt oppussing
    if (data.plan === 'starter') {
      const chosen = localStorage.getItem(`bundly_chosen_${userId}`);
      if (!chosen) return false;
      if (chosen !== 'oppussing') return false;
    }

    return true;
  } catch(e) {
    return true;
  }
}

async function choosePlan(plan, period) {
  const btn = event?.target;
  if (btn) { btn.textContent = 'Sender…'; btn.disabled = true; }
  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        plan, period,
        userId: currentUser?.id,
        email:  currentUser?.email,
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert('Noe gikk galt, prøv igjen.'); if(btn){btn.textContent='Prøv gratis i 7 dager';btn.disabled=false;} }
  } catch(err) {
    alert('Feil: ' + err.message);
    if(btn){btn.textContent='Prøv gratis i 7 dager';btn.disabled=false;}
  }
}
window.choosePlan = choosePlan;

// Supabase håndterer sesjon automatisk (localStorage)
async function handleSession(user) {
  if (!user) return;
  currentUser = user;
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = currentUser.email;

  // Teammedlemmer har alltid tilgang — de bruker eierens data og plan
  const isTeamMember = !!teamOwnerId;
  const hasPlan = isTeamMember || await checkSubscription(currentUser.id);

  document.getElementById('lockScreen').style.display = 'none';

  if (hasPlan) {
    document.getElementById('appContent').style.display = 'block';
    if (!appReady) startApp();
  } else {
    window.location.href = '/app/';
  }
}

if (supabaseReady) {
  // Sjekk eksisterende sesjon med én gang (unngår dobbel innlogging)
  db.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      handleSession(session.user);
    }
    // Lytt på videre endringer (innlogging, utlogging, token refresh)
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        window.location.href = '/app/';
      }
    });
  });
} else {
  // Ingen Supabase — åpne appen direkte
  document.getElementById('lockScreen').style.display = 'none';
  setTimeout(() => startApp(), 100);
}

async function startApp() {
  if (!supabaseReady) {
    document.getElementById('setupBanner').classList.add('show');
  }
  setDbStatus(supabaseReady ? 'saving' : 'offline');
  await loadFromDb();
  appReady = true;
  showTab('dashboard');
  render();
  renderBudget();
  renderForum();
  renderMilestoneColors();
  renderMilestoneList();
  startRealtime();
  requestNotificationPermission();
  checkDueDates();
  setInterval(checkDueDates, 30 * 60 * 1000);
}

/* ════════════════════════════════════
   DASHBOARD
════════════════════════════════════ */
function renderDashboard() {
  const grid = document.getElementById('dashboardGrid');
  if (!grid) return;

  const pot    = parseFmt('potInput');
  const totEst = budgetPosts.reduce((s,p)=>s+(p.est||0),0);
  const totAct = budgetPosts.reduce((s,p)=>s+(p.act||0),0);
  const rem    = pot - totEst;
  const remClass = rem < 0 ? 'red' : rem < pot * 0.1 ? 'yellow' : 'green';

  // Budget widget
  const budgetWidget = `
    <div class="dash-widget" onclick="showTab('budget')">
      <div class="dash-widget-header"><span>💰</span><h3>Budsjett</h3></div>
      <div class="dash-widget-body">
        <div class="dash-big-stats">
          <div class="dash-stat-card accent"><div class="dsv">${nok(pot)}</div><div class="dsl">Total pott</div></div>
          <div class="dash-stat-card"><div class="dsv${totEst>pot?' red':''}">${nok(totEst)}</div><div class="dsl">Estimert</div></div>
          <div class="dash-stat-card green"><div class="dsv">${nok(totAct)}</div><div class="dsl">Betalt</div></div>
          <div class="dash-stat-card ${remClass}"><div class="dsv">${rem<0?'−':''}${nok(Math.abs(rem))}</div><div class="dsl">Gjenstår</div></div>
        </div>
      </div>
    </div>`;

  // Kanban widget
  const totalCards = columns.reduce((s,c)=>s+c.cards.length,0);
  const maxCards = Math.max(...columns.map(c=>c.cards.length), 1);
  const kanbanWidget = `
    <div class="dash-widget" onclick="showTab('kanban')">
      <div class="dash-widget-header"><span>📋</span><h3>Tavle — ${totalCards} kort</h3></div>
      <div class="dash-widget-body">
        ${columns.map(col=>`
          <div class="dash-kanban-col">
            <div class="dash-kanban-label" title="${esc(col.title)}">${esc(col.title)}</div>
            <div class="dash-kanban-track">
              <div class="dash-kanban-fill" style="width:${Math.round(col.cards.length/maxCards*100)}%;background:${col.color}"></div>
            </div>
            <div class="dash-kanban-count">${col.cards.length}</div>
          </div>`).join('')}
      </div>
    </div>`;

  // Next due dates
  const today = new Date(); today.setHours(0,0,0,0);
  const lastColId = columns.length ? columns[columns.length-1].id : null;
  const cardsWithDue = [];
  columns.forEach(col => {
    if (col.id === lastColId) return; // skip last col (ferdig)
    col.cards.forEach(card => {
      if (card.due) cardsWithDue.push({ card, colTitle: col.title });
    });
  });
  cardsWithDue.sort((a,b)=>new Date(a.card.due)-new Date(b.card.due));
  const nextDue = cardsWithDue.slice(0,3);
  const dueWidget = `
    <div class="dash-widget" onclick="showTab('gantt')">
      <div class="dash-widget-header"><span>⏰</span><h3>Kommende frister</h3></div>
      <div class="dash-widget-body">
        ${nextDue.length ? nextDue.map(({card,colTitle})=>`
          <div class="dash-due-item">
            ${renderDue(card.due)}
            <div class="dash-due-title">${esc(card.title)}</div>
            <div class="dash-due-col">${esc(colTitle)}</div>
          </div>`).join('')
          : '<div style="color:#475569;font-size:0.83rem">Ingen frister satt ennå</div>'}
      </div>
    </div>`;

  // Activity feed
  const feed = activityLog.slice(0,8);
  const actWidget = `
    <div class="dash-widget">
      <div class="dash-widget-header"><span>📰</span><h3>Siste aktivitet</h3></div>
      <div class="dash-widget-body">
        ${feed.length ? feed.map(e=>`
          <div class="dash-activity-item">
            <div class="dash-activity-icon">${e.icon}</div>
            <div class="dash-activity-text">${esc(e.text)}</div>
            <div class="dash-activity-time">${timeAgo(e.date)}</div>
          </div>`).join('')
          : '<div style="color:#475569;font-size:0.83rem">Ingen aktivitet ennå</div>'}
      </div>
    </div>`;

  // Quick stats
  const qsWidget = `
    <div class="dash-widget">
      <div class="dash-widget-header"><span>📊</span><h3>Hurtigstatistikk</h3></div>
      <div class="dash-widget-body">
        <div class="dash-quick-stats">
          <div class="dash-qs"><div class="dqv">${budgetPosts.length}</div><div class="dql">Budsjettposter</div></div>
          <div class="dash-qs"><div class="dqv">${forumTopics.length}</div><div class="dql">Diskusjonstemaer</div></div>
          <div class="dash-qs"><div class="dqv">${suppliers.length}</div><div class="dql">Leverandører</div></div>
          <div class="dash-qs"><div class="dqv">${decisions.length}</div><div class="dql">Beslutninger</div></div>
          <div class="dash-qs"><div class="dqv">${progressPhotos.length}</div><div class="dql">Fremdriftsbilder</div></div>
          <div class="dash-qs"><div class="dqv">${columns.reduce((s,c)=>s+c.cards.length,0)}</div><div class="dql">Kanban-kort</div></div>
        </div>
      </div>
    </div>`;

  grid.innerHTML = budgetWidget + kanbanWidget + dueWidget + actWidget + qsWidget;
}

/* ════════════════════════════════════
   LEVERANDØRBOK
════════════════════════════════════ */
function setSupRating(val) {
  supRatingValue = val;
  const picker = document.getElementById('supStarPicker');
  if (!picker) return;
  picker.querySelectorAll('span').forEach((s, i) => {
    s.classList.toggle('on', i < val);
  });
}

function addSupplier() {
  const name = document.getElementById('supName').value.trim();
  if (!name) { document.getElementById('supName').focus(); return; }
  suppliers.push({
    id:      cid(),
    name,
    field:   document.getElementById('supField').value.trim(),
    phone:   document.getElementById('supPhone').value.trim(),
    email:   document.getElementById('supEmail').value.trim(),
    website: document.getElementById('supWebsite').value.trim(),
    rating:  supRatingValue,
    notes:   document.getElementById('supNotes').value.trim(),
  });
  logActivity('📋', `Ny leverandør: ${name}`);
  ['supName','supField','supPhone','supEmail','supWebsite','supNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  supRatingValue = 0;
  setSupRating(0);
  renderSuppliers();
}

function deleteSupplier(id) {
  if (!confirm('Slett leverandøren?')) return;
  suppliers = suppliers.filter(s => s.id !== id);
  renderSuppliers();
  saveState();
}

function editSupplier(id) {
  const s = suppliers.find(x => x.id === id);
  if (!s) return;
  document.getElementById('supName').value    = s.name;
  document.getElementById('supField').value   = s.field;
  document.getElementById('supPhone').value   = s.phone;
  document.getElementById('supEmail').value   = s.email;
  document.getElementById('supWebsite').value = s.website;
  document.getElementById('supNotes').value   = s.notes;
  supRatingValue = s.rating || 0;
  setSupRating(supRatingValue);
  suppliers = suppliers.filter(x => x.id !== id);
  renderSuppliers();
  document.getElementById('supName').focus();
}

function renderSuppliers() {
  const grid = document.getElementById('suppliersGrid');
  if (!grid) return;

  // Update field filter options
  const filter = document.getElementById('supplierFieldFilter');
  if (filter) {
    const fields = [...new Set(suppliers.map(s=>s.field).filter(Boolean))];
    const curVal = filter.value;
    filter.innerHTML = '<option value="">Alle fagfelt</option>' +
      fields.map(f => `<option value="${esc(f)}"${curVal===f?' selected':''}>${esc(f)}</option>`).join('');
  }

  const filterVal = filter ? filter.value : '';
  const vis = filterVal ? suppliers.filter(s=>s.field===filterVal) : suppliers;

  document.getElementById('supplierCount').textContent = `${suppliers.length} leverandør${suppliers.length!==1?'er':''}`;

  if (!vis.length) {
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:#475569;grid-column:1/-1">Ingen leverandører ennå</div>';
    return;
  }

  grid.innerHTML = vis.map(s => {
    const stars = [1,2,3,4,5].map(i => `<span class="supplier-star" style="color:${i<=s.rating?'#facc15':'#334155'}" onclick="event.stopPropagation();setSupRatingCard('${s.id}',${i})">${i<=s.rating?'★':'☆'}</span>`).join('');
    return `<div class="supplier-card">
      <div class="supplier-name">${esc(s.name)}</div>
      ${s.field ? `<div class="supplier-field-badge">${esc(s.field)}</div>` : ''}
      <div class="supplier-stars">${stars}</div>
      <div class="supplier-info">
        ${s.phone   ? `<span>📞 <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></span>` : ''}
        ${s.email   ? `<span>✉ <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></span>` : ''}
        ${s.website ? `<span>🌐 <a href="${esc(s.website)}" target="_blank">${esc(s.website.replace(/^https?:\/\//,''))}</a></span>` : ''}
      </div>
      ${s.notes ? `<div class="supplier-notes">${esc(s.notes)}</div>` : ''}
      <div class="supplier-actions">
        <button class="budget-row-btn" onclick="editSupplier('${s.id}')">Rediger</button>
        <button class="budget-row-btn del" onclick="deleteSupplier('${s.id}')">Slett</button>
      </div>
    </div>`;
  }).join('');

  saveState();
}

function setSupRatingCard(id, val) {
  const s = suppliers.find(x => x.id === id);
  if (s) { s.rating = val; renderSuppliers(); }
}

/* ════════════════════════════════════
   BESLUTNINGSLOGG
════════════════════════════════════ */
function addDecision() {
  const title = document.getElementById('decTitle').value.trim();
  if (!title) { document.getElementById('decTitle').focus(); return; }
  const tagsRaw = document.getElementById('decTags').value.trim();
  decisions.unshift({
    id:          cid(),
    date:        document.getElementById('decDate').value || new Date().toISOString().slice(0,10),
    title,
    description: document.getElementById('decDesc').value.trim(),
    author:      document.getElementById('decAuthor').value.trim(),
    category:    document.getElementById('decCat').value,
    tags:        tagsRaw ? tagsRaw.split(',').map(t=>t.trim()).filter(Boolean) : [],
  });
  logActivity('📝', `Beslutning: ${title}`);
  ['decTitle','decDesc','decTags'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  renderDecisions();
}

function deleteDecision(id) {
  decisions = decisions.filter(d => d.id !== id);
  renderDecisions();
  saveState();
}

function renderDecisions() {
  const timeline = document.getElementById('decisionsTimeline');
  if (!timeline) return;

  document.getElementById('decisionCount').textContent = `${decisions.length} beslutning${decisions.length!==1?'er':''}`;

  const filterVal = document.getElementById('decisionCatFilter')?.value || '';
  const vis = filterVal ? decisions.filter(d=>d.category===filterVal) : decisions;

  if (!vis.length) {
    timeline.innerHTML = '<div style="padding:40px;text-align:center;color:#475569">Ingen beslutninger ennå</div>';
    saveState();
    return;
  }

  timeline.innerHTML = vis.map((d, idx) => {
    const catStyle = DEC_CAT_COLORS[d.category] || DEC_CAT_COLORS.Annet;
    const tags = d.tags && d.tags.length
      ? `<div class="decision-tags">${d.tags.map(t=>`<span class="decision-tag">${esc(t)}</span>`).join('')}</div>` : '';
    const showLine = idx < vis.length - 1;
    return `<div class="decision-item">
      <div class="decision-date-col">${d.date ? new Date(d.date+'T12:00:00').toLocaleDateString('nb-NO',{day:'numeric',month:'short',year:'numeric'}) : '–'}</div>
      <div class="decision-connector">
        <div class="decision-dot" style="background:${catStyle.color}"></div>
        ${showLine ? '<div class="decision-line"></div>' : ''}
      </div>
      <div class="decision-content">
        <div class="decision-header">
          <div class="decision-title">${esc(d.title)}</div>
          <span class="decision-cat-badge" style="background:${catStyle.bg};color:${catStyle.color}">${esc(d.category)}</span>
          <button class="decision-del" onclick="deleteDecision('${d.id}')">🗑</button>
        </div>
        ${d.description ? `<div class="decision-desc">${esc(d.description)}</div>` : ''}
        ${d.author ? `<div class="decision-author">av ${esc(d.author)}</div>` : ''}
        ${tags}
      </div>
    </div>`;
  }).join('');

  saveState();
}

/* ════════════════════════════════════
   FREMDRIFTSBILDER
════════════════════════════════════ */
// Set default date for photo date picker
document.addEventListener('DOMContentLoaded', () => {
  const pd = document.getElementById('photoDate');
  if (pd) pd.value = new Date().toISOString().slice(0,10);
  const dd = document.getElementById('decDate');
  if (dd) dd.value = new Date().toISOString().slice(0,10);
});

document.getElementById('photoRoom')?.addEventListener('change', function() {
  const wrap = document.getElementById('customRoomWrap');
  if (wrap) wrap.style.display = this.value === '_custom' ? 'block' : 'none';
});

async function handlePhotoUpload() {
  const input = document.getElementById('photoFileInput');
  if (!input) return;

  let room = document.getElementById('photoRoom').value;
  if (room === '_custom') {
    room = document.getElementById('customRoomInput').value.trim() || 'Annet';
    // Add to options
    const sel = document.getElementById('photoRoom');
    const exists = [...sel.options].some(o => o.value === room);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = room; opt.textContent = room;
      sel.insertBefore(opt, sel.options[sel.options.length - 1]);
      sel.value = room;
    }
  }

  const caption = document.getElementById('photoCaption').value.trim();
  const date    = document.getElementById('photoDate').value || new Date().toISOString().slice(0,10);

  for (const file of input.files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const dataUrl = await readFileAsDataURL(file);
      let url = dataUrl;
      if (supabaseReady) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const ext  = file.type.split('/')[1] || 'jpg';
          const path = `fremgang/${room}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: file.type });
          if (!error) {
            const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            url = data.publicUrl;
          }
        } catch(e) { console.warn('Fremgang-opplasting feilet:', e); }
      }
      progressPhotos.push({ id: cid(), room, url, caption, date });
      logActivity('📸', `Bilde lastet opp: ${room}`);
    } catch(e) { console.warn(e); }
  }

  input.value = '';
  document.getElementById('photoCaption').value = '';
  renderProgressPhotos();
}

function deleteProgressPhoto(id) {
  progressPhotos = progressPhotos.filter(p => p.id !== id);
  renderProgressPhotos();
  saveState();
}

function renderProgressPhotos() {
  const section = document.getElementById('photoRoomsSection');
  if (!section) return;

  document.getElementById('photoCount').textContent = `${progressPhotos.length} bilde${progressPhotos.length!==1?'r':''}`;

  if (!progressPhotos.length) {
    section.innerHTML = '<div class="photo-empty">Ingen bilder ennå — last opp det første!</div>';
    saveState();
    return;
  }

  // Group by room
  const byRoom = {};
  progressPhotos.forEach(p => {
    if (!byRoom[p.room]) byRoom[p.room] = [];
    byRoom[p.room].push(p);
  });

  section.innerHTML = Object.entries(byRoom).map(([room, photos]) => `
    <div class="photo-room-group">
      <div class="photo-room-header">${esc(room)} (${photos.length})</div>
      <div class="photo-grid">
        ${photos.map(photo => `
          <div class="photo-item" onclick="openLightbox('${photo.url}')">
            <img src="${photo.url}" alt="${esc(photo.caption||room)}" loading="lazy" />
            <div class="photo-item-overlay">
              <div class="photo-item-caption">${esc(photo.caption||'')}${photo.date?'  '+photo.date:''}</div>
            </div>
            <button class="photo-item-del" onclick="event.stopPropagation();deleteProgressPhoto('${photo.id}')" title="Slett bilde">✕</button>
          </div>`).join('')}
      </div>
    </div>`).join('');

  saveState();
}

/* ════════════════════════════════════
   KVITTERING MODAL
════════════════════════════════════ */
function openReceiptModal(postId) {
  currentReceiptPostId = postId;
  const post = budgetPosts.find(p => p.id === postId);
  if (!post) return;
  document.getElementById('receiptModalTitle').textContent = `Kvitteringer — ${post.name}`;
  renderReceiptGrid(post);
  document.getElementById('receiptModalOverlay').classList.add('open');
}

function closeReceiptModal() {
  document.getElementById('receiptModalOverlay').classList.remove('open');
  currentReceiptPostId = null;
}

function renderReceiptGrid(post) {
  const grid = document.getElementById('receiptThumbGrid');
  if (!grid) return;
  const recs = post.receipts || [];
  grid.innerHTML = recs.map((url, i) => `
    <div class="receipt-thumb" onclick="openLightbox('${url}')">
      <img src="${url}" alt="Kvittering ${i+1}" />
      <button class="receipt-thumb-del" onclick="event.stopPropagation();deleteReceipt(${i})" title="Slett">✕</button>
    </div>`).join('');
}

function deleteReceipt(idx) {
  const post = budgetPosts.find(p => p.id === currentReceiptPostId);
  if (!post) return;
  if (!post.receipts) post.receipts = [];
  post.receipts.splice(idx, 1);
  renderReceiptGrid(post);
  renderBudget();
}

async function handleReceiptUpload() {
  const input = document.getElementById('receiptFileInput');
  if (!input || !currentReceiptPostId) return;
  const post = budgetPosts.find(p => p.id === currentReceiptPostId);
  if (!post) return;
  if (!post.receipts) post.receipts = [];

  for (const file of input.files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const dataUrl = await readFileAsDataURL(file);
      let url = dataUrl;
      if (supabaseReady) {
        try {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const ext  = file.type.split('/')[1] || 'jpg';
          const path = `receipts/${currentReceiptPostId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: file.type });
          if (!error) {
            const { data } = db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            url = data.publicUrl;
          }
        } catch(e) { console.warn('Kvittering-opplasting feilet:', e); }
      }
      post.receipts.push(url);
    } catch(e) { console.warn(e); }
  }
  input.value = '';
  renderReceiptGrid(post);
  renderBudget();
}

document.getElementById('receiptModalOverlay')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeReceiptModal();
});

/* ════════════════════════════════════
   PUSH-NOTIFIKASJONER
════════════════════════════════════ */
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    const banner = document.getElementById('notifBanner');
    if (banner) banner.classList.add('show');
  }
}

function enableNotifications() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(perm => {
    const banner = document.getElementById('notifBanner');
    if (banner) banner.classList.remove('show');
    if (perm === 'granted') checkDueDates();
  });
}

function checkDueDates() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const shown = JSON.parse(sessionStorage.getItem('notif_shown') || '[]');
  const lastColId = columns.length ? columns[columns.length-1].id : null;

  columns.forEach(col => {
    if (col.id === lastColId) return;
    col.cards.forEach(card => {
      if (!card.due) return;
      const due = new Date(card.due); due.setHours(0,0,0,0);
      if ((due.getTime() === today.getTime() || due.getTime() === tomorrow.getTime()) && !shown.includes(card.id)) {
        new Notification('Oppussing — Frist nærmer seg', {
          body: `${card.title} — frist ${new Date(card.due).toLocaleDateString('nb-NO',{day:'numeric',month:'long'})}`,
          icon: '🏠',
        });
        shown.push(card.id);
      }
    });
  });
  sessionStorage.setItem('notif_shown', JSON.stringify(shown));
}

/* ════════════════════════════════════
   GANTT MILESTONES
════════════════════════════════════ */
const MS_COLOR_OPTIONS = [
  { color: '#ef4444', label: 'Rød'    },
  { color: '#10b981', label: 'Grønn'  },
  { color: '#6366f1', label: 'Blå'    },
  { color: '#f59e0b', label: 'Oransje'},
  { color: '#8b5cf6', label: 'Lilla'  },
];

function renderMilestoneColors() {
  const el = document.getElementById('msColors');
  if (!el) return;
  el.innerHTML = MS_COLOR_OPTIONS.map(opt =>
    `<div class="milestone-color-btn${opt.color===selectedMsColor?' selected':''}"
       style="background:${opt.color}" title="${opt.label}"
       onclick="selectMsColor('${opt.color}')"></div>`
  ).join('');
}

function selectMsColor(color) {
  selectedMsColor = color;
  renderMilestoneColors();
}

function addMilestone() {
  const title = document.getElementById('msTitle').value.trim();
  const date  = document.getElementById('msDate').value;
  if (!title || !date) {
    if (!title) document.getElementById('msTitle').focus();
    else document.getElementById('msDate').focus();
    return;
  }
  milestones.push({ id: cid(), title, date, color: selectedMsColor });
  document.getElementById('msTitle').value = '';
  document.getElementById('msDate').value  = '';
  renderMilestoneList();
  renderGantt();
  saveState();
}

function deleteMilestone(id) {
  milestones = milestones.filter(m => m.id !== id);
  renderMilestoneList();
  renderGantt();
  saveState();
}

function renderMilestoneList() {
  const el = document.getElementById('milestoneList');
  if (!el) return;
  if (!milestones.length) { el.innerHTML = ''; return; }
  el.innerHTML = milestones.map(m => `
    <div class="milestone-row">
      <div class="milestone-row-dot" style="background:${m.color}"></div>
      <div class="milestone-row-title">${esc(m.title)}</div>
      <div class="milestone-row-date">${new Date(m.date+'T12:00:00').toLocaleDateString('nb-NO',{day:'numeric',month:'short',year:'numeric'})}</div>
      <button class="milestone-row-del" onclick="deleteMilestone('${m.id}')">🗑</button>
    </div>`).join('');
}
