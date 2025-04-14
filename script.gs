// Configurable properties

/*
   The number of languages you support. Please check the README.md for more
   information on column positions.
*/
var NUMBER_OF_LANGUAGES = 2;

/*
   The script expects two columns for iOS and Android identifiers, respectively,
   and a column after that with all of the string values. This is the position of
   the iOS column.
*/
var FIRST_COLUMN_POSITION = 1;

/*
   The position of the header containing the strings "Identifier iOS" and "Identifier Android"
*/
var HEADER_ROW_POSITION = 1;

/*
   Source language identifier (used for .xcstrings format)
   This should match one of your language codes in the spreadsheet, like "en"
*/
var SOURCE_LANGUAGE = "en";

/*
   Language codes for each column after the identifier columns
   These should match the language codes used by iOS and Android, e.g., ["en", "de", "fr"]
*/
var LANGUAGE_CODES = ["en", "de"];


// Constants

var LANGUAGE_IOS = 'iOS';
var LANGUAGE_ANDROID = 'Android';
var DEFAULT_LANGUAGE = LANGUAGE_IOS;
var PLURAL_SEPARATOR = '##{';
var PLURAL_END = '}';

// --- Plural Quantities (standard CLDR keywords) ---
// https://cldr.unicode.org/index/cldr-spec/plural-rules
// Android uses these directly. iOS .stringsdict also uses them.
var PLURAL_QUANTITIES = ['zero', 'one', 'two', 'few', 'many', 'other'];


// Export

function onOpen() {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Custom Export')
        .addItem('iOS (Legacy)', 'exportForIosLegacy')
        .addItem('iOS (.xcstrings)', 'exportForIosModern')
        .addItem('Android', 'exportForAndroid')
        .addToUi();
}

function exportForIosLegacy() {
    var e = {
        parameter: {
            language: LANGUAGE_IOS,
            modern: false
        }
    };
    exportSheet(e);
}

function exportForIosModern() {
    var e = {
        parameter: {
            language: LANGUAGE_IOS,
            modern: true
        }
    };
    exportSheet(e);
}

function exportForAndroid() {
    var e = {
        parameter: {
            language: LANGUAGE_ANDROID
        }
    };
    exportSheet(e);
}

/*
   Fetches the active sheet, gets all of the data, processes it for plurals,
   and displays the result strings.
*/
function exportSheet(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    var options = getExportOptions(e);
    var rowsData = getRowsData_(sheet, options);

    var platformKey = options.language === LANGUAGE_ANDROID ? 'identifierAndroid' : 'identifierIos';
    var processedData = processDataForPlurals_(rowsData, platformKey);

    var outputStrings = []; // Array to hold the generated file contents

    if (options.language === LANGUAGE_ANDROID) {
        // For Android, generate output for each language
        for (var langIndex = 0; langIndex < NUMBER_OF_LANGUAGES; langIndex++) {
            var androidXml = makeAndroidString(processedData.regular, processedData.plurals, langIndex, options);
            outputStrings.push({ androidXml: androidXml, langCode: LANGUAGE_CODES[langIndex] });
        }
    } else if (options.language === LANGUAGE_IOS) {
        if (options.modern) {
            // New .xcstrings format (combines both regular strings and plurals in a single file)
            var xcstrings = makeIosXCStrings(processedData.regular, processedData.plurals, options);
            outputStrings.push({ xcstrings: xcstrings });
        } else {
            // Legacy format (.strings and .stringsdict) - generate for each language
            for (var langIndex = 0; langIndex < NUMBER_OF_LANGUAGES; langIndex++) {
                var output = {
                    iosStrings: makeIosString(processedData.regular, langIndex, options),
                    langCode: LANGUAGE_CODES[langIndex]
                };
                
                // Only add stringsdict if there are plurals
                if (Object.keys(processedData.plurals).length > 0) {
                    output.iosStringsdict = makeIosStringsdict(processedData.plurals, langIndex, options);
                }
                
                outputStrings.push(output);
            }
        }
    }

    // Display results
    return displayTexts_(outputStrings, options);
}

function getExportOptions(e) {
    var options = {};
    options.language = e && e.parameter.language || DEFAULT_LANGUAGE;
    options.modern = e && e.parameter.modern || false;
    
    // Ensure LANGUAGE_CODES has at least NUMBER_OF_LANGUAGES entries
    while (LANGUAGE_CODES.length < NUMBER_OF_LANGUAGES) {
        LANGUAGE_CODES.push("lang" + (LANGUAGE_CODES.length + 1));
    }
    
    return options;
}


// UI Elements

function makeLabel(app, text, id) {
    var lb = app.createLabel(text);
    if (id) lb.setId(id);
    return lb;
}

function makeListBox(app, name, items) {
    var listBox = app.createListBox().setId(name).setName(name);
    listBox.setVisibleItemCount(1);

    var cache = CacheService.getPublicCache();
    var selectedValue = cache.get(name);
    Logger.log(selectedValue);
    for (var i = 0; i < items.length; i++) {
        listBox.addItem(items[i]);
        if (items[1] == selectedValue) {
            listBox.setSelectedIndex(i);
        }
    }
    return listBox;
}

function makeButton(app, parent, name, callback) {
    var button = app.createButton(name);
    app.add(button);
    var handler = app.createServerClickHandler(callback).addCallbackElement(parent);;
    button.addClickHandler(handler);
    return button;
}

function makeTextBox(id, content, title) {
    var titleHtml = title ? '<h3>' + escapeHtml_(title) + '</h3>' : '';
    var textArea = titleHtml + '<textarea rows="10" cols="80" id="' + id + '" readonly>' + escapeHtml_(content) + '</textarea><br/><br/>';
    return textArea;
}

// Display function to handle multiple outputs
function displayTexts_(languageOutputs, options) {
    var app = HtmlService.createHtmlOutput().setWidth(800).setHeight(600);
    var htmlContent = '';

    for (var i = 0; i < languageOutputs.length; i++) {
        var langOutput = languageOutputs[i];
        var langTitle = "";
        
        // Set appropriate titles based on output type and language
        if (langOutput.langCode) {
            langTitle = "Language: " + langOutput.langCode;
        } else if (NUMBER_OF_LANGUAGES > 1 && !options.modern) {
            langTitle = "Language " + (i + 1);
        } else {
            langTitle = "Output";
        }
        
        htmlContent += '<h2>' + langTitle + '</h2>';

        if (options.language === LANGUAGE_ANDROID) {
            htmlContent += makeTextBox("export_android_" + i, langOutput.androidXml, 
                "strings.xml" + (langOutput.langCode ? " (" + langOutput.langCode + ")" : ""));
        } else if (options.language === LANGUAGE_IOS) {
            if (options.modern) {
                htmlContent += makeTextBox("export_ios_xcstrings_" + i, langOutput.xcstrings, 
                    "Localizable.xcstrings");
            } else {
                htmlContent += makeTextBox("export_ios_strings_" + i, langOutput.iosStrings, 
                    "Localizable.strings" + (langOutput.langCode ? " (" + langOutput.langCode + ")" : ""));
                if (langOutput.iosStringsdict) {
                    htmlContent += makeTextBox("export_ios_stringsdict_" + i, langOutput.iosStringsdict, 
                        "Localizable.stringsdict" + (langOutput.langCode ? " (" + langOutput.langCode + ")" : ""));
                }
            }
        }
    }

    var title = "Translations (" + options.language + 
                (options.language === LANGUAGE_IOS ? (options.modern ? " Modern" : " Legacy") : "") + ")";
    
    app.setContent(htmlContent);
    SpreadsheetApp.getUi().showModalDialog(app, title);
    return app; // Return is needed for testing, but dialog is shown regardless
}


// --- Data Processing for Plurals ---

/*
  Parses a potential plural key.
  Returns: { baseKey: "key", quantity: "one" } or null if not a plural key.
*/
function parsePluralKey_(key) {
    if (!key || typeof key !== 'string') {
        return null;
    }
    var separatorIndex = key.lastIndexOf(PLURAL_SEPARATOR);
    if (separatorIndex === -1 || !key.endsWith(PLURAL_END)) {
        return null;
    }
    var baseKey = key.substring(0, separatorIndex);
    var quantity = key.substring(separatorIndex + PLURAL_SEPARATOR.length, key.length - PLURAL_END.length);

    // Validate if the quantity is known (optional but good practice)
    // if (PLURAL_QUANTITIES.indexOf(quantity) === -1) {
    //    Logger.log('Warning: Unknown plural quantity "' + quantity + '" for key "' + baseKey + '"');
    //    // Decide whether to return null or allow it
    // }

    if (baseKey.length === 0 || quantity.length === 0) {
        return null; // Invalid format
    }

    return { baseKey: baseKey, quantity: quantity };
}

/*
  Processes raw row data to separate regular strings and group plural strings.
  platformKey: 'identifierAndroid' or 'identifierIos'
*/
function processDataForPlurals_(rowsData, platformKey) {
    var regularStrings = [];
    var plurals = {}; // { baseKey: { quantity: { texts: [...] }, quantity2: ... }, baseKey2: ... }

    for (var i = 0; i < rowsData.length; i++) {
        var row = rowsData[i];
        var identifier = row[platformKey];

        if (!identifier || identifier === "") {
            continue; // Skip rows without an identifier for the target platform
        }

        // Check if any text exists for this row before processing
        var hasText = row.texts.some(function (text) { return text && text !== ""; });
        if (!hasText) {
            // If *no* language has text for this row, skip it entirely.
            // If *some* languages have text, keep the row object but individual
            // make... functions will handle empty strings for specific languages.
            // Let's refine this: if the text for the *first* language is empty,
            // we might skip, but this is complex. For now, process if identifier exists.
            // The make... functions already skip if text for *their* langIndex is empty.
            // Let's assume we process if identifier exists.
        }


        var pluralInfo = parsePluralKey_(identifier);

        if (pluralInfo) {
            // It's a plural key
            var baseKey = pluralInfo.baseKey;
            var quantity = pluralInfo.quantity;

            if (!plurals[baseKey]) {
                plurals[baseKey] = {};
            }
            // Store the entire row object for this quantity,
            // allowing access to all language texts later.
            plurals[baseKey][quantity] = row;

        } else if (identifier.endsWith("[]")) {
            // It's a string array (keep existing logic path for this within makeAndroidString)
            // Treat as regular for now, let makeAndroidString handle it.
            regularStrings.push(row);
        }
        else {
            // It's a regular string key
            regularStrings.push(row);
        }
    }

    return { regular: regularStrings, plurals: plurals };
}


// --- Creating iOS and Android strings ---

/*
   Creates the .xcstrings file for iOS (modern format)
   This combines both regular strings and plurals into a single JSON file
*/
function makeIosXCStrings(regularStrings, plurals, options) {
    var xcstrings = {
        "sourceLanguage": SOURCE_LANGUAGE,
        "strings": {},
        "version": "1.0"
    };
    
    // Process regular strings
    for (var i = 0; i < regularStrings.length; i++) {
        var o = regularStrings[i];
        var identifier = o.identifierIos;
        
        // Skip if identifier is missing or it's an array (not supported in iOS)
        if (!identifier || identifier === "" || identifier.endsWith("[]")) {
            continue;
        }
        
        // Create the entry for this string key
        var entry = {
            "localizations": {}
        };
        
        // Add each language's translation
        for (var langIndex = 0; langIndex < NUMBER_OF_LANGUAGES; langIndex++) {
            var text = o.texts[langIndex];
            if (text !== undefined && text !== "") {
                var langCode = LANGUAGE_CODES[langIndex];
                entry.localizations[langCode] = {
                    "stringUnit": {
                        "state": "translated",
                        "value": text
                    }
                };
            }
        }
        
        // Only add the entry if it has at least one localization
        if (Object.keys(entry.localizations).length > 0) {
            xcstrings.strings[identifier] = entry;
        }
    }
    
    // Process plurals
    for (var baseKey in plurals) {
        if (plurals.hasOwnProperty(baseKey)) {
            var pluralData = plurals[baseKey];
            
            // Create entry for this plural key
            var entry = {
                "localizations": {}
            };
            
            // Process each language
            for (var langIndex = 0; langIndex < NUMBER_OF_LANGUAGES; langIndex++) {
                var langCode = LANGUAGE_CODES[langIndex];
                var hasTranslationsForLang = false;
                
                // Check if any plural form has a translation for this language
                for (var quantity in pluralData) {
                    if (pluralData.hasOwnProperty(quantity)) {
                        var text = pluralData[quantity].texts[langIndex];
                        if (text !== undefined && text !== "") {
                            hasTranslationsForLang = true;
                            break;
                        }
                    }
                }
                
                if (hasTranslationsForLang) {
                    // Initialize the variations object for plurals
                    var variations = {
                        "plural": {}
                    };
                    
                    // Add each plural form that has a translation
                    for (var quantity in pluralData) {
                        if (pluralData.hasOwnProperty(quantity)) {
                            var text = pluralData[quantity].texts[langIndex];
                            if (text !== undefined && text !== "") {
                                variations.plural[quantity] = {
                                    "stringUnit": {
                                        "state": "translated",
                                        "value": text
                                    }
                                };
                            }
                        }
                    }
                    
                    // Add the variations to the language
                    entry.localizations[langCode] = {
                        "variations": variations
                    };
                }
            }
            
            // Only add the entry if it has at least one localization
            if (Object.keys(entry.localizations).length > 0) {
                xcstrings.strings[baseKey] = entry;
            }
        }
    }
    
    // Convert to a pretty-printed JSON string
    return JSON.stringify(xcstrings, null, 2);
}

/*
   Creates the strings.xml file for Android, including <plurals>.
*/
function makeAndroidString(regularStrings, plurals, textIndex, options) {

    var exportString = "";
    var prevIdentifier = ""; // For string-array handling

    exportString += '<?xml version="1.0" encoding="UTF-8"?>' + "\n";
    exportString += '<resources>\n';

    // 1. Process Regular Strings and String Arrays
    for (var i = 0; i < regularStrings.length; i++) {
        var o = regularStrings[i];
        var identifier = o.identifierAndroid;
        var text = o.texts[textIndex]; // Get text for the specific language index

        // Skip if identifier is missing or text for this language is empty
        if (!identifier || identifier === "" || text === undefined || text === "") {
            continue;
        }

        // Handle closing previous string-array
        if (!identifier.endsWith("[]") && prevIdentifier.endsWith("[]")) {
            exportString += "\t" + '</string-array>' + "\n";
            prevIdentifier = ""; // Reset prevIdentifier
        }

        if (identifier.endsWith("[]")) {
            var arrayName = identifier.substring(0, identifier.length - 2);
            if (identifier !== prevIdentifier) {
                // Start of a new array
                exportString += "\t" + '<string-array name="' + escapeXml_(arrayName) + '">' + "\n";
            }
            exportString += "\t\t" + '<item>' + escapeXml_(text) + '</item>' + "\n";
            prevIdentifier = identifier; // Track the current array identifier
        } else {
            // Regular string
            exportString += "\t" + '<string name="' + escapeXml_(identifier) + '">' + escapeXml_(text) + '</string>' + "\n";
            prevIdentifier = ""; // Ensure it's reset if previous was an array item
        }
    }

    // Close any trailing string-array
    if (prevIdentifier.endsWith("[]")) {
        exportString += "\t" + '</string-array>' + "\n";
    }

    // 2. Process Plurals
    for (var baseKey in plurals) {
        if (plurals.hasOwnProperty(baseKey)) {
            var pluralData = plurals[baseKey];
            var hasPluralText = Object.keys(pluralData).some(function (quantity) {
                return pluralData[quantity].texts[textIndex] !== undefined && pluralData[quantity].texts[textIndex] !== "";
            });

            // Only generate plurals tag if there's at least one translation for this language
            if (hasPluralText) {
                exportString += "\t" + '<plurals name="' + escapeXml_(baseKey) + '">' + "\n";
                // Add items for each quantity that has text for this language
                for (var quantity in pluralData) {
                    if (pluralData.hasOwnProperty(quantity)) {
                        var text = pluralData[quantity].texts[textIndex];
                        if (text !== undefined && text !== "") {
                            exportString += "\t\t" + '<item quantity="' + quantity + '">' + escapeXml_(text) + '</item>' + "\n";
                        }
                    }
                }
                exportString += "\t" + '</plurals>' + "\n";
            }
        }
    }

    exportString += "</resources>";

    return exportString;
}


/*
   Creates the Localizable.strings file content for iOS (non-plural keys only).
   Used in legacy iOS export.
*/
function makeIosString(regularStrings, textIndex, options) {
    var stringsContent = "";

    for (var i = 0; i < regularStrings.length; i++) {
        var o = regularStrings[i];
        var identifier = o.identifierIos;
        var text = o.texts[textIndex]; // Get text for the specific language index

        // Skip if identifier is missing or text for this language is empty
        // Also skip string arrays for iOS .strings file
        if (!identifier || identifier === "" || identifier.endsWith("[]") || text === undefined || text === "") {
            continue;
        }

        // Add to .strings file content
        stringsContent += '"' + escapeString_(identifier) + '" = "' + escapeString_(text) + '";\n';
    }

    return stringsContent;
}

/*
   Creates the Localizable.stringsdict file content for iOS plurals.
   Used in legacy iOS export.
*/
function makeIosStringsdict(plurals, textIndex, options) {
    var dictContent = "";

    dictContent += '<?xml version="1.0" encoding="UTF-8"?>\n';
    dictContent += '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
    dictContent += '<plist version="1.0">\n';
    dictContent += '<dict>\n';

    for (var baseKey in plurals) {
        if (plurals.hasOwnProperty(baseKey)) {
            var pluralData = plurals[baseKey];
            var hasPluralText = Object.keys(pluralData).some(function (quantity) {
                return pluralData[quantity].texts[textIndex] !== undefined && pluralData[quantity].texts[textIndex] !== "";
            });

            // Only generate dict entry if there's at least one translation for this language
            if (hasPluralText) {
                dictContent += '    <key>' + escapeXml_(baseKey) + '</key>\n';
                dictContent += '    <dict>\n';
                dictContent += '        <key>NSStringLocalizedFormatKey</key>\n';
                // Find a format specifier in one of the values (e.g., %d, %@). Default to %#@plural@ if none found.
                // A common pattern is to use %d for the count in 'other'.
                var formatKey = '%#@' + escapeXml_(baseKey) + '@'; // Default reference
                var foundFormat = false;
                for (var quantity in pluralData) {
                    if (pluralData.hasOwnProperty(quantity) && pluralData[quantity].texts[textIndex]) {
                        var text = pluralData[quantity].texts[textIndex];
                        // Look for common format specifiers
                        if (text.includes('%d') || text.includes('%@') || text.includes('%ld') || text.includes('%lu') || text.includes('%lld') || text.includes('%llu')) {
                            formatKey = escapeXml_(text);
                            foundFormat = true;
                            break; // Use the first one found
                        }
                    }
                }
                // If no format specifier like %d found, use the 'other' value if available, else default
                if (!foundFormat && pluralData['other'] && pluralData['other'].texts[textIndex]) {
                    formatKey = escapeXml_(pluralData['other'].texts[textIndex]);
                }


                dictContent += '        <string>' + formatKey + '</string>\n';
                dictContent += '        <key>' + escapeXml_(baseKey) + '</key>\n'; // The variable key name matches the plural base key
                dictContent += '        <dict>\n';
                dictContent += '            <key>NSStringFormatSpecTypeKey</key>\n';
                dictContent += '            <string>NSStringPluralRuleType</string>\n';
                dictContent += '            <key>NSStringFormatValueTypeKey</key>\n';
                // Common practice is 'd' for integers. Adjust if using floats etc.
                dictContent += '            <string>d</string>\n';

                // Add items for each quantity that has text for this language
                for (var quantity in pluralData) {
                    if (pluralData.hasOwnProperty(quantity)) {
                        var text = pluralData[quantity].texts[textIndex];
                        if (text !== undefined && text !== "") {
                            dictContent += '            <key>' + escapeXml_(quantity) + '</key>\n';
                            dictContent += '            <string>' + escapeXml_(text) + '</string>\n';
                        }
                    }
                }
                dictContent += '        </dict>\n';
                dictContent += '    </dict>\n';
            }
        }
    }

    dictContent += '</dict>\n';
    dictContent += '</plist>\n';

    return dictContent;
}


// Data fetching (Mostly Unchanged)

function getRowsData_(sheet, options) {
    // Ensure range doesn't exceed actual sheet dimensions
    var lastRow = sheet.getLastRow();
    // Start from row after header
    var startRow = HEADER_ROW_POSITION + 1;
    var numRows = lastRow - HEADER_ROW_POSITION;

    // Check if there are any data rows
    if (numRows <= 0) {
        return []; // No data to fetch
    }


    var dataRange = sheet.getRange(startRow, FIRST_COLUMN_POSITION, numRows, sheet.getMaxColumns());
    var headers = getNormalizedHeaders(sheet, options); // Get headers relative to FIRST_COLUMN_POSITION
    var objects = getObjects(dataRange.getValues(), headers);

    return objects;
}

function getNormalizedHeaders(sheet, options) {
    var headersRange = sheet.getRange(HEADER_ROW_POSITION, FIRST_COLUMN_POSITION, 1, sheet.getMaxColumns() - FIRST_COLUMN_POSITION + 1);
    var headers = headersRange.getValues()[0];
    // Filter out empty header cells *before* normalization
    var validHeaders = headers.filter(function (header) { return typeof header === 'string' && header.trim() !== ''; });
    return normalizeHeaders(validHeaders);
}


function normalizeHeaders(headers) {
    var keys = [];
    for (var i = 0; i < headers.length; ++i) {
        var key = normalizeHeader(headers[i]);
        if (key.length > 0) {
            keys.push(key);
        }
    }
    return keys;
}


function normalizeHeader(header) {
    var key = "";
    var upperCase = false;
    for (var i = 0; i < header.length; ++i) {
        var letter = header[i];
        if (letter == " " && key.length > 0) {
            upperCase = true;
            continue;
        }
        if (!isAlnum_(letter)) {
            // Allow underscore in headers
            if (letter === '_') {
                key += letter;
                upperCase = false; // Reset upperCase after underscore
                continue;
            }
            continue;
        }
        if (key.length == 0 && isDigit_(letter)) {
            // Allow keys starting with underscore then number? For now, skip first digit.
            if (key.length === 0 && letter === '_') { // Allow starting with _
                key += letter;
                continue;
            }
            continue; // first character must be a letter or _
        }
        if (upperCase) {
            upperCase = false;
            key += letter.toUpperCase();
        } else {
            key += letter.toLowerCase();
        }
    }
    return key;
}


function getObjects(data, keys) {
    var objects = [];
    var keyIdentifierIos = "identifierIos"; // Assuming normalized header
    var keyIdentifierAndroid = "identifierAndroid"; // Assuming normalized header

    // Find the actual index of identifier keys and text columns
    var idxIos = keys.indexOf(keyIdentifierIos);
    var idxAndroid = keys.indexOf(keyIdentifierAndroid);
    var textColumnIndices = [];
    for (var k = 0; k < keys.length; k++) {
        if (k !== idxIos && k !== idxAndroid) {
            textColumnIndices.push(k);
        }
    }
    // Sort text column indices just in case headers weren't perfectly ordered
    textColumnIndices.sort(function (a, b) { return a - b; });


    for (var i = 0; i < data.length; ++i) {
        var rowData = data[i];
        var object = {
            "texts": []
        };
        var hasIdentifier = false;
        var hasAnyText = false;

        // Assign identifiers if found
        if (idxIos !== -1 && !isCellEmpty_(rowData[idxIos])) {
            object[keyIdentifierIos] = rowData[idxIos];
            hasIdentifier = true;
        } else {
            object[keyIdentifierIos] = ""; // Ensure key exists
        }
        if (idxAndroid !== -1 && !isCellEmpty_(rowData[idxAndroid])) {
            object[keyIdentifierAndroid] = rowData[idxAndroid];
            hasIdentifier = true;
        } else {
            object[keyIdentifierAndroid] = ""; // Ensure key exists
        }


        // Populate texts array in the correct order
        for (var t = 0; t < NUMBER_OF_LANGUAGES; t++) {
            // Map the language index 't' to the correct column index in the sheet data
            // This assumes language columns start right after the identifier columns
            // A more robust approach might use header names like 'langEn', 'langFr'
            // For now, assume order: ID_iOS, ID_Android, Lang1, Lang2, ...
            var dataColIndex = (idxAndroid > idxIos ? idxAndroid : idxIos) + 1 + t;

            // Check if this calculated index is valid within the row's data length
            if (dataColIndex < rowData.length) {
                var cellData = rowData[dataColIndex];
                if (isCellEmpty_(cellData)) {
                    object["texts"].push(""); // Use empty string for empty cells
                } else {
                    object["texts"].push(cellData);
                    if (cellData !== "") {
                        hasAnyText = true;
                    }
                }
            } else {
                object["texts"].push(""); // Push empty string if column index is out of bounds
                Logger.log("Warning: Row " + (i + HEADER_ROW_POSITION + 1) + " seems to have fewer columns than expected for language index " + t);
            }
        }

        // Only add the object if it has at least one identifier AND some text content
        // Or adjust this logic based on requirements (e.g., must have ID for *target* platform)
        if (hasIdentifier) { // Maybe check (hasIdentifier && hasAnyText)?
            objects.push(object);
        }
    }
    return objects;
}


// Utils (Added escaping functions)

// Simple XML escaping
function escapeXml_(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case '\\\'': return '\'';
            case '"': return '"';
        }
    });
}

// Simple HTML escaping for display
function escapeHtml_(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, "\"")
        .replace(/'/g, "'");
}

// Escaping for iOS .strings values (quotes and backslashes)
function escapeString_(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function isCellEmpty_(cellData) {
    return typeof (cellData) == "string" && cellData == "";
}

function isAlnum_(char) {
    // Allow underscore
    return char >= 'A' && char <= 'Z' ||
        char >= 'a' && char <= 'z' ||
        isDigit_(char) ||
        char === '_';
}

function isDigit_(char) {
    return char >= '0' && char <= '9';
} 