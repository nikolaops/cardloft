const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../web/app.js"), "utf8");

function project(name, id, ticketTitle) {
  return {
    id,
    name,
    nextTicketNumber: 2,
    columns: [{ id: `${id}-column`, name: "To Do", color: "#64748b" }],
    labels: [],
    notes: [],
    sprints: [],
    tickets: ticketTitle ? [{
      id: `${id}-ticket`, number: 1, title: ticketTitle, description: "", notes: "",
      columnId: `${id}-column`, sprintId: null, labelIds: [], priority: "medium",
      comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }] : []
  };
}

function runApp({ saved, injected }) {
  const values = new Map();
  if (saved) values.set("cardloft-workspace", JSON.stringify(saved));
  const nodes = {
    "#app": { innerHTML: "" },
    "#modal-root": { innerHTML: "" },
    "#toast": { textContent: "", classList: { add() {}, remove() {} } }
  };
  const document = {
    querySelector(selector) { return nodes[selector] || null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };
  const context = {
    window: { __CARDLOFT_DATA__: injected },
    document,
    localStorage,
    crypto,
    Intl,
    Date,
    console,
    setTimeout,
    clearTimeout,
    confirm: () => true
  };
  vm.runInNewContext(source, context);
  return {
    data: JSON.parse(values.get("cardloft-workspace")),
    html: nodes["#app"].innerHTML
  };
}

{
  const latest = project("Latest after reload", "latest", "Keep this ticket");
  const stale = project("Stale startup snapshot", "stale", "Old ticket");
  latest.updatedAt = "2026-08-17T12:05:00.000Z";
  stale.updatedAt = "2026-08-17T12:00:00.000Z";
  const result = runApp({ saved: latest, injected: stale });

  assert.equal(result.data.version, 2, "legacy state should migrate to portfolio v2");
  assert.equal(result.data.projects.length, 1);
  assert.equal(result.data.projects[0].name, "Latest after reload", "reload must prefer current local state");
  assert.equal(result.data.projects[0].tickets[0].title, "Keep this ticket");
}

{
  const first = project("Alpha", "alpha");
  const second = project("Beta", "beta");
  first.notes.push({ id: "alpha-note", title: "Alpha only", body: "Private Alpha notebook", color: "#fff3a3", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  second.notes.push({ id: "beta-note", title: "Beta only", body: "Private Beta notebook", color: "#cde8ff", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  second.emoji = "🚀";
  second.color = "#ec4899";
  const portfolio = { version: 2, activeProjectId: "beta", projects: [first, second] };
  const result = runApp({ saved: portfolio, injected: null });

  assert.equal(result.data.projects.length, 2);
  assert.equal(result.data.activeProjectId, "beta");
  assert.equal(result.data.projects[0].notes[0].title, "Alpha only");
  assert.equal(result.data.projects[1].notes[0].title, "Beta only");
  assert.match(result.html, /Alpha/);
  assert.match(result.html, /Beta/);
  assert.match(result.html, /🚀 Beta/, "project title should be emoji, one space, then project name");
  assert.match(result.html, /#ec4899/);
  assert.match(result.html, /project-list/);
  assert.match(result.html, /board-switcher/);
  assert.match(result.html, /data-screen="backlog"/);
  assert.match(result.html, /data-action="settings-labels"/);
}

assert.match(source, /class="button danger" data-action="delete-ticket"/, "ticket editor should expose a visible delete action");
assert.match(source, /class="emoji-picker-popover"/, "project editor should expose an emoji picker");
assert.doesNotMatch(source, /placeholder="🚀" maxlength="8"/, "manual emoji text input should not return");
assert.match(source, /boardNavButton\("notes", "Notes"/, "Notes should be available as a global app view");
assert.match(source, /state\.notes\.push/, "new notes should be stored inside the active project");
assert.match(source, /document\.elementFromPoint/, "ticket movement should use the reliable pointer drop target");
assert.doesNotMatch(source, /draggable="true"/, "ticket movement should not depend on WebKit HTML5 drag");

console.log("State persistence and multi-project migration tests passed.");
