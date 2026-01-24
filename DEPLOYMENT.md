# Deploying to Vercel

This guide will help you deploy your Airline Operations Portal to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free account works)
2. **Vercel CLI**: Install globally with `npm i -g vercel` (optional, but recommended)
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push to Git Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Import Project in Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Vercel will auto-detect the Python project

3. **Configure Build Settings**:
   - Framework Preset: **Other**
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `pip install -r requirements.txt`

4. **Environment Variables** (Optional):
   - If you need any environment variables, add them in the Vercel dashboard under Settings > Environment Variables

5. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new
   - Confirm project settings
   - Deploy

5. **For production deployment**:
   ```bash
   vercel --prod
   ```

## Project Structure for Vercel

```
.
├── api/
│   └── index.py          # Serverless function handler
├── static/
│   ├── style.css         # Styles
│   └── script.js         # Frontend JavaScript
├── templates/
│   └── index.html        # Main HTML page
├── vercel.json           # Vercel configuration
├── requirements.txt      # Python dependencies
└── .vercelignore         # Files to ignore
```

## Important Notes

1. **API Routes**: All API endpoints are handled by `/api/index.py` as serverless functions
2. **Static Files**: Served from `/static/` directory
3. **Main Page**: Served from `/templates/index.html`
4. **CORS**: CORS headers are included in API responses for cross-origin requests

## Troubleshooting

### Common Issues

1. **Build Fails**:
   - Check that `requirements.txt` is correct
   - Ensure all dependencies are listed
   - Check Vercel build logs for specific errors

2. **API Routes Not Working**:
   - Verify `vercel.json` routes are correct
   - Check that `/api/index.py` exists
   - Ensure Flask routes match the API paths

3. **Static Files Not Loading**:
   - Verify files are in `/static/` directory
   - Check that paths in HTML use `/static/` prefix
   - Clear browser cache

4. **CORS Errors**:
   - CORS headers are already included in API responses
   - If issues persist, check browser console for specific errors

### Testing Locally with Vercel

You can test the Vercel deployment locally:

```bash
vercel dev
```

This will start a local server that mimics Vercel's environment.

## Updating Your Deployment

After making changes:

1. **Commit and push** to your Git repository
2. Vercel will automatically redeploy (if auto-deploy is enabled)
3. Or manually trigger deployment from Vercel dashboard

## Custom Domain

To use a custom domain:

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Python Support](https://vercel.com/docs/concepts/functions/serverless-functions/runtimes/python)

