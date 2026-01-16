// app.js

const API = "https://script.google.com/macros/s/ABC123/exec";

async function fetchMovies() {
  const res = await fetch(`${API}?action=movies`);
  return res.json();
}

async function updateLeaderboard() {
  let movies = await fetchMovies();
  movies.sort((a,b) => b.votes - a.votes);
  const ul = document.getElementById("leaderboard");
  ul.innerHTML = "";
  movies.forEach(m => {
    ul.innerHTML += `<li>${m.title}: ${m.votes} votes</li>`;
  });
}

function populateSelects(movies) {
  ["pick1","pick2","pick3"].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">Select</option>`;
    movies.forEach(m => {
      sel.innerHTML += `<option value="${m.title}">${m.title}</option>`;
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const movies = await fetchMovies();
  populateSelects(movies);
  updateLeaderboard();
});

document.getElementById("vote-form").onsubmit = async (e) => {
  e.preventDefault();
  const payload = {
    type: "vote",
    name: document.getElementById("name").value,
    pick1: document.getElementById("pick1").value,
    pick2: document.getElementById("pick2").value,
    pick3: document.getElementById("pick3").value,
  };
  await fetch(API, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  alert("Vote recorded!");
  updateLeaderboard();
};

document.getElementById("suggest-form").onsubmit = async (e) => {
  e.preventDefault();
  const payload = {
    type: "suggestion",
    name: document.getElementById("sug-name").value,
    suggestion: document.getElementById("suggestion").value,
  };
  await fetch(API, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  alert("Suggestion recorded!");
};
