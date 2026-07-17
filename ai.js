const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.6";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const DEFAULT_STATIONS = [
  "Tandoor",
  "Grill",
  "Pastry",
  "Bakery",
  "Banquet",
  "Biryani",
  "Curry",
  "Garde Manger",
  "Butchery",
  "Private Dining",
  "Breakfast",
  "Hot Section",
  "Cold Section",
  "Dessert",
  "Operations",
  "Training",
  "Bulk Production",
  "Menu Development"
];

const DEFAULT_AVAILABILITY_TYPES = [
  "Immediate",
  "This Week",
  "Weekend",
  "Seasonal",
  "Part-time",
  "Full-time",
  "Night Shift",
  "Interviewing",
  "Next Week",
  "Next Month"
];

function getAiProvider() {
  if (OPENAI_API_KEY) {
    return "openai";
  }

  if (ANTHROPIC_API_KEY) {
    return "anthropic";
  }

  return "none";
}

function getAiConfig() {
  const provider = getAiProvider();

  return {
    provider,
    embeddingProvider: OPENAI_API_KEY ? "openai" : "heuristic",
    configured: provider !== "none",
    mode: provider === "none" ? "heuristic-fallback" : "llm-enabled",
    envVars: {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY"
    }
  };
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeList(values) {
  return [...new Set((values || []).map((value) => String(value).trim()).filter(Boolean))];
}

function sentenceCase(value) {
  if (!value) {
    return "";
  }

  return value
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function parseYears(text) {
  const match = String(text || "").match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
  return match ? Number(match[1]) : null;
}

function detectAvailabilityHints(text) {
  const source = String(text || "").toLowerCase();
  const hints = [];

  if (/\bimmediate\b|\bimmediately\b|\basap\b|48 hours|right away/.test(source)) {
    hints.push("Immediate");
  }
  if (/weekend|saturday|sunday/.test(source)) {
    hints.push("Weekend");
  }
  if (/part[-\s]?time/.test(source)) {
    hints.push("Part-time");
  }
  if (/full[-\s]?time/.test(source)) {
    hints.push("Full-time");
  }
  if (/night shift|overnight|late shift/.test(source)) {
    hints.push("Night Shift");
  }
  if (/next week/.test(source)) {
    hints.push("Next Week");
  }
  if (/next month|august|september|october|november|december|january/.test(source)) {
    hints.push("Next Month");
  }
  if (/this week/.test(source)) {
    hints.push("This Week");
  }
  if (/seasonal|festival|wedding season|temporary/.test(source)) {
    hints.push("Seasonal");
  }

  return normalizeList(hints);
}

function findMatchesFromVocabulary(text, values) {
  const source = String(text || "").toLowerCase();
  return values.filter((value) => source.includes(String(value).toLowerCase()));
}

function deriveVocabulary(chefs) {
  const cities = normalizeList(chefs.map((chef) => chef.city).concat(chefs.flatMap((chef) => chef.citiesWorked || [])));
  const cuisines = normalizeList(chefs.flatMap((chef) => chef.cuisines || []));
  const serviceTypes = normalizeList(chefs.flatMap((chef) => chef.serviceTypes || []));
  const stations = normalizeList(DEFAULT_STATIONS.concat(chefs.flatMap((chef) => chef.stations || [])));

  return {
    cities,
    cuisines,
    serviceTypes,
    stations,
    availabilityTypes: DEFAULT_AVAILABILITY_TYPES
  };
}

function heuristicExtractSearchCriteria(query, chefs) {
  const vocabulary = deriveVocabulary(chefs);

  return {
    query: String(query || "").trim(),
    cities: findMatchesFromVocabulary(query, vocabulary.cities),
    cuisines: findMatchesFromVocabulary(query, vocabulary.cuisines),
    stations: findMatchesFromVocabulary(query, vocabulary.stations),
    serviceTypes: findMatchesFromVocabulary(query, vocabulary.serviceTypes),
    availabilityTypes: detectAvailabilityHints(query),
    mustHave: [],
    notes: String(query || "").trim()
  };
}

function buildChefSearchDocument(chef) {
  return [
    chef.name,
    chef.title,
    chef.city,
    ...(chef.citiesWorked || []),
    ...(chef.cuisines || []),
    ...(chef.serviceTypes || []),
    ...(chef.stations || []),
    chef.availability,
    chef.availabilityType,
    chef.summary,
    chef.profileNarrative
  ]
    .filter(Boolean)
    .join(" | ");
}

function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magA += a[index] * a[index];
    magB += b[index] * b[index];
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function createOpenAiEmbedding(input) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`OpenAI embedding request failed${details ? `: ${details}` : ""}`);
  }

  const payload = await response.json();
  return payload.data?.[0]?.embedding || [];
}

async function callOpenAiJson(system, prompt, schemaDescription) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: system
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${prompt}\n\nReturn strict JSON with this shape: ${schemaDescription}`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`OpenAI text request failed${details ? `: ${details}` : ""}`);
  }

  const payload = await response.json();
  return extractJsonFromText(payload.output_text || "");
}

async function callAnthropicJson(system, prompt, schemaDescription) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nReturn strict JSON with this shape: ${schemaDescription}`
        }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Anthropic text request failed${details ? `: ${details}` : ""}`);
  }

  const payload = await response.json();
  const text = (payload.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
  return extractJsonFromText(text);
}

function extractJsonFromText(text) {
  const source = String(text || "").trim();

  try {
    return JSON.parse(source);
  } catch {
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model did not return JSON");
    }

    return JSON.parse(match[0]);
  }
}

async function extractSearchCriteria(query, chefs) {
  const fallback = heuristicExtractSearchCriteria(query, chefs);
  const provider = getAiProvider();

  if (!String(query || "").trim()) {
    return {
      ...fallback,
      source: "empty-query"
    };
  }

  const schema = "{\"query\":\"string\",\"cities\":[\"string\"],\"cuisines\":[\"string\"],\"stations\":[\"string\"],\"serviceTypes\":[\"string\"],\"availabilityTypes\":[\"string\"],\"mustHave\":[\"string\"],\"notes\":\"string\"}";
  const system = "You extract structured hiring criteria for Indian hospitality staffing search. Use concise values only. Never invent unavailable cities or cuisines.";
  const prompt = `User kitchen brief: ${query}\nKnown cities: ${deriveVocabulary(chefs).cities.join(", ")}\nKnown cuisines: ${deriveVocabulary(chefs).cuisines.join(", ")}\nKnown stations: ${deriveVocabulary(chefs).stations.join(", ")}\nKnown service types: ${deriveVocabulary(chefs).serviceTypes.join(", ")}\nKnown availability buckets: ${deriveVocabulary(chefs).availabilityTypes.join(", ")}`;

  try {
    if (provider === "openai") {
      const extracted = await callOpenAiJson(system, prompt, schema);
      return {
        ...fallback,
        ...extracted,
        cities: normalizeList(extracted.cities || fallback.cities),
        cuisines: normalizeList(extracted.cuisines || fallback.cuisines),
        stations: normalizeList(extracted.stations || fallback.stations),
        serviceTypes: normalizeList(extracted.serviceTypes || fallback.serviceTypes),
        availabilityTypes: normalizeList(extracted.availabilityTypes || fallback.availabilityTypes),
        mustHave: normalizeList(extracted.mustHave || []),
        source: "openai-criteria"
      };
    }

    if (provider === "anthropic") {
      const extracted = await callAnthropicJson(system, prompt, schema);
      return {
        ...fallback,
        ...extracted,
        cities: normalizeList(extracted.cities || fallback.cities),
        cuisines: normalizeList(extracted.cuisines || fallback.cuisines),
        stations: normalizeList(extracted.stations || fallback.stations),
        serviceTypes: normalizeList(extracted.serviceTypes || fallback.serviceTypes),
        availabilityTypes: normalizeList(extracted.availabilityTypes || fallback.availabilityTypes),
        mustHave: normalizeList(extracted.mustHave || []),
        source: "anthropic-criteria"
      };
    }
  } catch {
    return {
      ...fallback,
      source: "heuristic-criteria"
    };
  }

  return {
    ...fallback,
    source: "heuristic-criteria"
  };
}

function buildScoreBreakdown(chef, query, criteria, filters, embeddingSimilarity) {
  let total = 10;
  const reasons = [];

  if (embeddingSimilarity > 0) {
    const embeddingScore = Math.round(Math.max(0, embeddingSimilarity) * 35);
    total += embeddingScore;
    reasons.push(`${embeddingScore} semantic similarity`);
  }

  const queryTokens = new Set(tokenize(query));
  const chefTokens = new Set(tokenize(buildChefSearchDocument(chef)));
  const overlappingTokens = [...queryTokens].filter((token) => chefTokens.has(token));
  const overlapScore = Math.min(15, overlappingTokens.length * 3);

  if (overlapScore) {
    total += overlapScore;
    reasons.push(`${overlapScore} keyword overlap`);
  }

  if (criteria.cities?.some((city) => city.toLowerCase() === chef.city.toLowerCase())) {
    total += 15;
    reasons.push("15 city fit");
  }

  const cuisineHits = (criteria.cuisines || []).filter((cuisine) =>
    (chef.cuisines || []).some((item) => item.toLowerCase() === cuisine.toLowerCase())
  );
  if (cuisineHits.length) {
    const cuisineScore = Math.min(15, cuisineHits.length * 7);
    total += cuisineScore;
    reasons.push(`${cuisineScore} cuisine fit`);
  }

  const stationHits = (criteria.stations || []).filter((station) =>
    (chef.stations || []).some((item) => item.toLowerCase() === station.toLowerCase())
  );
  if (stationHits.length) {
    const stationScore = Math.min(15, stationHits.length * 7);
    total += stationScore;
    reasons.push(`${stationScore} station fit`);
  }

  const serviceHits = (criteria.serviceTypes || []).filter((serviceType) =>
    (chef.serviceTypes || []).some((item) => item.toLowerCase() === serviceType.toLowerCase())
  );
  if (serviceHits.length) {
    const serviceScore = Math.min(10, serviceHits.length * 5);
    total += serviceScore;
    reasons.push(`${serviceScore} service type fit`);
  }

  if ((criteria.availabilityTypes || []).length) {
    const availabilityText = `${chef.availability} ${chef.availabilityType || ""}`.toLowerCase();
    const availabilityHits = criteria.availabilityTypes.filter((item) => availabilityText.includes(item.toLowerCase()));
    if (availabilityHits.length) {
      total += 10;
      reasons.push("10 availability fit");
    }
  }

  if (filters.city && chef.city.toLowerCase() === filters.city.toLowerCase()) {
    total += 8;
  }
  if (filters.cuisine && (chef.cuisines || []).some((item) => item.toLowerCase() === filters.cuisine.toLowerCase())) {
    total += 8;
  }
  if (filters.serviceType && (chef.serviceTypes || []).some((item) => item.toLowerCase() === filters.serviceType.toLowerCase())) {
    total += 8;
  }
  if (filters.availability && chef.availability.toLowerCase().includes(filters.availability.toLowerCase())) {
    total += 6;
  }

  total += Math.min(8, Math.round(Number(chef.rating || 0)));
  total += Math.min(8, Math.floor(Number(chef.experienceYears || 0) / 2));

  return {
    score: Math.max(0, Math.min(100, total)),
    reasons,
    cuisineHits,
    stationHits,
    serviceHits,
    overlappingTokens
  };
}

function applyStructuredFilters(chefs, filters) {
  return chefs.filter((chef) => {
    const matchesCity = !filters.city || chef.city.toLowerCase() === filters.city.toLowerCase();
    const matchesCuisine = !filters.cuisine || (chef.cuisines || []).some((item) => item.toLowerCase() === filters.cuisine.toLowerCase());
    const matchesServiceType = !filters.serviceType || (chef.serviceTypes || []).some((item) => item.toLowerCase() === filters.serviceType.toLowerCase());
    const matchesAvailability = !filters.availability || chef.availability.toLowerCase().includes(filters.availability.toLowerCase());
    return matchesCity && matchesCuisine && matchesServiceType && matchesAvailability;
  });
}

function heuristicExplainMatch(query, chef, scoreBreakdown) {
  const highlights = [];

  if (scoreBreakdown.stationHits.length) {
    highlights.push(`${chef.name} has direct ${scoreBreakdown.stationHits.join(" and ")} station experience`);
  }
  if (scoreBreakdown.cuisineHits.length) {
    highlights.push(`their ${scoreBreakdown.cuisineHits.join(" and ")} background overlaps with this brief`);
  }
  if (scoreBreakdown.serviceHits.length) {
    highlights.push(`they are already set up for ${scoreBreakdown.serviceHits.join(" and ")} work`);
  }
  if (!highlights.length) {
    highlights.push(`${chef.name}'s profile language, city, and service history align with the kitchen brief`);
  }

  const availabilityLine = chef.availabilityType
    ? `Availability is marked as ${chef.availabilityType.toLowerCase()}, which supports the stated timing.`
    : `${chef.availability} keeps them viable for the requested timing.`;

  return `${highlights[0]}. ${availabilityLine}`;
}

async function generateExplanation(query, chef, scoreBreakdown) {
  const provider = getAiProvider();
  const fallback = heuristicExplainMatch(query, chef, scoreBreakdown);

  if (provider === "none") {
    return {
      explanation: fallback,
      source: "heuristic-explanation"
    };
  }

  const schema = "{\"explanation\":\"string\"}";
  const system = "You explain why a chef matches a hiring brief. Be specific, grounded in the provided profile data, and keep it to two sentences maximum.";
  const prompt = `Kitchen brief: ${query}\nChef profile: ${JSON.stringify({
    name: chef.name,
    city: chef.city,
    cuisines: chef.cuisines,
    stations: chef.stations,
    serviceTypes: chef.serviceTypes,
    availability: chef.availability,
    availabilityType: chef.availabilityType,
    summary: chef.summary
  })}\nScore signals: ${JSON.stringify(scoreBreakdown)}`;

  try {
    const result = provider === "openai"
      ? await callOpenAiJson(system, prompt, schema)
      : await callAnthropicJson(system, prompt, schema);
    return {
      explanation: String(result.explanation || fallback).trim(),
      source: `${provider}-explanation`
    };
  } catch {
    return {
      explanation: fallback,
      source: "heuristic-explanation"
    };
  }
}

async function rankChefs({ query, filters, chefs }) {
  const normalizedFilters = {
    city: String(filters?.city || "").trim(),
    cuisine: String(filters?.cuisine || "").trim(),
    serviceType: String(filters?.serviceType || "").trim(),
    availability: String(filters?.availability || "").trim()
  };

  const filteredChefs = applyStructuredFilters(chefs, normalizedFilters);
  const criteria = await extractSearchCriteria(query, filteredChefs.length ? filteredChefs : chefs);

  let queryEmbedding = [];
  if (OPENAI_API_KEY && String(query || "").trim()) {
    try {
      queryEmbedding = await createOpenAiEmbedding(String(query).trim());
    } catch {
      queryEmbedding = [];
    }
  }

  const scored = [];
  for (const chef of filteredChefs) {
    let embeddingSimilarity = 0;

    if (queryEmbedding.length) {
      try {
        const chefEmbedding = await createOpenAiEmbedding(buildChefSearchDocument(chef));
        embeddingSimilarity = cosineSimilarity(queryEmbedding, chefEmbedding);
      } catch {
        embeddingSimilarity = 0;
      }
    }

    const breakdown = buildScoreBreakdown(chef, query, criteria, normalizedFilters, embeddingSimilarity);
    const explanation = await generateExplanation(query, chef, breakdown);

    scored.push({
      ...chef,
      fitScore: breakdown.score,
      fitReasons: breakdown.reasons,
      matchCriteria: criteria,
      matchExplanation: explanation.explanation,
      matchExplanationSource: explanation.source
    });
  }

  scored.sort((left, right) => {
    if (right.fitScore !== left.fitScore) {
      return right.fitScore - left.fitScore;
    }

    if (right.rating !== left.rating) {
      return right.rating - left.rating;
    }

    return right.verifiedBookings - left.verifiedBookings;
  });

  return {
    total: scored.length,
    chefs: scored,
    criteria,
    mode: getAiConfig().mode,
    provider: getAiProvider()
  };
}

function heuristicExtractProfileDraft(freeText, chefs) {
  const vocabulary = deriveVocabulary(chefs);
  const stations = findMatchesFromVocabulary(freeText, vocabulary.stations);
  const cuisines = findMatchesFromVocabulary(freeText, vocabulary.cuisines);
  const citiesWorked = findMatchesFromVocabulary(freeText, vocabulary.cities);
  const serviceTypes = findMatchesFromVocabulary(freeText, vocabulary.serviceTypes);
  const availabilityTypes = detectAvailabilityHints(freeText);
  const years = parseYears(freeText);

  return {
    cuisines,
    stations,
    yearsOfExperience: years || 0,
    citiesWorked,
    serviceTypes,
    availabilityType: availabilityTypes[0] || "",
    summary: String(freeText || "").trim().slice(0, 220),
    confidence: getAiProvider() === "none" ? "medium" : "high"
  };
}

async function extractProfileDraft(freeText, chefs) {
  const fallback = heuristicExtractProfileDraft(freeText, chefs);
  const provider = getAiProvider();

  if (!String(freeText || "").trim() || provider === "none") {
    return {
      ...fallback,
      source: "heuristic-profile-draft"
    };
  }

  const schema = "{\"cuisines\":[\"string\"],\"stations\":[\"string\"],\"yearsOfExperience\":0,\"citiesWorked\":[\"string\"],\"serviceTypes\":[\"string\"],\"availabilityType\":\"string\",\"summary\":\"string\",\"confidence\":\"high|medium|low\"}";
  const system = "You convert an informal chef self-description into structured profile fields for an Indian culinary hiring marketplace. Only return fields supported by the input.";
  const prompt = `Chef free-text profile: ${freeText}\nKnown cities: ${deriveVocabulary(chefs).cities.join(", ")}\nKnown cuisines: ${deriveVocabulary(chefs).cuisines.join(", ")}\nKnown stations: ${deriveVocabulary(chefs).stations.join(", ")}\nKnown service types: ${deriveVocabulary(chefs).serviceTypes.join(", ")}`;

  try {
    const result = provider === "openai"
      ? await callOpenAiJson(system, prompt, schema)
      : await callAnthropicJson(system, prompt, schema);
    return {
      ...fallback,
      ...result,
      cuisines: normalizeList(result.cuisines || fallback.cuisines),
      stations: normalizeList(result.stations || fallback.stations),
      citiesWorked: normalizeList(result.citiesWorked || fallback.citiesWorked),
      serviceTypes: normalizeList(result.serviceTypes || fallback.serviceTypes),
      availabilityType: String(result.availabilityType || fallback.availabilityType || "").trim(),
      yearsOfExperience: Number(result.yearsOfExperience || fallback.yearsOfExperience || 0),
      summary: String(result.summary || fallback.summary || "").trim(),
      confidence: String(result.confidence || fallback.confidence || "medium").trim(),
      source: `${provider}-profile-draft`
    };
  } catch {
    return {
      ...fallback,
      source: "heuristic-profile-draft"
    };
  }
}

function heuristicReadiness(profile) {
  let score = 38;
  const suggestions = [];

  if ((profile.cuisines || []).length) {
    score += 14;
  } else {
    suggestions.push("Add the cuisines you have actually worked in so kitchens can match you beyond job titles.");
  }

  if ((profile.stations || []).length) {
    score += 14;
  } else {
    suggestions.push("List the stations you can run independently, such as tandoor, pastry, grill, or banquet.");
  }

  if (Number(profile.yearsOfExperience || 0) > 0) {
    score += 12;
  } else {
    suggestions.push("Add your years of experience to help employers judge seniority quickly.");
  }

  if ((profile.citiesWorked || []).length) {
    score += 10;
  } else {
    suggestions.push("Mention the cities or properties where you have worked so employers can trust your operating context.");
  }

  if (profile.availabilityType) {
    score += 8;
  } else {
    suggestions.push("Choose an availability type so kitchens know whether they can hire you immediately or for planned openings.");
  }

  if ((profile.serviceTypes || []).length) {
    score += 8;
  } else {
    suggestions.push("Clarify whether you want full-time, consulting, events, or part-time work.");
  }

  if (String(profile.freeText || "").trim().length >= 80) {
    score += 10;
  } else {
    suggestions.push("Expand your kitchen story with real service volume, menu ownership, or team responsibilities.");
  }

  const readinessLabel = score >= 80 ? "Ready to shortlist" : score >= 60 ? "Promising with a few gaps" : "Needs more detail";

  return {
    readinessScore: Math.max(0, Math.min(100, score)),
    readinessLabel,
    suggestions: suggestions.slice(0, 3)
  };
}

async function evaluateReadiness(profile) {
  const fallback = heuristicReadiness(profile);
  const provider = getAiProvider();

  if (provider === "none") {
    return {
      ...fallback,
      source: "heuristic-readiness"
    };
  }

  const schema = "{\"readinessScore\":0,\"readinessLabel\":\"string\",\"suggestions\":[\"string\"]}";
  const system = "You coach informal culinary workers on how to improve hireability. Give a readiness score from 0-100 and 1-3 specific suggestions grounded in the actual profile.";
  const prompt = `Chef profile: ${JSON.stringify(profile)}`;

  try {
    const result = provider === "openai"
      ? await callOpenAiJson(system, prompt, schema)
      : await callAnthropicJson(system, prompt, schema);
    return {
      readinessScore: Math.max(0, Math.min(100, Number(result.readinessScore || fallback.readinessScore))),
      readinessLabel: String(result.readinessLabel || fallback.readinessLabel).trim(),
      suggestions: normalizeList(result.suggestions || fallback.suggestions).slice(0, 3),
      source: `${provider}-readiness`
    };
  } catch {
    return {
      ...fallback,
      source: "heuristic-readiness"
    };
  }
}

module.exports = {
  buildChefSearchDocument,
  evaluateReadiness,
  extractProfileDraft,
  extractSearchCriteria,
  getAiConfig,
  getAiProvider,
  heuristicExtractProfileDraft,
  heuristicReadiness,
  rankChefs
};
