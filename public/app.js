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
}

function renderChefs(payload) {
  const chefGrid = document.getElementById("chefGrid");
  const resultsMeta = document.getElementById("resultsMeta");
  resultsMeta.textContent = `${payload.total} chef${payload.total === 1 ? "" : "s"} matched`;

  if (!payload.chefs.length) {
    chefGrid.innerHTML = '<div class="results-empty">No chefs matched this filter set yet. Try widening the city, cuisine, or availability search.</div>';
    return;
  }

  chefGrid.innerHTML = payload.chefs.map((chef, index) => `
    <article class="docket chef-card reveal is-visible">
      <span class="docket-no">No. ${String(index + 1).padStart(4, "0")}</span>
      <span class="role">Verified • ${chef.serviceTypes[0]}</span>
      <h3>${chef.name}</h3>
      <p>${chef.summary}</p>
      <div class="tags">
        ${chef.cuisines.map((item) => `<span>${item}</span>`).join("")}
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

async function loadChefsFromForm(form) {
  const params = new URLSearchParams(new FormData(form));
  const payload = await fetchJson(`/api/chefs?${params.toString()}`);
  renderChefs(payload);
}

async function handleLeadSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const status = document.getElementById("formStatus");
  const formData = Object.fromEntries(new FormData(form).entries());

  status.textContent = "Submitting...";

  try {
    await fetchJson("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formData)
    });

    form.reset();
    status.textContent = "Interest captured successfully. This prototype wrote the lead to the backend data store.";
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
  const [overview, chefPayload, courses, testimonials] = await Promise.all([
    fetchJson("/api/overview"),
    fetchJson("/api/chefs"),
    fetchJson("/api/masterclasses"),
    fetchJson("/api/testimonials")
  ]);

  renderOverview(overview, chefPayload.chefs);
  renderChefs(chefPayload);
  renderCourses(courses);
  renderTestimonials(testimonials);
  initializeInteractions();

  const filterForm = document.getElementById("filterForm");
  filterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await loadChefsFromForm(filterForm);
  });

  document.getElementById("resetFilters").addEventListener("click", async () => {
    filterForm.reset();
    await loadChefsFromForm(filterForm);
  });

  document.getElementById("leadForm").addEventListener("submit", handleLeadSubmit);
}

initializeApp().catch((error) => {
  const resultsMeta = document.getElementById("resultsMeta");
  const chefGrid = document.getElementById("chefGrid");

  if (resultsMeta) {
    resultsMeta.textContent = error.message;
  }

  if (chefGrid) {
    chefGrid.innerHTML = '<div class="results-empty">The prototype could not load data right now. Check that the local server is running.</div>';
  }
});
