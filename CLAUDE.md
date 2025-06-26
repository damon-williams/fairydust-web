# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start local development server (uses `npx serve public`)
- `npm install` - Install dependencies (minimal - only `serve` package)

### Build
- `npm run build` - No actual build process needed (echoes message)
- Files are served directly from `public/` directory

## Project Architecture

**Fairydust Web** is a static website serving two main purposes:
1. Consumer homepage showcasing AI-powered apps using fairydust
2. SDK distribution and developer documentation platform

### Core Structure
```
public/
├── index.html              # Consumer homepage
├── fairydust.css          # SDK component styles
├── sdk/                   # SDK files in multiple formats
│   ├── simple.js         # Auto-enhanced version (recommended)
│   ├── index.umd.js      # Universal module for browsers  
│   ├── index.esm.js      # ES modules
│   └── index.js          # CommonJS
├── developer/            # Developer documentation and demos
└── components/           # Individual component demos
```

### Architecture Principles
- **Pure static site** - No build process, all files served directly
- **Multiple SDK formats** for different integration needs
- **Auto-enhancement pattern** - Components automatically enhance existing HTML elements
- **Vercel hosting** with CORS headers configured for SDK distribution

## SDK Components

### Account Component
- Shows user connection status and DUST balance
- Auto-enhances elements with `fairydust-account` class
- Handles authentication state and balance display

### Button Component  
- Handles micropayments with DUST tokens
- Auto-enhances elements with `fairydust-button` class
- Supports skip confirmation for frequent users
- Configurable styling and behavior

### Authentication Component
- Two-step OTP verification (email → phone/authenticator)
- Modal-based UI with input validation
- Auto-enhances elements with `fairydust-auth` class

### Purchase Component (Planned)
- For buying DUST tokens with traditional payment methods

## Integration Methods

### Simple HTML Integration (Recommended)
```html
<script src="https://fairydust-web.vercel.app/sdk/simple.js"></script>
<div class="fairydust-account"></div>
<button class="fairydust-button" data-amount="5">Buy for 5 DUST</button>
```

### React/SPA Integration
```javascript
import { initializeFairydust } from 'https://fairydust-web.vercel.app/sdk/index.esm.js';
await initializeFairydust();
```

### Programmatic Creation
```javascript
const accountComponent = fairydust.createAccount(container, options);
const buttonComponent = fairydust.createButton(container, options);
```

## API Endpoints

### Production (Railway)
- Authentication: `https://fairydust-auth-production.up.railway.app`
- Ledger: `https://fairydust-ledger-production.up.railway.app`
- Payment: `https://fairydust-payment-production.up.railway.app`

### Development (Local)
- All services: `http://localhost:3000` (when running locally)

## Key Configuration

### Vercel Deployment
- Automatic deployment from `main` branch
- CORS headers configured in `vercel.json` for SDK distribution
- Static file serving from `public/` directory

### User Experience Features
- New users receive 25 free DUST tokens
- Skip confirmation option for frequent users
- Seamless authentication flow across components
- Mobile-responsive design

## Development Notes

### SDK Development
- All SDK logic is in `public/sdk/` files
- Components use class-based enhancement pattern
- Event-driven architecture for component communication
- Error handling with user-friendly messages

### Styling
- `fairydust.css` contains all component styles
- Components inherit app styling by default
- CSS custom properties for theming support

### Browser Compatibility
- Safari compatibility issues resolved in recent updates
- CORS properly configured for cross-origin SDK usage
- Mobile browser support included

### Recent Focus Areas
- Critical SDK bug fixes (component methods, CORS)
- Authentication UI improvements
- React/SPA compatibility enhancements
- Railway backend service migration
- Safari browser compatibility

## Testing

Currently no formal test suite. Manual testing workflow:
1. Start local server with `npm run dev`
2. Test components on `http://localhost:3000/developer/`
3. Verify SDK integration on homepage
4. Test authentication flow end-to-end
5. Validate micropayment functionality