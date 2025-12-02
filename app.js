// State
let shifts = []; 
let activeShiftId = null;
let timerInterval = null;

// KONFIGURATION
const MIN_REST_HOURS = 10; 
const SHIFT_GAP_THRESHOLD_HOURS = 6; 

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners(); // NEU: Event Handler registrieren
    loadData();           // Daten laden & State wiederherstellen
    migrateData();
    updateUI();
    
    // Timer sofort starten, damit keine Sekunde vergeht bis zum ersten Update
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
    
    // Connection Status
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();
});

// --- Modern Event Handling ---
function initEventListeners() {
    // Haupt-Buttons
    document.getElementById('btn-work').addEventListener('click', () => startBlock('Arbeit'));
    document.getElementById('btn-wait').addEventListener('click', () => startBlock('Wartezeit'));
    document.getElementById('btn-break').addEventListener('click', () => startBlock('Pause'));
    document.getElementById('btn-transit').addEventListener('click', () => startBlock('Übergang'));
    document.getElementById('btn-drive').addEventListener('click', () => startBlock('Gastfahrt'));
    document.getElementById('btn-commute').addEventListener('click', () => startBlock('An-/Abreise'));
    
    // Stop Button
    document.getElementById('btn-stop').addEventListener('click', () => stopCurrentBlock());

    // History Toggle
    document.getElementById('history-header').addEventListener('click', toggleHistory);

    // Tools
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-reset').addEventListener('click', clearData);

    // Modal Actions
    document.getElementById('btn-save-edit').addEventListener('click', saveEdit);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeModal);
}

function updateConnectionStatus() {
    const el = document.getElementById('status-indicator');
    if (navigator.onLine) {
        el.innerText = 'Online';
        el.className = 'online'; // Klasse für Styling nutzen (optional in CSS)
    } else {
        el.innerText = 'Offline';
        el.className = 'offline';
    }
}

// --- Core Logic ---

function startBlock(type) {
    const now = new Date();
    
    // Prellschutz
    if (activeShiftId) {
        const currentBlock = shifts.find(s => s.id === activeShiftId);
        if (currentBlock && currentBlock.type === type) return; 
        stopCurrentBlock(now);
    }

    const newBlock = {
        id: Date.now(),
        type: type,
        start: now.toISOString(),
        end: null
    };

    shifts.push(newBlock);
    activeShiftId = newBlock.id;
    saveData(); // WICHTIG: Sofortiges Speichern verhindert Datenverlust bei Crash
    updateUI();
}

function stopCurrentBlock(endTime = new Date()) {
    if (!activeShiftId) return;

    const blockIndex = shifts.findIndex(s => s.id === activeShiftId);
    if (blockIndex !== -1) {
        shifts[blockIndex].end = endTime.toISOString();
    }
    
    activeShiftId = null;
    saveData();
    updateUI();
}

// --- Edit Logic ---

// Wrapper für onclick im generierten HTML (muss global verfügbar sein)
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
        if (newEnd < newStart) {
            newEnd.setDate(newEnd.getDate() + 1); 
        }
    }

    // 1. Update
    shifts[blockIndex].type = type;
    shifts[blockIndex].start = newStart.toISOString();
    shifts[blockIndex].end = newEnd ? newEnd.toISOString() : null;

    // 2. Ripple Back
    const prevBlock = shifts[blockIndex - 1];
    if (prevBlock && prevBlock.end) {
        prevBlock.end = newStart.toISOString();
    }

    // 3. Ripple Forward
    const nextBlock = shifts[blockIndex + 1];
    if (newEnd && nextBlock) {
        nextBlock.start = newEnd.toISOString();
    }

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
        if (s.type === 'Transfer') {
            s.type = 'Gastfahrt';
            changed = true;
        }
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
    const btn = document.getElementById('toggle-history-btn'); // ID angepasst
    list.classList.toggle('collapsed');
    btn.innerText = list.classList.contains('collapsed') ? '▲' : '▼';
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function loadData() {
    const stored = localStorage.getItem('shift_data');
    if (stored) {
        try {
            shifts = JSON.parse(stored);
            // Wiederherstellung des aktiven Blocks
            const active = shifts.find(s => s.end === null);
            if (active) {
                activeShiftId = active.id;
                console.log("Aktive Schicht wiederhergestellt:", active.type);
            }
        } catch (e) {
            console.error("Datenfehler:", e);
            shifts = [];
        }
    }
}

function saveData() {
    localStorage.setItem('shift_data', JSON.stringify(shifts));
}

function clearData() {
    if(confirm("Alles löschen?")) {
        shifts = [];
        activeShiftId = null;
        saveData();
        updateUI();
    }
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
    navigator.clipboard.writeText(rawCSV).then(() => {
        alert("Backup erstellt!");
    });
}

// --- UI Rendering ---

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

        // Edit Button bleibt hier inline, weil er dynamisch generiert wird.
        // Das ist ok, da window.editBlock oben definiert wurde.
        div.innerHTML = `
            <div>
                <strong>${displayLabel}</strong><br>
                <span class="log-time">${startTime} - ${end}</span>
            </div>
            <div style="text-align:right">
                <span class="log-details" style="${isNegative ? 'color:red' : ''}">${durationStr}</span><br>
                <button class="btn-edit" onclick="editBlock(${block.id})">✏️</button>
            </div>
        `;
        list.appendChild(div);

        // --- SCHICHT-TRENNER ---
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
            if (!typeEl.innerHTML.includes('✅')) {
                typeEl.innerHTML += ' ✅ (Ruhezeit OK)';
            }
        } else {
            timerEl.classList.remove('timer-success');
            typeEl.classList.remove('status-success');
        }
    } else {
        timerEl.classList.remove('timer-success');
        typeEl.classList.remove('status-success');
    }
}
