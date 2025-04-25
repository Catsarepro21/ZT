# Volunteer Hours Tracker

## Project Files

This package contains all the files needed to run your Volunteer Hours Tracker application:

- `server.js` - The main server file
- `googleSheetsAPI.js` - The Google Sheets integration
- `public/` folder - All the front-end HTML, CSS, and JavaScript
- `data/` folder - Contains the JSON data files
- `package.json` - Node.js dependencies

## How to Run Locally

1. Install Node.js (version 14 or higher)
2. Open a terminal/command prompt in this folder
3. Run `npm install` to install dependencies
4. Run `node server.js` to start the server
5. Visit `http://localhost:5000` in your browser

## How to Convert to APK for Fire Tablet

### Option 1: Online APK Builder

1. **Host the application**:
   - Create a free account on [Glitch.com](https://glitch.com)
   - Create a new project and upload these files
   - Note your project's public URL (e.g., `https://your-project.glitch.me`)

2. **Create APK**:
   - Go to [GoNative.io](https://gonative.io/) (free trial available)
   - Enter your Glitch project URL
   - Configure the app (name, icon, etc.)
   - Generate and download the APK

3. **Install on Fire Tablet**:
   - Enable "Apps from Unknown Sources" in your Fire Tablet settings
   - Transfer the APK file to your tablet (via email, cloud storage, or USB)
   - Open the file to install

### Option 2: Local Server on Fire Tablet

1. **Install a web server app** on your Fire Tablet:
   - Download "KWS Android Web Server" from Amazon Appstore

2. **Transfer the files**:
   - Connect your Fire Tablet to a computer via USB
   - Copy all these files to a folder on your tablet

3. **Run the server**:
   - Open the KWS app and point it to your folder
   - Access the app via the local address (typically `http://localhost:8080`)

### Option 3: Single-Page Offline Version

For a simpler approach, your web app can be modified to work entirely offline by storing data in the browser's localStorage instead of using a server. This would require some code modifications.

## Need Help?

If you have any questions or issues with the setup, please contact for support.