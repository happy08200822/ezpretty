// js/main.js

// 🚨 請換成你剛剛重新部署的 GAS 網址 🚨
const GAS_URL = "https://script.google.com/macros/s/AKfycbzIKHpWcWj0bOhaQsx-OynY5FVVorMJvTNON5PBOywj1q-Nd5EylLCSl-zTlFW9Rb5U/exec";

let db = [];
let appState = { mode: 'undispatched', filter: 'new' }; // 乾淨的狀態，移除 source

// ==========================================
// 1. 初始化與資料處理
// ==========================================
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

function onDataLoaded(data) {
    db = data.map(d => {
        const srcText = d.B || ""; 

        // 🎨 判斷邊框顏色標籤 (對應 CSS)
        if (srcText.includes("公司件")) {
            d._source = "ads";      // 藍色
        } else if (srcText.includes("講座件")) {
            d._source = "seminar";  // 咖啡色
        } else if (srcText.includes("自開件")) {
            d._source = "self";     // 綠色
        } else {
            d._source = "other";    // 灰色
        }

        // 🗂️ 判斷大分類模式 (_mode)
        if (srcText.includes("自開件")) {
            d._mode = 'self';
        } else if (d.R && (d.R.includes('無效') || d.R.includes('拒絕'))) {
            d._mode = 'invalid';
        } else if (d.U) {
            d._mode = 'dispatched';
        } else {
            d._mode = 'undispatched';
        }
        
        // 🚦 判斷第三層狀態過濾 (_status)
        if (d._mode === 'undispatched' || d._mode === 'invalid') {
            const isL = (d.L && d.L.includes('✅'));
            const isM = (d.M && d.M.includes('✅'));
            const isN = (d.N && d.N.includes('✅'));

            if (!isL && !isN) {
                d._status = 'new'; 
            } else if (d.R && d.R.includes('找不到ID')) {
                d._status = 'noline'; 
            } else if (isL && !isM) {
                d._status = 'unread'; 
            } else {
                d._status = 'read'; 
            }
        }
        return d;
    });

    document.getElementById('loading-screen').style.display = 'none';
    updateGlobalCounts();
    setMode('undispatched');
}

// ==========================================
// 2. 畫面渲染與計數
// ==========================================
function updateGlobalCounts() {
    ['undispatched', 'dispatched', 'self', 'invalid'].forEach(m => 
        document.getElementById(`c1-${m}`).innerText = db.filter(d => d._mode === m).length
    );
}

function getL3Count(filterKey) {
    return db.filter(d => {
        if (d._mode !== appState.mode) return false;
        if (appState.mode === 'undispatched' || appState.mode === 'invalid') {
            return d._status === filterKey;
        } else {
            return d.U === filterKey;
        }
    }).length;
}

function renderFilters() { 
    const c = document.getElementById('filterRow'); 
    let pills = [];
    let styleClass = '';
    
    if(appState.mode === 'undispatched' || appState.mode === 'invalid') {
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
            if (d._status !== appState.filter) return false; 
        } else {
            if (d.U !== appState.filter) return false;
        }
        return true;
    });

    if (res.length === 0) { list.innerHTML = '<div style="text-align:center; padding:40px; color:#ccc;">📭 無資料</div>'; return; }
    list.innerHTML = res.map(d => createCardHTML(d)).join('');
}

// ==========================================
// 全新 CRM 視角卡片渲染與邏輯
// ==========================================
function createCardHTML(d) {
    // 1. 動態提示語 (Action Alert) 判斷邏輯
    let alertMsg = '';
    let alertClass = '';
    const isL = (d.L && d.L.includes('✅')), isM = (d.M && d.M.includes('✅'));
    const isN = (d.N && d.N.includes('✅')), isO = (d.O && d.O.includes('✅'));
    const isQ = (d.Q && d.Q.includes('✅'));

    if (d.R && (d.R.includes('無效') || d.R.includes('拒絕'))) {
        alertMsg = '💀 此單已標記為無效！'; alertClass = '';
    } else if (d.W === '已成交') {
        alertMsg = '🎉 恭喜！此單已成交！'; alertClass = 'success';
    } else if (d.U) {
        alertMsg = (d.B && d.B.includes('自開')) ? `💪 業務自開：${d.U}` : `🚀 已派單給：${d.U}`; alertClass = 'neutral';
    } else if (!isL && !isN && !isQ) {
        alertMsg = '🆕 新單請聯絡！'; alertClass = '';
    } else if (isL && !isM) {
        if (!isN) alertMsg = '📞 已加Line！請打電話！';
        else if (isN && !isO) alertMsg = '🔄 未接！繼續打！';
        else if (isN && isO && !isQ) alertMsg = '🚨 裝死不看！';
        else if (isQ) alertMsg = '📧 已寄信！繼續追殺！';
    } else if (isL && isM) {
        if (!isN && !isO) alertMsg = '📞 已讀沒回！請打電話！';
        else if (isN && !isO) alertMsg = '🔄 已讀未接！繼續打！';
        else if (isN && isO) alertMsg = '🔥 已讀已通！該派單了！';
    } else if (!isL && isN) {
        if (!isO) alertMsg = '🔄 未通！繼續打！';
        else alertMsg = '⚠️ 有通沒加Line！';
    } else {
        alertMsg = '🔔 請持續追蹤！'; alertClass = '';
    }

    // 2. 狀態膠囊
    const lights = [
        {l:'Line',v:isL},{l:'已讀',v:isM},{l:'電話',v:isN},{l:'撥通',v:isO},{l:'Email',v:isQ}
    ].map(x => `<div class="status-pill ${x.v ? 'on' : ''}">${x.l}</div>`).join('');

    // 3. 基礎資料處理
    const dateStr = d.K ? d.K.split(' ')[0] : '';
    const rLabel = d.R || '無進度';
    const borderClass = `c-${d._source}`;
    
    // 按鈕狀態處理
    const hasGroup = d.S && d.S.startsWith('http');
    const groupBtn = hasGroup 
        ? `<a href="${d.S}" target="_blank" class="action-btn btn-white">💬 群組</a>` 
        : `<div class="action-btn btn-disabled">🚫 無群組</div>`;
    const lineLink = (d.G && d.G.length > 1) ? `https://line.me/ti/p/~${d.G}` : `https://line.me/R/nv/addFriends`;

    return `
    <div class="card">
        <div class="card-top-bar ${borderClass}"></div>
        <div class="card-content">
            
            <div class="crm-header">
                <div class="crm-tags-left">
                    <span class="crm-id">#${d.AB}</span>
                    <span class="crm-tag">🏷️ ${d.C || '無產業'}</span>
                    <span class="crm-tag-r">${rLabel}</span> </div>
                <div class="crm-meta-right">
                    <span class="crm-source ${borderClass}">${d.B || '未知來源'}</span>
                    <span class="crm-date">${dateStr}</span>
                </div>
            </div>

            <div class="crm-title-row">
                <div class="crm-title">${d.D || ''} ${d.E || '無店名'}</div>
                <button class="btn-icon-small" onclick="copyText('${d.D || ''} ${d.E || ''}')">📄</button>
            </div>

            <div class="crm-alert ${alertClass}">
                ${alertMsg}
            </div>

            <div class="crm-info-box">
                <div class="info-row"><span class="info-icon">👤</span><span class="info-text">負責人: ${d.F || '老闆'}</span></div>
                <div class="info-row"><span class="info-icon">📞</span><span class="info-text">電話: ${d.H || '--'}</span> 
                    ${d.H ? `<button class="btn-icon-small" style="margin-left:8px; padding:2px 6px;" onclick="copyText('${d.H}')">📄</button>` : ''}
                </div>
                <div class="info-row"><span class="info-icon">🆔</span><span class="info-text">Line ID: ${d.G || '--'}</span></div>
                <div class="info-row"><span class="info-icon">📝</span><span class="info-text info-highlight">需求: ${d.J || '無'}</span></div>
            </div>

            <div class="status-dashboard">${lights}</div>

            <div class="crm-record">
                <div class="record-title">✍️ 紀錄</div>
                <div class="record-box">${d.P || '無'}</div>
            </div>

            <div class="action-grid">
                <a href="${lineLink}" class="action-btn btn-white">💬 加Line</a>
                <a href="tel:${d.H}" class="action-btn btn-white">📞 撥號</a>
                ${groupBtn}
                <a href="mailto:${d.I}" class="action-btn btn-white">✉️ Email</a>
                <button class="action-btn btn-orange" onclick="openEdit('${d.AB}', event)">✏️ 更新</button>
                <button class="action-btn btn-purple" onclick="openDispatch('${d.AB}', event)">🚀 派單</button>
            </div>
            
        </div>
    </div>`;
}

// 輔助函式：複製文字
window.copyText = function(text) {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
        alert(`已複製：${text}`);
    }).catch(err => {
        console.error('複製失敗', err);
    });
}

// ==========================================
// 3. 導航與互動控制
// ==========================================
window.setMode = function(mode) { 
    appState.mode = mode; 
    if(mode.includes('dispatch') === false) {
        appState.filter = 'new'; 
    } else {
        appState.filter = 'Kelvin';
    } 
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active')); 
    document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active'); 
    
    updateGlobalCounts(); 
    renderFilters(); 
    renderList(); 
}

window.setFilter = function(val) { 
    appState.filter = val; 
    renderFilters(); 
    renderList(); 
}

window.handleSearch = function() { renderList(); }

// ==========================================
// 4. 編輯與派單面板
// ==========================================
window.openEdit = function(key, e) {
    e.stopPropagation(); currentKey = key;
    const data = db.find(d => d.AB === key);
    ['L','M','N','O','Q'].forEach(f => {
        const el = document.getElementById('tog-'+f);
        if(data[f] && data[f].includes('✅')) el.classList.add('active'); else el.classList.remove('active');
    });
    document.getElementById('inp-R').value = data.R || '';
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
            init(); 
        })
        .finally(() => { btn.innerText = "儲存"; btn.disabled = false; });
}

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

// ==========================================
// 5. 群組與工具
// ==========================================
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

// ==========================================
// 6. 啟動程式
// ==========================================
init();
