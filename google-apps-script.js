const SHEET_MOVIES = "Movies";
const SHEET_VOTES = "Votes";
const SHEET_SUGGEST = "Suggestions";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "movies") return getMovies();
  if (action === "leaderboard") return getLeaderboard();
  return ContentService.createTextOutput("No action specified");
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.type === "vote") return recordVote(payload);
    if (payload.type === "suggestion") return recordSuggestion(payload);
    return ContentService.createTextOutput("Invalid type");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function getMovies() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
  const data = sheet.getDataRange().getValues();
  const movies = [];
  for (let i = 1; i < data.length; i++) {
    movies.push({ id: data[i][0], title: data[i][1], votes: data[i][2] });
  }
  return asJSON(movies);
}

function getLeaderboard() {
  return getMovies();
}

function recordVote(payload) {
  const vsheet = SpreadsheetApp.getActive().getSheetByName(SHEET_VOTES);

  // Handle new object-based picks format
  const picksArray = typeof payload.picks === 'object' && !Array.isArray(payload.picks)
    ? Object.entries(payload.picks).flatMap(([title, count]) => Array(count).fill(title))
    : payload.picks;

  // Write to separate columns: Timestamp, Voter Name, Pick #1, Pick #2, Pick #3
  vsheet.appendRow([
    new Date(),
    payload.name,
    picksArray[0] || "",
    picksArray[1] || "",
    picksArray[2] || ""
  ]);

  const msheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
  const mdata = msheet.getDataRange().getValues();
  const titleToRow = {};
  for (let i = 1; i < mdata.length; i++) {
    titleToRow[mdata[i][1].toLowerCase()] = i + 1;
  }

  // Handle both object and array formats
  if (typeof payload.picks === 'object' && !Array.isArray(payload.picks)) {
    // New format: { "Movie Title": 2, "Another Movie": 1 }
    Object.entries(payload.picks).forEach(([title, count]) => {
      const row = titleToRow[title.toLowerCase()];
      if (row) {
        let cur = msheet.getRange(row, 3).getValue();
        msheet.getRange(row, 3).setValue(cur + count);
      }
    });
  } else {
    // Old format: ["Movie1", "Movie2", "Movie3"]
    payload.picks.forEach(title => {
      const row = titleToRow[title.toLowerCase()];
      if (row) {
        let cur = msheet.getRange(row, 3).getValue();
        msheet.getRange(row, 3).setValue(cur + 1);
      }
    });
  }

  return ContentService.createTextOutput("OK");
}

function recordSuggestion(payload) {
  const ss = SpreadsheetApp.getActive().getSheetByName(SHEET_SUGGEST);
  ss.appendRow([new Date(), payload.name, payload.suggestion]);

  // Add to Movies sheet if not exists
  const msheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
  const mdata = msheet.getDataRange().getValues();
  const existingTitles = mdata.slice(1).map(r => r[1].toLowerCase());

  if (!existingTitles.includes(payload.suggestion.toLowerCase())) {
    const newId = mdata.length;
    msheet.appendRow([newId, payload.suggestion, 0]);
  }

  return ContentService.createTextOutput("OK");
}

function asJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
