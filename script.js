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
let activeLang = "all";
let activeType = "all";
let SERVERS = [];

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

function computeCompliance(features) {
    const total = features.complete.length + features.inDev.length + features.incomplete.length;
    if (total === 0) return null;

    const points = features.complete.length + features.inDev.length * 0.5;
    const score = (points / total) * 100;

    return { score, compliance: scoreToTier(score) };
}

async function loadServerCompliance(server) {
    server.compliance = server.type === "fork" ? "forked" : "experimental";
    server.complianceScore = 0;

    if (server.type === "fork") return;

    try {
        const res = await fetch(`servers/${server.id}.yaml`);
        if (!res.ok) return;

        const result = computeCompliance(parseFeaturesYAML(await res.text()));
        if (!result) return;

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
        `;

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
        const show = langMatch && typeMatch;
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

fetch("servers.json")
    .then(r => r.json())
    .then(async data => {
        SERVERS = data.servers;
        await Promise.all(SERVERS.map(loadServerCompliance));
        buildCards();
        updateVerdict();
    });


