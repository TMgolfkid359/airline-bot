from flask import Flask, request, jsonify
import requests
import xml.etree.ElementTree as ET
import os
import sys

# Ensure project root is on path for to_data (Vercel deploys full repo)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

app = Flask(__name__)

# Configuration
SIMBRIEF_API_URL = "https://www.simbrief.com/api/xml.fetcher.php"
HOPPIE_ACARS_URL = "http://www.hoppie.nl/acars/system/connect.html"

def parse_xml_to_dict(element):
    """Recursively parse XML element to dictionary"""
    result = {}
    
    # Add text content if present
    if element.text and element.text.strip():
        result['_text'] = element.text.strip()
    
    # Process child elements
    for child in element:
        tag = child.tag
        if len(child) == 0:  # Leaf node
            text = child.text.strip() if child.text else ''
            # If tag already exists, make it a list
            if tag in result:
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(text)
            else:
                result[tag] = text
        else:  # Has children
            child_dict = parse_xml_to_dict(child)
            if tag in result:
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(child_dict)
            else:
                result[tag] = child_dict
    
    return result

@app.route('/api/simbrief/fetch', methods=['POST', 'OPTIONS'])
def fetch_simbrief():
    """Fetch flight data from SimBrief API using official Navigraph API parameters"""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    
    try:
        data = request.get_json() or {}
        
        # Build SimBrief API parameters according to official documentation
        # https://developers.navigraph.com/docs/simbrief/using-the-api
        params = {}
        
        # User identification (one of these is required)
        if data.get('username'):
            params['username'] = data['username']
        elif data.get('userid'):
            params['userid'] = data['userid']
        elif data.get('static_id'):
            params['static_id'] = data['static_id']
            if data.get('userid'):
                params['userid'] = data['userid']
        else:
            return jsonify({'error': 'Username, UserID, or Static ID required'}), 400
        
        # Minimum required parameters for generating new flight plans
        if data.get('orig'):
            params['orig'] = data['orig'].upper()
        if data.get('dest'):
            params['dest'] = data['dest'].upper()
        if data.get('type'):
            params['type'] = data['type'].upper()
        
        # Optional dispatch parameters
        optional_params = [
            'airline', 'fltnum', 'route', 'date', 'deph', 'depm',
            'steh', 'stem', 'reg', 'fin', 'selcal', 'callsign',
            'pax', 'altn', 'fl', 'cpt', 'dxname', 'pid', 'fuelfactor',
            'manualzfw', 'addedfuel', 'addedfuel_units', 'contpct',
            'resvrule', 'taxiout', 'taxiin', 'cargo', 'origrwy', 'destrwy',
            'climb', 'descent', 'cruise', 'civalue', 'acdata', 'etopsrule',
            'altn_count', 'altn_avoid', 'manualrmk', 'static_id'
        ]
        
        for param in optional_params:
            if param in data and data[param]:
                params[param] = data[param]
        
        # Alternate airports (altn_1_id, altn_1_rwy, altn_1_route, etc.)
        for i in range(1, 5):
            for suffix in ['_id', '_rwy', '_route']:
                key = f'altn_{i}{suffix}'
                if key in data and data[key]:
                    params[key] = data[key]
        
        # OFP Options
        ofp_options = [
            'planformat', 'units', 'navlog', 'etops', 'stepclimbs',
            'tlr', 'notams', 'firnot', 'maps', 'omit_sids', 'omit_stars', 'find_sidstar'
        ]
        
        for option in ofp_options:
            if option in data:
                params[option] = data[option]
        
        # Make request to SimBrief API
        response = requests.get(SIMBRIEF_API_URL, params=params, timeout=30)
        
        if response.status_code == 200:
            try:
                # Parse XML response
                root = ET.fromstring(response.content)
                
                # Convert XML to nested dictionary
                flight_data = parse_xml_to_dict(root)
                
                return jsonify({
                    'success': True,
                    'data': flight_data
                }), 200, {'Access-Control-Allow-Origin': '*'}
            except ET.ParseError as e:
                return jsonify({
                    'error': f'XML parsing error: {str(e)}',
                    'raw_response': response.text[:500]
                }), 500, {'Access-Control-Allow-Origin': '*'}
        else:
            return jsonify({
                'error': f'SimBrief API error: {response.status_code}',
                'details': response.text[:500]
            }), response.status_code, {'Access-Control-Allow-Origin': '*'}
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500, {'Access-Control-Allow-Origin': '*'}

@app.route('/api/hoppie/send', methods=['POST', 'OPTIONS'])
def send_hoppie():
    """Send message to aircraft via HOPPIE ACARS"""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    
    try:
        data = request.get_json() or {}
        logon = data.get('logon')
        from_callsign = data.get('from_callsign')
        to_callsign = data.get('to_callsign')
        message_type = data.get('message_type', 'telex')
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
                }), 200, {'Access-Control-Allow-Origin': '*'}
            else:
                return jsonify({
                    'success': False,
                    'error': result
                }), 400, {'Access-Control-Allow-Origin': '*'}
        else:
            return jsonify({
                'error': f'HOPPIE ACARS error: {response.status_code}',
                'details': response.text
            }), response.status_code, {'Access-Control-Allow-Origin': '*'}
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500, {'Access-Control-Allow-Origin': '*'}

@app.route('/api/hoppie/poll', methods=['POST', 'OPTIONS'])
def poll_hoppie():
    """Poll HOPPIE ACARS for incoming messages"""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    
    try:
        data = request.get_json() or {}
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
                }), 200, {'Access-Control-Allow-Origin': '*'}
            else:
                return jsonify({
                    'success': False,
                    'error': result
                }), 400, {'Access-Control-Allow-Origin': '*'}
        else:
            return jsonify({
                'error': f'HOPPIE ACARS error: {response.status_code}'
            }), response.status_code, {'Access-Control-Allow-Origin': '*'}
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500, {'Access-Control-Allow-Origin': '*'}

def _build_to_data_from_json(data):
    """Build TOData from JSON payload."""
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


@app.route('/api/to-data/example', methods=['GET', 'OPTIONS'])
def to_data_example():
    """Return example ACARS Takeoff Data message."""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    try:
        to_data = make_example_to_data()
        return jsonify({
            'success': True,
            'message': to_data.to_acars_message(),
            'lines': to_data.to_acars_lines(),
        }), 200, {'Access-Control-Allow-Origin': '*'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500, {'Access-Control-Allow-Origin': '*'}


@app.route('/api/to-data/build', methods=['POST', 'OPTIONS'])
def to_data_build():
    """Build ACARS Takeoff Data message from JSON payload."""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    try:
        data = request.get_json() or {}
        to_data = _build_to_data_from_json(data)
        return jsonify({
            'success': True,
            'message': to_data.to_acars_message(),
            'lines': to_data.to_acars_lines(),
        }), 200, {'Access-Control-Allow-Origin': '*'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500, {'Access-Control-Allow-Origin': '*'}


# Vercel automatically detects and uses the Flask app instance
# No custom handler needed - just export the app
