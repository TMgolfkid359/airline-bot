# GitHub & Vercel Setup Instructions

## Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Repository name: `airline-bot` (or any name you prefer)
4. Description: "Airline Operations Portal with SimBrief and HOPPIE ACARS integration"
5. Choose **Public** or **Private**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Push to GitHub

After creating the repository, GitHub will show you commands. Use these instead (already configured for your project):

```bash
cd "C:\Users\Titus\Documents\Airline Bot"
git remote add origin https://github.com/YOUR_USERNAME/airline-bot.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username and `airline-bot` with your repository name.

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository (the one you just created)
4. Vercel will auto-detect the Python project
5. Click "Deploy"
6. Your app will be live in a few minutes!

### Option B: Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
```

Follow the prompts to deploy.

## That's it!

Your Airline Operations Portal will be live on Vercel and automatically redeploy whenever you push to GitHub.

