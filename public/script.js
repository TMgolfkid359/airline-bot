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

// ACARS Message Log
let messageLog = [];
let autoPollInterval = null;
let isConnected = false;

// Initialize log on page load
document.addEventListener('DOMContentLoaded', () => {
  addLogEntry('system', null, null, null, 'RealACARS initialized. Ready to connect.');
});

// Event listeners
document.getElementById("fetchBtn").addEventListener("click", fetchSummary);
document.getElementById("takeoffBtn").addEventListener("click", printTakeoffData);
document.getElementById("landingBtn").addEventListener("click", printLandingData);
document.getElementById("takeoffPerfBtn").addEventListener("click", printTakeoffPerformanceCard);
document.getElementById("finalWeightBtn").addEventListener("click", printFinalWeightManifest);
document.getElementById("departureAtisBtn").addEventListener("click", printDepartureATIS);
document.getElementById("arrivalAtisBtn").addEventListener("click", printArrivalATIS);
document.getElementById("sendBtn").addEventListener("click", sendHoppie);
document.getElementById("connectBtn").addEventListener("click", toggleConnection);
document.getElementById("clearBtn").addEventListener("click", clearMessage);
document.getElementById("autoPollBtn").addEventListener("click", toggleAutoPoll);
document.getElementById("clearLogBtn").addEventListener("click", clearLog);
document.getElementById("exportLogBtn").addEventListener("click", exportLog);

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

      // Build ACARS takeoff data from OFP and prefill message for sending
      try {
        const toResponse = await fetch('/api/to-data/from-ofp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: flightData })
        });
        const toResult = await toResponse.json();
        if (toResult.success && toResult.message) {
          lastTakeoffDataFromOFP = toResult.message;
          document.getElementById("acars-message").value = toResult.message;
        }
      } catch (_) { /* non-fatal */ }

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
      addLogEntry('system', null, null, null, 'Flight summary fetched and printed successfully.');
    } else {
      status.textContent = "Error: " + (data.error || "Failed to fetch flight data");
      addLogEntry('error', null, null, null, `SimBrief fetch failed: ${data.error || 'Unknown error'}`, true);
    }
  } catch (err) {
    status.textContent = "Error: " + err.message;
    addLogEntry('error', null, null, null, `SimBrief error: ${err.message}`, true);
  }
}

// Last ACARS takeoff message built from OFP (for printing/sending)
let lastTakeoffDataFromOFP = null;

async function printTakeoffData() {
  if (!currentFlightData) {
    document.getElementById("status").textContent = "Error: Please fetch flight data first.";
    return;
  }
  try {
    const response = await fetch('/api/to-data/from-ofp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: currentFlightData })
    });
    const result = await response.json();
    if (!result.success) {
      document.getElementById("status").textContent = "Error: " + (result.error || "Failed to build TO data from OFP");
      return;
    }
    lastTakeoffDataFromOFP = result.message;
    document.getElementById("acars-message").value = result.message;
    const output = `------ ACARS TAKEOFF DATA (FROM OFP) ------\n\n${result.message}`;
    printWindow(output);
    document.getElementById("status").textContent = "Takeoff data from OFP printed and loaded into message.";
  } catch (err) {
    document.getElementById("status").textContent = "Error: " + err.message;
  }
}

async function printLandingData() {
  const output = `------ LANDING DATA ------

Landing Weight: ${landingWeight}`;
  printWindow(output);
}

// Helper function to parse METAR
function parseMETAR(metar) {
  if (!metar || metar === "N/A") return {};
  
  const result = {};
  
  // Extract temperature (format: XX/XX or MXX/MXX)
  const tempMatch = metar.match(/\s(\d{2}|M\d{2})\/(\d{2}|M\d{2})\s/);
  if (tempMatch) {
    let temp = tempMatch[1].replace('M', '-');
    result.temp = parseInt(temp) + "C";
  }
  
  // Extract altimeter (format: A29XX or Q10XX)
  const altMatch = metar.match(/\s(A\d{4}|Q\d{4})\s/);
  if (altMatch) {
    const alt = altMatch[1];
    if (alt.startsWith('A')) {
      result.altimeter = alt.substring(1, 3) + "." + alt.substring(3);
    } else if (alt.startsWith('Q')) {
      result.altimeter = (parseInt(alt.substring(1)) / 100).toFixed(2);
    }
  }
  
  // Extract wind (format: XXXXXKT or XXXXXGXXKT)
  const windMatch = metar.match(/(\d{3})(\d{2,3})(G\d{2,3})?KT/);
  if (windMatch) {
    result.windDir = windMatch[1];
    result.windSpd = windMatch[2];
    result.wind = windMatch[1] + "/" + windMatch[2];
  }
  
  // Extract runway condition
  if (metar.includes("DRY") || metar.includes("RY")) {
    result.rwyCondition = "DRY";
  } else if (metar.includes("WET") || metar.includes("W")) {
    result.rwyCondition = "WET";
  } else if (metar.includes("SNOW") || metar.includes("SN")) {
    result.rwyCondition = "SNOW";
  }
  
  return result;
}

// Helper function to calculate headwind/crosswind
function calculateWindComponents(windDir, windSpd, runwayHeading) {
  if (!windDir || !windSpd || !runwayHeading || windDir === "N/A" || windSpd === "N/A") {
    return { headwind: "[CALCULATE]", crosswind: "[CALCULATE]" };
  }
  
  const windDirNum = parseInt(windDir);
  const windSpdNum = parseInt(windSpd);
  const rwyNum = parseInt(runwayHeading);
  
  if (isNaN(windDirNum) || isNaN(windSpdNum) || isNaN(rwyNum)) {
    return { headwind: "[CALCULATE]", crosswind: "[CALCULATE]" };
  }
  
  const windAngle = (windDirNum - rwyNum + 360) % 360;
  const headwind = Math.round(windSpdNum * Math.cos(windAngle * Math.PI / 180));
  const crosswind = Math.round(windSpdNum * Math.sin(windAngle * Math.PI / 180));
  
  return { headwind: headwind + "KT", crosswind: Math.abs(crosswind) + "KT" };
}

async function printTakeoffPerformanceCard() {
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

  // Extract takeoff performance data
  const depICAO = get("origin > icao_code") || get("origin") || "N/A";
  const runway = get("origin > plan_rwy") || get("origin > rwy") || get("origrwy") || get("origin > runway") || "[EDIT]";
  const takeoffProc = get("origin > sid") || get("origin > departure_procedure") || get("origin > sid_name") || "[EDIT]";
  const initialAlt = get("general > initial_altitude") || get("altitude") || get("general > cruise_altitude") || "N/A";
  const aircraftType = get("aircraft > name") || get("aircraft") || get("aircraft > icao") || "N/A";
  const engines = get("aircraft > engines") || get("aircraft > engine_type") || "[EDIT]";
  
  // Parse METAR for environmental data
  const metar = get("origin > metar") || depWeather || "N/A";
  const metarData = parseMETAR(metar);
  
  // Environmental data - try multiple sources
  const temp = get("origin > temp") || get("origin > temperature") || metarData.temp || "[EDIT]";
  const altimeter = get("origin > altimeter") || get("origin > qnh") || get("origin > pressure") || metarData.altimeter || "[EDIT]";
  const windDir = get("origin > wind_dir") || get("origin > wind_direction") || metarData.windDir || "[EDIT]";
  const windSpd = get("origin > wind_spd") || get("origin > wind_speed") || metarData.windSpd || "[EDIT]";
  const wind = metarData.wind || (windDir !== "[EDIT]" && windSpd !== "[EDIT]" ? `${windDir}/${windSpd}` : "[EDIT]");
  
  // Calculate headwind/crosswind if we have runway heading
  const runwayHeading = runway.match(/\d{2}/) ? runway.match(/\d{2}/)[0] + "0" : null;
  const windComponents = calculateWindComponents(windDir, windSpd, runwayHeading);
  const headwind = windComponents.headwind;
  const crosswind = windComponents.crosswind;
  
  // Weight and balance
  const tow = get("weights > est_tow") || get("weights > tow") || get("weights > takeoff_weight") || manifestData.currentTOW || "[EDIT]";
  const cg = get("weights > cg") || get("weights > percent_cg") || get("weights > cg_percent") || manifestData.cg || "[EDIT]";
  const trim = get("weights > trim") || get("weights > trim_setting") || get("weights > trim_value") || manifestData.trim || "[EDIT]";
  const mtow = get("weights > mtow") || get("weights > max_takeoff_weight") || get("aircraft > mtow") || "[EDIT]";
  
  // Runway condition
  const rwyCondition = get("origin > rwy_condition") || get("origin > runway_condition") || metarData.rwyCondition || get("origin > surface") || "[EDIT]";
  
  // Configuration (not in SimBrief - placeholders)
  const flaps = get("takeoff > flaps") || get("takeoff > flap_setting") || "[EDIT]";
  const bleeds = "[EDIT]";
  const antiIce = "[EDIT]";
  
  // Assumed values
  const assumedWeight = tow !== "[EDIT]" ? tow : "[EDIT]";
  const assumedTemp = get("takeoff > assumed_temp") || get("takeoff > flex_temp") || "[EDIT]";
  
  // Takeoff performance (if TLR enabled)
  const v1 = get("takeoff > v1") || get("takeoff > v1_speed") || "[EDIT]";
  const vr = get("takeoff > vr") || get("takeoff > rotation_speed") || get("takeoff > vr_speed") || "[EDIT]";
  const v2 = get("takeoff > v2") || get("takeoff > v2_speed") || "[EDIT]";
  const vrMax = get("takeoff > vr_max") || get("takeoff > max_rotation") || "[EDIT]";
  
  // Altitudes
  const depElev = get("origin > elevation") || get("origin > field_elevation") || "0";
  const depElevNum = parseFloat(depElev.toString().replace(/[^0-9.-]/g, '')) || 0;
  
  const thrRedAlt = get("takeoff > thr_red_alt") || get("takeoff > thrust_reduction_altitude") || get("takeoff > thr_red") || "[EDIT]";
  const thrRedAltNum = parseFloat(thrRedAlt.toString().replace(/[^0-9.-]/g, ''));
  const thrRedAFE = !isNaN(thrRedAltNum) && depElevNum > 0 ? Math.round(thrRedAltNum - depElevNum) + " AFE" : "[CALCULATE]";
  
  const accelAlt = get("takeoff > accel_alt") || get("takeoff > acceleration_altitude") || get("takeoff > accel") || "[EDIT]";
  const accelAltNum = parseFloat(accelAlt.toString().replace(/[^0-9.-]/g, ''));
  const accelAFE = !isNaN(accelAltNum) && depElevNum > 0 ? Math.round(accelAltNum - depElevNum) + " AFE" : "[CALCULATE]";
  
  // Departure procedure details
  const sid = get("origin > sid") || get("origin > departure_procedure") || get("origin > sid_name") || "[EDIT]";
  const sidTransition = get("origin > sid_transition") || get("origin > transition") || "";
  const departureInstructions = get("origin > departure_instructions") || get("origin > departure_text") || get("origin > sid_text") || "[EDIT]";
  
  // Try to extract departure details from route
  const route = get("general > route") || get("route") || "";
  const routeParts = route.split(" ");
  const departureText = departureInstructions !== "[EDIT]" ? departureInstructions : 
                       (sid ? `RCL TO ${sid}` : "[EDIT DEPARTURE INSTRUCTIONS]");
  
  // MEL/CDL (not in SimBrief)
  const melCdl = get("aircraft > mel") || get("aircraft > cdl") || "[EDIT]";
  
  // Partial runway codes (not in SimBrief)
  const partialRunways = get("origin > partial_runways") || "[EDIT]";
  
  // Engine performance (not in SimBrief - placeholders)
  const reducedEPRN1 = get("takeoff > reduced_epr_n1") || get("takeoff > reduced_n1") || "[EDIT]";
  const reducedEPRHW = headwind !== "[CALCULATE]" ? headwind : "[EDIT]";
  const reducedEPRV1 = v1 !== "[EDIT]" ? v1 : "[EDIT]";
  const reducedEPRVR = vr !== "[EDIT]" ? vr : "[EDIT]";
  const reducedEPRV2 = v2 !== "[EDIT]" ? v2 : "[EDIT]";
  
  const maxEPRN1 = get("takeoff > max_epr_n1") || get("takeoff > max_n1") || "[EDIT]";
  const maxEPRTOG = tow !== "[EDIT]" ? tow : "[EDIT]";
  const maxEPRV1 = v1 !== "[EDIT]" ? v1 : "[EDIT]";
  const maxEPRVR = vr !== "[EDIT]" ? vr : "[EDIT]";
  const maxEPRV2 = v2 !== "[EDIT]" ? v2 : "[EDIT]";
  
  // Format the takeoff performance card
  const card = `T/O ${depICAO} ${runway}${takeoffProc && takeoffProc !== "[EDIT]" ? " *" + takeoffProc + "*" : ""}
${initialAlt} FT
${aircraftType} ${engines}
TEMP ${temp} ALT ${altimeter}
WIND ${wind} MAG
${headwind} HW ${crosswind} XW
TOCG/TRIM ${cg}/${trim}
${rwyCondition}
*FLAPS ${flaps}* *BLEEDS ${bleeds}* *ANTI-ICE ${antiIce}*
ASSMD WT: ${assumedWeight}
ASSMD TMP: ${assumedTemp}

REDUCED EPR:
N1    *HW*  V1   VR   V2
${reducedEPRN1}   ${reducedEPRHW}   ${reducedEPRV1}   ${reducedEPRVR}   ${reducedEPRV2}

TW EPR N1 ATMP V1/VR/V2
0    ---00  30C  50/62/65
5    ---01  27C  46/59/62
10   N/A N/A

MAX EPR:
N1    TOG   V1   VR   V2
${maxEPRN1}   ${maxEPRTOG}   ${maxEPRV1}   ${maxEPRVR}   ${maxEPRV2}

THR RED ${thrRedAlt} (${thrRedAFE} AFE)
ACC ALT ${accelAlt} (${accelAFE} AFE)

MTOG ${mtow} VR MAX ${vrMax}
MEL/CDL ${melCdl}

PARTIAL RUNWAY CODES:
${partialRunways}

${departureText}
ACCEL ALT: ${accelAlt} MSL/ ${accelAFE}`;

  printWindow(card);
  document.getElementById("status").textContent = "Takeoff Performance Card generated. Edit as needed.";
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

// ACARS Log Functions
function addLogEntry(type, from, to, messageType, message, isError = false) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = {
    timestamp,
    type,
    from,
    to,
    messageType,
    message,
    isError
  };
  
  messageLog.push(entry);
  updateLogDisplay();
  
  // Auto-scroll to bottom
  const logContainer = document.getElementById('acarsLog');
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateLogDisplay() {
  const logContainer = document.getElementById('acarsLog');
  logContainer.innerHTML = '';
  
  messageLog.forEach(entry => {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${entry.type}${entry.isError ? ' error' : ''}`;
    
    let content = `<span class="timestamp">[${entry.timestamp}]</span>`;
    
    if (entry.from && entry.to) {
      content += `<span class="from-to">${entry.from} → ${entry.to}</span>`;
    }
    
    if (entry.messageType) {
      content += `<span class="message-type">[${entry.messageType.toUpperCase()}]</span>`;
    }
    
    content += `<span class="message">${escapeHtml(entry.message)}</span>`;
    
    logEntry.innerHTML = content;
    logContainer.appendChild(logEntry);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clearLog() {
  messageLog = [];
  addLogEntry('system', null, null, null, 'Log cleared by user.');
}

function exportLog() {
  const logText = messageLog.map(entry => {
    return `[${entry.timestamp}] ${entry.from || ''} ${entry.to ? '→ ' + entry.to : ''} [${entry.messageType || 'SYSTEM'}] ${entry.message}`;
  }).join('\n');
  
  const blob = new Blob([logText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acars_log_${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  addLogEntry('system', null, null, null, 'Log exported successfully.');
}

function updateConnectionStatus(connected) {
  isConnected = connected;
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  if (connected) {
    indicator.classList.add('connected');
    statusText.textContent = 'CONNECTED';
    addLogEntry('system', null, null, null, 'ACARS connection established.');
  } else {
    indicator.classList.remove('connected');
    statusText.textContent = 'DISCONNECTED';
    addLogEntry('system', null, null, null, 'ACARS connection closed.');
  }
}

function toggleConnection() {
  const logon = document.getElementById('hoppie-logon').value;
  const fromCallsign = document.getElementById('from-callsign').value;
  const toCallsign = document.getElementById('to-callsign').value;
  
  if (!isConnected) {
    if (!logon || !fromCallsign || !toCallsign) {
      addLogEntry('system', null, null, null, 'Error: Please fill in logon code and callsigns.', true);
      return;
    }
    updateConnectionStatus(true);
    document.getElementById('connectBtn').textContent = 'Disconnect';
    // Start auto-polling if enabled
    if (autoPollInterval) {
      startAutoPoll();
    }
  } else {
    updateConnectionStatus(false);
    document.getElementById('connectBtn').textContent = 'Connect';
    stopAutoPoll();
  }
}

function toggleAutoPoll() {
  if (autoPollInterval) {
    stopAutoPoll();
    document.getElementById('autoPollBtn').textContent = 'Auto Poll';
    addLogEntry('system', null, null, null, 'Auto-polling disabled.');
  } else {
    if (!isConnected) {
      addLogEntry('system', null, null, null, 'Error: Please connect first.', true);
      return;
    }
    startAutoPoll();
    document.getElementById('autoPollBtn').textContent = 'Stop Poll';
    addLogEntry('system', null, null, null, 'Auto-polling enabled (45-75s interval).');
  }
}

function startAutoPoll() {
  if (autoPollInterval) return;
  
  // Random interval between 45-75 seconds as per HOPPIE recommendations
  const pollInterval = () => {
    const minInterval = 45000; // 45 seconds
    const maxInterval = 75000; // 75 seconds
    const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
    
    autoPollInterval = setTimeout(() => {
      pollHoppie();
      pollInterval(); // Schedule next poll
    }, interval);
  };
  
  pollInterval();
}

function stopAutoPoll() {
  if (autoPollInterval) {
    clearTimeout(autoPollInterval);
    autoPollInterval = null;
  }
}

function clearMessage() {
  document.getElementById('acars-message').value = '';
}

// HOPPIE ACARS Functions
async function sendHoppie() {
  const logon = document.getElementById('hoppie-logon').value;
  const fromCallsign = document.getElementById('from-callsign').value;
  const toCallsign = document.getElementById('to-callsign').value;
  const messageType = document.getElementById('message-type').value;
  const message = document.getElementById('acars-message').value;
  
  if (!logon || !fromCallsign || !toCallsign || !message) {
    addLogEntry('system', null, null, null, 'Error: Please fill in all required fields.', true);
    return;
  }
  
  addLogEntry('sent', fromCallsign, toCallsign, messageType, message);
  
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
      addLogEntry('system', null, null, null, `Message sent successfully to ${toCallsign}.`);
      document.getElementById('acars-message').value = '';
    } else {
      addLogEntry('error', fromCallsign, toCallsign, messageType, `Send failed: ${data.error || 'Unknown error'}`, true);
    }
  } catch (error) {
    addLogEntry('error', fromCallsign, toCallsign, messageType, `Send error: ${error.message}`, true);
  }
}

async function pollHoppie() {
  const logon = document.getElementById('hoppie-logon').value;
  const callsign = document.getElementById('from-callsign').value || document.getElementById('to-callsign').value;
  
  if (!logon || !callsign) {
    addLogEntry('system', null, null, null, 'Error: Please enter logon code and callsign', true);
    return;
  }
  
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
        data.messages.forEach(msg => {
          addLogEntry('received', msg.from, msg.to, msg.type, msg.message);
        });
        addLogEntry('system', null, null, null, `Received ${data.messages.length} message(s).`);
      }
      // Don't log "no messages" to avoid spam during auto-polling
    } else {
      addLogEntry('error', null, null, null, `Poll failed: ${data.error || 'Unknown error'}`, true);
    }
  } catch (error) {
    addLogEntry('error', null, null, null, `Poll error: ${error.message}`, true);
  }
}
