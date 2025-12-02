// State
let shifts = []; 
let activeShiftId = null;
let timerInterval = null;

// KONFIGURATION
const MIN_REST_HOURS = 10; 
const SHIFT_GAP_THRESHOLD_HOURS = 6; 

// HIER DIE URL VOM "TÜRSTEHER" SCRIPT EINTRAGEN (aus Schritt 2):
const GATEKEEPER_URL = "https://script.google.com/macros/s/AKfycbxSjCl4LOJpjhl9MuDxOP9TLupsa7-HFHRJvL11PNxx_AXUhSYosOiLYko2XCpVHw/exec";

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners(); 
    loadData();           
    migrateData();
    updateUI();
    
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();
});

function initEventListeners() {
    document.getElementById('btn-work').addEventListener('click', () => startBlock('Arbeit'));
    document.getElementById('btn-wait').addEventListener('click', () => startBlock('Wartezeit'));
    document.getElementById('btn-break').addEventListener('click', () => startBlock('Pause'));
    document.getElementById('btn-transit').addEventListener('click', () => startBlock('Übergang'));
    document.getElementById('btn-drive').addEventListener('click', () => startBlock('Gastfahrt'));
    document.getElementById('btn-commute').addEventListener('click', () => startBlock('An-/Abreise'));
    
    document.getElementById('btn-stop').addEventListener('click', () => stopCurrentBlock());
    document.getElementById('history-header').addEventListener('click', toggleHistory);

    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-reset').addEventListener('click', clearData);
    
    document.getElementById('btn-cloud').addEventListener('click', openCloudModal);
    document.getElementById('btn-save-cloud').addEventListener('click', handleCloudUpload); // Neue Handler Funktion
    document.getElementById('btn-cancel-cloud').addEventListener('click', closeCloudModal);

    document.getElementById('btn-save-edit').addEventListener('click', saveEdit);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeModal);
}

function updateConnectionStatus() {
    const el = document.getElementById('status-indicator');
    if (navigator.onLine) {
        el.innerText = 'Online';
        el.className = 'online'; 
    } else {
        el.innerText = 'Offline';
        el.className = 'offline';
    }
}

// --- CLOUD LOGIC (GATEKEEPER PATTERN) ---

function openCloudModal() {
    // Wenn wir schon ein PW haben, füllen wir es vor
    const pw = localStorage.getItem('cloud_pw') || '';
    document.getElementById('cloud-pw').value = pw;
    document.getElementById('cloud-modal').classList.remove('hidden');
}

function closeCloudModal() {
    document.getElementById('cloud-modal').classList.add('hidden');
}

async function handleCloudUpload() {
    const pw = document.getElementById('cloud-pw').value.trim();
    if (!pw) {
        alert("Bitte Code eingeben.");
        return;
    }

    if (shifts.length === 0) {
        alert("Keine Daten zum Senden.");
        return;
    }

    const btn = document.getElementById('btn-save-cloud');
    const originalText = btn.innerText;
    btn.innerText = "Verbinde...";
    btn.disabled = true;

    try {
        // Schritt 1: Prüfen ob wir die geheime URL schon haben
        let realDbUrl = localStorage.getItem('real_db_url');

        // Wenn nicht (oder wenn wir Passwort geändert haben), fragen wir den Türsteher
        if (!realDbUrl || localStorage.getItem('cloud_pw') !== pw) {
            console.log("Frage Türsteher nach URL...");
            const gateResponse = await fetch(GATEKEEPER_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" }, // text/plain verhindert CORS Preflight Probleme bei GAS
                body: JSON.stringify({ password: pw })
            });
            
            const gateData = await gateResponse.json();
            
            if (gateData.result !== "success") {
                throw new Error("Falscher Code! Türsteher sagt Nein.");
            }
            
            realDbUrl = gateData.url;
            // Speichern für die Zukunft
            localStorage.setItem('real_db_url', realDbUrl);
            localStorage.setItem('cloud_pw', pw);
        }

        // Schritt 2: Daten an die geheime URL senden
        btn.innerText = "Sende Daten...";
        
        const payload = {
            password: pw, // DB Script prüft auch nochmal das PW
            data: shifts.map(s => {
                const start = new Date(s.start);
                const end = s.end ? new Date(s.end) : null;
                let duration = 0;
                if (end) duration = Math.floor((end - start) / 60000);
                return {
                    id: s.id,
                    type: s.type,
                    startDate: start.toLocaleDateString(),
                    startTime: start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    endTime: end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LAEUFT',
                    duration: duration
                };
            })
        };

        const dbResponse = await fetch(realDbUrl, {
            method: "POST",
            mode: "no-cors", // Fire and Forget für Sheet (schneller, weniger Fehleranfällig bei Redirects)
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });

        // Bei no-cors können wir den Status nicht lesen, wir gehen von Erfolg aus, wenn kein Netzwerkfehler kam.
        alert("Erfolg! Daten wurden übertragen.");
        closeCloudModal();

    } catch (e) {
        console.error(e);
        alert("Fehler: " + e.message);
        // Falls URL falsch war, löschen wir sie, damit beim nächsten Mal neu gefragt wird
        localStorage.removeItem('real_db_url');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// --- Core Logic (Rest unverändert) ---

function startBlock(type) {
    const now = new Date();
    if (activeShiftId) {
        const currentBlock = shifts.find(s => s.id === activeShiftId);
        if (currentBlock && currentBlock.type === type) return; 
        stopCurrentBlock(now);
    }
    const newBlock = { id: Date.now(), type: type, start: now.toISOString(), end: null };
    shifts.push(newBlock);
    activeShiftId = newBlock.id;
    saveData();
    updateUI();
}

function stopCurrentBlock(endTime = new Date()) {
    if (!activeShiftId) return;
    const blockIndex = shifts.findIndex(s => s.id === activeShiftId);
    if (blockIndex !== -1) shifts[blockIndex].end = endTime.toISOString();
    activeShiftId = null;
    saveData();
    updateUI();
}

window.editBlock = function(id) {
    const block = shifts.find(s => s.id === id);
    if (!block) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-type').value = block.type;
    document.getElementById('edit-start').value = formatTimeForInput(block.start);
    document.getElementById('edit-end').value = block.end ? formatTimeForInput(block.end) : '';
    document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const type = document.getElementById('edit-type').value;
    const startInput = document.getElementById('edit-start').value; 
    const endInput = document.getElementById('edit-end').value; 
    const blockIndex = shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    const baseDateStart = new Date(shifts[blockIndex].start);
    const newStart = setTime(baseDateStart, startInput);
    let newEnd = null;
    if (endInput) {
        newEnd = setTime(baseDateStart, endInput);
        if (newEnd < newStart) newEnd.setDate(newEnd.getDate() + 1); 
    }

    shifts[blockIndex].type = type;
    shifts[blockIndex].start = newStart.toISOString();
    shifts[blockIndex].end = newEnd ? newEnd.toISOString() : null;

    const prevBlock = shifts[blockIndex - 1];
    if (prevBlock && prevBlock.end) prevBlock.end = newStart.toISOString();

    const nextBlock = shifts[blockIndex + 1];
    if (newEnd && nextBlock) nextBlock.start = newEnd.toISOString();

    closeModal();
    saveData();
    updateUI();
}

// --- Helpers ---

function getDisplayLabel(type) {
    switch(type) {
        case 'Arbeit': return '🚂 Arbeit';
        case 'Wartezeit': return '⏳ Warten';
        case 'Pause': return '☕ Pause';
        case 'Übergang': return '<img src="transit-icon.png" class="custom-icon" alt=""> Übergang';
        case 'Gastfahrt': return '🚕 Gastfahrt';
        case 'An-/Abreise': return '🚗 An-/Abreise';
        default: return type;
    }
}

function migrateData() {
    let changed = false;
    shifts.forEach(s => {
        if (s.type === 'Transfer') { s.type = 'Gastfahrt'; changed = true; }
    });
    if (changed) saveData();
}

function setTime(dateObj, timeString) {
    const [hours, minutes] = timeString.split(':');
    const newDate = new Date(dateObj);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    return newDate;
}

function formatTimeForInput(isoString) {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

function toggleHistory() {
    const list = document.getElementById('log-list');
    const btn = document.getElementById('toggle-history-btn');
    list.classList.toggle('collapsed');
    btn.innerText = list.classList.contains('collapsed') ? '▲' : '▼';
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('cloud-modal').classList.add('hidden');
}

function loadData() {
    const stored = localStorage.getItem('shift_data');
    if (stored) {
        try {
            shifts = JSON.parse(stored);
            const active = shifts.find(s => s.end === null);
            if (active) activeShiftId = active.id;
        } catch (e) { shifts = []; }
    }
}

function saveData() { localStorage.setItem('shift_data', JSON.stringify(shifts)); }

function clearData() {
    if(confirm("Alles löschen?")) { shifts = []; activeShiftId = null; saveData(); updateUI(); }
}

function exportData() {
    let csvContent = "data:text/csv;charset=utf-8,ID,Typ,StartDatum,StartZeit,EndeZeit,Dauer(Min)\n";
    shifts.forEach(e => {
        const start = new Date(e.start);
        const end = e.end ? new Date(e.end) : null;
        const dateStr = start.toLocaleDateString();
        const startTime = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const endTime = end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LAEUFT';
        let duration = 0;
        if (end) duration = Math.floor((end - start) / 60000);
        csvContent += `${e.id},${e.type},"${dateStr}",${startTime},${endTime},${duration}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "zugprotokoll_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const rawCSV = csvContent.replace("data:text/csv;charset=utf-8,", "");
    navigator.clipboard.writeText(rawCSV).then(() => { alert("Backup erstellt!"); });
}

function updateUI() {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    const displayShifts = [...shifts].reverse();

    displayShifts.forEach((block, index) => {
        const start = new Date(block.start);
        const end = block.end ? new Date(block.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'läuft...';
        const startTime = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        let durationStr = "";
        let isNegative = false;
        if (block.end) {
            const diff = new Date(block.end) - new Date(block.start);
            if (diff < 0) isNegative = true;
            const totalMins = Math.floor(Math.abs(diff) / 60000);
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            durationStr = `${isNegative ? '-' : ''}${hrs}h ${mins}m`;
        }

        const div = document.createElement('div');
        const safeType = block.type.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g, '');
        div.className = `log-entry type-${safeType}`;
        if (isNegative) div.style.borderRight = "5px solid red"; 

        const displayLabel = getDisplayLabel(block.type);

        div.innerHTML = `
            <div><strong>${displayLabel}</strong><br><span class="log-time">${startTime} - ${end}</span></div>
            <div style="text-align:right">
                <span class="log-details" style="${isNegative ? 'color:red' : ''}">${durationStr}</span><br>
                <button class="btn-edit" onclick="editBlock(${block.id})">✏️</button>
            </div>
        `;
        list.appendChild(div);

        const prevTimeBlock = displayShifts[index + 1];
        if (prevTimeBlock && prevTimeBlock.end) {
            const prevEnd = new Date(prevTimeBlock.end);
            const gapMs = start - prevEnd;
            const gapHours = gapMs / (1000 * 60 * 60);
            const prevDurationMs = prevEnd - new Date(prevTimeBlock.start);
            const prevDurationHours = prevDurationMs / (1000 * 60 * 60);
            const isLongRestBlock = (prevTimeBlock.type === 'Übergang' || prevTimeBlock.type === 'Pause') && prevDurationHours > SHIFT_GAP_THRESHOLD_HOURS;
            if (gapHours > SHIFT_GAP_THRESHOLD_HOURS || isLongRestBlock) {
                const separator = document.createElement('div');
                separator.className = 'shift-divider';
                const dateStr = start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                separator.innerHTML = `⏸️ SCHICHTWECHSEL (${dateStr})`;
                list.appendChild(separator);
            }
        }
    });

    const active = shifts.find(s => s.id === activeShiftId);
    if (active) {
        document.getElementById('active-type').innerHTML = getDisplayLabel(active.type);
        document.querySelector('.btn-stop').style.display = 'block';
    } else {
        document.getElementById('active-type').innerText = "Bereit für Abfahrt";
        document.getElementById('active-timer').innerText = "00:00:00";
        document.querySelector('.btn-stop').style.display = 'none';
    }
}

function updateTimerDisplay() {
    if (!activeShiftId) return;
    const block = shifts.find(s => s.id === activeShiftId);
    if (!block) return;
    const now = new Date();
    const start = new Date(block.start);
    const diff = now - start;
    const hh = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    const timerEl = document.getElementById('active-timer');
    const typeEl = document.getElementById('active-type');
    timerEl.innerText = `${hh}:${mm}:${ss}`;

    if (block.type === 'Übergang') {
        const hoursPassed = diff / (1000 * 60 * 60);
        if (hoursPassed >= MIN_REST_HOURS) {
            timerEl.classList.add('timer-success');
            typeEl.classList.add('status-success');
            if (!typeEl.innerHTML.includes('✅')) typeEl.innerHTML += ' ✅ (Ruhezeit OK)';
        } else {
            timerEl.classList.remove('timer-success');
            typeEl.classList.remove('status-success');
        }
    } else {
        timerEl.classList.remove('timer-success');
        typeEl.classList.remove('status-success');
    }
}
