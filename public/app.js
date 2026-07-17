const sessionState = {
  ai: null,
  lastMatchPayload: null,
  readinessSnapshot: null,
  structuredProfile: null
};

const MATCH_CACHE_PREFIX = "whitehat-match:";

async function fetchJson(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

function populateSelect(select, values) {
  const fragment = document.createDocumentFragment();

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    fragment.appendChild(option);
  });

  select.appendChild(fragment);
}

function toCsv(values) {
  return (values || []).join(", ");
}

function fromCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSearchElements() {
  return {
    searchStatus: document.getElementById("searchStatus"),
    resultsMeta: document.getElementById("resultsMeta"),
    chefGrid: document.getElementById("chefGrid")
  };
}

function renderSearchStatus(payload) {
  const { searchStatus } = getSearchElements();

  if (!searchStatus) {
    return;
  }

  const provider = payload.provider && payload.provider !== "none" ? payload.provider : "heuristic fallback";
  const criteriaLine = payload.criteria?.query
    ? `Interpreted brief with ${provider}.`
    : "No free-text brief yet. Showing the current talent roster with AI-ready scoring.";

  searchStatus.textContent = `${criteriaLine} ${payload.mode === "heuristic-fallback" ? "Add OPENAI_API_KEY or ANTHROPIC_API_KEY in Vercel for full model-backed extraction and coaching." : "Live model calls are enabled on the server."}`;
}

function renderOverview(data, chefs) {
  document.getElementById("heroEyebrow").textContent = data.hero.eyebrow;
  document.getElementById("heroHeadline").textContent = data.hero.headline;
  document.getElementById("heroSubheadline").textContent = data.hero.subheadline;

  const highlightList = document.getElementById("highlightList");
  highlightList.innerHTML = "";
  data.highlights.forEach((item) => {
    const entry = document.createElement("li");
    entry.textContent = item;
    highlightList.appendChild(entry);
  });

  const heroStats = document.getElementById("heroStats");
  heroStats.innerHTML = data.stats.map((stat) => `
    <div>
      <strong>${stat.value}</strong>
      ${stat.label}
    </div>
  `).join("");

  const signalGrid = document.getElementById("businessSignals");
  signalGrid.innerHTML = data.businessSignals.map((signal) => `
    <div class="row">
      <span>${signal.title}</span>
      <strong>${signal.body}</strong>
    </div>
  `).join("");

  const passTrack = document.getElementById("passTrack");
  const passTickets = [...chefs, ...chefs].map((chef) => `
    <div class="ticket">
      <div class="ticket-top">
        <span>Ticket</span>
        <span class="verified">Verified</span>
      </div>
      <h4>${chef.name}</h4>
      <small>${chef.title} • ${chef.city}</small>
    </div>
  `).join("");
  passTrack.innerHTML = passTickets;

  const gaugeTrack = document.getElementById("gaugeTrack");
  gaugeTrack.innerHTML = [...data.stats, ...data.stats].map((stat) => `
    <div class="gauge-item">
      <strong>${stat.value}</strong>
      <span>${stat.label}</span>
    </div>
  `).join("");

  populateSelect(document.getElementById("cityFilter"), data.filterOptions.cities);
  populateSelect(document.getElementById("cuisineFilter"), data.filterOptions.cuisines);
  populateSelect(document.getElementById("serviceTypeFilter"), data.filterOptions.serviceTypes);

  sessionState.ai = data.ai || null;
}

function renderChefs(payload) {
  const { chefGrid, resultsMeta } = getSearchElements();
  resultsMeta.textContent = `${payload.total} chef${payload.total === 1 ? "" : "s"} ranked by station fit`;

  if (!payload.chefs.length) {
    chefGrid.innerHTML = '<div class="results-empty">No chefs matched this brief yet. Try widening the city, cuisine, service type, or timing constraints.</div>';
    return;
  }

  chefGrid.innerHTML = payload.chefs.map((chef, index) => `
    <article class="docket chef-card reveal is-visible">
      <span class="docket-no">No. ${String(index + 1).padStart(4, "0")}</span>
      <div class="match-topline">
        <span class="role">Verified • ${chef.serviceTypes[0]}</span>
        <span class="fit-score">${chef.fitScore}% fit</span>
      </div>
      <h3>${chef.name}</h3>
      <p>${chef.summary}</p>
      <p class="match-explanation">${chef.matchExplanation}</p>
      <div class="tags">
        ${chef.cuisines.map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="tags tags-subtle">
        ${(chef.stations || []).map((item) => `<span>${item}</span>`).join("")}
      </div>
      <div class="chef-stats">
        <div><strong>${chef.experienceYears} yrs</strong>Experience</div>
        <div><strong>${chef.rating.toFixed(1)}</strong>Rating</div>
        <div><strong>${chef.verifiedBookings}</strong>Bookings</div>
        <div><strong>${chef.city}</strong>City</div>
      </div>
      <div class="chef-stats">
        <div><strong>${chef.priceLabel}</strong>Pricing</div>
        <div><strong>${chef.availability}</strong>Availability</div>
      </div>
    </article>
  `).join("");
}

function renderCourses(payload) {
  const courseGrid = document.getElementById("courseGrid");
  courseGrid.innerHTML = payload.masterclasses.map((item, index) => `
    <article class="docket learn-card reveal is-visible">
      <span class="docket-no">No. M-${String(index + 1).padStart(2, "0")}</span>
      <div class="meta">
        <span>${item.format}</span>
        <span>${item.duration}</span>
      </div>
      <h4>${item.title}</h4>
      <p>${item.summary}</p>
      <div class="fact-grid">
        <div><span>Instructor</span><strong>${item.instructor}</strong></div>
        <div><span>Level</span><strong>${item.level}</strong></div>
        <div><span>Enrolled</span><strong>${item.enrolled.toLocaleString()}</strong></div>
        <div><span>Format</span><strong>${item.format}</strong></div>
      </div>
    </article>
  `).join("");
}

function renderTestimonials(payload) {
  const testimonialGrid = document.getElementById("testimonialGrid");
  testimonialGrid.innerHTML = payload.testimonials.map((item, index) => `
    <article class="docket quote-card reveal is-visible">
      <span class="docket-no">No. T-${String(index + 1).padStart(2, "0")}</span>
      <h3>${item.name}</h3>
      <p>"${item.quote}"</p>
      <p>${item.role}</p>
    </article>
  `).join("");
}

function createMatchCacheKey({ query, filters }) {
  return `${MATCH_CACHE_PREFIX}${JSON.stringify({
    query: String(query || "").trim(),
    filters: filters || {}
  })}`;
}

function readMatchCache(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMatchCache(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function getFiltersFromForm(form) {
  return {
    city: form.city.value,
    cuisine: form.cuisine.value,
    serviceType: form.serviceType.value,
    availability: form.availability.value
  };
}

async function loadChefMatches(form) {
  const query = form.query.value;
  const filters = getFiltersFromForm(form);
  const cacheKey = createMatchCacheKey({ query, filters });
  const cached = readMatchCache(cacheKey);

  if (cached) {
    sessionState.lastMatchPayload = cached;
    renderSearchStatus(cached);
    renderChefs(cached);
    return;
  }

  const payload = await fetchJson("/api/chef-match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      filters
    })
  });

  sessionState.lastMatchPayload = payload;
  writeMatchCache(cacheKey, payload);
  renderSearchStatus(payload);
  renderChefs(payload);
}

function collectProfileReview() {
  return {
    freeText: document.getElementById("chefStory").value.trim(),
    cuisines: fromCsv(document.getElementById("profileCuisines").value),
    stations: fromCsv(document.getElementById("profileStations").value),
    yearsOfExperience: Number(document.getElementById("profileExperienceYears").value || 0),
    citiesWorked: fromCsv(document.getElementById("profileCitiesWorked").value),
    serviceTypes: fromCsv(document.getElementById("profileServiceTypes").value),
    availabilityType: document.getElementById("profileAvailabilityType").value.trim(),
    summary: document.getElementById("profileSummary").value.trim()
  };
}

function renderReadiness(readinessSnapshot) {
  sessionState.readinessSnapshot = readinessSnapshot;

  document.getElementById("readinessScore").textContent = readinessSnapshot.readinessScore;
  document.getElementById("readinessLabel").textContent = readinessSnapshot.readinessLabel;

  const suggestions = document.getElementById("readinessSuggestions");
  suggestions.innerHTML = readinessSnapshot.suggestions.map((item) => `<li>${item}</li>`).join("");
}

function populateProfileReview(structuredProfile, readinessSnapshot) {
  sessionState.structuredProfile = structuredProfile;

  document.getElementById("profileReview").classList.remove("is-hidden");
  document.getElementById("profileCuisines").value = toCsv(structuredProfile.cuisines);
  document.getElementById("profileStations").value = toCsv(structuredProfile.stations);
  document.getElementById("profileExperienceYears").value = structuredProfile.yearsOfExperience || "";
  document.getElementById("profileCitiesWorked").value = toCsv(structuredProfile.citiesWorked);
  document.getElementById("profileServiceTypes").value = toCsv(structuredProfile.serviceTypes);
  document.getElementById("profileAvailabilityType").value = structuredProfile.availabilityType || "";
  document.getElementById("profileSummary").value = structuredProfile.summary || "";
  document.getElementById("profileDraftStatus").textContent = `Draft built with ${structuredProfile.source || "AI support"} and ready for review. Edit anything before saving.`;

  renderReadiness(readinessSnapshot);
}

async function buildProfileDraft() {
  const profileDraftStatus = document.getElementById("profileDraftStatus");
  const freeText = document.getElementById("chefStory").value.trim();

  if (!freeText) {
    profileDraftStatus.textContent = "Add your kitchen story first so the AI can build a structured draft.";
    document.getElementById("profileReview").classList.remove("is-hidden");
    return;
  }

  profileDraftStatus.textContent = "Building chef profile draft...";

  const payload = await fetchJson("/api/profile-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ freeText })
  });

  sessionState.ai = payload.ai || sessionState.ai;
  populateProfileReview(payload.structuredProfile, payload.readinessSnapshot);
}

async function refreshReadiness() {
  const profileDraftStatus = document.getElementById("profileDraftStatus");
  profileDraftStatus.textContent = "Refreshing readiness score...";

  const payload = await fetchJson("/api/profile-readiness", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(collectProfileReview())
  });

  renderReadiness(payload.readinessSnapshot);
  profileDraftStatus.textContent = "Readiness score updated from your latest edits.";
}

async function handleLeadSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.getElementById("formStatus");

  status.textContent = "Submitting...";

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const reviewedProfile = document.getElementById("profileReview").classList.contains("is-hidden")
      ? null
      : collectProfileReview();

    await fetchJson("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        chefStory: payload.chefStory || "",
        structuredProfile: reviewedProfile ? {
          ...reviewedProfile,
          source: sessionState.structuredProfile?.source || "reviewed-profile"
        } : null,
        readinessSnapshot: sessionState.readinessSnapshot
      })
    });

    form.reset();
    document.getElementById("profileReview").classList.add("is-hidden");
    document.getElementById("readinessSuggestions").innerHTML = "";
    document.getElementById("readinessScore").textContent = "--";
    document.getElementById("readinessLabel").textContent = "Complete the fields above to see coach-style feedback for chefs.";
    sessionState.structuredProfile = null;
    sessionState.readinessSnapshot = null;
    status.textContent = "Interest captured successfully. Chef-side AI notes were stored with the submission when provided.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function initializeInteractions() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealEls = document.querySelectorAll(".reveal");

  if (!reduceMotion) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });

    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".menu-toggle");

  if (nav && toggle) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    document.querySelectorAll(".nav-links a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("mobile-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

async function initializeApp() {
  const [overview, courses, testimonials] = await Promise.all([
    fetchJson("/api/overview"),
    fetchJson("/api/masterclasses"),
    fetchJson("/api/testimonials")
  ]);

  const initialMatchPayload = await fetchJson("/api/chef-match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "",
      filters: {}
    })
  });

  renderOverview(overview, initialMatchPayload.chefs);
  renderSearchStatus(initialMatchPayload);
  renderChefs(initialMatchPayload);
  renderCourses(courses);
  renderTestimonials(testimonials);
  initializeInteractions();

  const filterForm = document.getElementById("filterForm");
  filterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadChefMatches(filterForm);
  });

  document.getElementById("resetFilters").addEventListener("click", async () => {
    filterForm.reset();
    await loadChefMatches(filterForm);
  });

  document.getElementById("buildProfileDraft").addEventListener("click", async () => {
    try {
      await buildProfileDraft();
    } catch (error) {
      document.getElementById("profileReview").classList.remove("is-hidden");
      document.getElementById("profileDraftStatus").textContent = error.message;
    }
  });

  document.getElementById("refreshReadiness").addEventListener("click", async () => {
    try {
      await refreshReadiness();
    } catch (error) {
      document.getElementById("profileReview").classList.remove("is-hidden");
      document.getElementById("profileDraftStatus").textContent = error.message;
    }
  });

  document.getElementById("leadForm").addEventListener("submit", handleLeadSubmit);
}

initializeApp().catch((error) => {
  const { resultsMeta, chefGrid } = getSearchElements();

  if (resultsMeta) {
    resultsMeta.textContent = error.message;
  }

  if (chefGrid) {
    chefGrid.innerHTML = '<div class="results-empty">The prototype could not load data right now. Check that the server or deployment is available.</div>';
  }
});
