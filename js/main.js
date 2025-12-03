import { state } from './state.js';

// Logic Imports (Hier muss initiateDelete und initiateEditBlock rein!)
import { loadData, migrateData, startBlock, stopCurrentBlock, saveEdit, executeDelete, clearData, performUndo, showSplitUI, executeSplit, initiateEditBlock, initiateDelete } from './logic.js';

// UI Imports (Hier NUR UI Zeug, KEIN initiateDelete mehr!)
import { updateUI, updateTimerDisplay, toggleHistory, closeModal, resetDeleteUI } from './ui.js';

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
    // Buttons
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
    
    // DELETE & SPLIT FLOW
    // initiateDelete wird aus ui.js oder logic.js importiert? 
    // HIER AUFPASSEN: initiateDelete sollte in logic.js sein und nicht in ui.js!
    // Im Import oben steht: import { ... initiateDelete ... } from './ui.js'; 
    // Aber du hast es in logic.js! Bitte importiere es korrekt aus logic.js!
    
    // KORREKTUR: initiateDelete Button Listener
    // Ich nutze die globale Referenz, falls unsicher, oder den Import.
    // Da wir in logic.js sind, importieren wir es von dort (siehe oben).
    // Aber warte, im Import oben war es bei ./ui.js gelistet. Das war der Fehler in meiner vorherigen main.js!
    
    // FIX: Wir holen initiateDelete aus logic.js (wo es hingehört).
    
    document.getElementById('btn-init-delete').addEventListener('click', () => {
        // Wir müssen sicherstellen, dass wir die Funktion aus logic.js aufrufen
        // Da wir oben "initiateDelete" aus ui.js importiert haben (fälschlicherweise?), 
        // müssen wir die Imports bereinigen.
        
        // Da ich den Import in dieser Datei neu schreibe, korrigiere ich es jetzt:
        // Siehe die import-Zeilen ganz oben!
    });
    
    // DA DAS VERWIRREND IST, HIER DIE SAUBERE EVENT DELEGATION FÜR DIE LISTE:
    document.getElementById('log-list').addEventListener('click', (e) => {
        // Wir suchen das nächste Element mit Klasse .btn-edit
        const btn = e.target.closest('.btn-edit');
        if (btn) {
            const id = parseInt(btn.dataset.id);
            initiateEditBlock(id);
        }
    });

    // Restliche Listener
    document.getElementById('btn-init-delete').addEventListener('click', initiateDelete); // Die aus logic.js!
    document.getElementById('btn-cancel-delete').addEventListener('click', resetDeleteUI); // Die aus ui.js!
    
    document.getElementById('btn-gap-merge').addEventListener('click', () => executeDelete('merge'));
    document.getElementById('btn-gap-prev').addEventListener('click', () => executeDelete('stretch-prev'));
    document.getElementById('btn-gap-next').addEventListener('click', () => executeDelete('pull-next'));
    document.getElementById('btn-gap-none').addEventListener('click', () => executeDelete('none'));

    document.getElementById('btn-undo').addEventListener('click', performUndo);
    document.getElementById('btn-show-split').addEventListener('click', showSplitUI);
    document.getElementById('btn-confirm-split').addEventListener('click', executeSplit);
    document.getElementById('btn-cancel-split').addEventListener('click', () => {
        document.getElementById('split-ui').classList.add('hidden');
        document.getElementById('btn-show-split').classList.remove('hidden');
    });
}

function updateConnectionStatus() {
    const el = document.getElementById('status-indicator');
    if (navigator.onLine) { el.innerText = 'Online'; el.className = 'online'; } 
    else { el.innerText = 'Offline'; el.className = 'offline'; }
}
