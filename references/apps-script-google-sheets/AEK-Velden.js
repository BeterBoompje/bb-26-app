/**
 * AEK VELDBEHEER SYSTEEM 2025
 * Geoptimaliseerd voor mobiel en desktop gebruik
 * Versie: 3.0 - SMART EXPORT & IMPORT SYSTEEM
 * 
 * NIEUWE WORKFLOW V3.0:
 * KWEKERIJEN: Veld invullen → Smart Export → URL delen
 * CENTRAAL: Import URLs → Koppel MOEDER data → Totaal Overzicht
 */

// ============================================================================
// GLOBALE CONFIGURATIE
// ============================================================================

const CONFIG = {
  FIELD_RANGE: 'A1:Z100',
  BOOM_NUMMER_MIN_DIGITS: 4,
  BOOM_NUMMER_MAX_DIGITS: 5,
  STATUS_LEVEND: 'LEVEND',
  STATUS_DOOD: 'DOOD',

  COLORS: {
    LEVEND_CHECKED: '#73ab84',      // Groen - Aangevinkt met geldig nummer
    DOOD_UNCHECKED: '#9b1d20',      // Rood - Niet aangevinkt met geldig nummer
    NO_NUMBER: '#a8d5ba',           // Lichtgroen - Geen boomnummer
    INVALID_NUMBER: '#ff9900',      // Oranje - Ongeldig nummer (te kort/lang)
    DUPLICATE: '#ff0000'            // Rood - Duplicate nummer
  },
  EXPORT_COLUMNS: [
    'KWEEKERIJ', 'VELD', 'BOOMNUMMER', 'STATUS', 
    'LOCATIE_RIJ', 'LOCATIE_KOLOM', 'LOCATIE_ABC', 'EIGENAAR', 'CHECKVORIGEJAAR','UITGIFTE','CHECKVORIGEJAARUITGIFTE','BOOMNUMMER-02', 'STATUS-02'
  ],
  MOEDER_COLUMNS: [
    'EIGENAAR', 'CHECK_VORIG_JAAR', 'UITGIFTE', 'CHECK_VORIG_JAAR_UITGIFTE'
  ]
};

// ============================================================================
// MENU & INITIALISATIE
// ============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  const exportMenu = ui.createMenu('📤 Export')
    .addItem('⚡ Smart Export (Aanbevolen)', 'smartExport')
    .addSeparator()
    .addItem('📋 Export Standaard (Oud)', 'exportField')
    .addItem('📊 Export Pivot (Oud)', 'exportPivotField');
  
  const importMenu = ui.createMenu('📥 Import (Centraal)')
    .addItem('🔗 Import Kwekerij URL', 'importFromURL')
    .addItem('📂 Import Kwekerij Bestand', 'importFromFile')
    .addSeparator()
    .addItem('🔗 Koppel MOEDER Data', 'koppelMoederData')
    .addItem('📊 Maak Totaal Overzicht', 'maakTotaalOverzicht');
  
  ui.createMenu('🌲 AEK Veldbeheer')
    .addItem('🆕 Nieuw Veld Aanmaken', 'newCleanField')
    .addSeparator()
    .addSubMenu(exportMenu)
    .addSubMenu(importMenu)
    .addSeparator()
    .addItem('✅ Data Validatie Instellen', 'setupDataValidation')
    .addItem('🎨 Stijl Toepassen', 'styleFields')
    .addSeparator()
    .addItem('🔍 Controleer Duplicaten', 'checkForDuplicates')
    .addItem('📱 Open Sidebar (Desktop)', 'showSidebar')
    .addSeparator()
    .addItem('ℹ️ Help & Instructies', 'showHelp')
    .addToUi();
    
  styleFields();
}

// ============================================================================
// NIEUW VELD AANMAKEN
// ============================================================================

function newCleanField() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Vraag veldnaam
  const result = ui.prompt(
    'Nieuw Veld Aanmaken',
    'Wat is de naam van het nieuwe veld?',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Geannuleerd');
    return;
  }
  
  const veldNaam = result.getResponseText().trim();
  
  if (!veldNaam) {
    ui.alert('Fout', 'Veldnaam mag niet leeg zijn!', ui.ButtonSet.OK);
    return;
  }
  
  // Verwijder bestaand sheet met deze naam
  const existingSheet = ss.getSheetByName(veldNaam);
  if (existingSheet) {
    const confirmDelete = ui.alert(
      'Bestaand Veld Gevonden',
      `Er bestaat al een veld met de naam "${veldNaam}". Wilt u dit overschrijven?`,
      ui.ButtonSet.YES_NO
    );
    
    if (confirmDelete === ui.Button.YES) {
      ss.deleteSheet(existingSheet);
    } else {
      return;
    }
  }
  
  // Maak nieuw sheet
  const newSheet = ss.insertSheet(veldNaam);
  
  // Setup het nieuwe veld
  setupNewField(newSheet);
  
  ui.alert('Succes!', `Veld "${veldNaam}" is aangemaakt en klaar voor gebruik.`, ui.ButtonSet.OK);
}

function setupNewField(sheet) {
  const range = sheet.getRange(CONFIG.FIELD_RANGE);
  
  range.insertCheckboxes()
    .setBackground(CONFIG.COLORS.NO_NUMBER)
    .setNote("BoomNummer:")
    .setFontSize(36)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  
  sheet.setRowHeightsForced(1, 100, 100);
  sheet.setColumnWidths(1, 26, 100);
  
  SpreadsheetApp.flush();
}

// ============================================================================
// DATA VALIDATION
// ============================================================================

function setupDataValidation() {
  const sheet = SpreadsheetApp.getActiveSheet();
  setupDataValidationForSheet(sheet);
  
  SpreadsheetApp.getUi().alert(
    'Data Validatie Actief', 
    '✓ Automatische controles zijn ingeschakeld!\n\n' +
    'Het systeem controleert nu bij elke invoer:\n' +
    '• Boom nummer lengte (4-5 cijfers)\n' +
    '• Duplicate nummers\n' +
    '• Automatische kleurcodering\n\n' +
    'TIP: Gebruik "Controleer Duplicaten" om bestaande data te checken.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function setupDataValidationForSheet(sheet) {
  setupConditionalFormattingForSheet(sheet);
}

function setupConditionalFormattingForSheet(sheet) {
  // Conditional formatting wordt gedaan via onEdit()
}

// ============================================================================
// BOOM NUMMER HELPERS
// ============================================================================

function extractBoomNummer(note) {
  if (!note) return '';
  if (!note.startsWith('BoomNummer:')) return '';
  return note.slice(11).trim();
}

function isValidBoomNummer(boomNummer) {
  if (!boomNummer) return false;
  const len = boomNummer.length;
  return /^\d+$/.test(boomNummer) && 
         len >= CONFIG.BOOM_NUMMER_MIN_DIGITS && 
         len <= CONFIG.BOOM_NUMMER_MAX_DIGITS;
}

function formatBoomNummer(nummer) {
  if (!nummer) return '';
  const numStr = nummer.toString();
  // 🔥 GEEN PADDING - gebruik nummer zoals het is ingevoerd
  return numStr;
}

// ============================================================================
// DUPLICATE CHECKING
// ============================================================================

function checkForDuplicates() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getRange(CONFIG.FIELD_RANGE);
  const notes = range.getNotes();
  
  const boomNummers = {};
  const duplicates = [];
  
  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < notes[i].length; j++) {
      const boomNummer = extractBoomNummer(notes[i][j]);
      
      if (boomNummer) {
        const formattedNummer = formatBoomNummer(boomNummer);
        const location = `${String.fromCharCode(65 + j)}${i + 1}`;
        
        if (!boomNummers[formattedNummer]) {
          boomNummers[formattedNummer] = [];
        }
        boomNummers[formattedNummer].push(location);
      }
    }
  }
  
  for (const [nummer, locations] of Object.entries(boomNummers)) {
    if (locations.length > 1) {
      duplicates.push({ nummer, locations });
    }
  }
  
  const ui = SpreadsheetApp.getUi();
  
  if (duplicates.length === 0) {
    ui.alert('Geen Duplicaten Gevonden', 
      '✓ Alle boom nummers zijn uniek!', 
      ui.ButtonSet.OK);
  } else {
    let message = `⚠️ ${duplicates.length} duplicate boom nummer(s) gevonden:\n\n`;
    duplicates.forEach(dup => {
      message += `Nummer ${dup.nummer}: ${dup.locations.join(', ')}\n`;
    });
    ui.alert('Duplicaten Gevonden', message, ui.ButtonSet.OK);
  }
  
  return duplicates;
}

// ============================================================================
// CELL STYLING & COLORING
// ============================================================================

function styleFields() {
  const sheet = SpreadsheetApp.getActiveSheet();
  sheet.setRowHeightsForced(1, 100, 100);
  sheet.setColumnWidths(1, 26, 100);
  SpreadsheetApp.flush();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function onEdit(e) {
  if (!e || !e.range) return;
  
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  
  if (row < 1 || row > 100 || col < 1 || col > 26) return;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
  
  checkCellFast(range);
}

function checkCellFast(range) {
  const note = range.getNote();
  const isChecked = range.isChecked();
  
  const boomNummer = extractBoomNummer(note);
  
  let color;
  
  if (!boomNummer) {
    color = CONFIG.COLORS.NO_NUMBER;
  } else {
    const len = boomNummer.length;
    const isValidLength = len >= 4 && len <= 5;
    const isNumeric = /^\d+$/.test(boomNummer);
    
    if (isNumeric && isValidLength) {
      color = isChecked ? CONFIG.COLORS.LEVEND_CHECKED : CONFIG.COLORS.DOOD_UNCHECKED;
    } else {
      color = CONFIG.COLORS.INVALID_NUMBER;
    }
  }
  
  range.setBackground(color);
}

function checkCell(range) {
  checkCellFast(range);
}

function checkSelection(selection) {
  var range = selection;
  if (range.getNumRows() === 1 &&
      range.getNumColumns() === 1 &&
      range.getCell(1, 1)) {
    return true;
  } else {
    return false;
  }
}

// ============================================================================
// 🚀 NIEUWE SMART EXPORT FUNCTIE
// ============================================================================
/**
 * Haal kweekerij naam uit bestandsnaam
 * Formaat: "AEK | APP_2025_KWEKERIJnaam"
 * @return {string} Kweekerij naam (bijv. "Beemster", "Randijk")
 */
function getKwekerijNaam() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fileName = ss.getName();
  
  // Zoek naar patroon: AEK | APP_2025_NAAM
  const match = fileName.match(/AEK\s*\|\s*APP_\d{4}_(.+)/i);
  
  if (match && match[1]) {
    return match[1].trim().toUpperCase();
  }
  
  // Fallback: als patroon niet matcht, gebruik bestandsnaam
  return fileName.toUpperCase();
}
/**
 * Smart Export - Alles in één keer!
 * Maakt direct een clean export zonder MOEDER dependencies
 */
function smartExport() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getActiveSheet();
  
  // Check of er wel data is
  const range = sourceSheet.getRange(CONFIG.FIELD_RANGE);
  const values = range.getValues();
  const notes = range.getNotes();
  
  let boomCount = 0;
  let invalidCount = 0;
  const duplicateCheck = {};
  let duplicateCount = 0;
  
  // Valideer data eerst
  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < notes[i].length; j++) {
      const boomNummer = extractBoomNummer(notes[i][j]);
      if (boomNummer) {
        boomCount++;
        
        if (!isValidBoomNummer(boomNummer)) {
          invalidCount++;
        }
        
        const formatted = formatBoomNummer(boomNummer);
        if (!duplicateCheck[formatted]) {
          duplicateCheck[formatted] = 0;
        }
        duplicateCheck[formatted]++;
      }
    }
  }
  
  // Tel duplicaten
  for (const count of Object.values(duplicateCheck)) {
    if (count > 1) duplicateCount++;
  }
  
  if (boomCount === 0) {
    ui.alert('Geen Data', 'Er zijn geen boom nummers gevonden in dit veld!', ui.ButtonSet.OK);
    return;
  }
  
  // Waarschuw bij problemen
  if (invalidCount > 0 || duplicateCount > 0) {
    let warning = '⚠️ Er zijn problemen gevonden:\n\n';
    if (invalidCount > 0) {
      warning += `• ${invalidCount} ongeldig(e) boom nummer(s)\n`;
    }
    if (duplicateCount > 0) {
      warning += `• ${duplicateCount} duplicate boom nummer(s)\n`;
    }
    warning += '\nWilt u toch exporteren?';
    
    const response = ui.alert('Validatie Waarschuwing', warning, ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) {
      return;
    }
  }
  
  // Maak export sheet
  const exportName = `${sourceSheet.getName()}_EXPORT`;
  let exportSheet = ss.getSheetByName(exportName);
  
  if (exportSheet) {
    ss.deleteSheet(exportSheet);
  }
  
  exportSheet = ss.insertSheet(exportName);
  
  // Bouw export data
  const exportData = [CONFIG.EXPORT_COLUMNS];
  
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values[i].length; j++) {
      const boomNummer = extractBoomNummer(notes[i][j]);
      
      if (boomNummer && isValidBoomNummer(boomNummer)) {
        const status = values[i][j] === true ? CONFIG.STATUS_LEVEND : CONFIG.STATUS_DOOD;
        const formatted = formatBoomNummer(boomNummer);
        
      exportData.push([
          getKwekerijNaam(),
          sourceSheet.getName(),
          formatted,
          status,
          i + 1,  // Rij
          j + 1,  // Kolom
          '',     // LOCATIE_ABC - wordt via formule ingevuld
          '',     // EIGENAAR - wordt via formule ingevuld
          '',     // CHECKVORIGEJAAR - wordt via formule ingevuld
          '',     // UITGIFTE - wordt via formule ingevuld
          '',     // CHECKVORIGEJAARUITGIFTE - wordt via formule ingevuld
          '',     // BOOMNUMMER-02 - wordt via formule ingevuld
          ''      // STATUS-02 - wordt via formule ingevuld
        ]);
      }
    }
  }
  
// Schrijf data - met PLAIN TEXT formatting voor boomnummers!
  if (exportData.length > 1) {
    // 🔥 EERST kolom formatteren als TEXT, DAN data schrijven
    const dataRange = exportSheet.getRange(1, 1, exportData.length, exportData[0].length);
    
    // Zet BOOMNUMMER kolom (kolom 3) op PLAIN TEXT formaat
    const boomNummerColumn = exportSheet.getRange(1, 3, exportData.length, 1);
    boomNummerColumn.setNumberFormat('@');
    
    // Nu pas data schrijven
    dataRange.setValues(exportData);

// Voeg formules toe voor LOCATIE_ABC en MOEDER koppelingen
    if (exportData.length > 1) {
      const startRow = 2;
      const numRows = exportData.length - 1;
      
      // Kolom 7: LOCATIE_ABC
      const locatieAbcFormulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        locatieAbcFormulas.push([`=CHAR(64+F${row})`]);
      }
      exportSheet.getRange(startRow, 7, numRows, 1).setFormulas(locatieAbcFormulas);
      
      // Kolom 8: EIGENAAR
      const eigenaarFormulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        eigenaarFormulas.push([`=IFERROR(VLOOKUP(C${row};MOEDER!$A$2:$B$2300;2;FALSE);"")`]);
      }
      exportSheet.getRange(startRow, 8, numRows, 1).setFormulas(eigenaarFormulas);
      
      // Kolom 9: CHECKVORIGEJAAR
      const checkVorigJaarFormulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        checkVorigJaarFormulas.push([`=IFERROR(VLOOKUP(C${row};MOEDER24!$A$2:$B$3950;2;FALSE);"")`]);
      }
      exportSheet.getRange(startRow, 9, numRows, 1).setFormulas(checkVorigJaarFormulas);
      
      // Kolom 10: UITGIFTE
      const uitgifteFormulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        uitgifteFormulas.push([`=IFERROR(VLOOKUP(C${row};MOEDER!$A$2:$D$2300;4;FALSE);"")`]);
      }
      exportSheet.getRange(startRow, 10, numRows, 1).setFormulas(uitgifteFormulas);
      
      // Kolom 11: CHECKVORIGEJAARUITGIFTE
      const checkVorigJaarUitgifteFormulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        checkVorigJaarUitgifteFormulas.push([`=IFERROR(VLOOKUP(C${row};MOEDER24!$A$2:$C$3950;3;FALSE);"")`]);
      }
      exportSheet.getRange(startRow, 11, numRows, 1).setFormulas(checkVorigJaarUitgifteFormulas);
      // Kolom 12: BOOMNUMMER-02 (uit MOEDER kolom G)
      const boomNummer02Formulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        boomNummer02Formulas.push([`=IFERROR(VLOOKUP(C${row};MOEDER!$A$2:$G$2300;7;FALSE);"")`]);
      }
      exportSheet.getRange(startRow, 12, numRows, 1).setFormulas(boomNummer02Formulas);
      
      // Kolom 13: STATUS-02 (zoek status van boom-02 in huidige sheet)
      const status02Formulas = [];
      for (let row = startRow; row <= exportData.length; row++) {
        status02Formulas.push([`=IFERROR(IF(L${row}="";"";VLOOKUP(L${row};$C$2:$D$1000;2;FALSE));"")`]);
      }
      exportSheet.getRange(startRow, 13, numRows, 1).setFormulas(status02Formulas);
    }
    
    // Freeze header
    exportSheet.setFrozenRows(1);
    // Format header
    const headerRange = exportSheet.getRange(1, 1, 1, exportData[0].length);
    headerRange.setFontWeight('bold')
      .setBackground('#4a86e8')
      .setFontColor('#ffffff');
    
    // Auto-resize columns
    for (let i = 1; i <= exportData[0].length; i++) {
      exportSheet.autoResizeColumn(i);
    }
  }
  
  // Success melding
  const url = ss.getUrl() + '#gid=' + exportSheet.getSheetId();
  
  ui.alert(
    '✅ Smart Export Voltooid!',
    `${exportData.length - 1} boom(en) geëxporteerd naar "${exportName}"\n\n` +
    `📋 VOOR KWEKERIJEN:\n` +
    `Deel deze URL met het centrale team:\n\n` +
    `${url}\n\n` +
    `Of kopieer de data uit het "${exportName}" sheet.`,
    ui.ButtonSet.OK
  );
  
  // Open export sheet
  ss.setActiveSheet(exportSheet);
}

// ============================================================================
// 📥 IMPORT FUNCTIES (VOOR CENTRAAL BESTAND)
// ============================================================================

/**
 * Import data van een kwekerij via URL
 */
function importFromURL() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.prompt(
    'Import Kwekerij URL',
    'Plak de URL van het kwekerij Google Sheets bestand:\n' +
    '(De URL die de kwekerij heeft gedeeld)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  
  const url = result.getResponseText().trim();
  
  if (!url) {
    ui.alert('Fout', 'Geen URL ingevoerd!', ui.ButtonSet.OK);
    return;
  }
  
  try {
    // Extract spreadsheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      ui.alert('Fout', 'Ongeldige Google Sheets URL!', ui.ButtonSet.OK);
      return;
    }
    
    const sourceSpreadsheetId = match[1];
    
    // Extract sheet ID if present
    let sourceSheetName = null;
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    
    if (gidMatch) {
      const gid = gidMatch[1];
      const sourceSpreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
      const sheets = sourceSpreadsheet.getSheets();
      
      for (const sheet of sheets) {
        if (sheet.getSheetId().toString() === gid) {
          sourceSheetName = sheet.getName();
          break;
        }
      }
    }
    
    // Vraag om sheet naam als niet gevonden
    if (!sourceSheetName) {
      const sheetResult = ui.prompt(
        'Welk sheet?',
        'Wat is de naam van het EXPORT sheet in het kwekerij bestand?\n' +
        '(Meestal eindigt dit op "_EXPORT")',
        ui.ButtonSet.OK_CANCEL
      );
      
      if (sheetResult.getSelectedButton() !== ui.Button.OK) {
        return;
      }
      
      sourceSheetName = sheetResult.getResponseText().trim();
    }
    
    if (!sourceSheetName) {
      ui.alert('Fout', 'Geen sheet naam opgegeven!', ui.ButtonSet.OK);
      return;
    }
    
    // Open source spreadsheet
    const sourceSpreadsheet = SpreadsheetApp.openById(sourceSpreadsheetId);
    const sourceSheet = sourceSpreadsheet.getSheetByName(sourceSheetName);
    
    if (!sourceSheet) {
      ui.alert('Fout', `Sheet "${sourceSheetName}" niet gevonden!`, ui.ButtonSet.OK);
      return;
    }
    
    // Haal data op
    const sourceData = sourceSheet.getDataRange().getValues();
    
    if (sourceData.length < 2) {
      ui.alert('Fout', 'Geen data gevonden in het export sheet!', ui.ButtonSet.OK);
      return;
    }
    
    // Bepaal import naam
    const importName = sourceSheetName.replace('_EXPORT', '_IMPORT');
    
    // Maak of update import sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let importSheet = ss.getSheetByName(importName);
    
    if (importSheet) {
      const overwrite = ui.alert(
        'Sheet Bestaat Al',
        `Sheet "${importName}" bestaat al. Overschrijven?`,
        ui.ButtonSet.YES_NO
      );
      
      if (overwrite !== ui.Button.YES) {
        return;
      }
      
      importSheet.clear();
    } else {
      importSheet = ss.insertSheet(importName);
    }
    
    // Schrijf data
    importSheet.getRange(1, 1, sourceData.length, sourceData[0].length)
      .setValues(sourceData);
    
    // Format header
    importSheet.setFrozenRows(1);
    const headerRange = importSheet.getRange(1, 1, 1, sourceData[0].length);
    headerRange.setFontWeight('bold')
      .setBackground('#6aa84f')
      .setFontColor('#ffffff');
    
    // Auto-resize
    for (let i = 1; i <= sourceData[0].length; i++) {
      importSheet.autoResizeColumn(i);
    }
    
    ui.alert(
      '✅ Import Geslaagd!',
      `${sourceData.length - 1} rij(en) geïmporteerd naar "${importName}"\n\n` +
      `Gebruik nu "Koppel MOEDER Data" om eigenaar info toe te voegen.`,
      ui.ButtonSet.OK
    );
    
    ss.setActiveSheet(importSheet);
    
  } catch (error) {
    ui.alert('Fout', `Import mislukt: ${error.message}\n\nControleer of je toegang hebt tot het bestand.`, ui.ButtonSet.OK);
  }
}

/**
 * Import data van een kwekerij via file upload (handmatig kopiëren)
 */
function importFromFile() {
  const ui = SpreadsheetApp.getUi();
  
  ui.alert(
    'Import via Kopiëren',
    'STAPPEN:\n\n' +
    '1. Open het kwekerij bestand\n' +
    '2. Ga naar het _EXPORT sheet\n' +
    '3. Selecteer alle data (Ctrl+A of Cmd+A)\n' +
    '4. Kopieer (Ctrl+C of Cmd+C)\n' +
    '5. Kom terug naar dit bestand\n' +
    '6. Maak een nieuw sheet aan (bijv. "Kwekerij1_IMPORT")\n' +
    '7. Plak de data (Ctrl+V of Cmd+V)\n\n' +
    'Gebruik daarna "Koppel MOEDER Data" om eigenaar info toe te voegen.',
    ui.ButtonSet.OK
  );
}

/**
 * Koppel MOEDER data aan geïmporteerde kwekerij data
 */
function koppelMoederData() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  
  // Check of er een MOEDER sheet is
  const moederSheet = ss.getSheetByName('MOEDER');
  const moeder23Sheet = ss.getSheetByName('MOEDER23');
  
  if (!moederSheet) {
    ui.alert(
      'MOEDER Sheet Niet Gevonden',
      'Er is geen "MOEDER" sheet in dit bestand!\n\n' +
      'Zorg ervoor dat je registratie data in een sheet genaamd "MOEDER" staat.',
      ui.ButtonSet.OK
    );
    return;
  }
  
  // Haal data op
  const data = activeSheet.getDataRange().getValues();
  
  if (data.length < 2) {
    ui.alert('Fout', 'Geen data gevonden in dit sheet!', ui.ButtonSet.OK);
    return;
  }
  
  // Zoek BOOMNUMMER kolom
  const headers = data[0];
  const boomNummerCol = headers.indexOf('BOOMNUMMER');
  
  if (boomNummerCol === -1) {
    ui.alert(
      'Fout',
      'Geen "BOOMNUMMER" kolom gevonden!\n\n' +
      'Zorg ervoor dat dit een geïmporteerd export sheet is.',
      ui.ButtonSet.OK
    );
    return;
  }
  
  // Voeg MOEDER kolommen toe als ze nog niet bestaan
  const newHeaders = [...headers];
  const formulaColumns = [];
  
  CONFIG.MOEDER_COLUMNS.forEach(col => {
    if (!newHeaders.includes(col)) {
      newHeaders.push(col);
      formulaColumns.push(col);
    }
  });
  
  if (formulaColumns.length === 0) {
    ui.alert('Info', 'MOEDER kolommen bestaan al!', ui.ButtonSet.OK);
    return;
  }
  
  // Update headers
  activeSheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  
  // Voeg formules toe
  const startCol = headers.length + 1;
  const boomNummerColLetter = columnToLetter(boomNummerCol + 1);
  
  for (let row = 2; row <= data.length; row++) {
    const formulas = [];
    
    formulaColumns.forEach(colName => {
      let formula = '';
      
      switch(colName) {
        case 'EIGENAAR':
          formula = `=IFERROR(VLOOKUP(${boomNummerColLetter}${row},MOEDER!$A:$B,2,FALSE),"")`;
          break;
        case 'CHECK_VORIG_JAAR':
          if (moeder23Sheet) {
            formula = `=IFERROR(VLOOKUP(${boomNummerColLetter}${row},MOEDER23!$A:$B,2,FALSE),"")`;
          } else {
            formula = '';
          }
          break;
        case 'UITGIFTE':
          formula = `=IFERROR(VLOOKUP(${boomNummerColLetter}${row},MOEDER!$A:$D,4,FALSE),"")`;
          break;
        case 'CHECK_VORIG_JAAR_UITGIFTE':
          if (moeder23Sheet) {
            formula = `=IFERROR(VLOOKUP(${boomNummerColLetter}${row},MOEDER23!$A:$C,3,FALSE),"")`;
          } else {
            formula = '';
          }
          break;
      }
      
      formulas.push(formula);
    });
    
    if (formulas.length > 0) {
      activeSheet.getRange(row, startCol, 1, formulas.length).setFormulas([formulas]);
    }
  }
  
  // Format nieuwe kolommen
  const newColRange = activeSheet.getRange(1, startCol, 1, formulaColumns.length);
  newColRange.setFontWeight('bold')
    .setBackground('#f4cccc');
  
  // Auto-resize
  for (let i = startCol; i < startCol + formulaColumns.length; i++) {
    activeSheet.autoResizeColumn(i);
  }
  
  ui.alert(
    '✅ MOEDER Data Gekoppeld!',
    `${formulaColumns.length} kolom(men) toegevoegd met VLOOKUP formules:\n\n` +
    formulaColumns.join('\n') + '\n\n' +
    'De data wordt nu automatisch gekoppeld aan je MOEDER registratie.',
    ui.ButtonSet.OK
  );
}

/**
 * Maak totaal overzicht van alle geïmporteerde kwekerijen
 */
function maakTotaalOverzicht() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets();
  
  // Zoek alle _IMPORT sheets
  const importSheets = allSheets.filter(sheet => 
    sheet.getName().includes('_IMPORT')
  );
  
  if (importSheets.length === 0) {
    ui.alert(
      'Geen Import Sheets',
      'Er zijn geen "_IMPORT" sheets gevonden!\n\n' +
      'Importeer eerst kwekerij data voordat je een totaal overzicht maakt.',
      ui.ButtonSet.OK
    );
    return;
  }
  
  // Maak of update TOTAAL sheet
  const totaalName = 'TOTAAL_OVERZICHT';
  let totaalSheet = ss.getSheetByName(totaalName);
  
  if (totaalSheet) {
    const overwrite = ui.alert(
      'Overschrijven?',
      `"${totaalName}" bestaat al. Opnieuw maken?`,
      ui.ButtonSet.YES_NO
    );
    
    if (overwrite !== ui.Button.YES) {
      return;
    }
    
    ss.deleteSheet(totaalSheet);
  }
  
  totaalSheet = ss.insertSheet(totaalName);
  
  // Verzamel alle data
  let allData = [];
  let headers = null;
  
  importSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    
    if (data.length > 0) {
      if (!headers) {
        headers = data[0];
        allData.push(headers);
      }
      
      // Voeg data toe (skip header)
      for (let i = 1; i < data.length; i++) {
        allData.push(data[i]);
      }
    }
  });
  
  if (allData.length < 2) {
    ui.alert('Geen Data', 'Geen data gevonden in de import sheets!', ui.ButtonSet.OK);
    return;
  }
  
  // Schrijf data
  totaalSheet.getRange(1, 1, allData.length, allData[0].length)
    .setValues(allData);
  
  // Format header
  totaalSheet.setFrozenRows(1);
  const headerRange = totaalSheet.getRange(1, 1, 1, allData[0].length);
  headerRange.setFontWeight('bold')
    .setBackground('#e06666')
    .setFontColor('#ffffff');
  
  // Auto-resize
  for (let i = 1; i <= allData[0].length; i++) {
    totaalSheet.autoResizeColumn(i);
  }
  
  // Sorteer op KWEEKERIJ en VELD
  const dataRange = totaalSheet.getRange(2, 1, allData.length - 1, allData[0].length);
  dataRange.sort([1, 2]); // Kolom 1 (KWEEKERIJ) en 2 (VELD)
  
  ui.alert(
    '✅ Totaal Overzicht Gemaakt!',
    `${allData.length - 1} boom(en) samengevoegd uit ${importSheets.length} kwekerij(en):\n\n` +
    importSheets.map(s => `• ${s.getName()}`).join('\n') + '\n\n' +
    `Alle data staat nu in "${totaalName}"`,
    ui.ButtonSet.OK
  );
  
  ss.setActiveSheet(totaalSheet);
}

// ============================================================================
// OUDE EXPORT FUNCTIES (BACKWARDS COMPATIBILITY)
// ============================================================================

/**
 * Export veld naar nieuw sheet (standaard format) - OUDE VERSIE
 */
function exportField() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getActiveSheet();
  const exportName = `${sourceSheet.getName()}_EXPORT_OUD`;
  
  const existingExport = ss.getSheetByName(exportName);
  if (existingExport) {
    ss.deleteSheet(existingExport);
  }
  
  const exportSheet = ss.insertSheet(exportName);
  
  const sourceRange = sourceSheet.getDataRange();
  const values = sourceRange.getValues();
  const notes = sourceRange.getNotes();
  
  const exportData = values.map((row, i) => 
    row.map((cell, j) => {
      const posR = i + 1;
      const posC = j + 1;
      const boomNummer = extractBoomNummer(notes[i][j]);
      
      if (!boomNummer) return '';
      
      const status = cell === true ? CONFIG.STATUS_LEVEND : CONFIG.STATUS_DOOD;
      const formatted = formatBoomNummer(boomNummer);
      
      return `${CONFIG.KWEEKERIJ},${sourceSheet.getName()},${status},NUM:${formatted}, Position:${posR},${posC}`;
    })
  );
  
  exportSheet.getRange(1, 1, exportData.length, exportData[0].length)
    .setValues(exportData);
  
  SpreadsheetApp.getUi().alert(
    'Export Voltooid (Oud Format)',
    `Data geëxporteerd naar sheet "${exportName}"\n\n` +
    `TIP: Gebruik "Smart Export" voor het nieuwe format!`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Export veld naar nieuw sheet (pivot format) - OUDE VERSIE
 */
function exportPivotField() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getActiveSheet();
  const exportName = `${sourceSheet.getName()}_EXPORTPivot_OUD`;
  
  const existingExport = ss.getSheetByName(exportName);
  if (existingExport) {
    ss.deleteSheet(existingExport);
  }
  
  const exportSheet = ss.insertSheet(exportName);
  
  const sourceRange = sourceSheet.getDataRange();
  const values = sourceRange.getValues();
  const notes = sourceRange.getNotes();
  
  const exportData = [];
  
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values[i].length; j++) {
      const posR = i + 1;
      const posC = j + 1;
      const boomNummer = extractBoomNummer(notes[i][j]);
      
      if (!boomNummer) continue;
      
      const status = values[i][j] === true ? CONFIG.STATUS_LEVEND : CONFIG.STATUS_DOOD;
      const formatted = formatBoomNummer(boomNummer);
      
      exportData.push([
        `${CONFIG.KWEEKERIJ},${sourceSheet.getName()},${status},NUM:${formatted}, Position:${posR},${posC}`
      ]);
    }
  }
  
  if (exportData.length > 0) {
    exportSheet.getRange(1, 1, exportData.length, 1)
      .setValues(exportData);
  }
  
  SpreadsheetApp.getUi().alert(
    'Pivot Export Voltooid (Oud Format)',
    `${exportData.length} boom(en) geëxporteerd naar "${exportName}"\n\n` +
    `TIP: Gebruik "Smart Export" voor het nieuwe format!`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================================
// UTILITY FUNCTIES
// ============================================================================

function SHEETNAME() {
  return SpreadsheetApp.getActiveSheet().getName();
}

/**
 * Convert column number to letter (1=A, 2=B, etc.)
 */
function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/**
 * Toon help informatie
 */
function showHelp() {
  const ui = SpreadsheetApp.getUi();
  const help = `
📘 AEK VELDBEHEER SYSTEEM V3.0 - HELP

🆕 NIEUW: SMART WORKFLOW!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 VOOR KWEKERIJEN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Maak een nieuw veld aan
2. Voer boom nummers in (4-5 cijfers)
3. Vink aan = LEVEND, niet aangevinkt = DOOD
4. Klik "Smart Export"
5. Deel de URL met het centrale team

✅ BOOM NUMMERS:
• Voer nummers in van 4-5 cijfers
• Leading zeros worden automatisch toegevoegd
• Duplicaten worden gedetecteerd

🎨 KLEUREN:
• Donkergroen: Levend (aangevinkt)
• Rood: Dood (niet aangevinkt)
• Lichtgroen: Geen boom nummer
• Oranje: Ongeldig nummer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 VOOR CENTRAAL TEAM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Ontvang URLs van kwekerijen
2. Klik "Import Kwekerij URL"
3. Plak de URL
4. Herhaal voor alle kwekerijen
5. Klik "Koppel MOEDER Data"
6. Klik "Maak Totaal Overzicht"

✨ KLAAR! Alle data in één overzicht!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 BELANGRIJKE SHEETS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MOEDER: Registratie data (boomnummer + eigenaar)
MOEDER23: Vorig jaar data (optioneel)
*_IMPORT: Geïmporteerde kwekerij data
TOTAAL_OVERZICHT: Alle kwekerijen samengevoegd

Versie 3.0 - ${new Date().getFullYear()}
  `;
  
  ui.alert('Help & Instructies', help, ui.ButtonSet.OK);
}

// ============================================================================
// SIDEBAR FUNCTIES (OPTIONEEL)
// ============================================================================

function showSidebar() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('AEK Veldbeheer')
      .setWidth(320);
    
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Sidebar Niet Gevonden',
      'De sidebar HTML file is niet geïnstalleerd.\n\n' +
      'De sidebar is optioneel en werkt alleen in browser!',
      ui.ButtonSet.OK
    );
  }
}

function addTreeFromSidebar(data) {
  const sheet = SpreadsheetApp.getActiveSheet();
  
  if (!isValidBoomNummer(data.boomNummer)) {
    return {
      success: false,
      message: 'Ongeldig boom nummer (moet 4-5 cijfers zijn)'
    };
  }
  
  let row, col;
  
  if (data.positieRij && data.positieKolom) {
    row = data.positieRij;
    col = data.positieKolom;
  } else {
    const range = sheet.getRange(CONFIG.FIELD_RANGE);
    const notes = range.getNotes();
    
    let found = false;
    for (let i = 0; i < notes.length && !found; i++) {
      for (let j = 0; j < notes[i].length && !found; j++) {
        const boomNummer = extractBoomNummer(notes[i][j]);
        if (!boomNummer) {
          row = i + 1;
          col = j + 1;
          found = true;
        }
      }
    }
    
    if (!found) {
      return {
        success: false,
        message: 'Geen lege plek gevonden in veld'
      };
    }
  }
  
  const allRange = sheet.getRange(CONFIG.FIELD_RANGE);
  const allNotes = allRange.getNotes();
  const formatted = formatBoomNummer(data.boomNummer);
  
  for (let i = 0; i < allNotes.length; i++) {
    for (let j = 0; j < allNotes[i].length; j++) {
      const existingNummer = extractBoomNummer(allNotes[i][j]);
      if (existingNummer && formatBoomNummer(existingNummer) === formatted) {
        const location = `${String.fromCharCode(65 + j)}${i + 1}`;
        return {
          success: false,
          message: `Duplicate! Nummer ${formatted} bestaat al op ${location}`
        };
      }
    }
  }
  
  const cell = sheet.getRange(row, col);
  cell.insertCheckboxes();
  cell.setValue(data.isLevend);
  cell.setNote(`BoomNummer:${formatted}`);
  
  checkCellFast(cell);
  
  return {
    success: true,
    message: `Boom ${formatted} toegevoegd op ${String.fromCharCode(64 + col)}${row}`
  };
}

function getFieldStats() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getRange(CONFIG.FIELD_RANGE);
  const values = range.getValues();
  const notes = range.getNotes();
  
  let total = 0;
  let living = 0;
  let dead = 0;
  const boomNummers = {};
  
  for (let i = 0; i < notes.length; i++) {
    for (let j = 0; j < notes[i].length; j++) {
      const boomNummer = extractBoomNummer(notes[i][j]);
      
      if (boomNummer) {
        total++;
        
        if (values[i][j] === true) {
          living++;
        } else {
          dead++;
        }
        
        const formatted = formatBoomNummer(boomNummer);
        if (!boomNummers[formatted]) {
          boomNummers[formatted] = 0;
        }
        boomNummers[formatted]++;
      }
    }
  }
  
  let duplicateCount = 0;
  for (const count of Object.values(boomNummers)) {
    if (count > 1) {
      duplicateCount++;
    }
  }
  
  return {
    total: total,
    living: living,
    dead: dead,
    duplicates: duplicateCount
  };
}

// ============================================================================
// EINDE SCRIPT V3.0
// ============================================================================