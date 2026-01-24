# Airline Operations Portal Bot

A modern web-based airline portal that integrates with SimBrief API to fetch flight plans and HOPPIE ACARS to communicate with aircraft.

## Features

- ✈️ **SimBrief Integration**: Fetch comprehensive flight plans, routes, weather, and fuel calculations
- 📡 **HOPPIE ACARS Communication**: Send messages to aircraft via ACARS system
- 🎨 **Modern UI**: Beautiful, responsive airline portal interface
- ⚡ **Quick Actions**: One-click functions to send flight plans, weather requests, and clearances

## Prerequisites

1. **SimBrief Account**: You need a SimBrief account (username or user ID)
   - Sign up at [SimBrief](https://www.simbrief.com/)
   - Note: For API access, you may need to contact SimBrief support

2. **HOPPIE ACARS Account**: You need to register for HOPPIE ACARS
   - Register at [HOPPIE ACARS](https://www.hoppie.nl/acars/)
   - Obtain your logon code after registration

3. **Python 3.8+**: Make sure Python is installed on your system

## Installation

1. **Clone or download this repository**

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration if needed
   ```

## Usage

1. **Start the Flask server**:
   ```bash
   python app.py
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

3. **Use the portal**:
   - **SimBrief Section**: Enter your SimBrief username/user ID and optional flight parameters (origin, destination, aircraft type) to fetch flight plans
   - **HOPPIE ACARS Section**: Enter your HOPPIE logon code, callsigns, and message to send ACARS messages to your aircraft
   - **Quick Actions**: Use the quick action buttons to send common messages like flight plans, weather requests, or clearance requests

## API Endpoints

### SimBrief
- `POST /api/simbrief/fetch` - Fetch flight plan data from SimBrief
  - Body: `{ "username": "...", "userid": "...", "orig": "...", "dest": "...", "type": "...", "route": "..." }`

### HOPPIE ACARS
- `POST /api/hoppie/send` - Send message to aircraft
  - Body: `{ "logon": "...", "from_callsign": "...", "to_callsign": "...", "message_type": "telex", "message": "..." }`
- `POST /api/hoppie/poll` - Poll for incoming messages
  - Body: `{ "logon": "...", "callsign": "..." }`

## Configuration

The application uses environment variables for configuration. Create a `.env` file based on `.env.example` if you need to customize settings.

## Notes

- **HOPPIE ACARS Polling**: The HOPPIE ACARS system recommends polling every 45-75 seconds. The portal allows manual polling via the "Poll for Messages" button.
- **SimBrief API**: The API works with username or user ID. You can specify optional parameters like origin, destination, and aircraft type to generate new flight plans.
- **Message Types**: Supported HOPPIE message types include: `telex`, `ocl`, `cpdlc`, and `poll`.

## Deployment

### Deploy to Vercel

This project is configured for deployment to Vercel. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

**Quick Deploy:**

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Follow the prompts to deploy

Or deploy via the [Vercel Dashboard](https://vercel.com/dashboard) by importing your Git repository.

**Note**: Vercel's free tier has a 10-second timeout limit. For longer-running operations, consider Vercel Pro or alternative platforms like Railway or Render.

## Troubleshooting

- **SimBrief API Errors**: Make sure your username/user ID is correct and you have an active SimBrief account
- **HOPPIE ACARS Errors**: Verify your logon code is correct and your callsigns are properly formatted
- **Connection Issues**: Check your internet connection and ensure both SimBrief and HOPPIE servers are accessible
- **Vercel Deployment Issues**: See [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting tips

## License

This project is provided as-is for personal use.

