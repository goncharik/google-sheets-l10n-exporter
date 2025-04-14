# Google Sheets Localization Script

A Google Sheets script that takes a sheet with translations and generates localization files for both iOS and Android platforms, with support for plurals.

## What It Does

- For **Android**: Creates XML resource files with strings and plurals
- For **iOS**: 
  - **Legacy format**: Creates Localizable.strings files and Localizable.stringsdict for plurals
  - **Modern format**: Creates Localizable.xcstrings files which combine both regular strings and plurals in a single JSON file

## Installation

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Copy the contents of `script.gs` into the editor
4. Save the project
5. Refresh your Google Sheet

## Usage

1. Format your sheet according to the guidelines below
2. From your sheet, access the custom menu: **Custom Export**
3. Select one of the following:
   - **iOS (Legacy)** - creates .strings and .stringsdict files
   - **iOS (.xcstrings)** - creates modern .xcstrings file
   - **Android** - creates strings.xml
4. Copy the generated files to your project

## Sheet Format

The script expects a specific sheet format:

| ... (any columns) | **Identifier iOS** | **Identifier Android** | English text | German text | ... |
|-------------------|--------------------|-----------------------|--------------|-------------|-----|
| (additional info) | login_button_title | login_button_title    | Login        | Einloggen   |     |
| ...               | ...                | ...                   | ...          | ...         |     |

**Important notes:**
- The **bold headers** are required exactly as written
- The first row must contain headers
- The position of the iOS/Android identifier columns can be configured (see Configuration)
- Language columns should be added to the right of the identifier columns

### Plural Support

This script supports pluralization with a special key format:

```
translation.key##{quantity}
```

Where `quantity` is one of the CLDR plural categories:
- `zero`
- `one`
- `two`
- `few`
- `many`
- `other`

**Example:**

| Identifier iOS        | Identifier Android   | English                | German                |
|-----------------------|---------------------|------------------------|----------------------|
| items.count##{zero}   | items_count##{zero} | No items               | Keine Elemente       |
| items.count##{one}    | items_count##{one}  | One item               | Ein Element          |
| items.count##{other}  | items_count##{other}| %d items               | %d Elemente          |

### String Arrays (Android)

For Android string arrays, append `[]` to the key. Consecutive rows with the same array name will be grouped:

| Identifier iOS   | Identifier Android    | English          | German           |
|------------------|----------------------|------------------|------------------|
| week.days        | week.days[]          | Monday           | Montag           |
| week.days        | week.days[]          | Tuesday          | Dienstag         |
| week.days        | week.days[]          | Wednesday        | Mittwoch         |

## Configuration

The script has several configurable properties at the top of the file:

```javascript
// Number of languages in your sheet (columns after identifier columns)
var NUMBER_OF_LANGUAGES = 2;

// Position of the first column with iOS identifiers (1-based)
var FIRST_COLUMN_POSITION = 1;

// Position of the header row
var HEADER_ROW_POSITION = 1;

// Source language identifier (used for .xcstrings format)
var SOURCE_LANGUAGE = "en";

// Language codes for each column after the identifier columns
var LANGUAGE_CODES = ["en", "de"];
```

Make sure to:
1. Set `NUMBER_OF_LANGUAGES` to match the number of language columns in your sheet
2. Update `LANGUAGE_CODES` array to match your actual language codes in the correct order
3. Set `SOURCE_LANGUAGE` to your development language (typically "en")

## Exported Files

### Android
- `strings.xml` with string and plural resources (one per language)

### iOS Legacy Format
- `Localizable.strings` for regular strings (one per language)
- `Localizable.stringsdict` for plurals (one per language)

### iOS Modern Format
- `Localizable.xcstrings` (combines all languages and both regular strings and plurals in a single JSON file)

## Modern iOS Format (.xcstrings)

The modern iOS format introduced in Xcode 15 combines all localizations in a single JSON file with the following advantages:
- Combines both regular strings and plurals in one file
- Supports multiple languages in a single file
- Native support in Xcode's localization system
- Better compatibility with future iOS/macOS versions

## Credits

This script is inspired by [localizable-sheet-script](https://github.com/cobeisfresh/localizable-sheet-script) by COBE, with added support for plurals and other enhancements.

## License

MIT License - See the [LICENSE](LICENSE) file for details. 