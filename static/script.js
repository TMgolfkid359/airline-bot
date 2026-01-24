// SimBrief API Integration
async function fetchSimBrief() {
    const username = document.getElementById('simbrief-username').value;
    const userid = document.getElementById('simbrief-userid').value;
    const origin = document.getElementById('origin').value.toUpperCase();
    const destination = document.getElementById('destination').value.toUpperCase();
    const aircraftType = document.getElementById('aircraft-type').value.toUpperCase();
    const route = document.getElementById('route').value;
    
    if (!username && !userid) {
        showResult('simbrief-result', 'Please enter either a username or user ID', 'error');
        return;
    }
    
    const resultBox = document.getElementById('simbrief-result');
    resultBox.className = 'result-box info';
    resultBox.innerHTML = '<div class="loading"></div>Fetching flight plan from SimBrief...';
    resultBox.style.display = 'block';
    
    try {
        const payload = {};
        if (username) payload.username = username;
        if (userid) payload.userid = userid;
        if (origin) payload.orig = origin;
        if (destination) payload.dest = destination;
        if (aircraftType) payload.type = aircraftType;
        if (route) payload.route = route;
        
        const response = await fetch('/api/simbrief/fetch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Format and display flight data
            const formattedData = formatFlightData(data.data);
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `<h3>Flight Plan Retrieved Successfully</h3><pre>${formattedData}</pre>`;
            
            // Store flight data globally for quick actions
            window.currentFlightData = data.data;
        } else {
            resultBox.className = 'result-box error';
            resultBox.innerHTML = `<strong>Error:</strong> ${data.error || 'Unknown error'}`;
        }
    } catch (error) {
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<strong>Error:</strong> ${error.message}`;
    }
}

function formatFlightData(data) {
    let formatted = '';
    const importantFields = [
        'origin', 'destination', 'aircraft', 'route', 'altitude',
        'fuel', 'alternate', 'times', 'weather', 'notams'
    ];
    
    for (const [key, value] of Object.entries(data)) {
        if (value && (importantFields.some(field => key.toLowerCase().includes(field)) || 
            key.length < 20)) { // Show shorter keys
            formatted += `${key}: ${value}\n`;
        }
    }
    
    return formatted || JSON.stringify(data, null, 2);
}

// HOPPIE ACARS Integration
async function sendHoppie() {
    const logon = document.getElementById('hoppie-logon').value;
    const fromCallsign = document.getElementById('from-callsign').value;
    const toCallsign = document.getElementById('to-callsign').value;
    const messageType = document.getElementById('message-type').value;
    const message = document.getElementById('acars-message').value;
    
    if (!logon || !fromCallsign || !toCallsign || !message) {
        showResult('hoppie-result', 'Please fill in all required fields', 'error');
        return;
    }
    
    const resultBox = document.getElementById('hoppie-result');
    resultBox.className = 'result-box info';
    resultBox.innerHTML = '<div class="loading"></div>Sending message via HOPPIE ACARS...';
    resultBox.style.display = 'block';
    
    try {
        const response = await fetch('/api/hoppie/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                logon: logon,
                from_callsign: fromCallsign,
                to_callsign: toCallsign,
                message_type: messageType,
                message: message
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `<strong>Success:</strong> ${data.message}`;
            document.getElementById('acars-message').value = '';
        } else {
            resultBox.className = 'result-box error';
            resultBox.innerHTML = `<strong>Error:</strong> ${data.error || 'Unknown error'}`;
        }
    } catch (error) {
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<strong>Error:</strong> ${error.message}`;
    }
}

async function pollHoppie() {
    const logon = document.getElementById('hoppie-logon').value;
    const callsign = document.getElementById('from-callsign').value || document.getElementById('to-callsign').value;
    
    if (!logon || !callsign) {
        showResult('hoppie-result', 'Please enter logon code and callsign', 'error');
        return;
    }
    
    const resultBox = document.getElementById('hoppie-result');
    resultBox.className = 'result-box info';
    resultBox.innerHTML = '<div class="loading"></div>Polling HOPPIE ACARS for messages...';
    resultBox.style.display = 'block';
    
    try {
        const response = await fetch('/api/hoppie/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                logon: logon,
                callsign: callsign
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.messages && data.messages.length > 0) {
                let messagesHtml = '<h3>Received Messages:</h3>';
                data.messages.forEach(msg => {
                    messagesHtml += `<div style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
                        <strong>From:</strong> ${msg.from}<br>
                        <strong>To:</strong> ${msg.to}<br>
                        <strong>Type:</strong> ${msg.type}<br>
                        <strong>Message:</strong> ${msg.message}
                    </div>`;
                });
                resultBox.className = 'result-box success';
                resultBox.innerHTML = messagesHtml;
            } else {
                resultBox.className = 'result-box info';
                resultBox.innerHTML = '<strong>No new messages</strong>';
            }
        } else {
            resultBox.className = 'result-box error';
            resultBox.innerHTML = `<strong>Error:</strong> ${data.error || 'Unknown error'}`;
        }
    } catch (error) {
        resultBox.className = 'result-box error';
        resultBox.innerHTML = `<strong>Error:</strong> ${error.message}`;
    }
}

// Quick Actions
async function sendFlightPlan() {
    if (!window.currentFlightData) {
        alert('Please fetch a flight plan from SimBrief first');
        return;
    }
    
    const logon = document.getElementById('hoppie-logon').value;
    const toCallsign = document.getElementById('to-callsign').value;
    
    if (!logon || !toCallsign) {
        alert('Please enter HOPPIE logon and destination callsign');
        return;
    }
    
    // Format flight plan message
    const flightPlan = window.currentFlightData;
    const message = `FLIGHT PLAN\n` +
        `ORIG: ${flightPlan.origin || 'N/A'}\n` +
        `DEST: ${flightPlan.destination || 'N/A'}\n` +
        `ROUTE: ${flightPlan.route || 'N/A'}\n` +
        `ALT: ${flightPlan.altitude || 'N/A'}\n` +
        `FUEL: ${flightPlan.fuel || 'N/A'}`;
    
    document.getElementById('acars-message').value = message;
    document.getElementById('from-callsign').value = 'OPS';
    await sendHoppie();
}

async function sendWeather() {
    const logon = document.getElementById('hoppie-logon').value;
    const toCallsign = document.getElementById('to-callsign').value;
    
    if (!logon || !toCallsign) {
        alert('Please enter HOPPIE logon and destination callsign');
        return;
    }
    
    const message = 'REQUEST WEATHER UPDATE';
    document.getElementById('acars-message').value = message;
    document.getElementById('from-callsign').value = 'OPS';
    await sendHoppie();
}

async function sendClearance() {
    const logon = document.getElementById('hoppie-logon').value;
    const toCallsign = document.getElementById('to-callsign').value;
    
    if (!logon || !toCallsign) {
        alert('Please enter HOPPIE logon and destination callsign');
        return;
    }
    
    const message = 'REQUEST CLEARANCE';
    document.getElementById('acars-message').value = message;
    document.getElementById('from-callsign').value = 'OPS';
    await sendHoppie();
}

function showResult(elementId, message, type) {
    const resultBox = document.getElementById(elementId);
    resultBox.className = `result-box ${type}`;
    resultBox.innerHTML = message;
    resultBox.style.display = 'block';
}

