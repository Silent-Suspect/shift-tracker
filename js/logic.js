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

// Speichert den aktuellen Zustand VOR einer Änderung
function createSnapshot() {
    // Wir speichern eine tiefe Kopie von beiden Listen und der ID
    const snapshot = {
        shifts: JSON.parse(JSON.stringify(state.shifts)),
        deletedShifts: JSON.parse(JSON.stringify(state.deletedShifts)),
        activeShiftId: state.activeShiftId
    };
    state.undoStack.push(snapshot);
    // Begrenzen auf 1 Schritt (oder mehr, wenn gewünscht)
    if (state.undoStack.length > 1) state.undoStack.shift(); 
}

export function performUndo() {
    if (state.undoStack.length === 0) return;
    
    const snapshot = state.undoStack.pop();
    
    // Zustand wiederherstellen
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
        state.undoStack = []; // Stack leeren
        saveData(); 
        updateUI(); 
    }
}

// --- EDIT LOGIC ---

export function initiateEditBlock(id) {
    resetDeleteUI();
    // Split UI verstecken
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

    // Snapshot vor Änderung? Wenn gewünscht.
    // createSnapshot(); // Hier optional, meistens erwartet man Undo nur bei Löschen.

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

    // Berechne Mitte
    const start = new Date(block.start);
    const end = block.end ? new Date(block.end) : new Date(); // Wenn läuft, nimm Jetzt
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

    createSnapshot(); // Safety First!

    const block = state.shifts[blockIndex];
    const baseDate = new Date(block.start);
    const splitDate = setTime(baseDate, splitTimeInput);

    // Validierung: Split muss zwischen Start und Ende liegen
    const start = new Date(block.start);
    const end = block.end ? new Date(block.end) : new Date();
    
    if (splitDate <= start || splitDate >= end) {
        alert("Zeitpunkt muss innerhalb des Blocks liegen.");
        return;
    }

    // 1. Neuer Block (Rechter Teil)
    // Erbt Typ und Ende vom Original
    const newBlock = {
        id: Date.now(), // Neue ID
        type: block.type,
        start: splitDate.toISOString(),
        end: block.end // Kann null sein wenn aktiv
    };

    // 2. Alter Block (Linker Teil)
    // Ende wird auf Split-Zeit gesetzt
    block.end = splitDate.toISOString();

    // Wenn der alte Block aktiv war, ist jetzt der neue Block aktiv
    if (state.activeShiftId === block.id) {
        state.activeShiftId = newBlock.id;
    }

    // Neuer Block wird direkt nach dem alten eingefügt
    state.shifts.splice(blockIndex + 1, 0, newBlock);

    saveData();
    updateUI();
    closeModal();
    updateTimerDisplay();
}

// --- DELETE LOGIC ---

function softDelete(blockIndex) {
    const block = state.shifts[blockIndex];
    state.deletedShifts.push(block);
    state.shifts.splice(blockIndex, 1);
}

export function executeDelete(strategy) {
    const id = parseInt(document.getElementById('edit-id').value);
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    createSnapshot(); // WICHTIG: Zustand sichern

    const block = state.shifts[blockIndex];
    const prevBlock = state.shifts[blockIndex - 1];
    const nextBlock = state.shifts[blockIndex + 1];

    if (strategy === 'undo-current') {
        softDelete(blockIndex);
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
        softDelete(blockIndex); 
        
        const nextIndexNew = state.shifts.findIndex(s => s.id === nextId);
        if (nextIndexNew !== -1) softDelete(nextIndexNew); 
    }
    else if (strategy === 'stretch-prev' && prevBlock) {
        prevBlock.end = block.end;
        softDelete(blockIndex);
    } 
    else if (strategy === 'pull-next' && nextBlock) {
        nextBlock.start = block.start;
        softDelete(blockIndex);
    } 
    else {
        if (block.id === state.activeShiftId) state.activeShiftId = null;
        softDelete(blockIndex);
    }

    saveData();
    updateUI();
    closeModal();
    updateTimerDisplay();
    
    // Toast anzeigen
    showUndoToast();
}
