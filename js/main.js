import { state } from './state.js';
import { loadData, migrateData, startBlock, stopCurrentBlock, saveEdit, executeDelete, clearData } from './logic.js';
import { updateUI, updateTimerDisplay, toggleHistory, closeModal, initiateDelete, resetDeleteUI } from './ui.js';
import { openCloudModal, closeCloudModal, handleCloudUpload, exportData } from './cloud.js';

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners(); 
    loadData();           
    migrateData();
    updateUI();
    
    updateTimerDisplay();
    state.timerInterval = setInterval(updateTimerDisplay, 1000);
    
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
    document.getElementById('btn-save-cloud').addEventListener('click', handleCloudUpload);
    document.getElementById('btn-cancel-cloud').addEventListener('click', closeCloudModal);

    document.getElementById('btn-save-edit').addEventListener('click', saveEdit);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeModal);
    
    // DELETE FLOW
    document.getElementById('btn-init-delete').addEventListener('click', initiateDelete);
    document.getElementById('btn-cancel-delete').addEventListener('click', resetDeleteUI);
    
    document.getElementById('btn-gap-merge').addEventListener('click', () => executeDelete('merge'));
    document.getElementById('btn-gap-prev').addEventListener('click', () => executeDelete('stretch-prev'));
    document.getElementById('btn-gap-next').addEventListener('click', () => executeDelete('pull-next'));
    document.getElementById('btn-gap-none').addEventListener('click', () => executeDelete('none'));
}

function updateConnectionStatus() {
    const el = document.getElementById('status-indicator');
    if (navigator.onLine) { el.innerText = 'Online'; el.className = 'online'; } 
    else { el.innerText = 'Offline'; el.className = 'offline'; }
}
