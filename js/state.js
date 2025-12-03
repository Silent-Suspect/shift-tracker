export const state = {
    shifts: [],
    deletedShifts: [], 
    activeShiftId: null,
    timerInterval: null,
    undoStack: [] // NEU: Speichert Snapshots für Rückgängig
};

// Konfiguration
export const CONFIG = {
    MIN_REST_HOURS: 10,
    SHIFT_GAP_THRESHOLD_HOURS: 6,
    AUTO_RESUME_THRESHOLD_MINUTES: 5,
    // HIER DEINE NEUE GATEKEEPER URL EINTRAGEN:
    GATEKEEPER_URL: "https://script.google.com/macros/s/AKfycbyL9aI1wfZ0bdQsE_TsdNUM1QVajAfgnYyZFCh_6_2GTtTW9fOHYEdtUXdK87uQKGw/exec"
};
