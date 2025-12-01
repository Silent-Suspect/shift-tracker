// State
let shifts = []; 
let activeShiftId = null;
let timerInterval = null;

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateUI();
    
    // Timer Ticker
    timerInterval = setInterval(updateTimerDisplay, 1000);
    
    // Status Check
    window.addEventListener('online', () => document.getElementById('status-indicator').innerText = 'Online');
    window.addEventListener('offline', () => document.getElementById('status-indicator').innerText = 'Offline');
    if(navigator.onLine) document.getElementById('status-indicator').innerText = 'Online';
});

// --- Core Logic ---

function startBlock(type) {
    const now = new Date();
    
    // NEU: Prellschutz / Dubletten-Check
    // Wenn bereits ein Block läuft UND es derselbe Typ ist -> Ignorieren
    if (activeShiftId) {
        const currentBlock = shifts.find(s => s.id === activeShiftId);
        if (currentBlock && currentBlock.type === type) {
            console.log("Aktivität läuft bereits: " + type);
            // Optional: Kurzes visuelles Feedback (z.B. Button wackeln lassen), 
            // aber für jetzt reicht ignorieren.
            return; 
        }
        // Wenn anderer Typ, beende den aktuellen
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
    saveData();
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

// --- Resize Edit Logic ---

function editBlock(id) {
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

    // 1. Update aktueller Block
    shifts[blockIndex].type = type;
    shifts[blockIndex].start = newStart.toISOString();
    shifts[blockIndex].end = newEnd ? newEnd.toISOString() : null;

    // 2. Rückwärts-Anpassung
    const prevBlock = shifts[blockIndex - 1];
    if (prevBlock && prevBlock.end) {
        prevBlock.end = newStart.toISOString();
    }

    // 3. Vorwärts-Anpassung
    const nextBlock = shifts[blockIndex + 1];
    if (newEnd && nextBlock) {
        nextBlock.start = newEnd.toISOString();
    }

    closeModal();
    saveData();
    updateUI();
}

// --- Helpers ---

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
    const btn = document.getElementById('toggle-history');
    list.classList.toggle('collapsed');
    btn.innerText = list.classList.contains('collapsed') ? '▲' : '▼';
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function loadData() {
    const stored = localStorage.getItem('shift_data');
    if (stored) {
        shifts = JSON.parse(stored);
        const active = shifts.find(s => s.end === null);
        if (active) activeShiftId = active.id;
    }
}

function saveData() {
    localStorage.setItem('shift_data', JSON.stringify(shifts));
}

function clearData() {
    if(confirm("ACHTUNG: Alle lokalen Daten werden gelöscht! Hast du ein Backup gemacht?")) {
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
    link.setAttribute("download", "zeitprotokoll_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const rawCSV = csvContent.replace("data:text/csv;charset=utf-8,", "");
    navigator.clipboard.writeText(rawCSV).then(() => {
        alert("Backup erstellt! Daten auch in Zwischenablage kopiert.");
    }, () => {
        alert("Backup Download gestartet.");
    });
}

// --- UI Rendering ---

function updateUI() {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    const displayShifts = [...shifts].reverse();

    displayShifts.forEach(block => {
        const start = new Date(block.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const end = block.end ? new Date(block.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'läuft...';
        
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
        div.className = `log-entry type-${block.type.replace(/\s/g, '')}`;
        if (isNegative) div.style.borderRight = "5px solid red"; 

        div.innerHTML = `
            <div>
                <strong>${block.type}</strong><br>
                <span class="log-time">${start} - ${end}</span>
            </div>
            <div style="text-align:right">
                <span class="log-details" style="${isNegative ? 'color:red' : ''}">${durationStr}</span><br>
                <button class="btn-edit" onclick="editBlock(${block.id})">✏️</button>
            </div>
        `;
        list.appendChild(div);
    });

    const active = shifts.find(s => s.id === activeShiftId);
    if (active) {
        document.getElementById('active-type').innerText = active.type;
        document.querySelector('.btn-stop').style.display = 'block';
    } else {
        document.getElementById('active-type').innerText = "Bereit";
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
    document.getElementById('active-timer').innerText = `${hh}:${mm}:${ss}`;
}
