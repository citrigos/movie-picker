const API = "https://script.google.com/macros/s/AKfycbylstYgHvvqMNfLfkKtHPAbazfFMpce5_-_QCuQ6BjZqaeusBx1ONIppOYD9-1TR2Zk/exec";

let movies = [];
let picks = {}; // changed to object to track vote counts per movie
let userName = localStorage.getItem('userName') || '';

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
  movies = await res.json();
  drawMovies();
  updateLeaderboard();
}

function drawMovies() {
  const list = document.getElementById("movie-list");
  list.innerHTML = "";

  // Sort movies alphabetically
  const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

  sortedMovies.forEach(m => {
    const card = document.createElement("div");
    card.className = "movie-card";
    const voteCount = picks[m.title] || 0;
    if (voteCount > 0) {
      card.classList.add("selected");
    }
    card.innerHTML = `
      <div class="movie-title">${toTitleCase(m.title)}</div>
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
    chip.innerHTML = `${toTitleCase(m.title)}<strong>${m.votes}</strong>`;
    topMovies.append(chip);
  });

  // Full leaderboard - movies with votes
  withVotes.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${toTitleCase(m.title)}: ${m.votes}`;
    lb.append(li);
  });

  // No votes section
  if (withoutVotes.length > 0) {
    const noVotesLi = document.createElement("li");
    noVotesLi.className = "no-votes";
    const movieTitles = withoutVotes.map(m => toTitleCase(m.title)).join(', ');
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

document.addEventListener("DOMContentLoaded", () => {
  // Don't call updateNameUI here - it's already handled by inline script
  fetchMovies();
});
