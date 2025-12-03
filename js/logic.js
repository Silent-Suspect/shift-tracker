import { state } from './state.js';
import { updateUI, updateTimerDisplay, closeModal, resetDeleteUI, showUndoToast, hideUndoToast } from './ui.js';
import { formatTimeForInput, setTime } from './utils.js';

export function loadData() {
    const stored = localStorage.getItem('shift_data');
    const storedDeleted = localStorage.getItem('deleted_shift_data');
    
    if (stored) {
        try {
            state.shifts = JSON.parse(stored);
            const active = state.shifts.find(s => s.end === null);
            if (active) state.activeShiftId = active.id;
        } catch (e) { state.shifts = []; }
    }
    
    if (storedDeleted) {
        try { state.deletedShifts = JSON.parse(storedDeleted); } 
        catch (e) { state.deletedShifts = []; }
    }
}

export function saveData() {
    localStorage.setItem('shift_data', JSON.stringify(state.shifts));
    localStorage.setItem('deleted_shift_data', JSON.stringify(state.deletedShifts));
}

export function migrateData() {
    let changed = false;
    state.shifts.forEach(s => {
        if (s.type === 'Transfer') { s.type = 'Gastfahrt'; changed = true; }
    });
    if (changed) saveData();
}

// --- SNAPSHOT & UNDO SYSTEM ---

function createSnapshot() {
    const snapshot = {
        shifts: JSON.parse(JSON.stringify(state.shifts)),
        deletedShifts: JSON.parse(JSON.stringify(state.deletedShifts)),
        activeShiftId: state.activeShiftId
    };
    state.undoStack.push(snapshot);
    if (state.undoStack.length > 1) state.undoStack.shift(); 
}

export function performUndo() {
    if (state.undoStack.length === 0) return;
    
    const snapshot = state.undoStack.pop();
    
    state.shifts = snapshot.shifts;
    state.deletedShifts = snapshot.deletedShifts;
    state.activeShiftId = snapshot.activeShiftId;
    
    saveData();
    updateUI();
    updateTimerDisplay();
    hideUndoToast();
    alert("Letzte Aktion rückgängig gemacht.");
}

// --- CORE ACTIONS ---

export function startBlock(type) {
    const now = new Date();
    if (state.activeShiftId) {
        const currentBlock = state.shifts.find(s => s.id === state.activeShiftId);
        if (currentBlock && currentBlock.type === type) return; 
        stopCurrentBlock(now);
    }
    const newBlock = { id: Date.now(), type: type, start: now.toISOString(), end: null };
    state.shifts.push(newBlock);
    state.activeShiftId = newBlock.id;
    saveData();
    updateUI();
}

export function stopCurrentBlock(endTime = new Date()) {
    if (!state.activeShiftId) return;
    const blockIndex = state.shifts.findIndex(s => s.id === state.activeShiftId);
    if (blockIndex !== -1) state.shifts[blockIndex].end = endTime.toISOString();
    state.activeShiftId = null;
    saveData();
    updateUI();
}

export function clearData() {
    if(confirm("Alle Schichtdaten löschen? (Passwort & Verbindung bleiben erhalten)")) { 
        state.shifts = []; 
        state.deletedShifts = []; 
        state.activeShiftId = null; 
        state.undoStack = []; 
        saveData(); 
        updateUI(); 
    }
}

// --- EDIT LOGIC ---

export function initiateEditBlock(id) {
    resetDeleteUI();
    document.getElementById('split-ui').classList.add('hidden');
    document.getElementById('btn-show-split').classList.remove('hidden');

    const block = state.shifts.find(s => s.id === id);
    if (!block) return;
    
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-type').value = block.type;
    document.getElementById('edit-start').value = formatTimeForInput(block.start);
    document.getElementById('edit-end').value = block.end ? formatTimeForInput(block.end) : '';
    document.getElementById('edit-modal').classList.remove('hidden');
}

export function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const type = document.getElementById('edit-type').value;
    const startInput = document.getElementById('edit-start').value; 
    const endInput = document.getElementById('edit-end').value; 
    
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    // Optional: Snapshot bei Zeit-Änderung, falls gewünscht
    // createSnapshot(); 

    const baseDateStart = new Date(state.shifts[blockIndex].start);
    const newStart = setTime(baseDateStart, startInput);
    let newEnd = null;
    if (endInput) {
        newEnd = setTime(baseDateStart, endInput);
        if (newEnd < newStart) newEnd.setDate(newEnd.getDate() + 1); 
    }

    state.shifts[blockIndex].type = type;
    state.shifts[blockIndex].start = newStart.toISOString();
    state.shifts[blockIndex].end = newEnd ? newEnd.toISOString() : null;

    const prevBlock = state.shifts[blockIndex - 1];
    if (prevBlock && prevBlock.end) prevBlock.end = newStart.toISOString();

    const nextBlock = state.shifts[blockIndex + 1];
    if (newEnd && nextBlock) nextBlock.start = newEnd.toISOString();

    closeModal();
    saveData();
    updateUI();
}

// --- SPLIT LOGIC ---

export function showSplitUI() {
    const id = parseInt(document.getElementById('edit-id').value);
    const block = state.shifts.find(s => s.id === id);
    if (!block) return;

    const start = new Date(block.start);
    const end = block.end ? new Date(block.end) : new Date(); 
    const midMillis = (start.getTime() + end.getTime()) / 2;
    const midDate = new Date(midMillis);

    document.getElementById('split-time').value = formatTimeForInput(midDate.toISOString());
    
    document.getElementById('btn-show-split').classList.add('hidden');
    document.getElementById('split-ui').classList.remove('hidden');
}

export function executeSplit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const splitTimeInput = document.getElementById('split-time').value;
    
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    createSnapshot();

    const block = state.shifts[blockIndex];
    const baseDate = new Date(block.start);
    const splitDate = setTime(baseDate, splitTimeInput);

    const start = new Date(block.start);
    const end = block.end ? new Date(block.end) : new Date();
    
    if (splitDate <= start || splitDate >= end) {
        alert("Zeitpunkt muss innerhalb des Blocks liegen.");
        return;
    }

    const newBlock = {
        id: Date.now(), 
        type: block.type,
        start: splitDate.toISOString(),
        end: block.end 
    };

    block.end = splitDate.toISOString();

    if (state.activeShiftId === block.id) {
        state.activeShiftId = newBlock.id;
    }

    state.shifts.splice(blockIndex + 1, 0, newBlock);

    saveData();
    updateUI();
    closeModal();
    updateTimerDisplay();
}

// --- DELETE LOGIC ---

export function initiateDelete() {
    const id = parseInt(document.getElementById('edit-id').value);
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;
    
    const block = state.shifts[blockIndex];
    const isCurrent = (block.id === state.activeShiftId);
    
    if (isCurrent) {
        const now = new Date();
        const start = new Date(block.start);
        const durationMins = (now - start) / 60000;
        
        // "Quick Undo" oder "Manual Delete" Status
        if (durationMins < 5) {
            executeDelete('undo-current');
        } else {
            if (confirm("Der Block läuft schon länger als 5 Minuten.\nMöchtest du den vorherigen Block wieder aufnehmen?")) {
                executeDelete('undo-current');
            } else {
                executeDelete('none');
            }
        }
        return;
    }

    document.getElementById('edit-form').classList.add('hidden');
    document.getElementById('delete-options').classList.remove('hidden');

    const mergeBtn = document.getElementById('btn-gap-merge');
    const prevBtn = document.getElementById('btn-gap-prev');
    const nextBtn = document.getElementById('btn-gap-next');

    const prevBlock = state.shifts[blockIndex - 1];
    const nextBlock = state.shifts[blockIndex + 1];

    if (prevBlock && nextBlock && prevBlock.type === nextBlock.type) {
        mergeBtn.classList.remove('hidden'); 
    } else {
        mergeBtn.classList.add('hidden');
    }

    if (prevBlock) prevBtn.style.display = 'flex'; else prevBtn.style.display = 'none';
    if (nextBlock) nextBtn.style.display = 'flex'; else nextBtn.style.display = 'none';
}

// UPDATE: softDelete nimmt jetzt einen Grund entgegen
function softDelete(blockIndex, reason = "GELÖSCHT") {
    const block = state.shifts[blockIndex];
    // Wir hängen den Grund an das Objekt an
    block.deleteStatus = reason;
    state.deletedShifts.push(block);
    state.shifts.splice(blockIndex, 1);
}

export function executeDelete(strategy) {
    const id = parseInt(document.getElementById('edit-id').value);
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    createSnapshot(); 

    const block = state.shifts[blockIndex];
    const prevBlock = state.shifts[blockIndex - 1];
    const nextBlock = state.shifts[blockIndex + 1];

    if (strategy === 'undo-current') {
        // Aktuellen Block löschen (Status: GELÖSCHT, da manuell)
        softDelete(blockIndex, "GELÖSCHT");
        state.activeShiftId = null;
        if (prevBlock) { prevBlock.end = null; state.activeShiftId = prevBlock.id; }
    } 
    else if (strategy === 'merge' && prevBlock && nextBlock) {
        const wasActive = (nextBlock.id === state.activeShiftId);
        prevBlock.end = nextBlock.end;
        if (wasActive) {
            prevBlock.end = null;
            state.activeShiftId = prevBlock.id;
        }
        
        const nextId = nextBlock.id;
        
        // HIER: Status VERSCHMOLZEN setzen
        softDelete(blockIndex, "VERSCHMOLZEN"); 
        
        const nextIndexNew = state.shifts.findIndex(s => s.id === nextId);
        if (nextIndexNew !== -1) softDelete(nextIndexNew, "VERSCHMOLZEN"); 
    }
    else if (strategy === 'stretch-prev' && prevBlock) {
        prevBlock.end = block.end;
        // Auch beim Lücke füllen ist es quasi ein Merge
        softDelete(blockIndex, "VERSCHMOLZEN");
    } 
    else if (strategy === 'pull-next' && nextBlock) {
        nextBlock.start = block.start;
        softDelete(blockIndex, "VERSCHMOLZEN");
    } 
    else {
        // Normales Löschen (Lücke lassen)
        if (block.id === state.activeShiftId) state.activeShiftId = null;
        softDelete(blockIndex, "GELÖSCHT");
    }

    saveData();
    updateUI();
    closeModal();
    updateTimerDisplay();
    
    showUndoToast();
}
