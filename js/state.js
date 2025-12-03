export const state = {
    shifts: [],
    deletedShifts: [], // Speicher für gelöschte Einträge
    activeShiftId: null,
    timerInterval: null
};

// Konfiguration
export const CONFIG = {
    MIN_REST_HOURS: 10,
    SHIFT_GAP_THRESHOLD_HOURS: 6,
    AUTO_RESUME_THRESHOLD_MINUTES: 5,
    // HIER DEINE NEUE GATEKEEPER URL EINTRAGEN:
    GATEKEEPER_URL: "https://script.google.com/macros/s/AKfycbyBGEprqn_IpNMqxpPuGNa4vIrw0AGwjHnabEmdHi_aeJMDQxKVI5SYe5BaYzYcv-BH/exec"
};
