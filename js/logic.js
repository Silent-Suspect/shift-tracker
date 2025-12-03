import { state } from './state.js';
import { updateUI, updateTimerDisplay, closeModal, resetDeleteUI } from './ui.js';
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
    
    // Gelöschte laden
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
    if(confirm("Alles löschen? (Auch gespeicherte Passwörter)")) { 
        state.shifts = []; 
        state.deletedShifts = []; // Friedhof leeren
        state.activeShiftId = null; 
        saveData(); 
        
        localStorage.removeItem('cloud_pw');
        localStorage.removeItem('cloud_url');
        localStorage.removeItem('real_db_url');
        
        updateUI(); 
    }
}

// Edit & Delete Logik
export function initiateEditBlock(id) {
    resetDeleteUI();
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

// Helper: Verschiebt Block in den Friedhof
function softDelete(blockIndex) {
    const block = state.shifts[blockIndex];
    state.deletedShifts.push(block);
    state.shifts.splice(blockIndex, 1);
}

export function executeDelete(strategy) {
    const id = parseInt(document.getElementById('edit-id').value);
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

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
        
        // Beim Mergen werden ZWEI Blöcke gelöscht (Mitte und Rechts)
        // Wir suchen sie über ID, da sich Indizes verschieben
        const nextId = nextBlock.id;
        softDelete(blockIndex); // Mitte weg
        
        const nextIndexNew = state.shifts.findIndex(s => s.id === nextId);
        if (nextIndexNew !== -1) softDelete(nextIndexNew); // Rechts weg
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
}
