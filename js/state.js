export const state = {
    shifts: [],
    activeShiftId: null,
    timerInterval: null
};

// Konfiguration
export const CONFIG = {
    MIN_REST_HOURS: 10,
    SHIFT_GAP_THRESHOLD_HOURS: 6,
    AUTO_RESUME_THRESHOLD_MINUTES: 5,
    // DEINE URL:
    GATEKEEPER_URL: "https://script.google.com/macros/s/AKfycbx9BEX0KZLq9YHcUubYs2q1srJ8wp-AbqClMoVkDLxneWr44RLBfcgUV171DMgZvkQ/exec"
};
