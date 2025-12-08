export const state = {
    shifts: [],
    deletedShifts: [], 
    activeShiftId: null,
    timerInterval: null,
    undoStack: [] 
};

// Konfiguration
export const CONFIG = {
    MIN_REST_HOURS: 10,
    SHIFT_GAP_THRESHOLD_HOURS: 6,
    AUTO_RESUME_THRESHOLD_MINUTES: 5,
    AUTO_MERGE_WAIT_MINUTES: 20, // NEU: Schwelle für Auto-Merge
    // HIER DEINE NEUE GATEKEEPER URL EINTRAGEN:
    GATEKEEPER_URL: "https://script.google.com/macros/s/AKfycbyL9aI1wfZ0bdQsE_TsdNUM1QVajAfgnYyZFCh_6_2GTtTW9fOHYEdtUXdK87uQKGw/exec"
};
