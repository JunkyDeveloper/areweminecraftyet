const LANG_LABELS = { java: "Java", rust: "Rust", go: "Go", cpp: "C++", csharp: "C#" };
const STATUS_LABELS = { active: "Active", wip: "WIP", inactive: "Inactive" };
const TYPE_LABELS = { reimplementation: "Reimplementation", fork: "Fork" };
const COMPLIANCE_LABELS = {
    full: "Full",
    mostly: "Mostly",
    partial: "Partial",
    experimental: "Experimental",
    forked: "Forked",
};
const CATEGORY_LABELS = {
    server: "Server",
    networking: "Networking",
    world: "World",
    player: "Player",
    combat: "Combat",
    entities: "Entities & AI",
};
const CATEGORY_ORDER = ["networking", "world", "player", "combat", "entities", "server"];
const FEATURE_BUCKET_LABELS = { complete: "Complete", inDev: "In Development", incomplete: "Missing" };
let activeLang = "all";
let activeType = "all";
let activeStatus = "all";
let activeCompliance = "all";
let activeVersion = "all";
let SERVERS = [];
let FEATURES_BY_ID = {};

function parseFeaturesYAML(text) {
    const features = { complete: [], inDev: [], incomplete: [] };
    let currentKey = null;

    text.split("\n").forEach(line => {
        if (!line.trim()) return;

        const keyMatch = line.match(/^- (\w+):\s*$/);
        if (keyMatch) {
            currentKey = keyMatch[1];
            return;
        }

        const itemMatch = line.match(/^\s+- (\S+)\s*$/);
        if (itemMatch && currentKey && features[currentKey]) {
            features[currentKey].push(itemMatch[1]);
        }
    });

    return features;
}

function scoreToTier(score) {
    if (score >= 100) return "full";
    if (score >= 90) return "mostly";
    if (score > 25) return "partial";
    return "experimental";
}

function featureWeight(id) {
    return FEATURES_BY_ID[id]?.weight ?? 1;
}

function sumWeights(ids) {
    return ids.reduce((sum, id) => sum + featureWeight(id), 0);
}

function computeCompliance(features) {
    const total = sumWeights(features.complete) + sumWeights(features.inDev) + sumWeights(features.incomplete);
    if (total === 0) return null;

    const points = sumWeights(features.complete) + sumWeights(features.inDev) * 0.5;
    const score = (points / total) * 100;

    return { score, compliance: scoreToTier(score) };
}

async function loadServerCompliance(server) {
    server.compliance = server.type === "fork" ? "forked" : "experimental";
    server.complianceScore = 0;
    server.features = null;

    if (server.type === "fork") return;

    try {
        const res = await fetch(`servers/${server.id}.yaml`);
        if (!res.ok) return;

        const features = parseFeaturesYAML(await res.text());
        const result = computeCompliance(features);
        if (!result) return;

        server.features = features;
        server.complianceScore = result.score;
        server.compliance = result.compliance;
    } catch (err) {
        console.error(`Failed to load features for ${server.id}:`, err);
    }
}

function buildCards() {
    const grid = document.getElementById("servers-grid");
    const empty = document.getElementById("empty-state");
    grid.querySelectorAll(".card").forEach(c => c.remove());

    SERVERS.forEach(s => {
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.lang = s.language;
        card.dataset.type = s.type;
        card.dataset.status = s.status;
        card.dataset.compliance = s.compliance;
        card.dataset.version = s.mcVersion;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `View compliance details for ${s.name}`);

        const forkNoteHTML = s.forkNote
            ? `<div class="card-fork-note">&#9888; This is a fork of vanilla Minecraft. Forks are listed for completeness but are unlikely candidates for full compliance.</div>`
            : "";
        const complianceLabel = COMPLIANCE_LABELS[s.compliance] ?? "Unknown";
        const complianceScore = s.complianceScore;
        const complianceDisplay = complianceScore.toFixed(1).replace(/\.0$/, "");

        card.innerHTML = `
            <div class="card-top ${s.compliance === "full" ? "compliant" : ""}"></div>
            <div class="card-body">
                <div class="card-name">${s.name}</div>
                <div class="card-meta">
                    <span class="badge badge-lang-${s.language}">${LANG_LABELS[s.language] ?? s.language}</span>
                    <span class="badge badge-type-${s.type === "reimplementation" ? "reimpl" : "fork"}">${TYPE_LABELS[s.type]}</span>
                    <span class="badge badge-version">MC ${s.mcVersion}</span>
                    <span class="badge badge-status-${s.status}">${STATUS_LABELS[s.status]}</span>
                    <span class="badge badge-compliance badge-compliance-${s.compliance}">Compliance: ${complianceLabel}</span>
                </div>
                <p class="card-desc">${s.description}</p>
                <div class="compliance-meter-row">
                    <div class="compliance-meter" aria-hidden="true">
                        <span class="compliance-fill compliance-${s.compliance}" style="width: ${complianceScore}%;"></span>
                    </div>
                    <span class="compliance-percent">${complianceDisplay}%</span>
                </div>
                ${forkNoteHTML}
            </div>
            <div class="card-footer">
                <span class="card-compliant ${s.compliance === "full" ? "yes" : "no"}">${s.compliance === "full" ? "Compliant" : "Not Compliant"}</span>
                <a class="card-source" href="${s.url}" target="_blank" rel="noopener">${s.sourceLabel} &rarr;</a>
            </div>
            <div class="card-details-hint">View details &rarr;</div>
        `;

        card.querySelector(".card-source").addEventListener("click", e => e.stopPropagation());
        card.addEventListener("click", () => openServerModal(s));
        card.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openServerModal(s);
            }
        });

        grid.insertBefore(card, empty);
    });

    applyFilters();
}

function applyFilters() {
    const cards = document.querySelectorAll(".card");
    let visible = 0;

    cards.forEach(card => {
        const langMatch = activeLang === "all" || card.dataset.lang === activeLang;
        const typeMatch = activeType === "all" || card.dataset.type === activeType;
        const statusMatch = activeStatus === "all" || card.dataset.status === activeStatus;
        const complianceMatch = activeCompliance === "all" || card.dataset.compliance === activeCompliance;
        const versionMatch = activeVersion === "all" || card.dataset.version === activeVersion;
        const show = langMatch && typeMatch && statusMatch && complianceMatch && versionMatch;
        card.classList.toggle("hidden", !show);
        if (show) visible++;
    });

    document.getElementById("empty-state").style.display = visible === 0 ? "block" : "none";
}

function updateVerdict() {
    const total = SERVERS.length;
    const yes = SERVERS.filter(s => s.compliance === "full").length;
    document.getElementById("count-yes").textContent = yes;
    document.getElementById("count-total").textContent = total;

    if (yes >= 1) {
        document.getElementById("verdict-text").textContent = "YES!";
        document.getElementById("verdict-text").classList.add("yes");
    }
}

document.querySelectorAll("[data-filter-lang]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-lang]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeLang = btn.dataset.filterLang;
        applyFilters();
    });
});

document.querySelectorAll("[data-filter-type]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-type]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeType = btn.dataset.filterType;
        applyFilters();
    });
});

document.querySelectorAll("[data-filter-status]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-status]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeStatus = btn.dataset.filterStatus;
        applyFilters();
    });
});

document.querySelectorAll("[data-filter-compliance]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-compliance]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeCompliance = btn.dataset.filterCompliance;
        applyFilters();
    });
});

document.querySelectorAll("[data-filter-version]").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("[data-filter-version]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeVersion = btn.dataset.filterVersion;
        applyFilters();
    });
});

function hashHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

function buildVersionFilters() {
    const row = document.getElementById("version-filter-row");
    const versions = [...new Set(SERVERS.map(s => s.mcVersion))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    versions.forEach(version => {
        const hue = hashHue(version);
        const btn = document.createElement("button");
        btn.className = "filter-btn version-dynamic";
        btn.dataset.filterVersion = version;
        btn.textContent = version;
        btn.style.setProperty("--btn-color", `hsl(${hue}, 45%, 28%)`);
        btn.style.setProperty("--btn-color-dark", `hsl(${hue}, 45%, 12%)`);
        btn.addEventListener("click", () => {
            document.querySelectorAll("[data-filter-version]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeVersion = version;
            applyFilters();
        });
        row.appendChild(btn);
    });
}

function groupFeaturesByCategory(ids) {
    const groups = {};

    ids.forEach(id => {
        const feature = FEATURES_BY_ID[id];
        if (!feature) return;
        (groups[feature.category] ??= []).push(feature);
    });

    Object.values(groups).forEach(list =>
        list.sort((a, b) => a.subCategory.localeCompare(b.subCategory) || a.name.localeCompare(b.name))
    );

    return CATEGORY_ORDER
        .filter(cat => groups[cat]?.length)
        .map(cat => ({ category: cat, features: groups[cat] }));
}

function renderFeatureBucket(bucketKey, ids, defaultOpen) {
    if (!ids.length) return "";

    const groups = groupFeaturesByCategory(ids);
    const categoriesHTML = groups.map(({ category, features }) => `
        <div class="modal-category">
            <div class="modal-category-title">${CATEGORY_LABELS[category] ?? category}</div>
            <ul class="modal-feature-list">
                ${features.map(f => `
                    <li class="modal-feature modal-feature-${bucketKey}">
                        <span class="modal-feature-name">${f.name}</span>
                        <span class="modal-feature-desc">${f.description}</span>
                    </li>
                `).join("")}
            </ul>
        </div>
    `).join("");

    return `
        <details class="modal-bucket modal-bucket-${bucketKey}" ${defaultOpen ? "open" : ""}>
            <summary>${FEATURE_BUCKET_LABELS[bucketKey]} <span class="modal-bucket-count">${ids.length}</span></summary>
            ${categoriesHTML}
        </details>
    `;
}

function renderModalBody(server) {
    const complianceLabel = COMPLIANCE_LABELS[server.compliance] ?? "Unknown";
    const complianceDisplay = server.complianceScore.toFixed(1).replace(/\.0$/, "");

    const header = `
        <div class="modal-header">
            <div class="modal-title" id="modal-title">${server.name}</div>
            <div class="card-meta">
                <span class="badge badge-lang-${server.language}">${LANG_LABELS[server.language] ?? server.language}</span>
                <span class="badge badge-type-${server.type === "reimplementation" ? "reimpl" : "fork"}">${TYPE_LABELS[server.type]}</span>
                <span class="badge badge-version">MC ${server.mcVersion}</span>
                <span class="badge badge-status-${server.status}">${STATUS_LABELS[server.status]}</span>
                <span class="badge badge-compliance badge-compliance-${server.compliance}">Compliance: ${complianceLabel}</span>
            </div>
            <p class="card-desc">${server.description}</p>
            <a class="card-source" href="${server.url}" target="_blank" rel="noopener">${server.sourceLabel} &rarr;</a>
        </div>
    `;

    if (!server.features) {
        const message = server.type === "fork"
            ? "Forks intentionally diverge from vanilla behavior, so feature-by-feature compliance isn't tracked for this entry."
            : "No feature data is available for this server yet.";
        return `${header}<p class="modal-empty">${message}</p>`;
    }

    const { complete, inDev, incomplete } = server.features;

    return `
        ${header}
        <div class="modal-summary">
            <div class="compliance-meter-row">
                <div class="compliance-meter" aria-hidden="true">
                    <span class="compliance-fill compliance-${server.compliance}" style="width: ${server.complianceScore}%;"></span>
                </div>
                <span class="compliance-percent">${complianceDisplay}%</span>
            </div>
        </div>
        ${renderFeatureBucket("incomplete", incomplete, true)}
        ${renderFeatureBucket("inDev", inDev, true)}
        ${renderFeatureBucket("complete", complete, false)}
    `;
}

function openServerModal(server) {
    const overlay = document.getElementById("modal-overlay");
    const body = document.getElementById("modal-body");
    body.innerHTML = renderModalBody(server);
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    document.getElementById("modal-close").focus();
}

function closeServerModal() {
    const overlay = document.getElementById("modal-overlay");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
}

document.getElementById("modal-close").addEventListener("click", closeServerModal);
document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target.id === "modal-overlay") closeServerModal();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeServerModal();
});

Promise.all([
    fetch("servers.json").then(r => r.json()),
    fetch("features.json").then(r => r.json()),
]).then(async ([serverData, featureData]) => {
    SERVERS = serverData.servers;
    featureData.forEach(f => { FEATURES_BY_ID[f.id] = f; });

    await Promise.all(SERVERS.map(loadServerCompliance));
    buildVersionFilters();
    buildCards();
    updateVerdict();
});


