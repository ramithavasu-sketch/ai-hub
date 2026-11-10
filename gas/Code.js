/**
 * AnywhereWorks AI Hub on Google Apps Script.
 *
 * The web app runs as its owner and is open only to Anywhere.co accounts, so Google
 * handles sign-in. Data lives in a Google Sheet (one tab per table) that the script
 * creates in the owner's Drive on first use. Every action goes through api(), which
 * works out who is asking and runs the same rules as the demo (rules.js, built from
 * src/lib/server.ts) before saving. People only ever receive projects they may see.
 * Uploaded files go to an "AnywhereWorks AI Hub — files" folder in the same Drive.
 */

var DOMAIN = 'anywhere.co';
var ACTIVITY_KEEP = 3000; // newest activity rows kept in the sheet
var MAX_UPLOAD_MB = 20;

// Column layout per tab. s = text, j = JSON (lists and objects), b = yes/no, n = number.
var SCHEMA = {
  departments: [['id', 's'], ['name', 's'], ['description', 's'], ['hue', 'n']],
  people: [['id', 's'], ['name', 's'], ['email', 's'], ['title', 's'], ['departmentId', 's'], ['bio', 's'],
    ['interests', 'j'], ['accessRole', 's'], ['active', 'b']],
  projects: [['id', 's'], ['name', 's'], ['tagline', 's'], ['description', 's'], ['problem', 's'], ['solution', 's'],
    ['benefits', 's'], ['ownerId', 's'], ['contributorIds', 'j'], ['departmentId', 's'], ['status', 's'],
    ['visibility', 's'], ['allowedIds', 'j'], ['technologies', 'j'], ['tags', 'j'], ['featured', 'b'],
    ['proposedAt', 's'], ['createdAt', 's'], ['updatedAt', 's'], ['journey', 'j'], ['notes', 's']],
  resources: [['id', 's'], ['projectId', 's'], ['title', 's'], ['type', 's'], ['description', 's'], ['url', 's'],
    ['addedBy', 's'], ['addedAt', 's']],
  updates: [['id', 's'], ['projectId', 's'], ['authorId', 's'], ['date', 's'], ['title', 's'], ['body', 's']],
  comments: [['id', 's'], ['projectId', 's'], ['authorId', 's'], ['date', 's'], ['body', 's']],
  activity: [['id', 's'], ['projectId', 's'], ['actorId', 's'], ['date', 's'], ['action', 's']],
};

var DEPARTMENTS = [
  ['d-cs', 'Customer Success', 'Support, call quality and customer experience', 168],
  ['d-qa', 'Quality Assurance', 'Call audits, calibration and quality standards', 140],
  ['d-eng', 'Product & Engineering', 'Platform, apps and internal tooling', 222],
  ['d-design', 'Design', 'Product design, brand and research', 262],
  ['d-mkt', 'Marketing', 'Content, campaigns and growth', 28],
  ['d-sales', 'Sales', 'Pipeline, partnerships and onboarding', 340],
  ['d-people', 'People & Culture', 'Hiring, learning and wellbeing', 48],
  ['d-ops', 'Finance & Operations', 'Billing, planning and process', 195],
];

// Actions the page may call, mapped to the rules. Each gets (db, me, ...args).
// Built on demand so it never depends on which script file Apps Script loads first.
function actions_() { return {
  saveProject: function (db, me, input, id) { return AIHub.saveProject(db, me, input, id || undefined).id; },
  setJourneyNote: AIHub.setJourneyNote,
  setStatus: AIHub.setStatus,
  publish: AIHub.publish,
  deleteProject: AIHub.deleteProject,
  toggleFeatured: AIHub.toggleFeatured,
  saveResource: function (db, me, projectId, input, id) { return AIHub.saveResource(db, me, projectId, input, id || undefined); },
  deleteResource: AIHub.deleteResource,
  addUpdate: AIHub.addUpdate,
  addComment: AIHub.addComment,
  deleteComment: AIHub.deleteComment,
  setAccess: AIHub.setAccess,
  setActive: AIHub.setActive,
  addDepartment: AIHub.addDepartment,
  updateProfile: AIHub.updateProfile,
}; }

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('AnywhereWorks AI Hub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called by the page: name is 'load' or one of the actions. Returns { result, data, me, appUrl }. */
function api(name, args) {
  var actions = actions_();
  if (name !== 'load' && !actions.hasOwnProperty(name)) throw new Error('Unknown action.');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var store = openStore_();
    var db = readDb_(store);
    var before = snapshot_(db);
    addMissingDepartments_(db);
    var me = currentPerson_(db);
    var result = null;
    if (me.active && name !== 'load') result = actions[name].apply(null, [db, me].concat(args || [])) || null;
    writeChanges_(store, db, before);
    return { result: result, me: me, data: me.active ? visibleData_(db, me) : null, appUrl: appUrl_() };
  } catch (e) {
    // Rule errors carry a friendly message; anything else gets a generic one in the page.
    throw new Error(e && e.message ? e.message : 'Something went wrong. Please try again.');
  } finally {
    lock.releaseLock();
  }
}

function appUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

// ---------- files ----------

/**
 * Run this once from the Apps Script editor after the app gains new permissions.
 * The web app can't show Google's approval screen itself; running a function here does.
 */
function authorize() {
  DriveApp.getRootFolder();
  DocumentApp.getActiveDocument();
  SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('All set. The AI Hub can now save files and read documents.');
}

/** Save an uploaded file in the AI Hub's Drive folder. Anyone at Anywhere.co with the link can open it. */
function uploadFile(file) {
  uploader_();
  var saved = filesFolder_().createFile(blobFrom_(file));
  try {
    saved.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Some Workspace settings block link sharing; the file is still saved and the owner can share it.
  }
  return { name: saved.getName(), url: saved.getUrl(), mimeType: saved.getMimeType() };
}

/** Read a project document (Word, PDF, Google Doc export or text) and return the form fields it fills. */
function readDocument(file) {
  uploader_();
  var blob = blobFrom_(file);
  var text;
  if (/^text\//.test(blob.getContentType()) || /\.(txt|md)$/i.test(file.name)) {
    text = blob.getDataAsString('UTF-8');
  } else {
    // Google converts Word, PDF (with OCR) and similar files into a temporary Google Doc we can read.
    var temp;
    try {
      temp = Drive.Files.create({ name: 'AI Hub import (temporary)', mimeType: MimeType.GOOGLE_DOCS, parents: [filesFolder_().getId()] }, blob);
    } catch (e) {
      throw new Error('We couldn’t read that file. Try a Word document, PDF or text file.');
    }
    try { text = DocumentApp.openById(temp.id).getBody().getText(); } finally { Drive.Files.remove(temp.id); }
  }
  return AIHub.fieldsFromText(text);
}

/** Only active contributors and admins may upload. Read-only, so no lock is needed. */
function uploader_() {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  var me = readDb_(openStore_()).people.filter(function (p) { return p.email.toLowerCase() === email; })[0];
  if (!me) throw new Error('Refresh the page and try again.');
  if (!me.active || me.accessRole === 'viewer') throw new Error('Ask an admin for contributor access to upload files.');
  return me;
}

function blobFrom_(file) {
  if (!file || !file.data) throw new Error('Choose a file to upload.');
  if (file.data.length * 0.75 > MAX_UPLOAD_MB * 1024 * 1024) throw new Error('Files can be up to ' + MAX_UPLOAD_MB + ' MB.');
  var name = String(file.name || 'file').slice(0, 200);
  return Utilities.newBlob(Utilities.base64Decode(file.data), file.mimeType || 'application/octet-stream', name);
}

function filesFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FILES_FOLDER_ID');
  if (id) {
    try {
      var folder = DriveApp.getFolderById(id);
      if (!folder.isTrashed()) return folder;
    } catch (e) {
      // Folder was deleted; make a new one below.
    }
  }
  var created = DriveApp.createFolder('AnywhereWorks AI Hub — files');
  props.setProperty('FILES_FOLDER_ID', created.getId());
  return created;
}

// ---------- who is asking ----------

function currentPerson_(db) {
  var email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email || email.split('@')[1] !== DOMAIN) throw new Error('Open the AI Hub with your Anywhere.co Google account.');
  var me = db.people.filter(function (p) { return p.email.toLowerCase() === email; })[0];
  if (me) return me;
  // First visit: join as a viewer. Whoever deployed the app is its first admin.
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  me = {
    id: 'u-' + Utilities.getUuid().slice(0, 8), name: nameFromEmail_(email), email: email, title: '',
    departmentId: '', bio: '', interests: [], accessRole: email === owner ? 'admin' : 'viewer', active: true,
  };
  db.people.push(me);
  return me;
}

function nameFromEmail_(email) {
  return email.split('@')[0].split(/[._-]+/).filter(String).map(function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function visibleData_(db, me) {
  var projects = db.projects.filter(function (p) { return AIHub.canView(me, p); });
  var ids = {};
  projects.forEach(function (p) { ids[p.id] = true; });
  var mine = function (rows) { return rows.filter(function (r) { return ids[r.projectId]; }); };
  var byName = function (a, b) { return a.name.localeCompare(b.name); };
  return {
    version: 0,
    departments: db.departments.slice().sort(byName),
    people: db.people.slice().sort(byName),
    projects: projects,
    resources: mine(db.resources),
    updates: mine(db.updates),
    comments: mine(db.comments),
    activity: mine(db.activity),
  };
}

// ---------- the Google Sheet ----------

function openStore_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('AnywhereWorks AI Hub — data');
  Object.keys(SCHEMA).forEach(function (table, i) {
    var sheet = i === 0 ? ss.getSheets()[0].setName(table) : ss.insertSheet(table);
    sheet.getRange(1, 1, 1, SCHEMA[table].length).setValues([SCHEMA[table].map(function (c) { return c[0]; })]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });
  var depts = DEPARTMENTS.map(function (d) { return { id: d[0], name: d[1], description: d[2], hue: d[3] }; });
  writeTable_(ss, 'departments', depts);
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

/** Departments added to DEPARTMENTS later also reach a Sheet that already exists. */
function addMissingDepartments_(db) {
  // The first upload called Marketing 'd-marketing'; the app's icons expect 'd-mkt'.
  db.departments.forEach(function (d) { if (d.id === 'd-marketing') d.id = 'd-mkt'; });
  db.people.concat(db.projects).forEach(function (r) { if (r.departmentId === 'd-marketing') r.departmentId = 'd-mkt'; });
  DEPARTMENTS.forEach(function (d) {
    var known = db.departments.some(function (x) { return x.id === d[0] || x.name.toLowerCase() === d[1].toLowerCase(); });
    if (!known) db.departments.push({ id: d[0], name: d[1], description: d[2], hue: d[3] });
  });
}

function readDb_(ss) {
  var db = { version: 0 };
  Object.keys(SCHEMA).forEach(function (table) {
    var cols = SCHEMA[table];
    var sheet = ss.getSheetByName(table);
    var last = sheet.getLastRow();
    var values = last > 1 ? sheet.getRange(2, 1, last - 1, cols.length).getDisplayValues() : [];
    db[table] = values.filter(function (row) { return row[0]; }).map(function (row) {
      var o = {};
      cols.forEach(function (c, i) { o[c[0]] = fromCell_(row[i], c[1]); });
      return o;
    });
  });
  return db;
}

function fromCell_(v, kind) {
  if (kind === 'b') return String(v).toUpperCase() === 'TRUE';
  if (kind === 'n') return Number(v) || 0;
  if (kind === 'j') { try { return v ? JSON.parse(v) : []; } catch (e) { return []; } }
  return String(v);
}

function toCell_(v, kind) {
  if (kind === 'j') return JSON.stringify(v == null ? [] : v);
  if (kind === 'b') return v ? 'TRUE' : 'FALSE';
  return v == null ? '' : String(v);
}

function snapshot_(db) {
  var s = {};
  Object.keys(SCHEMA).forEach(function (t) { s[t] = JSON.stringify(db[t]); });
  return s;
}

function writeChanges_(ss, db, before) {
  if (db.activity.length > ACTIVITY_KEEP) {
    db.activity.sort(function (a, b) { return a.date.localeCompare(b.date); });
    db.activity = db.activity.slice(-ACTIVITY_KEEP);
  }
  Object.keys(SCHEMA).forEach(function (t) {
    if (JSON.stringify(db[t]) !== before[t]) writeTable_(ss, t, db[t]);
  });
}

/** Rewrite a tab's rows. Cells are stored as plain text so Sheets never reformats dates or IDs. */
function writeTable_(ss, table, rows) {
  var cols = SCHEMA[table];
  var sheet = ss.getSheetByName(table);
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, cols.length).clearContent();
  if (!rows.length) return;
  var values = rows.map(function (r) { return cols.map(function (c) { return toCell_(r[c[0]], c[1]); }); });
  sheet.getRange(2, 1, values.length, cols.length).setNumberFormat('@').setValues(values);
}
