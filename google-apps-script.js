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
    if (payload.type === "markWatched") return markMovieWatched(payload);
    if (payload.type === "unmarkWatched") return unmarkMovieWatched(payload);
    return ContentService.createTextOutput("Invalid type");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function getMovies() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
  const data = sheet.getDataRange().getValues();

  // Get suggestion data to map suggesters and timestamps
  const suggestSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_SUGGEST);
  const suggestData = suggestSheet.getDataRange().getValues();

  // Create a map of movie title -> {suggester, timestamp}
  const suggesterMap = {};
  for (let i = 1; i < suggestData.length; i++) {
    const title = suggestData[i][2].toLowerCase();
    if (!suggesterMap[title]) {
      suggesterMap[title] = {
        suggester: suggestData[i][1],
        timestamp: suggestData[i][0]
      };
    }
  }

  const movies = [];
  for (let i = 1; i < data.length; i++) {
    const title = data[i][1];
    const movieData = suggesterMap[title.toLowerCase()];
    movies.push({
      id: data[i][0],
      title: title,
      votes: data[i][2],
      suggester: movieData ? movieData.suggester : null,
      timestamp: movieData ? movieData.timestamp : null,
      watchedDate: data[i][3] || null,
      markedBy: data[i][4] || null
    });
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
  try {
    // Log the payload for debugging
    Logger.log("Recording suggestion: " + JSON.stringify(payload));

    // Record to Suggestions sheet
    const ss = SpreadsheetApp.getActive().getSheetByName(SHEET_SUGGEST);
    if (!ss) {
      return ContentService.createTextOutput("Error: Suggestions sheet not found");
    }
    ss.appendRow([new Date(), payload.name, payload.suggestion]);

    // Add to Movies sheet if not exists
    const msheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
    if (!msheet) {
      return ContentService.createTextOutput("Error: Movies sheet not found");
    }

    const mdata = msheet.getDataRange().getValues();

    // Skip header row when checking existing titles
    const existingTitles = mdata.length > 1
      ? mdata.slice(1).map(r => r[1].toLowerCase())
      : [];

    if (!existingTitles.includes(payload.suggestion.toLowerCase())) {
      // Generate ID: if there are existing movies, use the last ID + 1, otherwise start at 1
      const newId = mdata.length > 1 ? mdata[mdata.length - 1][0] + 1 : 1;
      msheet.appendRow([newId, payload.suggestion, 0]);
      Logger.log("Added new movie with ID: " + newId);
    } else {
      Logger.log("Movie already exists: " + payload.suggestion);
    }

    return ContentService.createTextOutput("OK");
  } catch (error) {
    Logger.log("Error in recordSuggestion: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function markMovieWatched(payload) {
  try {
    Logger.log("Marking movie as watched: " + JSON.stringify(payload));

    const msheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
    const mdata = msheet.getDataRange().getValues();

    // Find the movie by title
    for (let i = 1; i < mdata.length; i++) {
      if (mdata[i][1].toLowerCase() === payload.title.toLowerCase()) {
        // Update Watched Date (column 4) and Marked By (column 5)
        msheet.getRange(i + 1, 4).setValue(new Date());
        msheet.getRange(i + 1, 5).setValue(payload.markedBy);
        Logger.log("Movie marked as watched: " + payload.title);
        return ContentService.createTextOutput("OK");
      }
    }

    return ContentService.createTextOutput("Error: Movie not found");
  } catch (error) {
    Logger.log("Error in markMovieWatched: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function unmarkMovieWatched(payload) {
  try {
    Logger.log("Unmarking movie as watched: " + JSON.stringify(payload));

    const msheet = SpreadsheetApp.getActive().getSheetByName(SHEET_MOVIES);
    const mdata = msheet.getDataRange().getValues();

    // Find the movie by title
    for (let i = 1; i < mdata.length; i++) {
      if (mdata[i][1].toLowerCase() === payload.title.toLowerCase()) {
        // Clear Watched Date (column 4) and Marked By (column 5)
        msheet.getRange(i + 1, 4).setValue("");
        msheet.getRange(i + 1, 5).setValue("");
        Logger.log("Movie unmarked as watched: " + payload.title);
        return ContentService.createTextOutput("OK");
      }
    }

    return ContentService.createTextOutput("Error: Movie not found");
  } catch (error) {
    Logger.log("Error in unmarkMovieWatched: " + error.toString());
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

function asJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
