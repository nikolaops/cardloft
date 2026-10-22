(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const projectEmojis = [
    "📌", "🚀", "💻", "🛠️", "🎯", "📋", "✅", "🐛", "✨", "🔥",
    "⚡️", "🌱", "📦", "🧪", "🎨", "📱", "🌐", "🔒", "💡", "📊",
    "🏗️", "🧭", "🏠", "💼", "🤖", "📝", "🔧", "📣", "🛒", "❤️"
  ];
  const noteColors = [
    { name: "Yellow", value: "#fff3a3" },
    { name: "Blue", value: "#cde8ff" },
    { name: "Green", value: "#d8f3dc" },
    { name: "Pink", value: "#ffd6e7" },
    { name: "Purple", value: "#e8d8ff" },
    { name: "Gray", value: "#e7e9ed" }
  ];

  function createProject(name = "My Project", includeExamples = false, emoji = "", color = "#3b82f6") {
    const columns = [
      { id: uid(), name: "To Do", color: "#64748b" },
      { id: uid(), name: "In Progress", color: "#3b82f6" },
      { id: uid(), name: "Review", color: "#8b5cf6" },
      { id: uid(), name: "Blocked", color: "#ef4444" },
      { id: uid(), name: "Done", color: "#22c55e" }
    ];
    const labels = [
      { id: uid(), name: "Feature", color: "#2563eb" },
      { id: uid(), name: "Bug", color: "#dc2626" },
      { id: uid(), name: "Improvement", color: "#7c3aed" }
    ];
    const sprint = {
      id: uid(), name: "Sprint 1", goal: "Ship the first useful version",
      startDate: dateInput(new Date()), endDate: dateInput(new Date(Date.now() + 14 * 86400000)), active: true
    };
    return {
      id: uid(),
      name,
      emoji,
      color,
      nextTicketNumber: includeExamples ? 3 : 1,
      columns,
      labels,
      notes: [],
      sprints: includeExamples ? [sprint] : [],
      tickets: includeExamples ? [
        {
          id: uid(), number: 1, title: "Welcome to Local Ticketing",
          description: "Open this ticket to add notes, comments, labels and sprint details.", notes: "",
          columnId: columns[0].id, sprintId: sprint.id, labelIds: [labels[0].id], priority: "medium",
          comments: [], createdAt: now(), updatedAt: now()
        },
        {
          id: uid(), number: 2, title: "Drag me to another column",
          description: "Cards can be moved between any of your custom workflow columns.", notes: "",
          columnId: columns[1].id, sprintId: sprint.id, labelIds: [labels[2].id], priority: "high",
          comments: [], createdAt: now(), updatedAt: now()
        }
      ] : []
    };
  }

  function starterWorkspace() {
    return createProject("My Project", true);
  }

  function normalizeProject(project) {
    project.id ||= uid();
    project.name ||= "Untitled Project";
    project.emoji ||= "";
    project.color ||= "#3b82f6";
    project.labels ||= [];
    project.notes ||= [];
    project.sprints ||= [];
    project.tickets ||= [];
    if (!Array.isArray(project.columns) || project.columns.length === 0) {
      project.columns = createProject().columns;
    }
    project.nextTicketNumber ||= Math.max(0, ...project.tickets.map(t => t.number || 0)) + 1;
    project.tickets.forEach(ticket => {
      ticket.comments ||= [];
      ticket.labelIds ||= [];
      ticket.notes ||= "";
      ticket.description ||= "";
      ticket.priority ||= "medium";
    });
    project.notes.forEach(note => {
      note.id ||= uid();
      note.title ||= "Untitled note";
      note.body ||= "";
      note.color ||= noteColors[0].value;
      note.createdAt ||= now();
      note.updatedAt ||= note.createdAt;
    });
    return project;
  }

  function normalize(candidate) {
    let portfolio;
    if (candidate && Array.isArray(candidate.projects)) {
      portfolio = candidate;
      portfolio.projects = portfolio.projects.map(normalizeProject);
    } else if (candidate && Array.isArray(candidate.columns)) {
      const migratedProject = normalizeProject(candidate);
      portfolio = { version: 2, activeProjectId: migratedProject.id, projects: [migratedProject] };
    } else {
      const initialProject = starterWorkspace();
      portfolio = { version: 2, activeProjectId: initialProject.id, projects: [initialProject] };
    }

    if (portfolio.projects.length === 0) portfolio.projects.push(createProject());
    if (!portfolio.projects.some(project => project.id === portfolio.activeProjectId)) {
      portfolio.activeProjectId = portfolio.projects[0].id;
    }
    portfolio.version = 2;
    return portfolio;
  }

  let portfolio = normalize(selectStoredCandidate(readFallback(), window.__LOCAL_TICKETING_DATA__));
  let state = portfolio.projects.find(project => project.id === portfolio.activeProjectId);
  const ui = { screen: "kanban", selectedSprintId: defaultSprintId(), settingsTab: "project" };
  let toastTimer;
  let pointerDrag = null;
  let suppressCardClickUntil = 0;

  function readFallback() {
    try { return JSON.parse(localStorage.getItem("local-ticketing-workspace")); } catch (_) { return null; }
  }

  function selectStoredCandidate(localCopy, nativeCopy) {
    if (!localCopy) return nativeCopy;
    if (!nativeCopy) return localCopy;
    const localRevision = Date.parse(localCopy.updatedAt || "");
    const nativeRevision = Date.parse(nativeCopy.updatedAt || "");
    if (Number.isFinite(localRevision) && Number.isFinite(nativeRevision)) {
      return localRevision >= nativeRevision ? localCopy : nativeCopy;
    }
    if (Number.isFinite(localRevision)) return localCopy;
    if (Number.isFinite(nativeRevision)) return nativeCopy;
    return nativeCopy;
  }

  function save(message) {
    portfolio.activeProjectId = state.id;
    portfolio.updatedAt = now();
    const json = JSON.stringify(portfolio);
    try { localStorage.setItem("local-ticketing-workspace", json); } catch (_) {}
    try {
      if (window.webkit?.messageHandlers?.storage) window.webkit.messageHandlers.storage.postMessage(json);
    } catch (_) {}
    if (message) toast(message);
  }

  function defaultSprintId() {
    return state.sprints.find(sprint => sprint.active)?.id || state.sprints[0]?.id || null;
  }

  function activateProject(projectId) {
    const project = portfolio.projects.find(item => item.id === projectId);
    if (!project) return;
    state = project;
    portfolio.activeProjectId = project.id;
    ui.selectedSprintId = defaultSprintId();
    save();
    render();
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("toast");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("toast"), 1700);
  }

  const icons = {
    kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>',
    sprint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 3 8 12h5l-2 9 6-11h-5l1-7Z"/></svg>',
    backlog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16v13H4zM7 4h10v3M8 11h8M8 15h6"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5v6.5L12.5 20 20 12.5 11.5 4H5a1 1 0 0 0-1 1Z"/><circle cx="8" cy="8" r="1.4"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h14v13l-5 5H5V3Z"/><path d="M14 21v-5h5M8 8h8M8 12h6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h9M17 7h3M4 17h3M11 17h9M13 4v6M7 14v6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 10 6 6 6-6"/></svg>'
  };

  function dateInput(date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function formatDate(value, withTime = false) {
    if (!value) return "";
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return new Intl.DateTimeFormat(undefined, withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" }).format(date);
  }

  function labelsFor(ticket) {
    return state.labels.filter(label => ticket.labelIds.includes(label.id));
  }

  function visibleTickets() {
    if (ui.screen === "backlog") return state.tickets.filter(ticket => !ticket.sprintId);
    if (ui.screen === "sprint") return state.tickets.filter(ticket => ticket.sprintId === ui.selectedSprintId);
    return state.tickets;
  }

  function render() {
    const isNotes = ui.screen === "notes";
    const tickets = isNotes ? [] : visibleTickets();
    const itemCount = isNotes ? state.notes.length : tickets.length;
    const selectedSprint = state.sprints.find(s => s.id === ui.selectedSprintId);
    const titles = {
      kanban: ["Kanban board", "All tickets across your workflow"],
      sprint: ["Sprint board", selectedSprint?.goal || "Focus on the work selected for this sprint"],
      backlog: ["Backlog", "Tickets that are not assigned to a sprint"],
      notes: ["Notes", `Private project notebook for ${projectDisplayName(state)}`]
    };
    const [title, subtitle] = titles[ui.screen];

    $("#app").innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="sidebar-brand">
            <strong>Local Ticketing</strong>
            <span>Offline workspace</span>
          </div>
          <div class="projects-heading"><span>Projects</span><button data-action="new-project" title="Create project">${icons.plus}</button></div>
          <div class="project-list">${projectListHTML()}</div>
          <div class="sidebar-footer"><button data-action="settings">${icons.settings}<span>Manage selected project</span></button></div>
        </aside>
        <main class="content">
          <header class="topbar">
            <div class="heading"><div class="heading-row"><h1>${esc(title)}</h1><span class="count">${itemCount}</span></div><p>${esc(subtitle)}</p></div>
            <nav class="board-switcher" aria-label="Board view">
              ${boardNavButton("kanban", "Kanban", icons.kanban)}
              ${boardNavButton("sprint", "Sprint", icons.sprint)}
              ${boardNavButton("backlog", "Backlog", icons.backlog)}
              ${boardNavButton("notes", "Notes", icons.note)}
              <button data-action="settings-labels">${icons.tag}<span>Labels</span></button>
            </nav>
            <div class="top-actions">
              ${ui.screen === "sprint" && state.sprints.length ? sprintPicker() : ""}
              <button class="icon-button" data-action="settings" title="Manage workspace">${icons.settings}</button>
              ${isNotes
                ? `<button class="button primary" data-action="new-note">${icons.plus}New note</button>`
                : `<button class="button primary" data-action="new-ticket" ${ui.screen === "sprint" && !ui.selectedSprintId ? "disabled" : ""}>${icons.plus}New ticket</button>`}
            </div>
          </header>
          ${isNotes ? notesView() : (ui.screen === "sprint" && !state.sprints.length ? emptySprint() : board(tickets))}
        </main>
      </div>`;
  }

  function boardNavButton(screen, label, icon) {
    return `<button class="${ui.screen === screen ? "active" : ""}" data-screen="${screen}">${icon}<span>${label}</span></button>`;
  }

  function projectListHTML() {
    return portfolio.projects.map(project => `
      <div class="project-row ${project.id === state.id ? "active" : ""}" style="--project-color:${project.color}">
        <button class="project-select" data-project-id="${project.id}">
          <span class="project-dot"></span>
          <span class="project-copy">
            <strong style="color:${project.color}">${esc(projectDisplayName(project))}</strong>
            <small>${project.tickets.length} ticket${project.tickets.length === 1 ? "" : "s"}</small>
          </span>
        </button>
        <button class="project-edit" data-action="edit-project" data-project-id="${project.id}" title="Edit ${esc(project.name)}">${icons.pencil}</button>
      </div>`).join("");
  }

  function projectDisplayName(project) {
    const emoji = (project.emoji || "").trim();
    return `${emoji ? `${emoji} ` : ""}${project.name}`;
  }

  function sprintPicker() {
    return `<select class="sprint-picker" id="sprint-picker" aria-label="Sprint">
      ${state.sprints.map(sprint => `<option value="${sprint.id}" ${sprint.id === ui.selectedSprintId ? "selected" : ""}>${esc(sprint.name)}${sprint.active ? "" : " (completed)"}</option>`).join("")}
    </select>`;
  }

  function emptySprint() {
    return `<div class="empty"><div>${icons.sprint}<h2>No sprint yet</h2><p>Create a sprint to plan a focused set of tickets.</p><button class="button" data-action="settings-sprints">Manage sprints</button></div></div>`;
  }

  function board(tickets) {
    return `<div class="board-wrap"><div class="board">
      ${state.columns.map(column => columnHTML(column, tickets.filter(ticket => ticket.columnId === column.id))).join("")}
    </div></div>`;
  }

  function notesView() {
    const notes = [...state.notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (!notes.length) {
      return `<div class="notes-empty"><div>${icons.note}<h2>No notes yet</h2><p>Create a sticky note for ideas, reminders, meeting notes or anything that does not belong in a ticket.</p><button class="button primary" data-action="new-note">${icons.plus}Create first note</button></div></div>`;
    }
    return `<div class="notes-wrap"><div class="notes-grid">${notes.map(noteCardHTML).join("")}</div></div>`;
  }

  function noteCardHTML(note) {
    return `<button class="sticky-note" data-note-id="${note.id}" style="--note-color:${note.color}">
      <span class="sticky-fold"></span>
      <strong>${esc(note.title)}</strong>
      <span class="sticky-body">${esc(note.body)}</span>
      <small>Updated ${formatDate(note.updatedAt, true)}</small>
    </button>`;
  }

  function columnHTML(column, tickets) {
    return `<section class="column" data-column-id="${column.id}">
      <header class="column-head"><span class="column-marker" style="background:${column.color}"></span><strong>${esc(column.name)}</strong><span class="column-count">${tickets.length}</span><button data-action="add-column-ticket" data-column-id="${column.id}" title="Add ticket">${icons.plus}</button></header>
      <div class="cards">
        ${tickets.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(cardHTML).join("")}
        <button class="add-card" data-action="add-column-ticket" data-column-id="${column.id}">＋ Add ticket</button>
      </div>
    </section>`;
  }

  function cardHTML(ticket) {
    const labelHTML = labelsFor(ticket).slice(0, 3).map(label =>
      `<span class="pill" style="color:${label.color};background:${label.color}1e">${esc(label.name)}</span>`).join("");
    const priority = { low: ["↓", "#64748b"], medium: ["=", "#3b82f6"], high: ["↑", "#f97316"], urgent: ["!", "#ef4444"] }[ticket.priority];
    return `<article class="card" data-ticket-id="${ticket.id}">
      <div class="card-title">${esc(ticket.title)}</div>
      ${labelHTML ? `<div class="labels">${labelHTML}</div>` : ""}
      <div class="card-meta"><span class="ticket-key">LOC-${ticket.number}</span><span class="spacer"></span>${ticket.comments.length ? `<span>◯ ${ticket.comments.length}</span>` : ""}<span class="priority" style="color:${priority[1]}" title="${ticket.priority} priority">${priority[0]}</span></div>
    </article>`;
  }

  function defaultSprintForNewTicket() {
    if (ui.screen === "sprint") return ui.selectedSprintId;
    if (ui.screen === "backlog") return null;
    return undefined;
  }

  function showNewTicket(columnId = state.columns[0]?.id, sprintId = defaultSprintForNewTicket()) {
    if (!columnId) return;
    const chosenSprint = sprintId === undefined ? "" : (sprintId || "");
    showModal(`
      <form class="modal" id="new-ticket-form">
        <div class="modal-head"><div><h2>Create ticket</h2><p>Add a task, bug or idea to your board</p></div></div>
        <div class="modal-body">
          ${field("Title", '<input id="new-title" name="title" placeholder="What needs to be done?" autofocus required>')}
          ${field("Description", '<textarea name="description" placeholder="Add useful context or acceptance criteria"></textarea>')}
          <div class="form-grid">
            ${field("Status", `<select name="columnId">${columnOptions(columnId)}</select>`)}
            ${field("Priority", prioritySelect("medium"))}
            ${field("Sprint", sprintOptions(chosenSprint))}
          </div>
          ${state.labels.length ? field("Labels", labelPicker([])) : ""}
        </div>
        <div class="modal-foot"><span class="spacer"></span><button type="button" class="button" data-close-modal>Cancel</button><button class="button primary" type="submit">Create ticket</button></div>
      </form>`);
    setTimeout(() => $("#new-title")?.focus(), 40);
  }

  function showTicket(ticketId) {
    const ticket = state.tickets.find(item => item.id === ticketId);
    if (!ticket) return;
    showModal(`
      <form class="modal wide" id="ticket-form" data-ticket-id="${ticket.id}">
        <div class="modal-head"><span class="ticket-key">LOC-${ticket.number}</span><input class="modal-title-input" name="title" value="${esc(ticket.title)}" aria-label="Title" required></div>
        <div class="modal-body">
          <div class="form-grid">
            ${field("Status", `<select name="columnId">${columnOptions(ticket.columnId)}</select>`)}
            ${field("Priority", prioritySelect(ticket.priority))}
            ${field("Sprint", sprintOptions(ticket.sprintId || ""))}
          </div>
          ${field("Description", `<textarea name="description" placeholder="Add useful context">${esc(ticket.description)}</textarea>`)}
          ${field("Private notes", `<textarea name="notes" placeholder="Personal implementation notes">${esc(ticket.notes)}</textarea>`)}
          ${state.labels.length ? field("Labels", labelPicker(ticket.labelIds)) : ""}
          <div class="divider"></div>
          <h3 class="section-title">Comments</h3>
          <div id="comment-list">${commentsHTML(ticket)}</div>
          <div class="comment-form"><textarea id="new-comment" placeholder="Add a comment…"></textarea><button type="button" class="button" data-action="add-comment">Comment</button></div>
        </div>
        <div class="modal-foot"><button type="button" class="button danger" data-action="delete-ticket">${icons.trash}Delete ticket</button><span class="created">Created ${formatDate(ticket.createdAt)}</span><span class="spacer"></span><button type="button" class="button" data-close-modal>Cancel</button><button class="button primary" type="submit">Save changes</button></div>
      </form>`);
  }

  function showNewProject() {
    showModal(`
      <form class="modal" id="new-project-form" style="width:min(480px,90vw)">
        <div class="modal-head"><div><h2>Create project</h2><p>Start a separate board with its own tickets, labels and sprints</p></div></div>
        <div class="modal-body">
          ${field("Project name", '<input id="new-project-name" name="name" placeholder="Project name" autofocus required>')}
          <div class="project-appearance-fields">
            ${field("Project emoji (optional)", emojiPicker(""))}
            ${field("Project color", '<input class="project-color-input" type="color" name="color" value="#3b82f6">')}
          </div>
          <p class="created">The project starts with default workflow columns that you can customize independently.</p>
        </div>
        <div class="modal-foot"><span class="spacer"></span><button type="button" class="button" data-close-modal>Cancel</button><button class="button primary" type="submit">Create project</button></div>
      </form>`);
    setTimeout(() => $("#new-project-name")?.focus(), 40);
  }

  function showNoteEditor(noteId = null) {
    const note = noteId ? state.notes.find(item => item.id === noteId) : null;
    const selectedColor = note?.color || noteColors[0].value;
    showModal(`
      <form class="modal note-editor" id="note-form" data-note-id="${note?.id || ""}">
        <div class="modal-head"><div><h2>${note ? "Edit note" : "New note"}</h2><p>${esc(projectDisplayName(state))} notebook</p></div></div>
        <div class="modal-body">
          ${field("Title", `<input id="note-title" name="title" value="${esc(note?.title || "")}" placeholder="Note title" autofocus required>`)}
          ${field("Note", `<textarea class="note-body-input" name="body" placeholder="Write anything you want to remember…" required>${esc(note?.body || "")}</textarea>`)}
          ${field("Sticky color", noteColorPicker(selectedColor))}
        </div>
        <div class="modal-foot">
          ${note ? `<button type="button" class="button danger" data-action="delete-note">${icons.trash}Delete note</button>` : ""}
          <span class="spacer"></span>
          <button type="button" class="button" data-close-modal>Cancel</button>
          <button class="button primary" type="submit">${note ? "Save note" : "Create note"}</button>
        </div>
      </form>`);
    setTimeout(() => $("#note-title")?.focus(), 40);
  }

  function noteColorPicker(selectedColor) {
    return `<div class="note-color-picker">
      <input type="hidden" name="color" value="${selectedColor}">
      ${noteColors.map(color => `<button type="button" class="note-color-choice ${color.value === selectedColor ? "selected" : ""}" data-note-color="${color.value}" style="--choice-color:${color.value}" title="${color.name}"></button>`).join("")}
    </div>`;
  }

  function commentsHTML(ticket) {
    if (!ticket.comments.length) return '<p class="created">No comments yet.</p>';
    return ticket.comments.map(comment => `<div class="comment"><div class="comment-head"><span>● Local user</span><span>${formatDate(comment.createdAt, true)}</span></div><p>${esc(comment.body)}</p></div>`).join("");
  }

  function field(label, control) {
    return `<div class="field"><label>${label}</label>${control}</div>`;
  }

  function emojiPicker(selectedEmoji) {
    return `<div class="emoji-picker-control">
      <input type="hidden" name="emoji" value="${esc(selectedEmoji)}">
      <button type="button" class="emoji-picker-trigger" data-action="toggle-emoji-picker">
        <span class="emoji-preview">${selectedEmoji ? esc(selectedEmoji) : "＋"}</span>
        <span class="emoji-picker-label">${selectedEmoji ? "Change emoji" : "Choose emoji"}</span>
      </button>
      <div class="emoji-picker-popover">
        <button type="button" class="emoji-option emoji-none" data-emoji-value="" title="No emoji">None</button>
        ${projectEmojis.map(emoji => `<button type="button" class="emoji-option ${emoji === selectedEmoji ? "selected" : ""}" data-emoji-value="${esc(emoji)}">${esc(emoji)}</button>`).join("")}
      </div>
    </div>`;
  }

  function columnOptions(selected) {
    return state.columns.map(column => `<option value="${column.id}" ${column.id === selected ? "selected" : ""}>${esc(column.name)}</option>`).join("");
  }

  function prioritySelect(selected) {
    const values = [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["urgent", "Urgent"]];
    return `<select name="priority">${values.map(([value,label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  }

  function sprintOptions(selected) {
    return `<select name="sprintId"><option value="" ${!selected ? "selected" : ""}>Backlog</option>${state.sprints.map(sprint => `<option value="${sprint.id}" ${sprint.id === selected ? "selected" : ""}>${esc(sprint.name)}</option>`).join("")}</select>`;
  }

  function labelPicker(selectedIds) {
    return `<div class="label-picker">${state.labels.map(label => {
      const selected = selectedIds.includes(label.id);
      return `<button type="button" class="label-choice ${selected ? "selected" : ""}" data-label-id="${label.id}" style="${selected ? `color:${label.color};border-color:${label.color}66;background:${label.color}1e` : ""}">${selected ? "✓ " : ""}${esc(label.name)}</button>`;
    }).join("")}</div>`;
  }

  function selectedLabels(form) {
    return $$(".label-choice.selected", form).map(button => button.dataset.labelId);
  }

  function showSettings(tab = ui.settingsTab) {
    ui.settingsTab = tab;
    showModal(`
      <div class="modal settings-modal">
        <div class="modal-head"><div><h2>Manage workspace</h2><p>Customize the workflow for this local project</p></div><span style="flex:1"></span><button class="button" data-close-modal>Done</button></div>
        <div class="settings-layout">
          <nav class="settings-nav">${["project","columns","labels","sprints"].map(item => `<button class="${ui.settingsTab === item ? "active" : ""}" data-settings-tab="${item}">${item[0].toUpperCase() + item.slice(1)}</button>`).join("")}</nav>
          <section class="settings-content" id="settings-content">${settingsContent()}</section>
        </div>
      </div>`);
  }

  function settingsContent() {
    if (ui.settingsTab === "project") return projectSettings();
    if (ui.settingsTab === "labels") return labelsSettings();
    if (ui.settingsTab === "sprints") return sprintsSettings();
    return columnsSettings();
  }

  function projectSettings() {
    return `<h3>Project</h3><p>Rename this project or create another independent workspace.</p>
      <form id="project-settings-form">
        ${field("Project name", `<input name="name" value="${esc(state.name)}" required>`)}
        <div class="project-appearance-fields">
          ${field("Project emoji (optional)", emojiPicker(state.emoji))}
          ${field("Project color", `<input class="project-color-input" type="color" name="color" value="${state.color}">`)}
        </div>
        <button class="button primary" type="submit">Save project</button>
      </form>
      <div class="divider"></div>
      <h3 style="margin-bottom:5px">Project management</h3>
      <p class="created" style="margin-bottom:13px">You currently have ${portfolio.projects.length} project${portfolio.projects.length === 1 ? "" : "s"}. Each project has separate tickets, columns, labels and sprints.</p>
      <div style="display:flex;gap:8px">
        <button class="button" data-action="new-project">${icons.plus}Create project</button>
        <button class="button danger" data-action="delete-project" ${portfolio.projects.length === 1 ? "disabled" : ""}>${icons.trash}Delete current project</button>
      </div>`;
  }

  function columnsSettings() {
    return `<h3>Workflow columns</h3><p>Add, rename, color and reorder the stages on every board.</p>
      <div>${state.columns.map((column,index) => `<div class="setting-row" data-column-row="${column.id}">
        <input class="color-select" type="color" value="${column.color}" aria-label="Color">
        <input class="setting-name" value="${esc(column.name)}" aria-label="Column name">
        <button class="mini-button" data-action="move-column-up" ${index === 0 ? "disabled" : ""} title="Move left">${icons.up}</button>
        <button class="mini-button" data-action="move-column-down" ${index === state.columns.length - 1 ? "disabled" : ""} title="Move right">${icons.down}</button>
        <button class="mini-button danger" data-action="delete-column" ${state.columns.length === 1 ? "disabled" : ""} title="Delete">${icons.trash}</button>
      </div>`).join("")}</div>
      <form class="new-row" id="add-column-form"><input type="color" class="color-select" name="color" value="#3b82f6"><input name="name" placeholder="New column name" required><button class="button" type="submit">Add column</button></form>`;
  }

  function labelsSettings() {
    return `<h3>Custom labels</h3><p>Create colored labels to categorize tickets at a glance.</p>
      <div>${state.labels.map(label => `<div class="setting-row" data-label-row="${label.id}"><input class="color-select" type="color" value="${label.color}"><input class="setting-name" value="${esc(label.name)}"><span class="pill" style="color:${label.color};background:${label.color}1e">${esc(label.name)}</span><button class="mini-button danger" data-action="delete-label">${icons.trash}</button></div>`).join("") || '<p class="created">No labels yet.</p>'}</div>
      <form class="new-row" id="add-label-form"><input type="color" class="color-select" name="color" value="#6366f1"><input name="name" placeholder="New label name" required><button class="button" type="submit">Add label</button></form>`;
  }

  function sprintsSettings() {
    return `<h3>Sprints</h3><p>Group tickets into time-boxed iterations while keeping an open backlog.</p>
      <div>${state.sprints.map(sprint => `<div class="setting-row sprint-row" data-sprint-row="${sprint.id}"><span class="status-dot ${sprint.active ? "" : "closed"}"></span><div class="sprint-info"><strong>${esc(sprint.name)}</strong><small>${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}${sprint.goal ? ` · ${esc(sprint.goal)}` : ""}</small></div><button class="button" data-action="toggle-sprint">${sprint.active ? "Complete" : "Reopen"}</button><button class="mini-button danger" data-action="delete-sprint">${icons.trash}</button></div>`).join("") || '<p class="created">No sprints yet.</p>'}</div>
      <form id="add-sprint-form" style="margin-top:15px;padding-top:14px;border-top:1px solid var(--border)">
        <div class="form-grid two">${field("Sprint name", '<input name="name" placeholder="Sprint 2" required>')}${field("Goal", '<input name="goal" placeholder="Optional sprint goal">')}</div>
        <div class="form-grid two">${field("Starts", `<input type="date" name="startDate" value="${dateInput(new Date())}" required>`)}${field("Ends", `<input type="date" name="endDate" value="${dateInput(new Date(Date.now() + 14*86400000))}" required>`)}</div>
        <button class="button" type="submit">Create sprint</button>
      </form>`;
  }

  function showModal(html) {
    $("#modal-root").innerHTML = `<div class="modal-backdrop">${html}</div>`;
  }

  function closeModal() { $("#modal-root").innerHTML = ""; }
  function refreshSettings() { $("#settings-content").innerHTML = settingsContent(); }

  document.addEventListener("click", event => {
    if (!event.target.closest(".emoji-picker-control")) {
      $$(".emoji-picker-control.open").forEach(control => control.classList.remove("open"));
    }

    const projectSelect = event.target.closest(".project-select");
    if (projectSelect) { activateProject(projectSelect.dataset.projectId); return; }

    const noteCard = event.target.closest(".sticky-note");
    if (noteCard) { showNoteEditor(noteCard.dataset.noteId); return; }

    const nav = event.target.closest("[data-screen]");
    if (nav) { ui.screen = nav.dataset.screen; render(); return; }

    const close = event.target.closest("[data-close-modal]");
    if (close) { closeModal(); return; }

    const emojiOption = event.target.closest("[data-emoji-value]");
    if (emojiOption) {
      const control = emojiOption.closest(".emoji-picker-control");
      const emoji = emojiOption.dataset.emojiValue;
      $("input[name='emoji']", control).value = emoji;
      $(".emoji-preview", control).textContent = emoji || "＋";
      $(".emoji-picker-label", control).textContent = emoji ? "Change emoji" : "Choose emoji";
      $$(".emoji-option", control).forEach(option => option.classList.toggle("selected", option.dataset.emojiValue === emoji));
      control.classList.remove("open");
      return;
    }

    const noteColorChoice = event.target.closest("[data-note-color]");
    if (noteColorChoice) {
      const picker = noteColorChoice.closest(".note-color-picker");
      $("input[name='color']", picker).value = noteColorChoice.dataset.noteColor;
      $$(".note-color-choice", picker).forEach(choice => choice.classList.toggle("selected", choice === noteColorChoice));
      return;
    }

    const labelChoice = event.target.closest(".label-choice");
    if (labelChoice) {
      labelChoice.classList.toggle("selected");
      const label = state.labels.find(item => item.id === labelChoice.dataset.labelId);
      const selected = labelChoice.classList.contains("selected");
      labelChoice.textContent = `${selected ? "✓ " : ""}${label.name}`;
      labelChoice.style.cssText = selected ? `color:${label.color};border-color:${label.color}66;background:${label.color}1e` : "";
      return;
    }

    const settingsTab = event.target.closest("[data-settings-tab]");
    if (settingsTab) { showSettings(settingsTab.dataset.settingsTab); return; }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) {
      const card = event.target.closest(".card");
      if (card && Date.now() >= suppressCardClickUntil) showTicket(card.dataset.ticketId);
      return;
    }

    const action = actionElement.dataset.action;
    if (action === "toggle-emoji-picker") {
      const control = actionElement.closest(".emoji-picker-control");
      const shouldOpen = !control.classList.contains("open");
      $$(".emoji-picker-control.open").forEach(item => item.classList.remove("open"));
      if (shouldOpen) control.classList.add("open");
      return;
    }
    if (action === "settings") showSettings();
    if (action === "settings-sprints") showSettings("sprints");
    if (action === "settings-labels") showSettings("labels");
    if (action === "new-project") showNewProject();
    if (action === "delete-project") deleteProject();
    if (action === "edit-project") editProject(actionElement.dataset.projectId);
    if (action === "new-ticket") showNewTicket();
    if (action === "new-note") showNoteEditor();
    if (action === "add-column-ticket") showNewTicket(actionElement.dataset.columnId);
    if (action === "add-comment") addComment();
    if (action === "delete-ticket") deleteTicket(actionElement.closest("form").dataset.ticketId);
    if (action === "delete-note") deleteNote(actionElement.closest("form").dataset.noteId);
    if (action.startsWith("move-column")) moveColumn(actionElement.closest("[data-column-row]").dataset.columnRow, action.endsWith("up") ? -1 : 1);
    if (action === "delete-column") deleteColumn(actionElement.closest("[data-column-row]").dataset.columnRow);
    if (action === "delete-label") deleteLabel(actionElement.closest("[data-label-row]").dataset.labelRow);
    if (action === "toggle-sprint") toggleSprint(actionElement.closest("[data-sprint-row]").dataset.sprintRow);
    if (action === "delete-sprint") deleteSprint(actionElement.closest("[data-sprint-row]").dataset.sprintRow);
  });

  document.addEventListener("change", event => {
    if (event.target.id === "sprint-picker") { ui.selectedSprintId = event.target.value; render(); return; }
    const columnRow = event.target.closest("[data-column-row]");
    if (columnRow && (event.target.matches(".setting-name") || event.target.matches(".color-select"))) {
      const column = state.columns.find(item => item.id === columnRow.dataset.columnRow);
      column.name = $(".setting-name", columnRow).value.trim() || column.name;
      column.color = $(".color-select", columnRow).value;
      save("Column updated");
      return;
    }
    const labelRow = event.target.closest("[data-label-row]");
    if (labelRow && (event.target.matches(".setting-name") || event.target.matches(".color-select"))) {
      const label = state.labels.find(item => item.id === labelRow.dataset.labelRow);
      label.name = $(".setting-name", labelRow).value.trim() || label.name;
      label.color = $(".color-select", labelRow).value;
      save("Label updated");
      refreshSettings();
    }
  });

  document.addEventListener("submit", event => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);

    if (form.id === "note-form") {
      const existingNote = state.notes.find(note => note.id === form.dataset.noteId);
      if (existingNote) {
        existingNote.title = data.get("title").trim();
        existingNote.body = data.get("body").trim();
        existingNote.color = data.get("color");
        existingNote.updatedAt = now();
        save("Note saved");
      } else {
        const timestamp = now();
        state.notes.push({
          id: uid(), title: data.get("title").trim(), body: data.get("body").trim(),
          color: data.get("color"), createdAt: timestamp, updatedAt: timestamp
        });
        save("Note created");
      }
      closeModal(); render();
      return;
    }

    if (form.id === "new-project-form") {
      const project = createProject(
        data.get("name").trim(),
        false,
        data.get("emoji").trim(),
        data.get("color")
      );
      portfolio.projects.push(project);
      state = project;
      portfolio.activeProjectId = project.id;
      ui.selectedSprintId = defaultSprintId();
      ui.screen = "kanban";
      save("Project created"); closeModal(); render();
      return;
    }

    if (form.id === "project-settings-form") {
      state.name = data.get("name").trim();
      state.emoji = data.get("emoji").trim();
      state.color = data.get("color");
      save("Project renamed");
      showSettings("project");
      render();
      return;
    }

    if (form.id === "new-ticket-form") {
      state.tickets.push({
        id: uid(), number: state.nextTicketNumber++, title: data.get("title").trim(),
        description: data.get("description").trim(), notes: "", columnId: data.get("columnId"),
        sprintId: data.get("sprintId") || null, labelIds: selectedLabels(form), priority: data.get("priority"),
        comments: [], createdAt: now(), updatedAt: now()
      });
      save("Ticket created"); closeModal(); render();
    }

    if (form.id === "ticket-form") {
      const ticket = state.tickets.find(item => item.id === form.dataset.ticketId);
      ticket.title = data.get("title").trim();
      ticket.description = data.get("description").trim();
      ticket.notes = data.get("notes").trim();
      ticket.columnId = data.get("columnId");
      ticket.sprintId = data.get("sprintId") || null;
      ticket.priority = data.get("priority");
      ticket.labelIds = selectedLabels(form);
      ticket.updatedAt = now();
      save("Ticket saved"); closeModal(); render();
    }

    if (form.id === "add-column-form") {
      state.columns.push({ id: uid(), name: data.get("name").trim(), color: data.get("color") });
      save("Column added"); refreshSettings();
    }
    if (form.id === "add-label-form") {
      state.labels.push({ id: uid(), name: data.get("name").trim(), color: data.get("color") });
      save("Label added"); refreshSettings();
    }
    if (form.id === "add-sprint-form") {
      const sprint = { id: uid(), name: data.get("name").trim(), goal: data.get("goal").trim(), startDate: data.get("startDate"), endDate: data.get("endDate"), active: true };
      state.sprints.push(sprint);
      ui.selectedSprintId ||= sprint.id;
      save("Sprint created"); refreshSettings();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $(".modal-backdrop")) closeModal();
  });

  document.addEventListener("mousedown", event => {
    const card = event.target.closest(".card");
    if (!card || event.button !== 0) return;
    pointerDrag = {
      ticketId: card.dataset.ticketId,
      card,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  });

  document.addEventListener("mousemove", event => {
    if (!pointerDrag) return;
    const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
    if (!pointerDrag.moved && distance < 6) return;
    pointerDrag.moved = true;
    event.preventDefault();
    pointerDrag.card.classList.add("dragging");
    document.body.classList.add("dragging-ticket");
    const targetColumn = document.elementFromPoint(event.clientX, event.clientY)?.closest(".column");
    $$(".column.drag-over").forEach(column => column.classList.toggle("drag-over", column === targetColumn));
  });

  document.addEventListener("mouseup", event => {
    if (!pointerDrag) return;
    const drag = pointerDrag;
    pointerDrag = null;
    drag.card.classList.remove("dragging");
    document.body.classList.remove("dragging-ticket");
    $$(".column.drag-over").forEach(column => column.classList.remove("drag-over"));
    if (!drag.moved) return;

    suppressCardClickUntil = Date.now() + 250;
    const targetColumn = document.elementFromPoint(event.clientX, event.clientY)?.closest(".column");
    const ticket = state.tickets.find(item => item.id === drag.ticketId);
    if (ticket && targetColumn && ticket.columnId !== targetColumn.dataset.columnId) {
      ticket.columnId = targetColumn.dataset.columnId;
      ticket.updatedAt = now();
      save("Ticket moved");
      render();
    }
  });

  function addComment() {
    const form = $("#ticket-form");
    const input = $("#new-comment");
    const body = input.value.trim();
    if (!body) return;
    const ticket = state.tickets.find(item => item.id === form.dataset.ticketId);
    ticket.comments.push({ id: uid(), body, createdAt: now() });
    ticket.updatedAt = now();
    input.value = "";
    $("#comment-list").innerHTML = commentsHTML(ticket);
    save("Comment added");
  }

  function deleteTicket(id) {
    const ticket = state.tickets.find(item => item.id === id);
    if (!ticket || !confirm(`Delete LOC-${ticket.number}? This cannot be undone.`)) return;
    state.tickets = state.tickets.filter(item => item.id !== id);
    save("Ticket deleted"); closeModal(); render();
  }

  function deleteNote(id) {
    const note = state.notes.find(item => item.id === id);
    if (!note || !confirm(`Delete note “${note.title}”? This cannot be undone.`)) return;
    state.notes = state.notes.filter(item => item.id !== id);
    save("Note deleted"); closeModal(); render();
  }

  function deleteProject() {
    if (portfolio.projects.length === 1) return;
    if (!confirm(`Delete project “${state.name}” and all of its tickets? This cannot be undone.`)) return;
    const deletedId = state.id;
    portfolio.projects = portfolio.projects.filter(project => project.id !== deletedId);
    state = portfolio.projects[0];
    portfolio.activeProjectId = state.id;
    ui.selectedSprintId = defaultSprintId();
    ui.screen = "kanban";
    save("Project deleted"); closeModal(); render();
  }

  function editProject(projectId) {
    const project = portfolio.projects.find(item => item.id === projectId);
    if (!project) return;
    state = project;
    portfolio.activeProjectId = project.id;
    ui.selectedSprintId = defaultSprintId();
    save();
    render();
    showSettings("project");
  }

  function moveColumn(id, offset) {
    const index = state.columns.findIndex(item => item.id === id);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= state.columns.length) return;
    [state.columns[index], state.columns[destination]] = [state.columns[destination], state.columns[index]];
    save("Columns reordered"); refreshSettings();
  }

  function deleteColumn(id) {
    if (state.columns.length === 1) return;
    const column = state.columns.find(item => item.id === id);
    if (!confirm(`Delete “${column.name}”? Its tickets will move to the nearest column.`)) return;
    const index = state.columns.findIndex(item => item.id === id);
    const fallback = state.columns[index === 0 ? 1 : index - 1].id;
    state.tickets.forEach(ticket => { if (ticket.columnId === id) ticket.columnId = fallback; });
    state.columns.splice(index, 1);
    save("Column deleted"); refreshSettings();
  }

  function deleteLabel(id) {
    const label = state.labels.find(item => item.id === id);
    if (!confirm(`Delete label “${label.name}”?`)) return;
    state.labels = state.labels.filter(item => item.id !== id);
    state.tickets.forEach(ticket => ticket.labelIds = ticket.labelIds.filter(labelId => labelId !== id));
    save("Label deleted"); refreshSettings();
  }

  function toggleSprint(id) {
    const sprint = state.sprints.find(item => item.id === id);
    sprint.active = !sprint.active;
    save(sprint.active ? "Sprint reopened" : "Sprint completed"); refreshSettings();
  }

  function deleteSprint(id) {
    const sprint = state.sprints.find(item => item.id === id);
    if (!confirm(`Delete sprint “${sprint.name}”? Its tickets will return to the backlog.`)) return;
    state.sprints = state.sprints.filter(item => item.id !== id);
    state.tickets.forEach(ticket => { if (ticket.sprintId === id) ticket.sprintId = null; });
    if (ui.selectedSprintId === id) ui.selectedSprintId = state.sprints[0]?.id || null;
    save("Sprint deleted"); refreshSettings();
  }

  window.ticketingNewTicket = () => showNewTicket();
  save();
  render();
})();
