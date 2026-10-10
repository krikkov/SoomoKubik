export const APPS_SCRIPT_CODE = String.raw`/**
 * КУБИК — бэкенд соревнований на Google Таблице.
 * Разверните как веб-приложение: Запуск от имени "Я", доступ "У всех".
 * Полученный URL (.../exec) вставьте в приложение (Настройки -> URL Apps Script).
 */

var DB_SHEET = 'DB';
var TEAMS_SHEET = 'Команды';
var MATCHES_SHEET = 'Сражения';
var HEADERS = ['id', 'name', 'date', 'stage', 'updatedAt', 'json'];

/**
 * ЗАПУСТИТЕ ОДИН РАЗ вручную (выберите setup в списке функций и нажмите «Выполнить»):
 * Google попросит разрешения, а в таблице появятся листы DB, Команды, Сражения.
 */
function setup() {
  db_();
  maybeRender_(true);
  SpreadsheetApp.getActiveSpreadsheet().toast('КУБИК: таблица готова к работе', 'Готово', 5);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var res = handle_(p.action || 'list', p);
  if (p.callback) {
    return ContentService.createTextOutput(p.callback + '(' + JSON.stringify(res) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(res);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  return json_(handle_(body.action, body));
}

function handle_(action, data) {
  try {
    if (action === 'ping') return { ok: true, version: 2, time: new Date().toISOString() };
    if (action === 'list') {
      var res = { ok: true, competitions: listAll_() };
      flushPending_();
      return res;
    }
    if (action === 'get') return { ok: true, competition: getOne_(data.id) };

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) return { ok: false, error: 'Таблица занята, повторите попытку' };
    try {
      switch (action) {
        case 'save':   return { ok: true, competition: save_(data.competition) };
        case 'patch':  return { ok: true, competition: patch_(data) };
        case 'delete': return { ok: true, deleted: remove_(data.id) };
        default:       return { ok: false, error: 'Unknown action: ' + action };
      }
    } finally {
      try { lock.releaseLock(); } catch (e2) {}
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function db_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DB_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DB_SHEET);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function listAll_() {
  var sh = db_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    try { out.push(JSON.parse(values[i][5])); } catch (e) {}
  }
  return out;
}

function findRow_(id) {
  var sh = db_();
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function getOne_(id) {
  var row = findRow_(id);
  if (row < 0) return null;
  try { return JSON.parse(db_().getRange(row, 6).getValue()); } catch (e) { return null; }
}

function save_(comp) {
  if (!comp || !comp.id) throw new Error('Нет id соревнования');
  comp.updatedAt = new Date().toISOString();
  var sh = db_();
  var row = findRow_(comp.id);
  var values = [comp.id, comp.name, comp.date, comp.stage, comp.updatedAt, JSON.stringify(comp)];
  if (row < 0) sh.appendRow(values);
  else sh.getRange(row, 1, 1, HEADERS.length).setValues([values]);
  maybeRender_(false);
  return comp;
}

function maybeRender_(force) {
  var cache = CacheService.getScriptCache();
  try {
    if (!force && cache.get('rendered')) {
      cache.put('dirty', '1', 1800);
      return;
    }
    cache.put('rendered', '1', 20);
    cache.remove('dirty');
    renderReadable_();
  } catch (e) {
    try { cache.put('dirty', '1', 1800); } catch (e2) {}
  }
}

function flushPending_() {
  var cache = CacheService.getScriptCache();
  try {
    if (!cache.get('dirty') || cache.get('rendered')) return;
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return;
    try {
      cache.put('rendered', '1', 20);
      cache.remove('dirty');
      renderReadable_();
    } finally {
      try { lock.releaseLock(); } catch (e3) {}
    }
  } catch (e) {}
}

function patch_(data) {
  // Совместимость с клиентами, которые передают id или compId.
  var comp = getOne_(data.compId || data.id);
  if (!comp) throw new Error('Соревнование не найдено');
  var patches = data.patches || [];
  var lists = [comp.matches || [], comp.finalMatches || []];
  for (var p = 0; p < patches.length; p++) {
    for (var l = 0; l < lists.length; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        if (lists[l][i].id === patches[p].id) {
          var patch = patches[p].patch || {};
          for (var k in patch) lists[l][i][k] = patch[k];
        }
      }
    }
  }
  var extra = data.extra || {};
  for (var key in extra) comp[key] = extra[key];
  return save_(comp);
}

function remove_(id) {
  var row = findRow_(id);
  if (row < 0) return false;
  db_().deleteRow(row);
  maybeRender_(true);
  return true;
}

function renderReadable_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var comps = listAll_();

  var teams = [['Соревнование', 'Дата', 'Стол', 'Команда', 'Участники']];
  var matches = [['Соревнование', 'Этап', 'Стол', 'Тур', '№', 'Команда A', 'Команда B', 'Победитель', 'Счёт', 'Способ', 'Раунды', 'Эксперт', 'Время']];
  var METHOD = { normal: 'по баллам', draw: '0:0 (3 переигровки)', forfeit: 'неявка', penalty: 'нарушения', judges: 'решение судей' };

  comps.forEach(function (c) {
    var nameById = {};
    (c.teams || []).forEach(function (t) {
      nameById[t.id] = t.name;
      teams.push([c.name, c.date, t.table || '', t.name, (t.members || []).join(', ')]);
    });
    var all = (c.matches || []).concat(c.finalMatches || []);
    all.forEach(function (m) {
      matches.push([
        c.name,
        m.stage === 'final' ? 'Финал' : 'Основной',
        m.stage === 'final' ? '' : m.table,
        m.round, m.order,
        nameById[m.a] || '', nameById[m.b] || '',
        m.draw ? 'Ничья' : (nameById[m.winner] || ''),
        (m.scoreA === null || m.scoreA === undefined) ? '' : (m.scoreA + ':' + m.scoreB),
        METHOD[m.method] || '',
        (m.rounds || []).map(function (r) { return r === 'a' ? 'A' : r === 'b' ? 'B' : '–'; }).join(' '),
        m.judge || '',
        m.finishedAt || ''
      ]);
    });
  });

  writeSheet_(ss, TEAMS_SHEET, teams);
  writeSheet_(ss, MATCHES_SHEET, matches);
}

function writeSheet_(ss, name, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (rows.length) sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
}
`;
