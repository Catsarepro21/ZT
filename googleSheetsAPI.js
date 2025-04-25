const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Define the scope for Google Sheets API
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * Create a new Google Sheets API client
 * @param {Object} credentials - Google API credentials from service account
 * @returns {Object} - Google Sheets API client
 */
function createSheetsClient(credentials) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES
    });
    
    return google.sheets({ version: 'v4', auth });
  } catch (error) {
    console.error('Error creating Google Sheets client:', error);
    throw error;
  }
}

/**
 * Create or update a worksheet in a Google Spreadsheet
 * @param {Object} sheets - Google Sheets API client
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {string} sheetTitle - Title of the worksheet
 * @param {Array} headerRow - Array of header column names
 * @param {Array} data - 2D array of data rows
 * @returns {Object} - API response
 */
async function updateWorksheet(sheets, spreadsheetId, sheetTitle, headerRow, data) {
  try {
    // Check if the sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const existingSheets = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
    const sheetExists = existingSheets.includes(sheetTitle);
    
    // If sheet doesn't exist, create it
    if (!sheetExists) {
      console.log(`Creating new sheet: ${sheetTitle}`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetTitle
              }
            }
          }]
        }
      });
    }
    
    // Combine headers and data
    const rows = [headerRow, ...data];
    
    // Clear existing content
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetTitle
    });
    
    // Update the sheet with new data
    return await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'RAW',
      resource: {
        values: rows
      }
    });
  } catch (error) {
    console.error(`Error updating worksheet ${sheetTitle}:`, error);
    throw error;
  }
}

/**
 * Sync volunteers and events to Google Sheets
 * @param {Object} sheetsConfig - Configuration with credentials and spreadsheetId
 * @param {Array} volunteers - Array of volunteer objects
 * @param {Array} events - Array of event objects
 * @returns {Object} - Sync results
 */
async function syncToGoogleSheets(sheetsConfig, volunteers, events) {
  try {
    if (!sheetsConfig || !sheetsConfig.spreadsheetId || !sheetsConfig.credentials) {
      throw new Error('Google Sheets configuration is incomplete');
    }
    
    console.log(`Starting Google Sheets sync with spreadsheet ID: ${sheetsConfig.spreadsheetId}`);
    
    // Create Google Sheets client
    const sheets = createSheetsClient(sheetsConfig.credentials);
    
    // Sort volunteers alphabetically by name
    const sortedVolunteers = [...volunteers].sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    // Prepare data for the Volunteers sheet with sequential IDs
    const volunteersHeader = ['ID', 'Name', 'Phone', 'Email', 'Total Hours'];
    const volunteersData = sortedVolunteers.map((volunteer, index) => {
      // Calculate total hours for each volunteer
      const volunteerEvents = events.filter(event => event.volunteerId === volunteer.id);
      const totalHours = volunteerEvents.reduce((sum, event) => sum + parseFloat(event.hours || 0), 0);
      
      // Use sequential ID starting from 1
      return [
        index + 1, // Sequential ID starting from 1
        volunteer.name,
        volunteer.phone,
        volunteer.email,
        totalHours.toFixed(2)
      ];
    });
    
    // Update the Volunteers sheet
    console.log(`Updating Volunteers sheet with ${sortedVolunteers.length} records...`);
    await updateWorksheet(sheets, sheetsConfig.spreadsheetId, 'Volunteers', volunteersHeader, volunteersData);
    
    // For each volunteer, create or update an individual sheet with their events
    for (let i = 0; i < sortedVolunteers.length; i++) {
      const volunteer = sortedVolunteers[i];
      let volunteerEvents = events.filter(event => event.volunteerId === volunteer.id);
      
      if (volunteerEvents.length > 0) {
        // Sort events by date (earliest to latest)
        volunteerEvents = volunteerEvents.sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        );
        
        const volunteerSheetName = `Volunteer - ${volunteer.name.replace(/[^a-zA-Z0-9]/g, ' ')}`.substring(0, 30);
        
        // Map event data with sequential IDs
        const volunteerEventsData = volunteerEvents.map((event, eventIndex) => [
          eventIndex + 1, // Sequential ID starting from 1
          event.name,
          event.location,
          event.date,
          event.hours
        ]);
        
        console.log(`Updating individual sheet for ${volunteer.name} with ${volunteerEvents.length} events...`);
        await updateWorksheet(
          sheets, 
          sheetsConfig.spreadsheetId, 
          volunteerSheetName,
          ['ID', 'Event', 'Location', 'Date', 'Hours'],
          volunteerEventsData
        );
      }
    }
    
    console.log('Google Sheets sync completed successfully');
    
    return {
      success: true,
      volunteersCount: volunteers.length,
      eventsCount: events.length
    };
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  syncToGoogleSheets
};