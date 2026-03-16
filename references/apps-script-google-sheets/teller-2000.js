/**
 * BeterBoompje - Geoptimaliseerde Shopify Matrixify Order Verwerking
 * Versie 2.1 - PRODUCTIE KLAAR
 * 
 * CHANGELOG v2.1:
 * - Fix: SKU normalisatie voor spaties en underscores
 * - Fix: Verbeterde error handling met header validatie
 * - Feature: Statistics tracking en rapportage
 * - Feature: Logging van onbekende boomtypen
 */


const INDEX_SHEET_NAME = 'HOOFDBLAD';
const META_SHEET_NAME  = '_meta_index';
const CATEGORY_ORDER   = ['INPUT','OVERZICHT','TRANSPORT','DEF VOORRAAD','OVERIG'];


// ============================================
// MENU CONFIGURATIE
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();

   const menuIndex = ui.createMenu('🧭 Overzicht')
    .addItem('Index openen','openIndex_')
    .addItem('Index bouwen of vernieuwen','rebuildIndex')
    .addItem('Alleen bijwerken','updateIndex')

  const menuRandijk = ui.createMenu('🌲 Randijk')
    .addItem('🔢 Bereken totalen en kleur rijen', 'calculateAndColor')
    .addItem('✂️ Pickup details splitsen naar kolommen', 'splitPickupDetails')
    .addItem('Push Data', 'syncCleanPivotData');

  const menuFlora = ui.createMenu('🌸 Flora@Home')
    .addItem('✂️ Shipping details splitsen naar kolommen', 'splitDetailsInColumnC')
    .addItem('🔄 Filter en vervang SKU\'s', 'HerbiesfindAndReplace')
    .addItem('🏠 Adressen splitsen naar straat en huisnummer', 'processShippingAddresses')
    .addItem('📦 Maak Matrixify TNT export', 'floraAThomeTNTImporter');

   const menuPlantsome = ui.createMenu('🌸 PLANTSOME')
    .addItem('📦 Verwerk Plansum Verzendingen', 'processPlansumOrders')
    .addItem('📊 Totaaloverzicht Bomen (Plansum)', 'createPlansumTotalOverview')

  const menuBB = ui.createMenu('🎄 BeterBoompje')
    .addItem('🏷️ Markeer orders met BORG', 'checkForBorg')
    .addItem('⚙️ Verwerk Pickup Orders', 'processPickupOrders')
    .addItem('📊 Totaaloverzicht Bomen', 'createTotalOverview')
    .addItem('📅 Overzicht per Locatie & Datum', 'createLocationDateOverview');

  ui.createMenu('🎄 BB Data Magic')
    .addSubMenu(menuIndex)
    .addSubMenu(menuRandijk)
    .addSubMenu(menuFlora)
    .addSubMenu(menuPlantsome)
    .addSubMenu(menuBB)
    .addToUi();
}

// ============================================
// NIEUWE FUNCTIONALITEIT - PICKUP ORDER VERWERKING
// ============================================

/**
 * Hoofdfunctie: Verwerkt Shopify Matrixify pickup orders
 * - Verwijdert tip/fooi regels
 * - Split pickup details naar kolommen
 * - Extraheert boomtype uit SKU
 * 
 * VERSIE 2.1: Verbeterde validatie en rapportage
 */
function processPickupOrders() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    // Valideer dat sheet data heeft
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      ui.alert('⚠️ Waarschuwing', 'Sheet heeft geen data om te verwerken.', ui.ButtonSet.OK);
      return;
    }
    
    // Valideer vereiste headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const requiredHeaders = ['Line: SKU', 'Line: Name', 'Line: Quantity', 'Additional Details'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      ui.alert('❌ Fout', 
               `Vereiste kolommen niet gevonden:\n${missingHeaders.join('\n')}\n\n` +
               'Zorg dat je een correcte Shopify Matrixify export gebruikt.', 
               ui.ButtonSet.OK);
      return;
    }
    
    // Bevestiging vragen met details
    const response = ui.alert(
      'Pickup Orders Verwerken',
      `Sheet: ${sheet.getName()}\n` +
      `Rijen: ${lastRow - 1}\n\n` +
      'Dit zal:\n' +
      '1. Tip/fooi regels verwijderen\n' +
      '2. Pickup details splitsen\n' +
      '3. Boomtype extraheren uit SKU\n\n' +
      'Doorgaan?',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    // Initialiseer statistieken
    const stats = {
      tipsRemoved: 0,
      rowsProcessed: 0,
      unknownTypes: 0,
      startTime: new Date()
    };
    
    Logger.log('=== PICKUP ORDER VERWERKING GESTART ===');
    Logger.log('Sheet: ' + sheet.getName());
    Logger.log('Start rijen: ' + (lastRow - 1));
    
    // Stap 1: Verwijder tips
    stats.tipsRemoved = removeTipRowsWithCount(sheet);
    
    // Stap 2: Split pickup details
    splitPickupDetailsOptimized(sheet);
    
    // Stap 3: Extraheer boomtype
    stats.unknownTypes = extractTreeTypeWithStats(sheet);
    
    // Bereken eindstatistieken
    stats.rowsProcessed = sheet.getLastRow() - 1;
    const duration = ((new Date() - stats.startTime) / 1000).toFixed(1);
    
    Logger.log('=== VERWERKING VOLTOOID ===');
    Logger.log('Eindresultaat: ' + stats.rowsProcessed + ' rijen');
    Logger.log('Tips verwijderd: ' + stats.tipsRemoved);
    Logger.log('Onbekende types: ' + stats.unknownTypes);
    Logger.log('Duur: ' + duration + ' seconden');
    
    // Toon resultaat aan gebruiker
    let message = `✅ Verwerking geslaagd!\n\n` +
                  `Verwerkt: ${stats.rowsProcessed} rijen\n` +
                  `Tips verwijderd: ${stats.tipsRemoved}\n` +
                  `Duur: ${duration}s\n`;
    
    if (stats.unknownTypes > 0) {
      message += `\n⚠️ ${stats.unknownTypes} bomen met onbekend type\n` +
                 `Bekijk kolom "Boomtype" en de logs voor details.`;
    }
    
    ui.alert('Resultaat', message, ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('❌ Fout', 
             `Er is een fout opgetreden:\n${error.message}\n\n` +
             'Bekijk View > Logs voor meer details.', 
             ui.ButtonSet.OK);
    Logger.log('ERROR in processPickupOrders: ' + error.message);
    Logger.log('Stack trace: ' + error.stack);
  }
}

/**
 * Verwijdert alle rijen waar het product een tip/fooi is
 * VERSIE 2.1: Returns aantal verwijderde tips voor rapportage
 */
function removeTipRowsWithCount(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nameIndex = headers.indexOf('Line: Name');
  
  if (nameIndex === -1) {
    throw new Error('Kolom "Line: Name" niet gevonden');
  }
  
  let tipsRemoved = 0;
  
  // Loop van onder naar boven om rijen te verwijderen
  for (let i = data.length - 1; i > 0; i--) {
    const name = (data[i][nameIndex] || '').toString().trim().toLowerCase();
    
    // Check of het een tip is (exact match voor veiligheid)
    if (name === 'tip' || name === 'fooi') {
      sheet.deleteRow(i + 1);
      tipsRemoved++;
      Logger.log(`Tip verwijderd op rij ${i + 1}`);
    }
  }
  
  Logger.log(`Totaal ${tipsRemoved} tips verwijderd`);
  return tipsRemoved;
}

/**
 * Geoptimaliseerde versie van pickup details splitsen
 */
function splitPickupDetailsOptimized(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndex = headers.indexOf("Additional Details") + 1;
  
  if (columnIndex === 0) {
    Logger.log('Geen "Additional Details" kolom gevonden, wordt overgeslagen');
    return;
  }

  const dataRange = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1);
  const values = dataRange.getValues();

  // Labels voor nieuwe kolommen
  const labels = ['Pickup-Day', 'Pickup-Date', 'Pickup-Time', 'Pickup-Location-Company'];

  // Voeg kolommen toe als ze er nog niet zijn
  const existingHeaders = headers.slice(columnIndex);
  const needsColumns = !labels.every(label => existingHeaders.includes(label));
  
  if (needsColumns) {
    sheet.insertColumnsAfter(columnIndex, labels.length);
    sheet.getRange(1, columnIndex + 1, 1, labels.length).setValues([labels]);
    Logger.log('Pickup detail kolommen toegevoegd: ' + labels.join(', '));
  }

  // Parse en split data
  const splitData = values.map(row => {
    if (!row[0]) return new Array(labels.length).fill('');
    
    const parts = row[0].toString().split('\n');
    const dataMap = {};
    
    parts.forEach(part => {
      const colonIndex = part.indexOf(':');
      if (colonIndex > -1) {
        const key = part.substring(0, colonIndex).trim();
        const value = part.substring(colonIndex + 1).trim();
        dataMap[key] = value;
      }
    });
    
    return labels.map(label => dataMap[label] || '');
  });

  // Schrijf resultaten
  sheet.getRange(2, columnIndex + 1, values.length, labels.length).setValues(splitData);
  Logger.log(`Pickup details gesplitst voor ${values.length} rijen`);
}

/**
 * Extraheert boomtype uit SKU en voegt toe als nieuwe kolom
 * VERSIE 2.1: Returns aantal onbekende types voor rapportage
 */
function extractTreeTypeWithStats(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const skuIndex = headers.indexOf('Line: SKU');
  
  if (skuIndex === -1) {
    throw new Error('Kolom "Line: SKU" niet gevonden');
  }
  
  // Check of Boomtype kolom al bestaat
  let boomtypeIndex = headers.indexOf('Boomtype');
  
  if (boomtypeIndex === -1) {
    // Voeg nieuwe kolom toe als deze niet bestaat
    const newColumnIndex = sheet.getLastColumn() + 1;
    sheet.getRange(1, newColumnIndex).setValue('Boomtype');
    boomtypeIndex = newColumnIndex - 1;
    Logger.log('Boomtype kolom aangemaakt');
  } else {
    Logger.log('Boomtype kolom bestaat al, wordt overschreven');
  }
  
  const data = sheet.getRange(2, skuIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  const treeTypes = [];
  let unknownCount = 0;
  const unknownSKUs = [];
  
  for (let i = 0; i < data.length; i++) {
    const sku = data[i][0] || '';
    const treeType = extractTreeTypeFromSKU(sku);
    
    if (treeType === 'Onbekend' && sku) {
      unknownCount++;
      unknownSKUs.push(sku);
      Logger.log(`⚠️ Onbekend boomtype voor SKU: "${sku}" (rij ${i + 2})`);
    }
    
    treeTypes.push([treeType]);
  }
  
  // Schrijf naar de juiste kolom
  sheet.getRange(2, boomtypeIndex + 1, treeTypes.length, 1).setValues(treeTypes);
  
  // Log samenvatting
  if (unknownCount > 0) {
    Logger.log(`\n⚠️ WAARSCHUWING: ${unknownCount} onbekende boomtypen gevonden`);
    Logger.log('Unieke onbekende SKUs:');
    const uniqueUnknown = [...new Set(unknownSKUs)];
    uniqueUnknown.forEach(sku => Logger.log('  - ' + sku));
  }
  
  return unknownCount;
}

/**
 * DATA Pusher
 * Exporteert een schone, geaggregeerde versie van de draaitabel
 * Filtert automatisch subtotalen en eindtotalen eruit
 */
function syncCleanPivotData() {
  const externalSheetId = '1C0evz5G3M_PmCBXJ-4tj2iqeRKh3tTQ0qF6Q8SdEAxw';
  const sourceSheetName = 'BB | Input - draaitable Pickups';
  const targetSheetName = 'BB | output - draaitable pickups Clean';
  
  const sourceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sourceSheetName);
  const data = sourceSheet.getDataRange().getValues();
  
  // Header regel
  const cleanData = [['Pickup-Location-Company', 'Pickup-Date', 'Aantal bomen']];
  
  // Aggregatie object: key = "locatie|datum", value = totaal aantal
  const aggregation = {};
  
  for (let i = 1; i < data.length; i++) { // Start bij 1 om header over te slaan
    const locatie = data[i][0];
    const pickupDate = data[i][1];
    const aantal = data[i][3];
    
    // Skip lege rijen, subtotalen en eindtotalen
    if (!locatie || 
        !pickupDate || 
        typeof aantal !== 'number' || 
        aantal <= 0 ||
        locatie.toString().toLowerCase().includes('totaal') ||
        locatie.toString().toLowerCase().includes('eindtotaal')) {
      continue;
    }
    
    // Maak unieke key
    const key = `${locatie}|${pickupDate}`;
    
    // Tel op
    if (aggregation[key]) {
      aggregation[key] += aantal;
    } else {
      aggregation[key] = aantal;
    }
  }
  
  // Converteer aggregatie object naar array
  for (const [key, value] of Object.entries(aggregation)) {
    const [locatie, pickupDate] = key.split('|');
    cleanData.push([locatie, pickupDate, value]);
  }
  
  // Schrijf naar externe sheet
  const externalSheet = SpreadsheetApp.openById(externalSheetId).getSheetByName(targetSheetName);
  externalSheet.clearContents();
  
  if (cleanData.length > 1) { // Meer dan alleen header
    externalSheet.getRange(1, 1, cleanData.length, 3).setValues(cleanData);
  } else {
    // Alleen header schrijven als er geen data is
    externalSheet.getRange(1, 1, 1, 3).setValues([cleanData[0]]);
  }
  
  Logger.log(`Succesvol ${cleanData.length - 1} schone regels geëxporteerd`);
}

/**
 * Helper functie: Haalt boomtype uit SKU string
 * VERSIE 2.1: Robuuste normalisatie voor spaties en underscores
 * 
 * Kijkt alleen naar MET/ZONDER kluit en de maat
 * BORG wordt genegeerd (is niet relevant voor categorisering)
 */
function extractTreeTypeFromSKU(sku) {
  if (!sku) return '';
  
  // Normaliseer SKU: uppercase en vervang spaties/underscores met streepjes
  // FIX v2.1: Handelt "AMSTERDAM- KOPVANOOST" type SKUs correct af
  const skuNormalized = sku.toString()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')  // Vervang spaties en underscores met streepjes
    .replace(/-{2,}/g, '-')   // Vervang dubbele streepjes met enkele
    .trim();
  
  // Check voor MET KLUIT (ongeacht of er BORG in zit of niet)
  if (skuNormalized.includes('MET')) {
    if (skuNormalized.includes('100-125')) return 'MET-100-125';
    if (skuNormalized.includes('125-150')) return 'MET-125-150';
    if (skuNormalized.includes('150-175')) return 'MET-150-175';
    if (skuNormalized.includes('175-200')) return 'MET-175-200';
  }
  
  // Check voor ZONDER KLUIT
  if (skuNormalized.includes('ZONDER')) {
    if (skuNormalized.includes('150-175')) return 'ZONDER-150-175';
    if (skuNormalized.includes('175-200')) return 'ZONDER-175-200';
    if (skuNormalized.includes('200-250')) return 'ZONDER-200-250';
    if (skuNormalized.includes('250-300')) return 'ZONDER-250-300';
  }
  
  return 'Onbekend';
}

// ============================================
// OVERZICHTEN GENEREREN
// ============================================

/**
 * Maakt totaaloverzicht van alle bestelde bomen per type
 * Voor voorraadcontrole
 * VERSIE 2.1: Met voorraad koppeling naar "BB | DEF voorraad PICKUPS" sheet
 */
function createTotalOverview() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Vind relevante kolommen
    const boomtypeIndex = headers.indexOf('Boomtype');
    const quantityIndex = headers.indexOf('Line: Quantity');
    
    if (boomtypeIndex === -1) {
      ui.alert('❌ Fout', 'Kolom "Boomtype" niet gevonden. Voer eerst "Verwerk Pickup Orders" uit.', ui.ButtonSet.OK);
      return;
    }
    
    if (quantityIndex === -1) {
      ui.alert('❌ Fout', 'Kolom "Line: Quantity" niet gevonden.', ui.ButtonSet.OK);
      return;
    }
    
    // Tel bomen per type
    const totals = {};
    let skippedRows = 0;
    
    for (let i = 1; i < data.length; i++) {
      const boomtype = (data[i][boomtypeIndex] || '').toString().trim();
      const quantityStr = (data[i][quantityIndex] || '').toString().trim();
      
      // Parse quantity veilig
      const quantity = parseInt(quantityStr, 10);
      
      // Skip ongeldige of lege entries
      if (isNaN(quantity) || quantity <= 0) {
        skippedRows++;
        continue;
      }
      
      if (!boomtype || boomtype === 'Onbekend' || boomtype === '') {
        skippedRows++;
        continue;
      }
      
      totals[boomtype] = (totals[boomtype] || 0) + quantity;
    }
    
    Logger.log(`Totaaloverzicht: ${Object.keys(totals).length} categorieën, ${skippedRows} rijen overgeslagen`);
    
    // Check of voorraad sheet bestaat
    const voorraadSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BB | DEF voorraad PICKUPS');
    const hasVoorraadSheet = voorraadSheet !== null;
    
    if (!hasVoorraadSheet) {
      Logger.log('⚠️ Waarschuwing: "BB | DEF voorraad PICKUPS" sheet niet gevonden. Voorraad kolommen worden niet toegevoegd.');
    }
     // Maak NIEUW output sheet met timestamp (overschrijft NIET bestaande)
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH');
    const sheetName = `Totaaloverzicht Pickups ${timestamp}`;

    // Maak nieuw sheet
    const outputSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);

    Logger.log(`Nieuw overzicht sheet aangemaakt: ${sheetName}`);
    
    // Bereid output data voor - met of zonder voorraad kolommen
    const headers_output = hasVoorraadSheet 
      ? ['Categorie', 'Verkocht', 'Begin Voorraad', 'Voorraad Resterend']
      : ['Categorie', 'Verkocht', 'Losse verkoop', 'STADSKANT'];
    
    const output = [headers_output];
    
    // Sorteer boomtypen
    const sortedTypes = Object.keys(totals).sort();
    let grandTotal = 0;
    
    sortedTypes.forEach(type => {
      const total = totals[type];
      grandTotal += total;
      
      if (hasVoorraadSheet) {
        // Met voorraad formule
        // Placeholder - wordt vervangen door formule
        output.push([type, total, 'FORMULA', 'FORMULA']);
      } else {
        // Zonder voorraad
        output.push([type, total, '', '']);
      }
    });
    
    // Voeg totaal toe
    output.push(['', '', '', '']);
    output.push(['Total', grandTotal, '', '']);
    output.push(['', '', '', '']);
    output.push(['Grand Totaal', grandTotal, '', '']);
    
    // Schrijf data (zonder formules)
    outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
    
    // Voeg VLOOKUP formules toe voor voorraad als het sheet bestaat
    if (hasVoorraadSheet) {
      const formulaStartRow = 2; // Start na header
      const numCategories = sortedTypes.length;
      
      for (let i = 0; i < numCategories; i++) {
        const rowNum = formulaStartRow + i;
        
        // Kolom C: VLOOKUP voor Begin Voorraad
        const vlookupFormula = `=IFERROR(VLOOKUP(A${rowNum};'BB | DEF voorraad PICKUPS'!A:B;2;FALSE);0)`;
        outputSheet.getRange(rowNum, 3).setFormula(vlookupFormula);
        
        // Kolom D: Voorraad Resterend = Begin Voorraad (C) - Verkocht (B)
        const restFormula = `=C${rowNum}-B${rowNum}`;
        outputSheet.getRange(rowNum, 4).setFormula(restFormula);
      }
      
      Logger.log(`Voorraad formules toegevoegd voor ${numCategories} categorieën`);
    }
    
    // Formattering
    formatTotalOverview(outputSheet, output.length, hasVoorraadSheet);
    
    // Activeer het nieuwe sheet
    outputSheet.activate();
    
    // Success message
    let message = `Totaaloverzicht is gegenereerd:\n\n` +
                  `Categorieën: ${sortedTypes.length}\n` +
                  `Totaal verkocht: ${grandTotal}\n` +
                  `Overgeslagen: ${skippedRows} rijen`;
    
    if (hasVoorraadSheet) {
      message += `\n\n✅ Voorraad gekoppeld aan "BB | DEF voorraad PICKUPS"`;
    } else {
      message += `\n\n⚠️ "BB | DEF voorraad PICKUPS" sheet niet gevonden`;
    }
    
    ui.alert('✅ Geslaagd', message, ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('❌ Fout', 'Er is een fout opgetreden: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error in createTotalOverview: ' + error);
  }
}

/**
 * Formatteert het totaaloverzicht sheet
 * VERSIE 2.1: Ondersteunt voorraad kolommen
 */
function formatTotalOverview(sheet, numRows, hasVoorraadSheet) {
  const numCols = hasVoorraadSheet ? 4 : 4;
  
  // Header formattering
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4A86E8');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setHorizontalAlignment('center');
  
  // Data kolommen alignment
  if (numRows > 2) {
    // Kolom A (Categorie) - Links
    sheet.getRange(2, 1, numRows - 2, 1).setHorizontalAlignment('left');
    
    // Kolom B t/m D (Getallen) - Rechts
    sheet.getRange(2, 2, numRows - 2, numCols - 1).setHorizontalAlignment('right');
  }
  
  // Voorraad Resterend kolom - kleurcodering
  if (hasVoorraadSheet && numRows > 2) {
    const dataRows = numRows - 4; // Exclude header, empty row, total rows
    
    // Conditional formatting: rood als negatief, groen als positief
    const resterendRange = sheet.getRange(2, 4, dataRows, 1);
    
    // Negatieve waarden - rood
    const negativeRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setBackground('#F4CCCC')
      .setFontColor('#CC0000')
      .setRanges([resterendRange])
      .build();
    
    // Positieve waarden - lichtgroen
    const positiveRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground('#D9EAD3')
      .setRanges([resterendRange])
      .build();
    
    // Nul waarden - oranje
    const zeroRule = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(0)
      .setBackground('#FCE5CD')
      .setFontColor('#E69138')
      .setRanges([resterendRange])
      .build();
    
    const rules = sheet.getConditionalFormatRules();
    rules.push(negativeRule, positiveRule, zeroRule);
    sheet.setConditionalFormatRules(rules);
  }
  
  // Totaal rij formattering
  const totalRow = sheet.getRange(numRows - 2, 1, 1, numCols);
  totalRow.setFontWeight('bold');
  totalRow.setBackground('#E8E8E8');
  
  // Grand Totaal formattering
  const grandTotalRow = sheet.getRange(numRows, 1, 1, numCols);
  grandTotalRow.setFontWeight('bold');
  grandTotalRow.setFontSize(14);
  grandTotalRow.setBackground('#FFD966');
  
  // Auto-resize kolommen
  sheet.autoResizeColumns(1, numCols);
  
  // Freeze header
  sheet.setFrozenRows(1);
}

/**
 * Maakt overzicht per locatie en datum
 * Voor leveringsplanning
 */
function createLocationDateOverview() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Vind relevante kolommen
    const boomtypeIndex = headers.indexOf('Boomtype');
    const quantityIndex = headers.indexOf('Line: Quantity');
    const locationIndex = headers.indexOf('Pickup-Location-Company');
    const dateIndex = headers.indexOf('Pickup-Date');
    const timeIndex = headers.indexOf('Pickup-Time');
    
    if (boomtypeIndex === -1 || locationIndex === -1 || dateIndex === -1) {
      ui.alert('❌ Fout', 'Vereiste kolommen niet gevonden. Voer eerst "Verwerk Pickup Orders" uit.', ui.ButtonSet.OK);
      return;
    }
    
    // Groepeer data per locatie, datum en boomtype
    const grouped = {};
    let skippedRows = 0;
    
    for (let i = 1; i < data.length; i++) {
      const boomtype = (data[i][boomtypeIndex] || '').toString().trim();
      const quantityStr = (data[i][quantityIndex] || '').toString().trim();
      const location = (data[i][locationIndex] || 'Onbekend').toString().trim();
      const date = (data[i][dateIndex] || 'Onbekend').toString().trim();
      const time = (data[i][timeIndex] || '').toString().trim();
      
      // Parse quantity veilig
      const quantity = parseInt(quantityStr, 10);
      
      if (isNaN(quantity) || quantity <= 0 || boomtype === 'Onbekend' || !boomtype) {
        skippedRows++;
        continue;
      }
      
      const key = `${location}|${date}|${time}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          location: location,
          date: date,
          time: time,
          trees: {}
        };
      }
      
      grouped[key].trees[boomtype] = (grouped[key].trees[boomtype] || 0) + quantity;
    }
    
    Logger.log(`Locatie overzicht: ${Object.keys(grouped).length} pickup momenten, ${skippedRows} rijen overgeslagen`);
    
    // Maak of overschrijf output sheet
    let outputSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Locatie & Datum Overzicht');
    if (outputSheet) {
      outputSheet.clear();
    } else {
      outputSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Locatie & Datum Overzicht');
    }
    
    // Verzamel alle unieke boomtypen voor kolommen
    const allTreeTypes = new Set();
    Object.values(grouped).forEach(entry => {
      Object.keys(entry.trees).forEach(type => allTreeTypes.add(type));
    });
    const sortedTreeTypes = Array.from(allTreeTypes).sort();
    
    // Maak header
    const header = ['Locatie', 'Datum', 'Tijd', ...sortedTreeTypes, 'Totaal'];
    const output = [header];
    
    // Sorteer entries op datum en locatie
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      const aDate = String(grouped[a].date);
      const bDate = String(grouped[b].date);
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return String(grouped[a].location).localeCompare(String(grouped[b].location));
    });
    
    // Voeg data toe
    sortedKeys.forEach(key => {
      const entry = grouped[key];
      const row = [
        entry.location,
        entry.date,
        entry.time
      ];
      
      let rowTotal = 0;
      sortedTreeTypes.forEach(type => {
        const count = entry.trees[type] || 0;
        row.push(count);
        rowTotal += count;
      });
      
      row.push(rowTotal);
      output.push(row);
    });
    
    // Schrijf data
    outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
    
    // Formattering
    formatLocationDateOverview(outputSheet, output.length, sortedTreeTypes.length);
    
    // Activeer het nieuwe sheet
    outputSheet.activate();
    
    ui.alert('✅ Geslaagd', 
             `Locatie & Datum overzicht is gegenereerd:\n\n` +
             `Pickup momenten: ${sortedKeys.length}\n` +
             `Boomtype categorieën: ${sortedTreeTypes.length}\n` +
             `Overgeslagen: ${skippedRows} rijen`, 
             ui.ButtonSet.OK);
    
  } catch (error) {
    ui.alert('❌ Fout', 'Er is een fout opgetreden: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error in createLocationDateOverview: ' + error);
  }
}

/**
 * Formatteert het locatie & datum overzicht sheet
 */
function formatLocationDateOverview(sheet, numRows, numTreeTypes) {
  // Header formattering
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#6AA84F');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setWrap(true);
  
  // Totaal kolom formattering
  const totalColIndex = 4 + numTreeTypes;
  const totalColRange = sheet.getRange(2, totalColIndex, numRows - 1, 1);
  totalColRange.setFontWeight('bold');
  totalColRange.setBackground('#E8E8E8');
  
  // Auto-resize kolommen
  sheet.autoResizeColumns(1, sheet.getLastColumn());
  
  // Freeze header en eerste 3 kolommen
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  
  // Voeg filters toe
  const dataRange = sheet.getRange(1, 1, numRows, sheet.getLastColumn());
  dataRange.createFilter();
}

// ============================================
// BESTAANDE FUNCTIES (BEHOUDEN)
// ============================================

function checkForBorg() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const skuIndex = headers.indexOf("Line: SKU");
  
  if (skuIndex === -1) {
    throw new Error("Column 'Line: SKU' not found");
  }

  const borgColumnIndex = headers.length;
  sheet.getRange(1, borgColumnIndex + 1).setValue("Borg");

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const sku = data[i][skuIndex] || "";
    results.push([sku.includes("-BORG-")]);
  }

  sheet.getRange(2, borgColumnIndex + 1, results.length, 1).setValues(results);
}

function processShippingAddresses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const address1Index = headers.indexOf("Shipping: Address 1") + 1;
  const address2Index = headers.indexOf("Shipping: Address 2") + 1;

  if (address1Index === 0 || address2Index === 0) {
    SpreadsheetApp.getUi().alert('De vereiste headers "Shipping: Address 1" en "Shipping: Address 2" zijn niet gevonden.');
    return;
  }

  sheet.insertColumnsAfter(address2Index, 2);

  const newHeaders = ["Processed Address 1", "House Number"];
  sheet.getRange(1, address2Index + 1, 1, newHeaders.length).setValues([newHeaders]);

  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const data = dataRange.getValues();

  const processedData = data.map(row => {
    const address1 = row[address1Index - 1] || '';
    const address2 = row[address2Index - 1] || '';

    const address1String = typeof address1 === 'string' ? address1.trim() : address1.toString().trim();
    const address2String = typeof address2 === 'string' ? address2.trim() : (address2 ? address2.toString().trim() : '');

    const address1Match = address1String.match(/^(.*?)(?:\s+(\d.*))?$/);
    const address1Main = address1Match && address1Match[1] ? address1Match[1].trim() : address1String;
    let houseNumber = address1Match && address1Match[2] ? address1Match[2].trim() : '';

    if (!houseNumber && address2String) {
      houseNumber = address2String;
    }

    return [
      address1Main || address2String,
      houseNumber.trim()
    ];
  });

  const newRange = sheet.getRange(2, address2Index + 1, processedData.length, processedData[0].length);
  newRange.setValues(processedData);

  SpreadsheetApp.getUi().alert('Adressen zijn verwerkt! Nieuwe kolommen toegevoegd direct na "Shipping: Address 2".');
}

function splitDetailsInColumnC() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndex = headers.indexOf("Additional Details") + 1;
  
  if (columnIndex === 0) {
    SpreadsheetApp.getUi().alert('De kolom "Additional Details" is niet gevonden. Controleer de headers.');
    return;
  }

  const totalColumns = sheet.getLastColumn();
  const dataRange = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1);
  const values = dataRange.getValues();

  const labels = ['Shipping-Day', 'Shipping-Date', 'Checkout-Method'];

  if (totalColumns > columnIndex + 2) {
    sheet.insertColumnsAfter(columnIndex, 3);
  }

  const headerRange = sheet.getRange(1, columnIndex + 1, 1, labels.length);
  headerRange.setValues([labels]);

  const splitData = values.map(row => {
    if (row[0]) {
      const parts = row[0].split('\n');
      const dataMap = {};

      parts.forEach(part => {
        const [key, value] = part.split(': ');
        if (key && value) {
          dataMap[key.trim()] = value.trim();
        }
      });

      return labels.map(label => dataMap[label] || '');
    } else {
      return ['', '', ''];
    }
  });

  const destinationRange = sheet.getRange(2, columnIndex + 1, values.length, labels.length);
  destinationRange.setValues(splitData);

  SpreadsheetApp.getUi().alert('Gegevens in de kolom "Additional Details" zijn gesplitst naar nieuwe kolommen met headers!');
}

function splitPickupDetails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndex = headers.indexOf("Additional Details") + 1;
  
  if (columnIndex === 0) {
    SpreadsheetApp.getUi().alert('De kolom "Additional Details" is niet gevonden. Controleer de headers.');
    return;
  }

  const totalColumns = sheet.getLastColumn();
  const dataRange = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1, 1);
  const values = dataRange.getValues();

  const labels = ['Pickup-Day', 'Pickup-Date', 'Pickup-Time', 'Pickup-Location-Company'];

  if (totalColumns > columnIndex + labels.length - 1) {
    sheet.insertColumnsAfter(columnIndex, labels.length);
  }

  const headerRange = sheet.getRange(1, columnIndex + 1, 1, labels.length);
  headerRange.setValues([labels]);

  const splitData = values.map(row => {
    if (row[0]) {
      const parts = row[0].split('\n');
      const dataMap = {};

      parts.forEach(part => {
        const [key, value] = part.split(': ');
        if (key && value) {
          dataMap[key.trim()] = value.trim();
        }
      });

      return labels.map(label => dataMap[label] || '');
    } else {
      return new Array(labels.length).fill('');
    }
  });

  const destinationRange = sheet.getRange(2, columnIndex + 1, values.length, labels.length);
  destinationRange.setValues(splitData);

  SpreadsheetApp.getUi().alert('Gegevens in de kolom "Additional Details" zijn gesplitst naar nieuwe kolommen met headers!');
}

function floraAThomeTNTImporter() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  var headers = ["Name", "Command", "Line Type", "Line: SKU", "Line: Quantity", "Fulfillment: Status", "Fulfillment: Tracking Company", "Fulfillment: Tracking Number"];
  var output = [headers];
  
  var refWebshopIndex = data[0].indexOf("ReferenceWebshop");
  var productCodeIndex = data[0].indexOf("Product Code");
  var partnerBarcodeIndex = data[0].indexOf("Partner Barcode");
  
  var skuMapping = {
    "MM-MEC-0374": "ZNDRKLUIT-160170",
    "MM-MEC-0373": "ZNDRKLUIT-140150"
  };
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    
    if (!row[productCodeIndex]) {
      continue;
    }

    var newSku = skuMapping[row[productCodeIndex]] || row[productCodeIndex];
    
    var newRow = [
      row[refWebshopIndex],
      "UPDATE",
      "Line Item",
      newSku,
      1,
      "success",
      "DPD NL",
      row[partnerBarcodeIndex]
    ];
    
    output.push(newRow);
  }

  var outputSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TNT DATA IMPORT") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("TNT DATA IMPORT");
  outputSheet.clear();
  
  outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  outputSheet.setFrozenRows(1);
  outputSheet.setFrozenColumns(1);

  Logger.log("Processing complete. Check the 'TNT DATA IMPORT' sheet.");
}

function HerbiesfindAndReplace() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 0; i < data[0].length; i++) {
    if (data[0][i] === "Line: SKU") {
      for (var row = 1; row < data.length; row++) {
        if (data[row][i] === "ZNDRKLUIT-140150") {
          data[row][i] = "BL-726";
        } else if (data[row][i] === "ZNDRKLUIT-160170") {
          data[row][i] = "BL-727";
        } else {
          sheet.deleteRow(row + 1);
          data.splice(row, 1);
          row--;
        }
      }
      break;
    }
  }

  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
}

function calculateAndColor() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();

  const categories = {
    'MET-100-125': { color: '#FFFF00', total: 0 },
    'MET-125-150': { color: '#0000FF', total: 0 },
    'MET-150-175': { color: '#FFA500', total: 0 },
    'MET-175-200': { color: '#FF0000', total: 0 },
    'MET-BORG-100-125': { color: '#FFFF00', total: 0 },
    'MET-BORG-125-150': { color: '#0000FF', total: 0 },
    'MET-BORG-150-175': { color: '#FFA500', total: 0 },
    'MET-BORG-175-200': { color: '#FF0000', total: 0 },
    'ZONDER-150-175': { color: '#FFFF00', total: 0 },
    'ZONDER-175-200': { color: '#0000FF', total: 0 },
    'ZONDER-200-250': { color: '#808080', total: 0 },
    'ZONDER-250-300': { color: '#008000', total: 0 }
  };

  const combinedTotals = {};

  for (let i = 0; i < data.length; i++) {
    const description = data[i][0];
    const value = parseInt(data[i][1], 10);

    if (!isNaN(value)) {
      for (let range of ['100-125', '125-150', '150-175', '175-200']) {
        if (description.includes(`MET-${range}`) || description.includes(`MET-BORG-${range}`)) {
          if (!combinedTotals[range]) {
            combinedTotals[range] = { total: 0, color: categories[`MET-${range}`].color };
          }
          combinedTotals[range].total += value;
          sheet.getRange(i + 1, 1, 1, data[i].length).setBackground(categories[`MET-${range}`].color);
          break;
        }
      }

      for (let range in categories) {
        if (description.includes(range) && description.includes('ZONDER')) {
          categories[range].total += value;
          sheet.getRange(i + 1, 1, 1, data[i].length).setBackground(categories[range].color);
          break;
        }
      }
    }
  }

  const outputSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Resultaten') ||
                      SpreadsheetApp.getActiveSpreadsheet().insertSheet('Resultaten');
  outputSheet.clear();

  const output = [['Categorie', 'Totaal']];
  for (let range in combinedTotals) {
    output.push([`MET-${range} (incl. BORG)`, combinedTotals[range].total]);
  }

  for (let range in categories) {
    if (range.includes('ZONDER')) {
      output.push([range, categories[range].total]);
    }
  }

  const grandTotal = Object.values(combinedTotals).reduce((sum, item) => sum + item.total, 0) +
                     Object.values(categories).filter(cat => cat.color && cat.total).reduce((sum, cat) => sum + cat.total, 0);
  output.push(['Grand Total', grandTotal]);

  outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  SpreadsheetApp.getUi().alert('Berekeningen voltooid! Resultaten staan in de "Resultaten"-sheet.');
}



// ============================================

// HULPFUNCTIES - OVERZICHT BEHEER

// ============================================



/**

 * Ruimt oude "Totaaloverzicht" en "Plansum Overzicht" sheets op

 * Houdt alleen de meest recente X overzichten

 */

function cleanupOldOverviews() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ui = SpreadsheetApp.getUi();

  

  // Vind alle overzicht sheets

  const allSheets = ss.getSheets();

  const pickupOverviews = allSheets.filter(sheet => 

    sheet.getName().startsWith('Totaaloverzicht ')

  );

  const plansumOverviews = allSheets.filter(sheet => 

    sheet.getName().startsWith('Plansum Overzicht ')

  );

  

  const totalOverviews = pickupOverviews.length + plansumOverviews.length;

  

  if (totalOverviews === 0) {

    ui.alert('ℹ️ Info', 'Geen overzicht sheets gevonden om op te ruimen.', ui.ButtonSet.OK);

    return;

  }

  

  // Sorteer op naam (bevat timestamp, dus sorteert chronologisch)

  pickupOverviews.sort((a, b) => b.getName().localeCompare(a.getName()));

  plansumOverviews.sort((a, b) => b.getName().localeCompare(a.getName()));

  

  // Toon dialoog

  let message = `Gevonden:\n` +

                `• ${pickupOverviews.length} "Totaaloverzicht" (Pickup) sheets\n` +

                `• ${plansumOverviews.length} "Plansum Overzicht" sheets\n\n`;

  

  if (pickupOverviews.length > 0) {

    message += `Meest recente Pickup:\n${pickupOverviews.slice(0, 2).map(s => '• ' + s.getName()).join('\n')}\n\n`;

  }

  if (plansumOverviews.length > 0) {

    message += `Meest recente Plansum:\n${plansumOverviews.slice(0, 2).map(s => '• ' + s.getName()).join('\n')}\n\n`;

  }

  

  message += `Van ELKE soort de 5 meest recente behouden?\n(oudere worden verwijderd)`;

  

  const response = ui.alert(

    '🗑️ Oude Overzichten Opruimen',

    message,

    ui.ButtonSet.OK_CANCEL

  );

  

  if (response !== ui.Button.OK) {

    return;

  }

  

  // Behoud de 5 meest recente van elke soort

  const keepCount = 5;

  const pickupToDelete = pickupOverviews.slice(keepCount);

  const plansumToDelete = plansumOverviews.slice(keepCount);

  const totalToDelete = pickupToDelete.length + plansumToDelete.length;

  

  if (totalToDelete === 0) {

    ui.alert('ℹ️ Info', `Alle ${totalOverviews} overzichten worden behouden (niet meer dan ${keepCount} per soort).`, ui.ButtonSet.OK);

    return;

  }

  

  // Verwijder oude sheets

  pickupToDelete.forEach(sheet => {

    Logger.log(`Verwijder oud Pickup overzicht: ${sheet.getName()}`);

    ss.deleteSheet(sheet);

  });

  

  plansumToDelete.forEach(sheet => {

    Logger.log(`Verwijder oud Plansum overzicht: ${sheet.getName()}`);

    ss.deleteSheet(sheet);

  });

  

  ui.alert(

    '✅ Opgeruimd!',

    `${totalToDelete} oude overzichten verwijderd:\n` +

    `• ${pickupToDelete.length} Pickup overzichten\n` +

    `• ${plansumToDelete.length} Plansum overzichten\n\n` +

    `Per soort ${keepCount} meest recente behouden.`,

    ui.ButtonSet.OK

  );

}



// ============================================

// PLANSUM VERZENDING FUNCTIES

// ============================================



/**

 * Hoofdfunctie: Verwerkt Shopify Matrixify Plansum verzend orders

 * - Verwijdert tip/fooi regels

 * - Extraheert boomtype uit Plansum SKU

 * - Telt TP-TICKET apart

 */

function processPlansumOrders() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  const ui = SpreadsheetApp.getUi();

  

  try {

    // Valideer dat sheet data heeft

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {

      ui.alert('⚠️ Waarschuwing', 'Sheet heeft geen data om te verwerken.', ui.ButtonSet.OK);

      return;

    }

    

    // Valideer vereiste headers

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const requiredHeaders = ['Line: SKU', 'Line: Name', 'Line: Quantity'];

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    

    if (missingHeaders.length > 0) {

      ui.alert('❌ Fout', 

               `Vereiste kolommen niet gevonden:\n${missingHeaders.join('\n')}\n\n` +

               'Zorg dat je een correcte Shopify Matrixify export gebruikt.', 

               ui.ButtonSet.OK);

      return;

    }

    

    // Bevestiging vragen met details

    const response = ui.alert(

      'Plansum Orders Verwerken',

      `Sheet: ${sheet.getName()}\n` +

      `Rijen: ${lastRow - 1}\n\n` +

      'Dit zal:\n' +

      '1. Tip/fooi regels verwijderen\n' +

      '2. Boomtype extraheren uit Plansum SKU\n' +

      '3. TP-TICKETs apart tellen\n\n' +

      'Doorgaan?',

      ui.ButtonSet.YES_NO

    );

    

    if (response !== ui.Button.YES) {

      return;

    }

    

    // Initialiseer statistieken

    const stats = {

      tipsRemoved: 0,

      rowsProcessed: 0,

      unknownTypes: 0,

      tpTickets: 0,

      terugplantTickets: 0,

      startTime: new Date()

    };

    

    Logger.log('=== PLANSUM ORDER VERWERKING GESTART ===');

    Logger.log('Sheet: ' + sheet.getName());

    Logger.log('Start rijen: ' + (lastRow - 1));

    

    // Stap 1: Verwijder tips

    stats.tipsRemoved = removeTipRowsWithCount(sheet);

    

    // Stap 2: Extraheer boomtype (Plansum versie)

    const result = extractPlansumTreeType(sheet);

    stats.unknownTypes = result.unknownTypes;

    stats.tpTickets = result.tpTickets;

    stats.terugplantTickets = result.terugplantTickets;

    

    // Bereken eindstatistieken

    stats.rowsProcessed = sheet.getLastRow() - 1;

    const duration = ((new Date() - stats.startTime) / 1000).toFixed(1);

    

    Logger.log('=== VERWERKING VOLTOOID ===');

    Logger.log('Eindresultaat: ' + stats.rowsProcessed + ' rijen');

    Logger.log('Tips verwijderd: ' + stats.tipsRemoved);

    Logger.log('Onbekende types: ' + stats.unknownTypes);

    Logger.log('TP-TICKETs: ' + stats.tpTickets);

    Logger.log('Terugplant Tickets: ' + stats.terugplantTickets);

    Logger.log('Duur: ' + duration + ' seconden');

    

    // Toon resultaat aan gebruiker

    let message = `✅ Verwerking geslaagd!\n\n` +

                  `Verwerkt: ${stats.rowsProcessed} rijen\n` +

                  `Tips verwijderd: ${stats.tipsRemoved}\n` +

                  `TP-TICKETs: ${stats.tpTickets}\n` +

                  `Terugplant Tickets: ${stats.terugplantTickets}\n` +

                  `Duur: ${duration}s\n`;

    

    if (stats.unknownTypes > 0) {

      message += `\n⚠️ ${stats.unknownTypes} bomen met onbekend type\n` +

                 `Bekijk kolom "Boomtype" en de logs voor details.`;

    }

    

    ui.alert('Resultaat', message, ui.ButtonSet.OK);

    

  } catch (error) {

    ui.alert('❌ Fout', 

             `Er is een fout opgetreden:\n${error.message}\n\n` +

             'Bekijk View > Logs voor meer details.', 

             ui.ButtonSet.OK);

    Logger.log('ERROR in processPlansumOrders: ' + error.message);

    Logger.log('Stack trace: ' + error.stack);

  }

}



/**

 * Extraheert boomtype uit Plansum SKU en voegt toe als nieuwe kolom

 * Plansum SKUs: ZNDRKLUIT-140150, KLUIT-150175-VERZENDEN, KLUIT-150175-VERZENDEN_TRGPLNTN

 */

function extractPlansumTreeType(sheet) {

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const skuIndex = headers.indexOf('Line: SKU');

  

  if (skuIndex === -1) {

    throw new Error('Kolom "Line: SKU" niet gevonden');

  }

  

  // Check of Boomtype kolom al bestaat

  let boomtypeIndex = headers.indexOf('Boomtype');

  

  if (boomtypeIndex === -1) {

    // Voeg nieuwe kolom toe als deze niet bestaat

    const newColumnIndex = sheet.getLastColumn() + 1;

    sheet.getRange(1, newColumnIndex).setValue('Boomtype');

    boomtypeIndex = newColumnIndex - 1;

    Logger.log('Boomtype kolom aangemaakt');

  } else {

    Logger.log('Boomtype kolom bestaat al, wordt overschreven');

  }

  

  // Check of TP-TICKET kolom al bestaat

  let tpTicketIndex = headers.indexOf('TP-TICKET');

  

  if (tpTicketIndex === -1) {

    const newColumnIndex = sheet.getLastColumn() + 1;

    sheet.getRange(1, newColumnIndex).setValue('TP-TICKET');

    tpTicketIndex = newColumnIndex - 1;

    Logger.log('TP-TICKET kolom aangemaakt');

  }

  

  // Check of Terugplant Ticket kolom al bestaat

  let terugplantIndex = headers.indexOf('Terugplant Ticket');

  

  if (terugplantIndex === -1) {

    const newColumnIndex = sheet.getLastColumn() + 1;

    sheet.getRange(1, newColumnIndex).setValue('Terugplant Ticket');

    terugplantIndex = newColumnIndex - 1;

    Logger.log('Terugplant Ticket kolom aangemaakt');

  }

  

  const data = sheet.getRange(2, skuIndex + 1, sheet.getLastRow() - 1, 1).getValues();

  const treeTypes = [];

  const tpTicketFlags = [];

  const terugplantFlags = [];

  let unknownCount = 0;

  let tpTicketCount = 0;

  let terugplantCount = 0;

  const unknownSKUs = [];

  

  for (let i = 0; i < data.length; i++) {

    const sku = data[i][0] || '';

    const skuUpper = sku.toString().toUpperCase();

    

    // Check voor TP-TICKET

    if (skuUpper === 'TP-TICKET') {

      treeTypes.push(['TP-TICKET']);

      tpTicketFlags.push([true]);

      terugplantFlags.push([false]);

      tpTicketCount++;

      continue;

    }

    

    // Check voor Terugplant Ticket (SKUs met _TRGPLNTN)

    const hasTerugplantTicket = skuUpper.includes('_TRGPLNTN');

    

    const treeType = extractPlansumTreeTypeFromSKU(sku);

    

    if (treeType === 'Onbekend' && sku) {

      unknownCount++;

      unknownSKUs.push(sku);

      Logger.log(`⚠️ Onbekend boomtype voor Plansum SKU: "${sku}" (rij ${i + 2})`);

    }

    

    if (hasTerugplantTicket) {

      terugplantCount++;

    }

    

    treeTypes.push([treeType]);

    tpTicketFlags.push([false]);

    terugplantFlags.push([hasTerugplantTicket]);

  }

  

  // Schrijf naar de juiste kolommen

  sheet.getRange(2, boomtypeIndex + 1, treeTypes.length, 1).setValues(treeTypes);

  sheet.getRange(2, tpTicketIndex + 1, tpTicketFlags.length, 1).setValues(tpTicketFlags);

  sheet.getRange(2, terugplantIndex + 1, terugplantFlags.length, 1).setValues(terugplantFlags);

  

  // Log samenvatting

  if (unknownCount > 0) {

    Logger.log(`\n⚠️ WAARSCHUWING: ${unknownCount} onbekende boomtypen gevonden`);

    Logger.log('Unieke onbekende SKUs:');

    const uniqueUnknown = [...new Set(unknownSKUs)];

    uniqueUnknown.forEach(sku => Logger.log('  - ' + sku));

  }

  

  Logger.log(`Terugplant Tickets gevonden: ${terugplantCount}`);

  

  return {

    unknownTypes: unknownCount,

    tpTickets: tpTicketCount,

    terugplantTickets: terugplantCount

  };

}



/**

 * Helper functie: Haalt boomtype uit Plansum SKU string

 * 

 * Plansum SKU formaten:

 * - ZNDRKLUIT-140150 → ZONDER-140-150

 * - ZNDRKLUIT-160170 → ZONDER-160-170

 * - KLUIT-100125-VERZENDEN → MET-100-125

 * - KLUIT-125150-VERZENDEN → MET-125-150

 * - KLUIT-150175-VERZENDEN → MET-150-175

 * - KLUIT-175200-VERZENDEN → MET-175-200

 * - KLUIT-xxxxx-VERZENDEN_TRGPLNTN → Zelfde categorie (terugplant ticket = apart geteld)

 * - TP-TICKET → Aparte categorie

 */

function extractPlansumTreeTypeFromSKU(sku) {

  if (!sku) return '';

  

  // Normaliseer SKU: uppercase

  const skuUpper = sku.toString().toUpperCase().trim();

  

  // Check voor TP-TICKET (al afgehandeld, maar voor de zekerheid)

  if (skuUpper === 'TP-TICKET') {

    return 'TP-TICKET';

  }

  

  // ZONDER KLUIT

  if (skuUpper.startsWith('ZNDRKLUIT-')) {

    if (skuUpper.includes('140150')) return 'ZONDER-140-150';

    if (skuUpper.includes('160170')) return 'ZONDER-160-170';

  }

  

  // MET KLUIT (met of zonder TRGPLNTN - beide krijgen zelfde categorie)

  if (skuUpper.startsWith('KLUIT-')) {

    if (skuUpper.includes('100125')) return 'MET-100-125';

    if (skuUpper.includes('125150')) return 'MET-125-150';

    if (skuUpper.includes('150175')) return 'MET-150-175';

    if (skuUpper.includes('175200')) return 'MET-175-200';

  }

  

  return 'Onbekend';

}



/**

 * Maakt totaaloverzicht van Plansum verzend orders per type

 */

function createPlansumTotalOverview() {

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  const ui = SpreadsheetApp.getUi();

  

  try {

    const data = sheet.getDataRange().getValues();

    const headers = data[0];

    

    // Vind relevante kolommen

    const boomtypeIndex = headers.indexOf('Boomtype');

    const quantityIndex = headers.indexOf('Line: Quantity');

    const tpTicketIndex = headers.indexOf('TP-TICKET');

    

    if (boomtypeIndex === -1) {

      ui.alert('❌ Fout', 'Kolom "Boomtype" niet gevonden. Voer eerst "Verwerk Plansum Orders" uit.', ui.ButtonSet.OK);

      return;

    }

    

    if (quantityIndex === -1) {

      ui.alert('❌ Fout', 'Kolom "Line: Quantity" niet gevonden.', ui.ButtonSet.OK);

      return;

    }

    

    // Tel bomen per type

    const totals = {};

    let skippedRows = 0;

    let tpTicketTotal = 0;

    

    for (let i = 1; i < data.length; i++) {

      const boomtype = (data[i][boomtypeIndex] || '').toString().trim();

      const quantityStr = (data[i][quantityIndex] || '').toString().trim();

      const isTPTicket = tpTicketIndex !== -1 ? data[i][tpTicketIndex] : false;

      

      // Parse quantity veilig

      const quantity = parseInt(quantityStr, 10);

      

      // Skip ongeldige of lege entries

      if (isNaN(quantity) || quantity <= 0) {

        skippedRows++;

        continue;

      }

      

      // Tel TP-TICKETs apart

      if (isTPTicket || boomtype === 'TP-TICKET') {

        tpTicketTotal += quantity;

        continue;

      }

      

      if (!boomtype || boomtype === 'Onbekend' || boomtype === '') {

        skippedRows++;

        continue;

      }

      

      totals[boomtype] = (totals[boomtype] || 0) + quantity;

    }

    

    Logger.log(`Plansum overzicht: ${Object.keys(totals).length} categorieën, ${skippedRows} rijen overgeslagen, ${tpTicketTotal} TP-TICKETs`);

    

    // Check of voorraad sheet bestaat (PLANTSOME versie)

    const voorraadSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BB | DEF voorraad PLANTSOME');

    const hasVoorraadSheet = voorraadSheet !== null;

    

    if (!hasVoorraadSheet) {

      Logger.log('⚠️ Waarschuwing: "BB | DEF voorraad PLANTSOME" sheet niet gevonden. Voorraad kolommen worden niet toegevoegd.');

    }

    

    // Maak NIEUW output sheet met timestamp

    const now = new Date();

    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    const sheetName = `Plansum Overzicht ${timestamp}`;

    

    // Maak nieuw sheet

    const outputSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);

    

    Logger.log(`Nieuw Plansum overzicht sheet aangemaakt: ${sheetName}`);

    

    // Bereid output data voor

    const headers_output = hasVoorraadSheet 

      ? ['Categorie', 'Verkocht', 'Begin Voorraad', 'Voorraad Resterend']

      : ['Categorie', 'Verkocht'];

    

    const output = [headers_output];

    

    // Sorteer boomtypen

    const sortedTypes = Object.keys(totals).sort();

    let grandTotal = 0;

    

    sortedTypes.forEach(type => {

      const total = totals[type];

      grandTotal += total;

      

      if (hasVoorraadSheet) {

        output.push([type, total, 'FORMULA', 'FORMULA']);

      } else {

        output.push([type, total]);

      }

    });

    

    // Voeg totaal toe

    output.push(['', '', '', '']);

    output.push(['Total Bomen', grandTotal, '', '']);

    output.push(['TP-TICKETs', tpTicketTotal, '', '']);

    output.push(['', '', '', '']);

    output.push(['Grand Totaal', grandTotal, '', '']);

    

    // Schrijf data (zonder formules)

    outputSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

    

    // Voeg VLOOKUP formules toe voor voorraad als het sheet bestaat

    if (hasVoorraadSheet) {

      const formulaStartRow = 2;

      const numCategories = sortedTypes.length;

      

      for (let i = 0; i < numCategories; i++) {

        const rowNum = formulaStartRow + i;

        

        // Kolom C: VLOOKUP voor Begin Voorraad (PLANTSOME sheet)

        const vlookupFormula = `=IFERROR(VLOOKUP(A${rowNum};'BB | DEF voorraad PLANTSOME'!A:B;2;FALSE);0)`;

        outputSheet.getRange(rowNum, 3).setFormula(vlookupFormula);

        

        // Kolom D: Voorraad Resterend = Begin Voorraad (C) - Verkocht (B)

        const restFormula = `=C${rowNum}-B${rowNum}`;

        outputSheet.getRange(rowNum, 4).setFormula(restFormula);

      }

      

      Logger.log(`Voorraad formules toegevoegd voor ${numCategories} categorieën`);

    }

    

    // Formattering

    formatTotalOverview(outputSheet, output.length, hasVoorraadSheet);

    

    // Activeer het nieuwe sheet

    outputSheet.activate();

    

    // Success message

    let message = `Plansum overzicht is gegenereerd:\n\n` +

                  `Categorieën: ${sortedTypes.length}\n` +

                  `Totaal verkocht: ${grandTotal} bomen\n` +

                  `TP-TICKETs: ${tpTicketTotal}\n` +

                  `Overgeslagen: ${skippedRows} rijen`;

    

    if (hasVoorraadSheet) {

      message += `\n\n✅ Voorraad gekoppeld aan "BB | DEF voorraad"`;

    } else {

      message += `\n\n⚠️ "BB | DEF voorraad" sheet niet gevonden`;

    }

    

    ui.alert('✅ Geslaagd', message, ui.ButtonSet.OK);

    

  } catch (error) {

    ui.alert('❌ Fout', 'Er is een fout opgetreden: ' + error.message, ui.ButtonSet.OK);

    Logger.log('Error in createPlansumTotalOverview: ' + error);

  }

}


/* HOOFDPAGINA INDEXEN */
function openIndex_() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(INDEX_SHEET_NAME)) rebuildIndex();
  ss.setActiveSheet(ss.getSheetByName(INDEX_SHEET_NAME));
}

function rebuildIndex() {
  const ss = SpreadsheetApp.getActive();
  ensureMeta_(ss);
  updateMetaFromIndex_(); // bewaar handmatige edits

  const indexSh = getOrCreateIndexSheet_(ss);
  const indexId = indexSh.getSheetId();
  const metaId  = ss.getSheetByName(META_SHEET_NAME).getSheetId();

  indexSh.clear();

  const headers = ['Categorie','Naam','Link','SheetId','SortKey'];
  indexSh.getRange(1,1,1,headers.length).setValues([headers]);

  const metaMap = getMetaMap_(ss);
  const ssUrl = ss.getUrl();

  // verzamel alle tabbladen behalve index en meta
  const sheets = ss.getSheets()
    .filter(s => ![indexId, metaId].includes(s.getSheetId()))
    .filter(s => !s.getName().startsWith('_'));

  // alfabetisch op naam
  sheets.sort((a,b)=> a.getName().localeCompare(b.getName(), undefined, {sensitivity:'base'}));

  const rows = [];
  const linkUrls = [];

  sheets.forEach(s => {
    const id   = s.getSheetId();
    const name = s.getName();
    const link = ssUrl + '#gid=' + id;

    const meta = metaMap[id] || {};
    const autoCat = parseCategoryFromName_(name);
    const cat  = meta.cat || autoCat || '';
    const sortKey = cat.toUpperCase();

    rows.push([cat, name, 'Openen', id, sortKey]);
    linkUrls.push(link);
  });

  if (rows.length) {
    indexSh.getRange(2,1,rows.length,rows[0].length).setValues(rows);

    for (let i = 0; i < rows.length; i++) {
      const row = 2 + i;
      setRichLink_(indexSh.getRange(row, 2), rows[i][1], linkUrls[i]); // Naam klikbaar
      setRichLink_(indexSh.getRange(row, 3), 'Openen', linkUrls[i]);   // Link klikbaar
    }
  }

  styleIndexSheet_(indexSh, rows.length);

  // sorteer Hoofdblad op Categorie en daarna op Naam
  if (rows.length) {
    indexSh
      .getRange(2,1,rows.length,headers.length)
      .sort([{column:1, ascending:true},{column:2, ascending:true}]);
  }

  // zet tabs onderin alfabetisch en Hoofdblad eerst
  reorderTabsAlphabetically_(ss);

  updateMetaFromIndex_(); // sla huidige staat op
}

function updateIndex() {
  updateMetaFromIndex_();
  rebuildIndex();
}

/* helpers */
function ensureMeta_(ss) {
  let meta = ss.getSheetByName(META_SHEET_NAME);
  if (!meta) {
    meta = ss.insertSheet(META_SHEET_NAME);
    meta.getRange(1,1,1,2).setValues([['SheetId','Categorie']]);
    meta.hideSheet();
  }
}

function getMetaMap_(ss) {
  const sh = ss.getSheetByName(META_SHEET_NAME);
  const last = sh.getLastRow();
  const map = {};
  if (last < 2) return map;
  const vals = sh.getRange(2,1,last-1,2).getValues();
  vals.forEach(r => {
    const id = r[0];
    if (id) map[id] = { cat: r[1] || '' };
  });
  return map;
}

function updateMetaFromIndex_() {
  const ss = SpreadsheetApp.getActive();
  ensureMeta_(ss);

  const idx = ss.getSheetByName(INDEX_SHEET_NAME);
  const meta = ss.getSheetByName(META_SHEET_NAME);
  if (!idx) return;

  const lastRow = idx.getLastRow();
  const lastCol = idx.getLastColumn();
  if (lastRow < 2) return;

  const headers = idx.getRange(1,1,1,lastCol).getValues()[0];
  const idCol   = headers.indexOf('SheetId') + 1;
  const catCol  = headers.indexOf('Categorie') + 1;

  const data = idx.getRange(2,1,lastRow-1,lastCol).getValues();

  const out = [];
  data.forEach((row) => {
    const id = row[idCol-1];
    if (!id) return;
    const cat  = row[catCol-1] || '';
    out.push([id, cat]);
  });

  meta.clear();
  meta.getRange(1,1,1,2).setValues([['SheetId','Categorie']]);
  if (out.length) meta.getRange(2,1,out.length,2).setValues(out);
  meta.hideSheet();
}

function parseCategoryFromName_(name) {
  if (!name) return 'OVERIG';
  const up = name.toUpperCase().trim();
  
  // INPUT sheets
  if (up.includes('BB | INPUT') || up.includes('BB | DEF VOORRAAD')) {
    if (up.includes('DEF VOORRAAD')) return 'DEF VOORRAAD';
    return 'INPUT';
  }
  
  // OVERZICHT sheets (totaaloverzicht, plansum overzicht)
  if (up.includes('OVERZICHT') || up.includes('TOTAAL')) {
    return 'OVERZICHT';
  }
  
  // TRANSPORT sheets (TR |)
  if (up.startsWith('TR |') || up.startsWith('TR|')) {
    return 'TRANSPORT';
  }
  
  // DEF VOORRAAD sheets
  if (up.includes('DEF VOORRAAD')) {
    return 'DEF VOORRAAD';
  }
  
  return 'OVERIG';
}

function getOrCreateIndexSheet_(ss) {
  let sh = ss.getSheetByName(INDEX_SHEET_NAME);
  if (!sh) sh = ss.insertSheet(INDEX_SHEET_NAME);
  return sh;
}

function styleIndexSheet_(sh, rowCount) {
  const lastCol = sh.getLastColumn();

  const head = sh.getRange(1,1,1,lastCol);
  head.setFontWeight('bold')
      .setHorizontalAlignment('left')
      .setBackground('#0B6E4F')
      .setFontColor('#ffffff');

  sh.setFrozenRows(1);

  if (rowCount > 0) {
    const bandRange = sh.getRange(1,1,rowCount+1,lastCol);
    bandRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  sh.setColumnWidths(1,1,140); // Categorie
  sh.setColumnWidths(2,1,320); // Naam (breder voor langere namen)
  sh.setColumnWidths(3,1,110); // Link

  // validatie categorie
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CATEGORY_ORDER, true)
    .setAllowInvalid(true)
    .build();
  if (rowCount > 0) sh.getRange(2,1,rowCount,1).setDataValidation(rule);

  // hulp kolommen verbergen
  if (lastCol >= 4) {
    sh.hideColumns(4); // SheetId
    sh.hideColumns(5); // SortKey
  }

  const rng = sh.getRange(1,1,Math.max(2,rowCount+1),lastCol);
  if (sh.getFilter()) sh.getFilter().remove();
  rng.createFilter();
}

function setRichLink_(range, text, url) {
  const rich = SpreadsheetApp.newRichTextValue()
    .setText(text)
    .setLinkUrl(url)
    .build();
  range.setRichTextValue(rich);
}

// veilig herordenen van tabs
function reorderTabsAlphabetically_(ss) {
  const indexSheet = ss.getSheetByName(INDEX_SHEET_NAME);
  const metaSheet  = ss.getSheetByName(META_SHEET_NAME);

  const rest = ss.getSheets().filter(s => s !== indexSheet && s !== metaSheet);
  rest.sort((a,b)=> a.getName().localeCompare(b.getName(), undefined, {sensitivity:'base'}));

  let pos = 1;
  if (indexSheet && typeof indexSheet.setIndex === 'function') {
    indexSheet.setIndex(pos++);
  }

  for (const s of rest) {
    if (typeof s.setIndex === 'function') {
      s.setIndex(pos++);
    }
  }

  if (metaSheet) metaSheet.hideSheet();
}