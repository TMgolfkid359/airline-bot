// Global variables to store flight data
let takeoffWeight = "N/A";
let landingWeight = "N/A";
let depWeather = "N/A";
let arrWeather = "N/A";
let currentFlightData = null;

// Final Weight Manifest data storage
let manifestData = {
  seq: 1,
  towChange: null,
  previousTOW: null,
  releaseVersion: 1
};

// Event listeners
document.getElementById("fetchBtn").addEventListener("click", fetchSummary);
document.getElementById("takeoffBtn").addEventListener("click", printTakeoffData);
document.getElementById("landingBtn").addEventListener("click", printLandingData);
document.getElementById("takeoffPerfBtn").addEventListener("click", printTakeoffPerformanceCard);
document.getElementById("finalWeightBtn").addEventListener("click", printFinalWeightManifest);
document.getElementById("departureAtisBtn").addEventListener("click", printDepartureATIS);
document.getElementById("arrivalAtisBtn").addEventListener("click", printArrivalATIS);
document.getElementById("sendBtn").addEventListener("click", sendHoppie);
document.getElementById("pollBtn").addEventListener("click", pollHoppie);

// SimBrief Functions
async function fetchSummary() {
  const username = document.getElementById("username").value.trim();
  const status = document.getElementById("status");
  if (!username) {
    status.textContent = "Error: Please enter a username.";
    return;
  }

  status.textContent = "Fetching data...";

  try {
    const response = await fetch('/api/simbrief/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: username })
    });

    const data = await response.json();

    if (data.success) {
      const flightData = data.data;
      currentFlightData = flightData;
      
      // Extract data from nested XML structure
      const get = (key) => {
        const keys = key.split(' > ');
        let value = flightData;
        
        for (const k of keys) {
          if (!value) return null;
          
          // Try different case variations
          value = value[k] || value[k.toLowerCase()] || value[k.toUpperCase()] || 
                  value[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()];
          
          // If value is an object with _text property, get the text
          if (value && typeof value === 'object' && '_text' in value) {
            value = value._text;
          }
        }
        
        // Return string value or "N/A"
        if (value && typeof value === 'string') {
          return value.trim() || "N/A";
        } else if (value && typeof value === 'object' && '_text' in value) {
          return value._text.trim() || "N/A";
        } else if (value) {
          return String(value).trim() || "N/A";
        }
        return "N/A";
      };

      // Try to get values - handle different XML structures
      const airline = get("general > icao_airline") || get("icao_airline") || "N/A";
      const Captain = get("crew > cpt") || get("cpt") || "N/A";
      const FirstOfficer = get("crew > fo") || get("fo") || "N/A";
      const Dispatcher = get("crew > dx") || get("dx") || "N/A";
      const flightNumber = get("flight_number") || get("flightnumber") || "N/A";
      const depICAO = get("origin > icao_code") || get("origin") || flightData.orig || "N/A";
      const arrICAO = get("destination > icao_code") || get("destination") || flightData.dest || "N/A";
      const route = get("general > route") || get("route") || "N/A";
      const cruiseAlt = get("general > initial_altitude") || get("altitude") || "N/A";
      const costIndex = get("general > costindex") || get("costindex") || "N/A";
      const blockFuel = get("fuel > plan_ramp") || get("fuel") || "N/A";
      const zfw = get("weights > est_zfw") || get("zfw") || "N/A";
      const schedDepTime = get("times > sched_out") || get("sched_out") || "N/A";
      const enrouteTime = get("times > enroute") || get("enroute") || "N/A";
      const aircraftType = get("aircraft > name") || get("aircraft") || flightData.type || "N/A";
      const registration = get("aircraft > reg") || get("reg") || "N/A";
      const aircraftnumber = get("aircraft > fin") || get("fin") || "N/A";
      const pax = get("general > passengers") || get("passengers") || "N/A";
      const climbprofile = get("general > climb_profile") || get("climb_profile") || "N/A";
      const descentprofile = get("general > descent_profile") || get("descent_profile") || "N/A";
      const alternate = get("alternate > icao_code") || get("alternate") || "N/A";
      const cruisemach = get("general > cruise_mach") || get("cruise_mach") || "N/A";
      const depName = get("origin > name") || "N/A";
      const arrName = get("destination > name") || "N/A";
      const altName = get("alternate > name") || "N/A";
      depWeather = get("origin > metar") || get("metar") || "N/A";
      arrWeather = get("destination > metar") || "N/A";
      const altWeather = get("alternate > metar") || "N/A";
      const windavgspd = get("avg_wind_spd") || get("wind_spd") || "N/A";
      const windavgdir = get("avg_wind_dir") || get("wind_dir") || "N/A";
      const isadev = get("avg_temp_dev") || get("temp_dev") || "N/A";
      const depElev = get("origin > elevation") || get("elevation") || "N/A";
      const arrElev = get("destination > elevation") || "N/A";
      const altElev = get("alternate > elevation") || "N/A";
      const cargo = get("weights > cargo") || get("cargo") || "N/A";

      // Extract additional data for Final Weight Manifest
      const rampWeight = get("weights > est_ramp") || get("weights > ramp") || "N/A";
      const takeoffFuel = get("fuel > plan_takeoff") || get("fuel > takeoff") || "N/A";
      const taxiFuel = get("fuel > plan_taxi") || get("fuel > taxi") || "N/A";
      const tow = get("weights > est_tow") || get("weights > tow") || takeoffWeight.replace(/[^0-9.]/g, '');
      const cg = get("weights > cg") || get("weights > percent_cg") || get("weights > cg_percent") || "N/A";
      const trim = get("weights > trim") || get("weights > trim_setting") || "N/A";

      // Passenger breakdown (try to get first/coach split)
      const paxFirst = get("general > pax_first") || get("pax_first") || "0";
      const paxCoach = get("general > pax_coach") || get("pax_coach") || pax;
      const totalPax = (parseInt(paxFirst) || 0) + (parseInt(paxCoach) || parseInt(pax) || 0);

      // Crew data
      const fas = get("crew > fa") || get("crew > cabin_crew") || get("crew > flight_attendants") || "N/A";
      const pilots = (Captain !== "N/A" && FirstOfficer !== "N/A") ? "2" : "N/A";

      // Store manifest data
      manifestData.currentTOW = tow;
      manifestData.rampWeight = rampWeight;
      manifestData.takeoffFuel = takeoffFuel;
      manifestData.taxiFuel = taxiFuel;
      manifestData.zfw = zfw;
      manifestData.cg = cg;
      manifestData.trim = trim;
      manifestData.paxFirst = paxFirst;
      manifestData.paxCoach = paxCoach;
      manifestData.totalPax = totalPax;
      manifestData.pilots = pilots;
      manifestData.fas = fas;
      manifestData.airline = airline;
      manifestData.flightNumber = flightNumber;
      manifestData.registration = registration;

      // Calculate weights if available
      if (blockFuel !== "N/A" && zfw !== "N/A") {
        const fuelNum = parseFloat(blockFuel.replace(/[^0-9.]/g, ''));
        const zfwNum = parseFloat(zfw.replace(/[^0-9.]/g, ''));
        if (!isNaN(fuelNum) && !isNaN(zfwNum)) {
          takeoffWeight = (fuelNum + zfwNum).toFixed(0) + " lbs";
          landingWeight = (zfwNum + (fuelNum * 0.3)).toFixed(0) + " lbs";
        }
      }

      const output = `------- ACARS FLIGHT SUMMARY --------
Flight #: ${airline}${flightNumber}

Origin: ${depICAO} (${depElev} ft)
(${depName})
${depWeather}

Destination: ${arrICAO} (${arrElev} ft)
(${arrName})
${arrWeather}

Alternate: ${alternate} (${altElev} ft)
(${altName})
${altWeather}

Route: ${route}

Cruise Altitude: ${cruiseAlt}

Average Winds: ${windavgdir}/${windavgspd} (ISA ${isadev})

--------- CREW INFORMATION ----------
Captain: ${Captain}
First Officer: ${FirstOfficer}
Dispatcher: ${Dispatcher}

------- PERFORMANCE PROFILE --------
Climb Profile: ${climbprofile}
Cruise Mach: ${cruisemach}
Descent Profile: ${descentprofile}
Cost Index: ${costIndex}

------------- WEIGHTS -------------
Passengers: ${pax}
Cargo: ${cargo}
Zero Fuel Weight: ${zfw}
Block Fuel: ${blockFuel}
Takeoff Weight: ${takeoffWeight}
Landing Weight: ${landingWeight}

------- AIRCRAFT INFORMATION --------
Aircraft Type: ${aircraftType}
Registration: ${registration}
Aircraft #: ${aircraftnumber}`;

      printWindow(output);
      status.textContent = "Printed successfully.";
    } else {
      status.textContent = "Error: " + (data.error || "Failed to fetch flight data");
    }
  } catch (err) {
    status.textContent = "Error: " + err.message;
  }
}

async function printTakeoffData() {
  const output = `------ TAKEOFF DATA ------

Takeoff Weight: ${takeoffWeight}`;
  printWindow(output);
}

async function printLandingData() {
  const output = `------ LANDING DATA ------

Landing Weight: ${landingWeight}`;
  printWindow(output);
}

async function printFinalWeightManifest() {
  if (!currentFlightData) {
    document.getElementById("status").textContent = "Error: Please fetch flight data first.";
    return;
  }

  const get = (key) => {
    const keys = key.split(' > ');
    let value = currentFlightData;
    
    for (const k of keys) {
      if (!value) return null;
      value = value[k] || value[k.toLowerCase()] || value[k.toUpperCase()] || 
              value[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()];
      
      if (value && typeof value === 'object' && '_text' in value) {
        value = value._text;
      }
    }
    
    if (value && typeof value === 'string') {
      return value.trim() || "N/A";
    } else if (value && typeof value === 'object' && '_text' in value) {
      return value._text.trim() || "N/A";
    } else if (value) {
      return String(value).trim() || "N/A";
    }
    return "N/A";
  };

  // Get current timestamp
  const now = new Date();
  const timestamp = now.toISOString().substr(11, 8) + "Z";
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateFormatted = now.getDate().toString().padStart(2, '0') + monthNames[now.getMonth()] + now.getFullYear().toString().substr(2);

  // Calculate TOW Change (if previous TOW exists)
  let towChange = "N/A";
  if (manifestData.previousTOW && manifestData.currentTOW) {
    const prev = parseFloat(manifestData.previousTOW.toString().replace(/[^0-9.-]/g, ''));
    const curr = parseFloat(manifestData.currentTOW.toString().replace(/[^0-9.-]/g, ''));
    if (!isNaN(prev) && !isNaN(curr)) {
      const change = curr - prev;
      towChange = change >= 0 ? `+${change.toFixed(0)}` : change.toFixed(0);
      // If change exceeds threshold, show "CALL DD"
      if (Math.abs(change) > 2000) {
        towChange = "CALL DD";
      }
    }
  }

  // Extract numeric values
  const towNum = parseFloat(manifestData.currentTOW.toString().replace(/[^0-9.]/g, ''));
  const zfwNum = parseFloat(manifestData.zfw.toString().replace(/[^0-9.]/g, ''));
  const paxNum = parseInt(manifestData.totalPax) || 0;
  const pilotsNum = parseInt(manifestData.pilots) || 0;
  const fasNum = parseInt(manifestData.fas.toString().replace(/[^0-9]/g, '')) || 0;
  
  // Calculate SOB (Souls On Board)
  // SOB = Passengers + Lap Infants + Pilots + Flight Attendants
  const lapInfants = 0; // Not available from SimBrief, default to 0
  const kids = 0; // Not available from SimBrief, default to 0
  const fdJumpseat = 0; // Not available from SimBrief, default to 0
  const faJumpseat = 0; // Not available from SimBrief, default to 0
  const sob = paxNum + lapInfants + pilotsNum + fasNum;

  // Format registration for header (remove spaces, ensure format)
  const regFormatted = manifestData.registration.replace(/\s/g, '').toUpperCase();
  const regDisplay = regFormatted.startsWith('N') ? `.${regFormatted}` : `.${regFormatted}`;

  // Format passenger display
  const paxFirstNum = parseInt(manifestData.paxFirst) || 0;
  const paxCoachNum = parseInt(manifestData.paxCoach) || 0;
  const paxDisplay = paxFirstNum > 0 ? `${paxFirstNum}/${paxCoachNum}` : `${paxCoachNum}`;
  const paxTotalDisplay = `-${paxNum}-`;

  // Format CG and Trim
  const cgDisplay = manifestData.cg !== "N/A" ? parseFloat(manifestData.cg.toString().replace(/[^0-9.]/g, '')).toFixed(1) : "N/A";
  const trimDisplay = manifestData.trim !== "N/A" ? parseFloat(manifestData.trim.toString().replace(/[^0-9.]/g, '')).toFixed(1) : "N/A";

  // Generate manifest in Boeing format
  const manifest = `AN ${regDisplay}
QUDPCULUA-1FINAL WEIGHTS

1. ${manifestData.airline}${manifestData.flightNumber}/${manifestData.seq.toString().padStart(2, '0')}
   SENT: ${timestamp}

2. TOG: ${isNaN(towNum) ? "N/A" : Math.round(towNum).toString()}

3. SEQ: ${manifestData.seq.toString().padStart(2, '0')}

4. TOW CHG: ${towChange}

5. ZFW: ${isNaN(zfwNum) ? manifestData.zfw : Math.round(zfwNum).toString()}

6. CG: ${cgDisplay}%
   TRIM ${trimDisplay}

7. SOB: ${sob}

8. PSGRS: ${paxDisplay}
   ${paxTotalDisplay}

9. LAP: ${lapInfants.toString().padStart(2, '0')}

10. CREW: ${pilotsNum}/${fasNum}

11. KIDS: ${kids.toString().padStart(2, '0')}

12. FD JUMPSEAT: ${fdJumpseat}

13. FA JUMPSEAT: ${faJumpseat}

14. FLIGHT PLAN RELEASE: -${manifestData.releaseVersion}-

15. FINAL DG SUMMARY (EPNF): ${dateFormatted}/${timestamp}`;

  printWindow(manifest);
  
  // Increment sequence number for next manifest
  manifestData.seq++;
  manifestData.previousTOW = manifestData.currentTOW;
  
  document.getElementById("status").textContent = "Final Weight Manifest printed successfully.";
}

async function printDepartureATIS() {
  try {
    const username = document.getElementById("username").value.trim();
    if (!username) {
      document.getElementById("status").textContent = "Error: Please enter a username first.";
      return;
    }

    const response = await fetch('/api/simbrief/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: username })
    });

    const data = await response.json();
    if (!data.success) {
      document.getElementById("status").textContent = "Error: " + (data.error || "Failed to fetch data");
      return;
    }

    const flightData = data.data;
    const get = (key) => {
      const keys = key.split(' > ');
      let value = flightData;
      for (const k of keys) {
        value = value?.[k] || value?.[k.toLowerCase()] || value?.[k.toUpperCase()];
      }
      return value?.trim() || "N/A";
    };

    const depATIS = get("origin > atis > message") || get("atis") || "N/A";
    const depTAF = get("origin > taf") || get("taf") || "N/A";
    depWeather = get("origin > metar") || get("metar") || "N/A";

    const output = `------ DEPARTURE ATIS ------

${depWeather}

${depATIS}

${depTAF}`;
    printWindow(output);
  } catch (err) {
    document.getElementById("status").textContent = "Error: " + err.message;
  }
}

async function printArrivalATIS() {
  try {
    const username = document.getElementById("username").value.trim();
    if (!username) {
      document.getElementById("status").textContent = "Error: Please enter a username first.";
      return;
    }

    const response = await fetch('/api/simbrief/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username: username })
    });

    const data = await response.json();
    if (!data.success) {
      document.getElementById("status").textContent = "Error: " + (data.error || "Failed to fetch data");
      return;
    }

    const flightData = data.data;
    const get = (key) => {
      const keys = key.split(' > ');
      let value = flightData;
      for (const k of keys) {
        value = value?.[k] || value?.[k.toLowerCase()] || value?.[k.toUpperCase()];
      }
      return value?.trim() || "N/A";
    };

    const arrATIS = get("destination > atis > message") || get("atis") || "N/A";
    const arrTAF = get("destination > taf") || get("taf") || "N/A";
    arrWeather = get("destination > metar") || get("metar") || "N/A";

    const output = `------ ARRIVAL ATIS ------

${arrWeather}

${arrATIS}

${arrTAF}`;
    printWindow(output);
  } catch (err) {
    document.getElementById("status").textContent = "Error: " + err.message;
  }
}

function printWindow(content) {
  const newWindow = window.open('', '', 'width=800,height=600');
  newWindow.document.write(`
    <style>
      @page {
        size: 80mm 297mm;
        margin: 0.1in;
      }
      body {
        font-family: Consolas, monospace;
        font-size: 10pt;
        margin: 0;
        padding: 0;
      }
      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        max-width: 100%;
      }
    </style>
    <pre>${content}</pre>
  `);
  newWindow.document.close();
  newWindow.print();
}

// HOPPIE ACARS Functions
async function sendHoppie() {
  const logon = document.getElementById('hoppie-logon').value;
  const fromCallsign = document.getElementById('from-callsign').value;
  const toCallsign = document.getElementById('to-callsign').value;
  const messageType = document.getElementById('message-type').value;
  const message = document.getElementById('acars-message').value;
  
  if (!logon || !fromCallsign || !toCallsign || !message) {
    document.getElementById('hoppie-status').textContent = 'Error: Please fill in all required fields';
    return;
  }
  
  const statusBox = document.getElementById('hoppie-status');
  statusBox.textContent = 'Sending message via HOPPIE ACARS...';
  
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
      statusBox.textContent = 'Success: ' + data.message;
      document.getElementById('acars-message').value = '';
    } else {
      statusBox.textContent = 'Error: ' + (data.error || 'Unknown error');
    }
  } catch (error) {
    statusBox.textContent = 'Error: ' + error.message;
  }
}

async function pollHoppie() {
  const logon = document.getElementById('hoppie-logon').value;
  const callsign = document.getElementById('from-callsign').value || document.getElementById('to-callsign').value;
  
  if (!logon || !callsign) {
    document.getElementById('hoppie-status').textContent = 'Error: Please enter logon code and callsign';
    return;
  }
  
  const statusBox = document.getElementById('hoppie-status');
  statusBox.textContent = 'Polling HOPPIE ACARS for messages...';
  
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
        let messagesText = 'Received Messages:\n\n';
        data.messages.forEach(msg => {
          messagesText += `From: ${msg.from}\nTo: ${msg.to}\nType: ${msg.type}\nMessage: ${msg.message}\n\n`;
        });
        statusBox.textContent = messagesText;
      } else {
        statusBox.textContent = 'No new messages';
      }
    } else {
      statusBox.textContent = 'Error: ' + (data.error || 'Unknown error');
    }
  } catch (error) {
    statusBox.textContent = 'Error: ' + error.message;
  }
}
