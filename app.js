const API = "https://script.google.com/macros/s/AKfycbwstea0jH5mMB0bjhxWW-cuoRZQYTTY9mmQPOPp66HpcbUUYCJknZQ3ycRTYfyR1Ty6/exec";

let movies = [];
let picks = [];

async function fetchMovies() {
  const res = await fetch(`${API}?action=movies`);
  movies = await res.json();
  drawMovies();
  updateLeaderboard();
}

function drawMovies() {
  const list = document.getElementById("movie-list");
  list.innerHTML = "";
  movies.forEach(m => {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.textContent = m.title;
    card.onclick = () => togglePick(m.title, card);
    list.append(card);
  });
}

function togglePick(title, card) {
  if (picks.includes(title)) {
    picks = picks.filter(x => x !== title);
    card.classList.remove("selected");
  } else if (picks.length < 3) {
    picks.push(title);
    card.classList.add("selected");
  }
  document.getElementById("selected-count").textContent = picks.length;
}

async function submitVote() {
  const name = document.getElementById("name").value.trim();
  if (!name) return alert("Enter your name!");
  if (picks.length !== 3) return alert("Pick exactly 3 movies!");

  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      type: "vote",
      name,
      picks
    })
  });

  alert("Vote submitted!");
  picks = [];
  fetchMovies(); // refresh leaderboard + reset
}

async function submitSuggestion() {
  const name = document.getElementById("sug-name").value.trim();
  const suggestion = document.getElementById("suggestion").value.trim();
  if (!name || !suggestion) return alert("Enter name & suggestion!");

  await fetch(API, {
    method: "POST",
    body: JSON.stringify({
      type: "suggestion",
      name,
      suggestion
    })
  });

  alert(`Thanks for suggesting "${suggestion}"!`);
  fetchMovies(); // refresh list instantly
}

async function updateLeaderboard() {
  const lb = document.getElementById("leaderboard");
  lb.innerHTML = "";
  const sorted = [...movies].sort((a,b) => b.votes - a.votes);
  sorted.forEach(m => {
    const li = document.createElement("li");
    li.textContent = `${m.title}: ${m.votes}`;
    lb.append(li);
  });
}

document.getElementById("submit-vote").onclick = submitVote;
document.getElementById("submit-suggest").onclick = submitSuggestion;

document.addEventListener("DOMContentLoaded", fetchMovies);
