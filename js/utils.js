export function getDisplayLabel(type) {
    switch(type) {
        case 'Arbeit': return '🚂 Arbeit';
        case 'Wartezeit': return '⏳ Warten';
        case 'Pause': return '☕ Pause';
        // Pfade angepasst auf assets/
        case 'Übergang': return '<img src="assets/transit-icon.png" class="custom-icon" alt=""> Übergang';
        case 'Gastfahrt': return '<img src="assets/taxi-icon.png" class="custom-icon" alt=""> Gastfahrt';
        case 'An-/Abreise': return '🚗 An-/Abreise';
        default: return type;
    }
}

export function formatTimeForInput(isoString) {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

export function setTime(dateObj, timeString) {
    const [hours, minutes] = timeString.split(':');
    const newDate = new Date(dateObj);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    newDate.setSeconds(0);
    return newDate;
}
