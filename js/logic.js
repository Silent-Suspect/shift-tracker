import { state } from './state.js';
import { updateUI, updateTimerDisplay, closeModal, resetDeleteUI } from './ui.js';
import { formatTimeForInput, setTime } from './utils.js';

export function loadData() {
    const stored = localStorage.getItem('shift_data');
    if (stored) {
        try {
            state.shifts = JSON.parse(stored);
            const active = state.shifts.find(s => s.end === null);
            if (active) state.activeShiftId = active.id;
        } catch (e) { state.shifts = []; }
    }
}

export function saveData() {
    localStorage.setItem('shift_data', JSON.stringify(state.shifts));
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
    if(confirm("Alles löschen?")) { 
        state.shifts = []; 
        state.activeShiftId = null; 
        saveData(); 
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

export function executeDelete(strategy) {
    const id = parseInt(document.getElementById('edit-id').value);
    const blockIndex = state.shifts.findIndex(s => s.id === id);
    if (blockIndex === -1) return;

    const block = state.shifts[blockIndex];
    const prevBlock = state.shifts[blockIndex - 1];
    const nextBlock = state.shifts[blockIndex + 1];

    if (strategy === 'undo-current') {
        state.shifts.splice(blockIndex, 1);
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
        state.shifts.splice(blockIndex, 2);
    }
    else if (strategy === 'stretch-prev' && prevBlock) {
        prevBlock.end = block.end;
        state.shifts.splice(blockIndex, 1);
    } 
    else if (strategy === 'pull-next' && nextBlock) {
        nextBlock.start = block.start;
        state.shifts.splice(blockIndex, 1);
    } 
    else {
        if (block.id === state.activeShiftId) state.activeShiftId = null;
        state.shifts.splice(blockIndex, 1);
    }

    saveData();
    updateUI();
    closeModal();
    updateTimerDisplay();
}
