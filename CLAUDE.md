# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start local development server (uses `npx serve public`)

### Build
- `npm run build` - No actual build process needed (echoes message)
- Files are served directly from `public/` directory

## Project Architecture

**Fairydust Web** is a simple static landing page for the fairydust product.

### Core Structure
```
public/
├── index.html              # Landing page with HubSpot signup form
├── images/                 # Brand assets
│   ├── fairy_icon.png     # Logo icon
│   └── fairydust-wordmark.png  # Text logo
└── legal/                 # Legal documents
    ├── privacy-v1.0.0.html    # Privacy policy
    └── terms-v1.0.0.html      # Terms of service
```

### Architecture Principles
- **Pure static site** - No build process, all files served directly
- **HubSpot integration** - Uses embedded HubSpot forms for lead capture
- **Vercel hosting** - Simple static file hosting

## Current Implementation

### Landing Page Features
- **Coming Soon Design** - Purple gradient background with centered content
- **HubSpot Form Integration** - Embedded signup form for early access
- **Responsive Design** - Mobile-optimized with Inter font family
- **Brand Assets** - Fairy icon and wordmark logos
- **Legal Pages** - Privacy policy and terms of service

### HubSpot Configuration
- Portal ID: `243159225`
- Form ID: `fbafba59-8ea7-49c9-9be0-cfcb82c57d78`
- Region: `na2`
- Form script loaded from: `https://js-na2.hsforms.net/forms/embed/243159225.js`

## Key Configuration

### Vercel Deployment
- Automatic deployment from `main` branch
- Static file serving from `public/` directory
- Simple `vercel.json` with `"public": true`

### Package.json
- Minimal configuration with no dependencies
- Development server uses `npx serve public`
- No build process required

## Development Notes

### Styling
- All CSS is inline in `index.html`
- Uses Inter font from Google Fonts
- Custom HubSpot form styling overrides
- Purple theme (`#7c3aed`) with gradient background

### Form Styling
- Custom CSS overrides for HubSpot form elements
- Consistent button and input styling
- Responsive design for mobile devices

## Testing

Manual testing workflow:
1. Start local server with `npm run dev`
2. Test form submission on `http://localhost:3000`
3. Verify responsive design on mobile
4. Check HubSpot form integration