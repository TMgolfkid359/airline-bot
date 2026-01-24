from flask import Flask, request, jsonify
import requests
import xml.etree.ElementTree as ET

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

# Vercel automatically detects and uses the Flask app instance
# No custom handler needed - just export the app
