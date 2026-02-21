// js/main.js

// 🚨 請換成你剛剛重新部署的 GAS 網址 🚨
const GAS_URL = "https://script.google.com/macros/s/你的網址/exec";

let db = [];
let appState = { mode: 'undispatched', source: 'ads', filter: 'new' };
let currentKey = null;
let selectedAgent = '';

// 初始化：透過 fetch 呼叫 GAS
function init() {
    document.getElementById('loading-screen').style.display = 'flex';
    
    fetch(GAS_URL + "?action=getClientData")
        .then(res => res.json())
        .then(data => {
            onDataLoaded(data);
        })
        .catch(err => {
            alert("載入資料失敗，請檢查網路或 GAS 網址");
            console.error(err);
            document.getElementById('loading-screen').style.display = 'none';
        });
}

// 資料處理
function onDataLoaded(data) {
    db = data.map(d => {
        d._source = (d.B && d.B.includes('廣告')) ? 'ads' : 'seminar';
        
        if (d.R && (d.R.includes('無效') || d.R.includes('拒絕'))) d._mode = 'invalid';
        else if (d.B && (d.B.includes('自開') || d.B.includes('陌生'))) d._mode = 'self';
        else if (d.U) d._mode = 'dispatched';
        else d._mode = 'undispatched';
        
        if (d._mode === 'undispatched' || d._mode === 'invalid') {
            if(d.L === '❌' && d.N === '❌') d._status = 'new';
            else if(d.R === '找不到ID') d._status = 'noline';
            else if(d.M === '❌') d._status = 'unread';
            else d._status = 'read';
        }
        return d;
    });

    document.getElementById('loading-screen').style.display = 'none';
    updateGlobalCounts();
    setMode('undispatched');
}

function updateGlobalCounts() {
    ['undispatched', 'dispatched', 'self', 'invalid'].forEach(m => 
        document.getElementById(`c1-${m}`).innerText = db.filter(d => d._mode === m).length
    );
    if (appState.mode === 'undispatched' || appState.mode === 'invalid') {
        document.getElementById('c2-ads').innerText = db.filter(d => d._mode === appState.mode && d._source === 'ads').length;
        document.getElementById('c2-seminar').innerText = db.filter(d => d._mode === appState.mode && d._source === 'seminar').length;
    }
}

function getL3Count(filterKey) {
    return db.filter(d => {
        if (d._mode !== appState.mode) return false;
        if (appState.mode === 'undispatched' || appState.mode === 'invalid') {
            if (d._source !== appState.source) return false;
            return d._status === filterKey;
        } else {
            return d.U === filterKey;
        }
    }).length;
}

function renderList() {
    const list = document.getElementById('list');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    const res = db.filter(d => {
        if (searchTerm) {
            const str = ((d.E||'') + (d.H||'') + (d.F||'') + (d.AB||'')).toLowerCase();
            return str.includes(searchTerm);
        }
        if (d._mode !== appState.mode) return false;
        if (appState.mode === 'undispatched' || appState.mode === 'invalid') {
            if (d._source !== appState.source) return false;
            // 暫時不過濾狀態以顯示更多資料
            // if (d._status !== appState.filter) return false; 
        } else {
            if (d.U !== appState.filter) return false;
        }
        return true;
    });

    if (res.length === 0) { list.innerHTML = '<div style="text-align:center; padding:40px; color:#ccc;">📭 無資料</div>'; return; }
    list.innerHTML = res.map(d => createCardHTML(d)).join('');
}

function createCardHTML(d) {
    const lights = [
        {l:'Line',v:d.L},{l:'已讀',v:d.M},{l:'電話',v:d.N},{l:'撥通',v:d.O},{l:'Email',v:d.Q}
    ].map(x=>`<div class="status-item"><div class="status-dot ${x.v==='✅'?'on':'off'}"></div><span class="status-label">${x.l}</span></div>`).join('');
    
    const hasGroup = d.S && d.S.startsWith('http');
    const groupBtn = hasGroup 
        ? `<a href="${d.S}" target="_blank" class="btn-action btn-success" style="display:block;margin-bottom:8px;text-decoration:none;">💬 開啟群組</a>` 
        : `<button class="btn-action btn-disabled" style="display:block;width:100%;margin-bottom:8px;">🚫 尚未建群</button>`;
    
    const borderClass = d._source === 'ads' ? 'c-ads' : (d._source === 'seminar' ? 'c-seminar' : 'c-self');
    const emailRow = d.I ? `<div class="contact-grid"><div><div class="contact-label">Email</div><div class="contact-val" style="font-size:12px">${d.I}</div></div><a href="mailto:${d.I}" class="btn-action">✉️</a></div>` : '';
    const idDisplay = d.AA ? `<div style="font-size:10px;color:#bbb;text-align:center;margin-top:-6px;margin-bottom:12px;font-family:monospace;">ID: ${d.AA.substring(0,8)}...</div>` : '';
    const dispatchInfo = d.U ? `<div class="dispatch-info"><div style="font-weight:bold; margin-bottom:4px; color:#333;">👤 ${d.U}</div><div>狀態：${d.W||'-'} ｜ 結果：${d.Y||'-'}</div><div class="meta-time">${d.V ? `<div>👉 指派: ${d.V}</div>` : ''}${d.X ? `<div>⏰ 展示: ${d.X}</div>` : ''}</div></div>` : '';

    return `
    <div class="card" onclick="toggleCard(this)">
        <div class="card-border ${borderClass}"></div>
        <div class="card-summary">
            <div class="row-header"><div class="shop-name">${d.E}</div><div class="key-badge">#${d.AB} ｜ ${d.K ? d.K.split(' ')[0] : ''}</div></div>
            <div class="row-tags"><span class="tag">${d.D||'無'}</span><span class="tag">${d.C||'無'}</span><div class="boss-name">👤 ${d.F||'老闆'}</div></div>
            <div class="status-dashboard" style="padding:5px 20px;">${lights}</div>
            <div class="progress-bar ${d.W==='已成交'?'finished':''}"><div class="progress-icon"></div><span>${d.R||'無進度'}</span></div>
        </div>
        <div class="card-details">
            <div class="contact-grid"><div>電話</div><a href="tel:${d.H}" class="btn-action">📞 ${d.H}</a></div>
            <div class="contact-grid"><div>Line ID</div><button class="btn-action" onclick="handleAddLine('${d.G}', '${d.H}', event)">💬 加好友</button></div>
            ${emailRow}
            <hr style="border:0;border-top:1px dashed #eee;margin:10px 0;">
            ${groupBtn} ${idDisplay}
            <div class="log-area">${d.P||'無紀錄'}</div>
            ${dispatchInfo}
            <div class="footer-actions">
                <button class="btn-action" onclick="openEdit('${d.AB}', event)">✏️ 編輯</button>
                <button class="btn-action btn-primary" onclick="openDispatch('${d.AB}', event)">🚀 派單</button>
            </div>
        </div>
    </div>`;
}

// 導航控制
window.setMode = function(mode) { 
    appState.mode = mode; 
    if(mode.includes('dispatch')===false) {appState.filter='new'; appState.source='ads';} else {appState.filter='Kelvin';} 
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active')); 
    document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active'); 
    const r2=document.getElementById('sourceRow'); 
    if(mode==='undispatched'||mode==='invalid'){r2.classList.add('show'); document.querySelectorAll('.source-tab').forEach(t=>t.classList.remove('active')); document.querySelector('.source-tab[data-src="ads"]').classList.add('active');} 
    else{r2.classList.remove('show');} 
    updateGlobalCounts(); renderFilters(); renderList(); 
}

window.setSource = function(src) { 
    appState.source=src; appState.filter='new'; 
    document.querySelectorAll('.source-tab').forEach(b=>b.classList.remove('active')); 
    document.querySelector(`.source-tab[data-src="${src}"]`).classList.add('active'); 
    updateGlobalCounts(); renderFilters(); renderList(); 
}

window.setFilter = function(val) { appState.filter=val; renderFilters(); renderList(); }

function renderFilters() { 
    const c = document.getElementById('filterRow'); 
    let pills = [];
    let styleClass = '';
    if(appState.mode==='undispatched'||appState.mode==='invalid') {
        styleClass = (k) => k==='new'?'pill-new':(k==='unread'?'pill-unread':(k==='read'?'pill-read':''));
        pills = [{k:'new', t:'🔴 新單'}, {k:'unread', t:'🟡 未讀'}, {k:'read', t:'🟢 已讀'}, {k:'noline', t:'⚪ 沒Line'}];
    } else {
        styleClass = () => 'pill-agent';
        pills = [{k:'Kelvin', t:'👤 Kelvin'}, {k:'David', t:'👤 David'}, {k:'WT', t:'👤 WT'}];
    }
    c.innerHTML = pills.map(p => {
        const count = getL3Count(p.k);
        return `<div class="filter-pill ${styleClass(p.k)} ${appState.filter===p.k?'active':''}" onclick="setFilter('${p.k}')">${p.t} <span class="count-badge-L3">${count}</span></div>`;
    }).join('');
}

window.toggleCard = function(el) { el.classList.toggle('open'); }
window.handleSearch = function() { renderList(); }

// 編輯面板
window.openEdit = function(key, e) {
    e.stopPropagation(); currentKey = key;
    const data = db.find(d => d.AB === key);
    ['L','M','N','O','Q'].forEach(f => {
        const el = document.getElementById('tog-'+f);
        if(data[f]==='✅') el.classList.add('active'); else el.classList.remove('active');
    });
    document.getElementById('inp-R').value = data.R;
    document.getElementById('history-P').innerText = data.P || '';
    document.getElementById('inp-P-new').value = ''; 
    openSheet('sheet-edit');
}
window.toggleBtn = function(el) { el.classList.toggle('active'); }
window.insertTime = function() {
    const now = new Date();
    const str = `[ ${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()} WT ]：`;
    document.getElementById('inp-P-new').value = str;
}

window.saveEdit = function() {
    if(!currentKey) return;
    const btn = document.getElementById('btn-save-edit');
    btn.innerText = "儲存中..."; btn.disabled = true;

    const updates = {
        L: document.getElementById('tog-L').classList.contains('active') ? '✅' : '❌',
        M: document.getElementById('tog-M').classList.contains('active') ? '✅' : '❌',
        N: document.getElementById('tog-N').classList.contains('active') ? '✅' : '❌',
        O: document.getElementById('tog-O').classList.contains('active') ? '✅' : '❌',
        Q: document.getElementById('tog-Q').classList.contains('active') ? '✅' : '❌',
        R: document.getElementById('inp-R').value,
        P: (document.getElementById('history-P').innerText + '\n' + document.getElementById('inp-P-new').value).trim()
    };
    
    // 透過 fetch 傳送更新請求
    const params = new URLSearchParams({
        action: 'updateClientData',
        key: currentKey,
        data: JSON.stringify(updates)
    });

    fetch(GAS_URL, { method: "POST", body: params })
        .then(res => res.text())
        .then(res => {
            alert('✅ 儲存成功');
            closeAllSheets();
            init(); // 重新載入資料
        })
        .finally(() => { btn.innerText = "儲存"; btn.disabled = false; });
}

// 派單面板
window.openDispatch = function(key, e) {
    e.stopPropagation(); currentKey = key;
    const data = db.find(d => d.AB === key);
    document.querySelectorAll('.agent-item').forEach(el => el.classList.remove('selected'));
    if(data.U) selectedAgent = data.U;
    document.getElementById('inp-T').value = data.T || '';
    document.getElementById('inp-S').value = data.S || '';
    document.getElementById('inp-AA').value = data.AA || '';
    openSheet('sheet-dispatch');
}
window.selectAgent = function(el, name) {
    document.querySelectorAll('.agent-item').forEach(el => el.classList.remove('selected'));
    el.classList.add('selected');
    selectedAgent = name;
}
window.confirmDispatch = function() {
    if(!currentKey) return;
    const btn = document.getElementById('btn-save-dispatch');
    btn.innerText = "派單中..."; btn.disabled = true;

    const now = new Date();
    const timeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    const updates = {
        U: selectedAgent,
        V: timeStr,
        T: document.getElementById('inp-T').value,
        S: document.getElementById('inp-S').value,
        AA: document.getElementById('inp-AA').value
    };

    const params = new URLSearchParams({
        action: 'updateClientData',
        key: currentKey,
        data: JSON.stringify(updates)
    });

    fetch(GAS_URL, { method: "POST", body: params })
        .then(res => res.text())
        .then(res => {
            alert('🚀 派單成功');
            closeAllSheets();
            init();
        })
        .finally(() => { btn.innerText = "確認派單"; btn.disabled = false; });
}

// 群組選擇器
window.openGroupSelector = function() {
    document.getElementById('group-list-container').innerText = "連線載入中...";
    openSheet('modal-group');
    document.getElementById('modal-group').classList.add('show');
    
    fetch(GAS_URL + "?action=getRecentGroups")
        .then(res => res.json())
        .then(groups => {
            const list = document.getElementById('group-list-container');
            list.innerHTML = groups.map(g => `
                <div class="group-item" onclick="selectGroup('${g.id}')">
                    <div><div style="font-weight:bold;">${g.name}</div><div class="group-id-sub">${g.time}</div></div>
                    <div style="color:#007bff;">選擇</div>
                </div>`).join('');
        });
}
window.selectGroup = function(id) { document.getElementById('inp-AA').value = id; closeGroupSelector(); }
window.closeGroupSelector = function() { document.getElementById('modal-group').classList.remove('show'); }

// 工具函式
function openSheet(id) { document.getElementById('overlay').classList.add('show'); document.getElementById(id).classList.add('show'); }
window.closeAllSheets = function() { document.getElementById('overlay').classList.remove('show'); document.querySelectorAll('.bottom-sheet').forEach(el => el.classList.remove('show')); closeGroupSelector(); }
window.handleAddLine = function(lineId, phone, e) {
    e.stopPropagation();
    if (lineId && lineId.length > 1) { window.location.href = `https://line.me/ti/p/~${lineId}`; } 
    else if (phone) {
        navigator.clipboard.writeText(phone).then(() => {
            if(confirm(`已複製電話：${phone}\n\n對方未提供 ID，是否開啟 LINE 搜尋頁面？`)) { window.location.href = 'https://line.me/R/nv/addFriends'; }
        });
    } else { alert('無 LINE ID 也無電話'); }
}

// 啟動
init();
