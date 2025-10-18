# Knight Bot - WhatsApp Pairing Code Website

## Overview
This is a WhatsApp pairing code generator website that helps users connect their WhatsApp accounts and automatically sets up their bot deployment on GitHub.

## Current State
- **Status**: Running and functional
- **Port**: 5000
- **Framework**: Node.js with Express
- **Features**:
  - WhatsApp pairing code generation
  - QR code generation for pairing
  - Automatic session file sending via WhatsApp

## Project Structure
- `index.js` - Main server entry point
- `pair.js` - Pairing code generation endpoint
- `qr.js` - QR code generation endpoint
- `mega.js` - Mega.nz cloud storage integration
- `pair.html` - Main pairing interface
- `index.html` - Landing page
- Various other HTML pages (blog, contact, privacy, terms)

## Dependencies
- @whiskeysockets/baileys - WhatsApp Web API
- express - Web server
- qrcode - QR code generation
- megajs - Cloud storage
- awesome-phonenumber - Phone number validation

## Upcoming Features
- GitHub automation for bot deployment
- Automatic repository forking and session file deployment
- Cron job to keep server alive

## Recent Changes
- 2025-10-18: Initial setup on Replit, configured to run on port 5000
