import { state, CONFIG } from './state.js';
import { getDisplayLabel } from './utils.js';
import { initiateEditBlock } from './logic.js'; 

export function updateUI() {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    const displayShifts = [...state.shifts].reverse();

    displayShifts.forEach((block, index) => {
        const start = new Date(block.start);
        const end = block.end ? new Date(block.end) : null;
        
        const startTime = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        let endTimeDisplay = 'läuft...';
        
        let durationStr = "";
        let isNegative = false;
        
        if (end) {
            // Check auf Tageswechsel
            const isNextDay = end.getDate() !== start.getDate() || end.getMonth() !== start.getMonth();
            const timeStr = end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            // Wenn neuer Tag, hängen wir (+1) an
            endTimeDisplay = isNextDay ? `${timeStr} (+1)` : timeStr;

            const diff = end - start;
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
            <div><strong>${displayLabel}</strong><br><span class="log-time">${startTime} - ${endTimeDisplay}</span></div>
            <div style="text-align:right">
                <span class="log-details" style="${isNegative ? 'color:red' : ''}">${durationStr}</span><br>
                <button class="btn-edit" data-id="${block.id}">✏️</button>
            </div>
        `;
        
        div.querySelector('.btn-edit').addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            initiateEditBlock(id);
        });

        list.appendChild(div);

        // SCHICHT-TRENNER
        const prevTimeBlock = displayShifts[index + 1];
        if (prevTimeBlock && prevTimeBlock.end) {
            const prevEnd = new Date(prevTimeBlock.end);
            const gapMs = start - prevEnd;
            const gapHours = gapMs / (1000 * 60 * 60);
            const prevDurationMs = prevEnd - new Date(prevTimeBlock.start);
            const prevDurationHours = prevDurationMs / (1000 * 60 * 60);
            const isLongRestBlock = (prevTimeBlock.type === 'Übergang' || prevTimeBlock.type === 'Pause') && prevDurationHours > CONFIG.SHIFT_GAP_THRESHOLD_HOURS;
            
            if (gapHours > CONFIG.SHIFT_GAP_THRESHOLD_HOURS || isLongRestBlock) {
                const separator = document.createElement('div');
                separator.className = 'shift-divider';
                const dateStr = start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                separator.innerHTML = `⏸️ SCHICHTWECHSEL (${dateStr})`;
                list.appendChild(separator);
            }
        }
    });

    const active = state.shifts.find(s => s.id === state.activeShiftId);
    if (active) {
        document.getElementById('active-type').innerHTML = getDisplayLabel(active.type);
        document.querySelector('.btn-stop').style.display = 'block';
    } else {
        document.getElementById('active-type').innerText = "Bereit für Abfahrt";
        document.getElementById('active-timer').innerText = "00:00:00";
        document.querySelector('.btn-stop').style.display = 'none';
    }
}

export function updateTimerDisplay() {
    if (!state.activeShiftId) return;
    const block = state.shifts.find(s => s.id === state.activeShiftId);
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
        if (hoursPassed >= CONFIG.MIN_REST_HOURS) {
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

export function toggleHistory() {
    const list = document.getElementById('log-list');
    const btn = document.getElementById('toggle-history-btn');
    list.classList.toggle('collapsed');
    btn.innerText = list.classList.contains('collapsed') ? '▲' : '▼';
}

export function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('cloud-modal').classList.add('hidden');
    resetDeleteUI();
}

export function resetDeleteUI() {
    document.getElementById('edit-form').classList.remove('hidden');
    document.getElementById('delete-options').classList.add('hidden');
    document.getElementById('btn-gap-merge').classList.add('hidden');
    const splitUi = document.getElementById('split-ui');
    if (splitUi) splitUi.classList.add('hidden');
    const splitBtn = document.getElementById('btn-show-split');
    if (splitBtn) splitBtn.classList.remove('hidden');
}

export function showUndoToast() {
    const toast = document.getElementById('undo-toast');
    toast.classList.remove('hidden');
    setTimeout(() => {
        hideUndoToast();
    }, 30000);
}

export function hideUndoToast() {
    document.getElementById('undo-toast').classList.add('hidden');
}
