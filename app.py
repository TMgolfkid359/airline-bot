from flask import Flask, render_template, request, jsonify
import requests
import json
from datetime import datetime
import os
from dotenv import load_dotenv

from to_data import (
    TOData,
    DepartureRunway,
    TakeoffEnvironment,
    TakeoffConfiguration,
    AssumedConditions,
    ReducedThrustRow,
    MaxThrustData,
    TakeoffLimits,
    MelCdlItem,
    PartialRunwayCode,
    TakeoffNotes,
    make_example_to_data,
)

load_dotenv()

app = Flask(__name__)

# Configuration
SIMBRIEF_API_URL = "https://www.simbrief.com/api/xml.fetcher.php"
HOPPIE_ACARS_URL = "http://www.hoppie.nl/acars/system/connect.html"

@app.route('/')
def index():
    """Main airline portal page"""
    return render_template('index.html')

@app.route('/api/simbrief/fetch', methods=['POST'])
def fetch_simbrief():
    """Fetch flight data from SimBrief API"""
    try:
        data = request.json
        username = data.get('username')
        userid = data.get('userid')
        
        if not username and not userid:
            return jsonify({'error': 'Username or UserID required'}), 400
        
        # SimBrief API parameters
        params = {}
        if username:
            params['username'] = username
        if userid:
            params['userid'] = userid
        
        # Optional parameters
        if 'orig' in data:
            params['orig'] = data['orig']
        if 'dest' in data:
            params['dest'] = data['dest']
        if 'type' in data:
            params['type'] = data['type']
        if 'route' in data:
            params['route'] = data['route']
        
        # Make request to SimBrief API
        response = requests.get(SIMBRIEF_API_URL, params=params, timeout=30)
        
        if response.status_code == 200:
            # Parse XML response
            import xml.etree.ElementTree as ET
            root = ET.fromstring(response.content)
            
            # Convert XML to dictionary for easier handling
            flight_data = {}
            for child in root:
                flight_data[child.tag] = child.text
            
            return jsonify({
                'success': True,
                'data': flight_data
            })
        else:
            return jsonify({
                'error': f'SimBrief API error: {response.status_code}',
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _build_to_data_from_json(data: dict) -> TOData:
    """Build TOData from a JSON payload (e.g. from SimBrief or manual input)."""
    dep = data.get("departure", {})
    env = data.get("environment", {})
    cfg = data.get("configuration", {})
    ass = data.get("assumed", {})
    limits = data.get("limits", {})
    notes = data.get("notes", {})

    to_data = TOData(
        departure=DepartureRunway(
            airport=dep.get("airport", ""),
            runway=dep.get("runway", ""),
            t_proc=dep.get("t_proc", False),
        ),
        environment=TakeoffEnvironment(
            climb_altitude_ft=env.get("climb_altitude_ft"),
            airplane_engine=env.get("airplane_engine", ""),
            temp_c=env.get("temp_c"),
            altimeter_inhg=env.get("altimeter_inhg"),
            wind_mag_deg=env.get("wind_mag_deg"),
            wind_speed_kt=env.get("wind_speed_kt"),
            headwind_kt=env.get("headwind_kt"),
            crosswind_kt=env.get("crosswind_kt"),
            tocg=env.get("tocg"),
            trim=env.get("trim"),
            runway_condition=env.get("runway_condition", "DRY"),
        ),
        configuration=TakeoffConfiguration(
            flaps=cfg.get("flaps", 1),
            bleeds_on=cfg.get("bleeds_on", True),
            anti_ice_off=cfg.get("anti_ice_off", True),
        ),
        assumed=AssumedConditions(
            assumed_weight=ass.get("assumed_weight"),
            assumed_temp_c=ass.get("assumed_temp_c"),
        ),
        reduced_thrust_na=data.get("reduced_thrust_na", False),
        limits=TakeoffLimits(
            thr_red_ft_msl=limits.get("thr_red_ft_msl"),
            thr_red_afe_ft=limits.get("thr_red_afe_ft"),
            acc_alt_ft_msl=limits.get("acc_alt_ft_msl"),
            acc_alt_afe_ft=limits.get("acc_alt_afe_ft"),
            mtog=limits.get("mtog"),
            vr_max=limits.get("vr_max"),
        ),
        notes=TakeoffNotes(
            track_instructions=notes.get("track_instructions", ""),
            engine_failure_procedure=notes.get("engine_failure_procedure", ""),
        ),
        message_identifier=data.get("message_identifier", ""),
    )

    if not to_data.reduced_thrust_na:
        if data.get("reduced_epr_row"):
            r = data["reduced_epr_row"]
            to_data.reduced_epr_row = ReducedThrustRow(
                n1=r.get("n1"),
                headwind_kt=r.get("headwind_kt"),
                v1=r.get("v1"),
                vr=r.get("vr"),
                v2=r.get("v2"),
                n1_display=r.get("n1_display"),
            )
        for tw in data.get("tw_epr_rows", []):
            to_data.tw_epr_rows.append(
                ReducedThrustRow(
                    n1=tw.get("n1"),
                    tailwind_kt=tw.get("tailwind_kt"),
                    assumed_temp_c=tw.get("assumed_temp_c"),
                    v1=tw.get("v1"),
                    vr=tw.get("vr"),
                    v2=tw.get("v2"),
                    n1_display=tw.get("n1_display"),
                )
            )
        if data.get("max_epr"):
            m = data["max_epr"]
            to_data.max_epr = MaxThrustData(
                n1=m.get("n1"),
                tog=m.get("tog"),
                v1=m.get("v1"),
                vr=m.get("vr"),
                v2=m.get("v2"),
            )

    for item in data.get("mel_cdl", []):
        to_data.mel_cdl.append(
            MelCdlItem(code=item.get("code", ""), description=item.get("description", ""))
        )
    for pr in data.get("partial_runway_codes", []):
        to_data.partial_runway_codes.append(
            PartialRunwayCode(
                runway_intersection=pr.get("runway_intersection", ""),
                length_ft=pr.get("length_ft"),
                code=pr.get("code", ""),
            )
        )

    return to_data


@app.route('/api/to-data/example', methods=['GET'])
def to_data_example():
    """Return example ACARS Takeoff Data message (DEN 16R, 737-800)."""
    try:
        to_data = make_example_to_data()
        return jsonify({
            'success': True,
            'message': to_data.to_acars_message(),
            'lines': to_data.to_acars_lines(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/to-data/build', methods=['POST'])
def to_data_build():
    """Build ACARS Takeoff Data message from JSON payload."""
    try:
        data = request.json or {}
        to_data = _build_to_data_from_json(data)
        return jsonify({
            'success': True,
            'message': to_data.to_acars_message(),
            'lines': to_data.to_acars_lines(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/hoppie/send', methods=['POST'])
def send_hoppie():
    """Send message to aircraft via HOPPIE ACARS"""
    try:
        data = request.json
        logon = data.get('logon')  # HOPPIE logon code
        from_callsign = data.get('from_callsign')
        to_callsign = data.get('to_callsign')
        message_type = data.get('message_type', 'telex')  # telex, ocl, cpdlc, etc.
        message = data.get('message')
        
        if not all([logon, from_callsign, to_callsign, message]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # HOPPIE ACARS API parameters
        params = {
            'logon': logon,
            'from': from_callsign,
            'to': to_callsign,
            'type': message_type,
            'packet': message
        }
        
        # Make request to HOPPIE ACARS
        response = requests.get(HOPPIE_ACARS_URL, params=params, timeout=15)
        
        if response.status_code == 200:
            # HOPPIE returns responses like "ok" or error messages
            result = response.text.strip()
            if result == 'ok':
                return jsonify({
                    'success': True,
                    'message': 'Message sent successfully'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result
                }), 400
        else:
            return jsonify({
                'error': f'HOPPIE ACARS error: {response.status_code}',
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/hoppie/poll', methods=['POST'])
def poll_hoppie():
    """Poll HOPPIE ACARS for incoming messages"""
    try:
        data = request.json
        logon = data.get('logon')
        callsign = data.get('callsign')
        
        if not logon or not callsign:
            return jsonify({'error': 'Logon and callsign required'}), 400
        
        # Poll for messages
        params = {
            'logon': logon,
            'from': callsign,
            'to': callsign,
            'type': 'poll'
        }
        
        response = requests.get(HOPPIE_ACARS_URL, params=params, timeout=15)
        
        if response.status_code == 200:
            result = response.text.strip()
            if result == 'ok' or result.startswith('ok'):
                # Parse messages if any
                messages = []
                if result != 'ok':
                    # HOPPIE returns messages in format: ok {from} {to} {type} {message}
                    parts = result.split(' ', 4)
                    if len(parts) >= 5:
                        messages.append({
                            'from': parts[1],
                            'to': parts[2],
                            'type': parts[3],
                            'message': parts[4]
                        })
                
                return jsonify({
                    'success': True,
                    'messages': messages
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result
                }), 400
        else:
            return jsonify({
                'error': f'HOPPIE ACARS error: {response.status_code}'
            }), response.status_code
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

