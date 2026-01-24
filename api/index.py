from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# Configuration
SIMBRIEF_API_URL = "https://www.simbrief.com/api/xml.fetcher.php"
HOPPIE_ACARS_URL = "http://www.hoppie.nl/acars/system/connect.html"

@app.route('/api/simbrief/fetch', methods=['POST', 'OPTIONS'])
def fetch_simbrief():
    """Fetch flight data from SimBrief API"""
    if request.method == 'OPTIONS':
        return '', 200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    
    try:
        data = request.get_json() or {}
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
            }), 200, {'Access-Control-Allow-Origin': '*'}
        else:
            return jsonify({
                'error': f'SimBrief API error: {response.status_code}',
                'details': response.text
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

# Export app for Vercel
# Vercel will automatically detect and use this Flask app
__all__ = ['app']
