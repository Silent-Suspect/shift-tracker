import { state, CONFIG } from './state.js';

export function openCloudModal() {
    const pw = localStorage.getItem('cloud_pw') || '';
    document.getElementById('cloud-pw').value = pw;
    document.getElementById('cloud-modal').classList.remove('hidden');
}

export function closeCloudModal() {
    document.getElementById('cloud-modal').classList.add('hidden');
}

export function exportData() {
    let csvContent = "data:text/csv;charset=utf-8,ID,Typ,StartDatum,StartZeit,EndeZeit,Dauer(Min)\n";
    state.shifts.forEach(e => {
        const start = new Date(e.start);
        const end = e.end ? new Date(e.end) : null;
        const dateStr = start.toLocaleDateString();
        const startTime = start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const endTime = end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LAEUFT';
        let duration = 0;
        if (end) duration = Math.floor((end - start) / 60000);
        csvContent += `${e.id},${e.type},"${dateStr}",${startTime},${endTime},${duration}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "zugprotokoll_backup.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    const rawCSV = csvContent.replace("data:text/csv;charset=utf-8,", "");
    navigator.clipboard.writeText(rawCSV).then(() => { alert("Backup erstellt!"); });
}

export async function handleCloudUpload() {
    const pw = document.getElementById('cloud-pw').value.trim();
    if (!pw) { alert("Bitte Code eingeben."); return; }
    
    if (state.shifts.length === 0 && state.deletedShifts.length === 0) { 
        alert("Keine Daten zum Senden."); return; 
    }

    const btn = document.getElementById('btn-save-cloud');
    const originalText = btn.innerText;
    btn.innerText = "Verbinde...";
    btn.disabled = true;

    try {
        let realDbUrl = localStorage.getItem('real_db_url');
        
        if (!realDbUrl || localStorage.getItem('cloud_pw') !== pw) {
            const gateResponse = await fetch(CONFIG.GATEKEEPER_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ password: pw })
            });
            
            const gateData = await gateResponse.json();
            if (gateData.result !== "success") throw new Error("Code abgelehnt!");
            realDbUrl = gateData.url;
            localStorage.setItem('real_db_url', realDbUrl);
            localStorage.setItem('cloud_pw', pw);
        }

        btn.innerText = "Sende Daten...";
        
        // Helper zum Formatieren
        const formatShift = (s) => {
            const start = new Date(s.start);
            const end = s.end ? new Date(s.end) : null;
            let duration = 0;
            if (end) duration = Math.floor((end - start) / 60000);
            return {
                id: s.id, type: s.type,
                startDate: start.toLocaleDateString(),
                startTime: start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                endTime: end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'LAEUFT',
                duration: duration,
                // UPDATE: Hier senden wir den Lösch-Grund mit!
                deleteStatus: s.deleteStatus // undefined bei aktiven, String bei gelöschten
            };
        };

        const payload = {
            password: pw,
            data: state.shifts.map(formatShift),
            deleted: state.deletedShifts.map(formatShift)
        };

        await fetch(realDbUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });
        
        alert("Erfolg! Daten übertragen.");
        closeCloudModal();
    } catch (e) {
        alert("Fehler: " + e.message);
        localStorage.removeItem('real_db_url');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
