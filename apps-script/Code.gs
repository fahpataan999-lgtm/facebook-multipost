const SPREADSHEET_ID = "1VpzsUI7TFW0UBtVmaAqae3cFZ5PYxIMswiDKS6WPQBk";
const QUEUE_SHEET = "Queue";
const PAGE_SHEET = "Page Choices";
const DRIVE_FOLDER_ID = ""; // Optional: put an upload folder ID here.
const TIMEZONE = "Asia/Bangkok";
const DEFAULT_STATUS = "READY";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action || "list";
    const result = action === "create"
      ? createRows(payload)
      : action === "update"
        ? updateRow(payload)
        : action === "upload"
          ? uploadOnly(payload)
          : getQueueData();
    return jsonOutput({ ok: true, ...result });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function doGet() {
  return jsonOutput({ ok: true, ...getQueueData() });
}

function authorizeApp() {
  SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  const file = DriveApp.createFile("facebook-multipost-authorization-check.txt", "ok", MimeType.PLAIN_TEXT);
  file.setTrashed(true);
  return "Authorization completed.";
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getQueueData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = getRequiredSheet(ss, QUEUE_SHEET);
  const pageSheet = getRequiredSheet(ss, PAGE_SHEET);
  const values = queueSheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const rows = values.slice(1).filter((row) => row.some(Boolean)).map((row) => rowToObject(headers, row)).reverse();
  const ids = getNextIds(values, headers);
  const pageCount = Math.max(pageSheet.getLastRow() - 1, 0);
  const pages = pageCount ? pageSheet.getRange(2, 1, pageCount, 1).getDisplayValues().flat().filter(Boolean) : [];
  return { rows, pages, nextRowId: ids.nextRowId, nextContentId: ids.nextContentId };
}

function createRows(payload) {
  const entries = normalizePayloadEntries(payload);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getRequiredSheet(ss, QUEUE_SHEET);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const ids = getNextIds(values, headers);
  const rows = [];
  let rowId = ids.nextRowId;
  let contentNumber = ids.nextContentNumber;

  entries.forEach((entry) => {
    const pageNames = normalizePageNames(entry, payload);
    validateEntry(entry, pageNames);
    const contentId = `C${String(contentNumber).padStart(3, "0")}`;
    contentNumber += 1;
    const fileInfo = uploadFiles(entry.uploaded_files || entry.files || entry.file);

    pageNames.forEach((pageName) => {
      const item = {
        row_id: rowId,
        content_id: contentId,
        caption: entry.caption,
        media_type: entry.media_type || fileInfo.mediaType || "text",
        drive_file_id: fileInfo.ids || "",
        link: fileInfo.urls || "",
        page_name: pageName,
        scheduled_at: entry.publish_mode === "NOW" ? "" : entry.scheduled_at,
        timezone: TIMEZONE,
        status: DEFAULT_STATUS,
        fb_post_id: "",
        error: "",
        processed_at: "",
        publish_mode: entry.publish_mode
      };
      rows.push(headers.map((header) => item[header] ?? ""));
      rowId += 1;
    });
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return { created: rows.length, ...getQueueData() };
}

function updateRow(payload) {
  const entries = normalizePayloadEntries(payload);
  const entry = entries[0];
  const pageNames = normalizePageNames(entry, payload);
  validateEntry(entry, pageNames);
  if (!payload.row_id) throw new Error("row_id is required.");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getRequiredSheet(ss, QUEUE_SHEET);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const rowIdIndex = headers.indexOf("row_id");
  const targetIndex = values.findIndex((row, index) => index > 0 && String(row[rowIdIndex]) === String(payload.row_id));
  if (targetIndex < 1) throw new Error("Row not found.");

  const current = rowToObject(headers, values[targetIndex]);
  if (!isEditableRow(current)) throw new Error("Only READY or SCHEDULED rows with SCHEDULED publish mode can be edited.");

  const fileInfo = uploadFiles(entry.uploaded_files || entry.files || entry.file);
  const item = {
    ...current,
    caption: entry.caption,
    media_type: entry.media_type || fileInfo.mediaType || current.media_type || "text",
    drive_file_id: fileInfo.ids || current.drive_file_id || "",
    link: fileInfo.urls || current.link || "",
    page_name: pageNames[0],
    scheduled_at: entry.publish_mode === "NOW" ? "" : entry.scheduled_at,
    timezone: TIMEZONE,
    status: DEFAULT_STATUS,
    publish_mode: entry.publish_mode
  };
  sheet.getRange(targetIndex + 1, 1, 1, headers.length).setValues([headers.map((header) => item[header] ?? "")]);
  return { updated: true, ...getQueueData() };
}

function normalizePayloadEntries(payload) {
  if (Array.isArray(payload.entries) && payload.entries.length) return payload.entries;
  return [{ caption: payload.caption, media_type: payload.media_type, scheduled_at: payload.scheduled_at, publish_mode: payload.publish_mode, page_names: payload.page_names || [], files: payload.files || (payload.file ? [payload.file] : []) }];
}

function normalizePageNames(entry, payload) {
  if (Array.isArray(entry.page_names) && entry.page_names.length) return entry.page_names.filter(Boolean);
  return Array.isArray(payload.page_names) ? payload.page_names.filter(Boolean) : [];
}

function validateEntry(entry, pageNames) {
  if (!entry.caption || !String(entry.caption).trim()) throw new Error("Caption is required.");
  if (!Array.isArray(pageNames) || pageNames.length === 0) throw new Error("Select at least one page.");
  if (!["NOW", "SCHEDULED"].includes(entry.publish_mode)) throw new Error("publish_mode must be NOW or SCHEDULED.");
  if (entry.publish_mode === "SCHEDULED" && !entry.scheduled_at) throw new Error("scheduled_at is required for SCHEDULED mode.");
  if (entry.media_type === "video" && Array.isArray(entry.files) && entry.files.length > 1) throw new Error("Video accepts only one file.");
}

function uploadOnly(payload) {
  const fileInfo = uploadFiles(payload.files || payload.file);
  return { drive_file_id: fileInfo.ids || "", link: fileInfo.urls || "", media_type: fileInfo.mediaType || "" };
}

function uploadFiles(files) {
  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  const existing = fileList.filter((file) => file && (file.id || file.url));
  const uploaded = fileList.filter((file) => file && file.base64).map((file) => uploadFile(file));
  const allFiles = existing.concat(uploaded);
  return {
    ids: allFiles.map((file) => file.id).filter(Boolean).join(","),
    urls: allFiles.map((file) => file.url).filter(Boolean).join(","),
    mediaType: allFiles[0] ? allFiles[0].mediaType || "" : ""
  };
}

function uploadFile(file) {
  const bytes = Utilities.base64Decode(file.base64);
  const blob = Utilities.newBlob(bytes, file.mimeType || "application/octet-stream", file.name || "upload");
  const driveFile = DRIVE_FOLDER_ID ? DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob) : DriveApp.createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: driveFile.getId(), url: driveFile.getUrl(), mediaType: inferMediaType(file.mimeType) };
}

function inferMediaType(mimeType) {
  if (!mimeType) return "file";
  if (mimeType.indexOf("image/") === 0) return "photo";
  if (mimeType.indexOf("video/") === 0) return "video";
  return "file";
}

function getNextIds(values, headers) {
  const rowIdIndex = headers.indexOf("row_id");
  const contentIdIndex = headers.indexOf("content_id");
  let maxRowId = 0;
  let maxContentNumber = 0;
  values.slice(1).forEach((row) => {
    const rowId = Number(row[rowIdIndex]);
    if (!Number.isNaN(rowId)) maxRowId = Math.max(maxRowId, rowId);
    const match = String(row[contentIdIndex] || "").match(/C(\d+)/i);
    if (match) maxContentNumber = Math.max(maxContentNumber, Number(match[1]));
  });
  return { nextRowId: maxRowId + 1, nextContentNumber: maxContentNumber + 1, nextContentId: `C${String(maxContentNumber + 1).padStart(3, "0")}` };
}

function rowToObject(headers, row) {
  return headers.reduce((item, header, index) => {
    item[header] = row[index] || "";
    return item;
  }, {});
}

function normalizeHeaders(headers) {
  return headers.map((header) => String(header || "").trim());
}

function normalizeValue(value) {
  return String(value || "").trim().toUpperCase();
}

function isEditableRow(row) {
  const status = normalizeValue(row.status);
  return normalizeValue(row.publish_mode) === "SCHEDULED" && ["READY", "SCHEDULED"].includes(status);
}

function getRequiredSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return sheet;
}
