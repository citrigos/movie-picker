const API = "https://script.google.com/macros/s/AKfycbxY5sWwES-VNHpyDx1K09ai4Xr8yO4wcwcMy1i-JYmWP_mpIRO08NpbW7oxO2GCuJM/exec";

let movies = [];
let picks = {}; // changed to object to track vote counts per movie
let userName = localStorage.getItem('userName') || '';
let sortBy = 'alpha'; // 'alpha' or 'time'
let watchedMovies = []; // Now fetched from Google Sheets

// Convert text to title case
function toTitleCase(str) {
  return str.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

// Haptic feedback for mobile devices
function triggerHaptic(intensity = 'medium') {
  // Check if the Vibration API is supported
  if ('vibrate' in navigator) {
    switch(intensity) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 10, 30]);
        break;
      case 'success':
        navigator.vibrate([20, 10, 20, 10, 40]);
        break;
      default:
        navigator.vibrate(20);
    }
  }
}

// Custom alert function
function customAlert(message) {
  const alertEl = document.getElementById('custom-alert');
  const messageEl = document.getElementById('custom-alert-message');
  messageEl.textContent = message;
  alertEl.classList.remove('hidden');
}

// Close custom alert
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('custom-alert-ok').onclick = () => {
    document.getElementById('custom-alert').classList.add('hidden');
  };
});

async function fetchMovies() {
  const res = await fetch(`${API}?action=movies`);
  const allMovies = await res.json();

  // Separate watched and unwatched movies
  watchedMovies = allMovies.filter(m => m.watchedDate);
  movies = allMovies.filter(m => !m.watchedDate);

  drawMovies();
  updateLeaderboard();
  drawWatchedMovies();
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  if (date > oneYearAgo) {
    // Within last year: DD/MM
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  } else {
    // Older: MM/YYYY
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${year}`;
  }
}

function drawMovies() {
  const list = document.getElementById("movie-list");
  list.innerHTML = "";

  // Sort movies based on current sort option
  const sortedMovies = [...movies].sort((a, b) => {
    if (sortBy === 'alpha') {
      return a.title.localeCompare(b.title);
    } else {
      // Sort by timestamp (newest first if no timestamp, put at end)
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
  });

  sortedMovies.forEach(m => {
    const card = document.createElement("div");
    card.className = "movie-card";
    const voteCount = picks[m.title] || 0;
    if (voteCount > 0) {
      card.classList.add("selected");
    }
    const suggesterText = m.suggester ? `<span class="suggester">by ${m.suggester}</span>` : '';
    const dateText = (sortBy === 'time' && m.timestamp) ? `<span class="movie-date">${formatDate(m.timestamp)}</span>` : '';
    card.innerHTML = `
      <div class="movie-title">
        <span>${toTitleCase(m.title)} ${suggesterText}</span>
        ${dateText}
      </div>
      ${voteCount > 0 ? `<div class="vote-badge">${voteCount}</div>` : ''}
    `;
    card.onclick = () => togglePick(m.title);
    list.append(card);
  });
}

function togglePick(title) {
  const totalVotes = Object.values(picks).reduce((sum, count) => sum + count, 0);
  const currentVotes = picks[title] || 0;

  // Cycle through: 0 -> 1 -> 2 -> 3 -> 0
  if (currentVotes === 0 && totalVotes < 3) {
    // Start voting for this movie
    picks[title] = 1;
    triggerHaptic('medium');
  } else if (currentVotes > 0 && currentVotes < 3 && totalVotes < 3) {
    // Add another vote
    picks[title]++;
    triggerHaptic('light');
  } else if (currentVotes > 0) {
    // Remove all votes from this movie and free up space
    delete picks[title];
    triggerHaptic('light');
  } else {
    // Can't add more votes (already at 3 total)
    triggerHaptic('heavy');
  }

  const newTotal = Object.values(picks).reduce((sum, count) => sum + count, 0);
  document.getElementById("selected-count").textContent = newTotal;
  drawMovies();
}

async function submitVote() {
  if (!userName) return customAlert("Please enter your name at the top first!");

  const totalVotes = Object.values(picks).reduce((sum, count) => sum + count, 0);
  if (totalVotes !== 3) return customAlert("Pick exactly 3 votes!");

  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.remove("hidden");

  try {
    console.log("Submitting vote:", { type: "vote", name: userName, picks });
    const response = await fetch(API, {
      method: "POST",
      body: JSON.stringify({
        type: "vote",
        name: userName,
        picks
      })
    });

    console.log("Response status:", response.status);
    const responseData = await response.text();
    console.log("Response data:", responseData);

    loadingIndicator.classList.add("hidden");
    triggerHaptic('success');
    customAlert("Vote submitted!");
    picks = {};
    document.getElementById("selected-count").textContent = 0;
    await fetchMovies(); // refresh leaderboard + reset
  } catch (error) {
    console.error("Submit vote error:", error);
    loadingIndicator.classList.add("hidden");
    customAlert("Failed to submit vote. Please try again.");
  }
}

async function submitSuggestion() {
  if (!userName) return customAlert("Please enter your name at the top first!");

  const suggestion = document.getElementById("suggestion").value.trim();
  if (!suggestion) return customAlert("Enter at least one movie title!");

  const suggestionInput = document.getElementById("suggestion");

  // Parse comma-separated list
  const movies = suggestion.split(',').map(s => s.trim()).filter(s => s);
  if (movies.length === 0) return customAlert("Enter at least one movie title!");

  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.remove("hidden");

  try {
    // Submit each movie separately
    for (const movie of movies) {
      console.log("Submitting suggestion:", { type: "suggestion", name: userName, suggestion: toTitleCase(movie) });
      const response = await fetch(API, {
        method: "POST",
        body: JSON.stringify({
          type: "suggestion",
          name: userName,
          suggestion: toTitleCase(movie)
        })
      });
      console.log("Suggestion response status:", response.status);
    }

    loadingIndicator.classList.add("hidden");
    triggerHaptic('success');
    const movieWord = movies.length === 1 ? 'movie' : 'movies';
    customAlert(`Thanks for suggesting ${movies.length} ${movieWord}!`);
    suggestionInput.value = "";
    await fetchMovies(); // refresh list instantly
  } catch (error) {
    console.error("Submit suggestion error:", error);
    loadingIndicator.classList.add("hidden");
    customAlert("Failed to submit suggestion. Please try again.");
  }
}

async function updateLeaderboard() {
  const lb = document.getElementById("leaderboard");
  const topMovies = document.getElementById("top-movies");

  lb.innerHTML = "";
  topMovies.innerHTML = "";

  const sorted = [...movies].sort((a,b) => b.votes - a.votes);
  const withVotes = sorted.filter(m => m.votes > 0);
  const withoutVotes = sorted.filter(m => m.votes === 0);

  // Top leaderboard (top 3)
  sorted.slice(0, 3).forEach(m => {
    const chip = document.createElement("div");
    chip.className = "top-movie";
    chip.innerHTML = `${toTitleCase(m.title.trim())}<strong>${m.votes}</strong>`;
    topMovies.append(chip);
  });

  // Full leaderboard - movies with votes
  withVotes.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${toTitleCase(m.title.trim())}: ${m.votes}`;
    lb.append(li);
  });

  // No votes section
  if (withoutVotes.length > 0) {
    const noVotesLi = document.createElement("li");
    noVotesLi.className = "no-votes";
    const movieTitles = withoutVotes.map(m => toTitleCase(m.title.trim())).join(', ');
    noVotesLi.textContent = `No votes for: ${movieTitles}`;
    lb.append(noVotesLi);
  }
}

function saveName() {
  const nameInput = document.getElementById("name");
  const name = nameInput.value.trim();

  if (!name) return customAlert("Please enter your name!");

  userName = name;
  localStorage.setItem('userName', userName);
  updateNameUI();
}

function updateNameUI() {
  const nameBanner = document.getElementById("name-banner");
  const notYouLink = document.getElementById("not-you-link");
  const greeting = document.getElementById("greeting");

  if (userName) {
    nameBanner.classList.add("hidden");
    notYouLink.classList.remove("hidden");
    greeting.textContent = `Hi ${userName}, vote for movie night!`;
  } else {
    nameBanner.classList.remove("hidden");
    notYouLink.classList.add("hidden");
    greeting.textContent = "Vote for Movie Night!";
  }
}

function changeName() {
  userName = '';
  localStorage.removeItem('userName');
  document.getElementById("name").value = '';
  updateNameUI();
}

document.getElementById("submit-vote").onclick = submitVote;
document.getElementById("submit-suggest").onclick = submitSuggestion;
document.getElementById("save-name").onclick = saveName;

// Toggle suggest form
document.getElementById("suggest-toggle").onclick = () => {
  const form = document.getElementById("suggest-form");
  const button = document.getElementById("suggest-toggle");
  if (form.classList.contains("hidden")) {
    form.classList.remove("hidden");
    button.classList.add("hidden");
  } else {
    form.classList.add("hidden");
    button.classList.remove("hidden");
  }
};

// Handle Enter key in name input
document.getElementById("name").addEventListener("keypress", (e) => {
  if (e.key === "Enter") saveName();
});

// Handle Enter key in suggestion input
document.getElementById("suggestion").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitSuggestion();
  }
});

// Fun mode toggle
document.getElementById("fun-mode-toggle").onclick = () => {
  document.body.classList.toggle("fun-mode");
};

// Sort controls
document.getElementById("sort-alpha").onclick = (e) => {
  e.preventDefault();
  sortBy = 'alpha';
  document.getElementById("sort-alpha").classList.add("active");
  document.getElementById("sort-time").classList.remove("active");
  drawMovies();
};

document.getElementById("sort-time").onclick = (e) => {
  e.preventDefault();
  sortBy = 'time';
  document.getElementById("sort-time").classList.add("active");
  document.getElementById("sort-alpha").classList.remove("active");
  drawMovies();
};

// Leaderboard toggle
document.getElementById("leaderboard-toggle").onclick = () => {
  const section = document.getElementById("leaderboard-section");
  const button = document.getElementById("leaderboard-toggle");
  section.classList.remove("hidden");
  button.classList.add("hidden");
};

// Watched movies functions
function drawWatchedMovies() {
  const container = document.getElementById("watched-movies-list");
  container.innerHTML = "";

  if (watchedMovies.length === 0) {
    container.innerHTML = '<p style="color: #86868b; font-size: 0.8rem; font-style: italic;">No movies marked as watched yet.</p>';
    return;
  }

  watchedMovies.forEach(movie => {
    const chip = document.createElement("div");
    chip.className = "watched-movie-chip";
    const dateStr = movie.watchedDate ? ` (${formatDate(movie.watchedDate)})` : '';
    chip.innerHTML = `
      <span>${toTitleCase(movie.title)}${dateStr}</span>
      <span class="remove-btn" data-title="${movie.title}">×</span>
    `;
    container.append(chip);
  });

  // Add event listeners to remove buttons
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.onclick = () => {
      const title = btn.getAttribute("data-title");
      removeWatchedMovie(title);
    };
  });
}

async function markAsWatched() {
  if (!userName) return customAlert("Please enter your name at the top first!");

  const input = document.getElementById("mark-watched");
  const dateInput = document.getElementById("watched-date");
  const movieTitle = input.value.trim();
  const watchedDate = dateInput.value; // YYYY-MM-DD format or empty

  if (!movieTitle) return customAlert("Enter a movie title!");

  // Check if movie exists in the unwatched list
  const movie = movies.find(m => m.title.toLowerCase() === movieTitle.toLowerCase());

  if (!movie) {
    return customAlert("Movie not found in the list. Make sure the title matches exactly.");
  }

  // Check if already watched
  if (watchedMovies.some(m => m.title.toLowerCase() === movieTitle.toLowerCase())) {
    return customAlert("This movie is already marked as watched!");
  }

  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.remove("hidden");

  try {
    const payload = {
      type: "markWatched",
      title: movie.title,
      markedBy: userName
    };

    // Only include watchedDate if user provided one
    if (watchedDate) {
      payload.watchedDate = watchedDate;
    }

    console.log("Marking as watched:", payload);
    const response = await fetch(API, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    console.log("Mark watched response status:", response.status);
    const responseData = await response.text();
    console.log("Mark watched response data:", responseData);

    loadingIndicator.classList.add("hidden");
    input.value = "";
    dateInput.value = "";
    triggerHaptic('success');
    customAlert("Movie marked as watched!");

    // Refresh the movie list
    await fetchMovies();
  } catch (error) {
    console.error("Mark watched error:", error);
    loadingIndicator.classList.add("hidden");
    customAlert("Failed to mark movie as watched. Please try again.");
  }
}

async function removeWatchedMovie(title) {
  const loadingIndicator = document.getElementById("loading-indicator");
  loadingIndicator.classList.remove("hidden");

  try {
    console.log("Unmarking as watched:", { type: "unmarkWatched", title });
    const response = await fetch(API, {
      method: "POST",
      body: JSON.stringify({
        type: "unmarkWatched",
        title: title
      })
    });

    console.log("Unmark watched response status:", response.status);
    const responseData = await response.text();
    console.log("Unmark watched response data:", responseData);

    loadingIndicator.classList.add("hidden");
    triggerHaptic('medium');

    // Refresh the movie list
    await fetchMovies();
  } catch (error) {
    console.error("Unmark watched error:", error);
    loadingIndicator.classList.add("hidden");
    customAlert("Failed to unmark movie. Please try again.");
  }
}

document.getElementById("submit-watched").onclick = markAsWatched;

// Handle Enter key in mark-watched input
document.getElementById("mark-watched").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    markAsWatched();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Don't call updateNameUI here - it's already handled by inline script
  fetchMovies();
});
