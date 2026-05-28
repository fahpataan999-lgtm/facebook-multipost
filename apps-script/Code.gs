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
        : getQueueData();
    return jsonOutput({ ok: true, ...result });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message });
  }
}

function doGet() {
  return jsonOutput({ ok: true, ...getQueueData() });
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getQueueData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const queueSheet = getRequiredSheet(ss, QUEUE_SHEET);
  const pageSheet = getRequiredSheet(ss, PAGE_SHEET);
  const values = queueSheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const rows = values.slice(1)
    .filter((row) => row.some(Boolean))
    .map((row) => rowToObject(headers, row))
    .reverse();
  const ids = getNextIds(values, headers);
  const pageCount = Math.max(pageSheet.getLastRow() - 1, 0);
  const pages = pageCount
    ? pageSheet.getRange(2, 1, pageCount, 1).getDisplayValues().flat().filter(Boolean)
    : [];

  return {
    rows,
    pages,
    nextRowId: ids.nextRowId,
    nextContentId: ids.nextContentId
  };
}

function createRows(payload) {
  validatePayload(payload);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getRequiredSheet(ss, QUEUE_SHEET);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const ids = getNextIds(values, headers);
  const contentId = ids.nextContentId;
  const fileInfo = uploadFile(payload.file);
  const rows = payload.page_names.map((pageName, index) => {
    const item = {
      row_id: ids.nextRowId + index,
      content_id: contentId,
      caption: payload.caption,
      media_type: payload.media_type || fileInfo.mediaType || "text",
      drive_file_id: fileInfo.id || "",
      link: fileInfo.url || "",
      page_name: pageName,
      scheduled_at: payload.publish_mode === "NOW" ? "" : payload.scheduled_at,
      timezone: TIMEZONE,
      status: DEFAULT_STATUS,
      fb_post_id: "",
      error: "",
      processed_at: "",
      publish_mode: payload.publish_mode
    };
    return headers.map((header) => item[header] ?? "");
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);

  return {
    created: rows.length,
    ...getQueueData()
  };
}

function updateRow(payload) {
  validatePayload(payload);
  if (!payload.row_id) {
    throw new Error("row_id is required.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getRequiredSheet(ss, QUEUE_SHEET);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = normalizeHeaders(values[0] || []);
  const rowIdIndex = headers.indexOf("row_id");
  const targetIndex = values.findIndex((row, index) => index > 0 && String(row[rowIdIndex]) === String(payload.row_id));

  if (targetIndex < 1) {
    throw new Error("Row not found.");
  }

  const current = rowToObject(headers, values[targetIndex]);
  if (!isEditableRow(current)) {
    throw new Error("Only READY scheduled rows can be edited.");
  }

  const fileInfo = uploadFile(payload.file);
  const item = {
    ...current,
    caption: payload.caption,
    media_type: payload.media_type || fileInfo.mediaType || current.media_type || "text",
    drive_file_id: fileInfo.id || current.drive_file_id || "",
    link: fileInfo.url || current.link || "",
    page_name: payload.page_names[0],
    scheduled_at: payload.publish_mode === "NOW" ? "" : payload.scheduled_at,
    timezone: TIMEZONE,
    status: DEFAULT_STATUS,
    publish_mode: payload.publish_mode
  };

  const rowValues = headers.map((header) => item[header] ?? "");
  sheet.getRange(targetIndex + 1, 1, 1, headers.length).setValues([rowValues]);

  return {
    updated: true,
    ...getQueueData()
  };
}

function validatePayload(payload) {
  if (!payload.caption || !String(payload.caption).trim()) {
    throw new Error("Caption is required.");
  }
  if (!Array.isArray(payload.page_names) || payload.page_names.length === 0) {
    throw new Error("Select at least one page.");
  }
  if (!["NOW", "SCHEDULED"].includes(payload.publish_mode)) {
    throw new Error("publish_mode must be NOW or SCHEDULED.");
  }
  if (payload.publish_mode === "SCHEDULED" && !payload.scheduled_at) {
    throw new Error("scheduled_at is required for SCHEDULED mode.");
  }
}

function uploadFile(file) {
  if (!file || !file.base64) {
    return {};
  }

  const bytes = Utilities.base64Decode(file.base64);
  const blob = Utilities.newBlob(bytes, file.mimeType || "application/octet-stream", file.name || "upload");
  const driveFile = DRIVE_FOLDER_ID
    ? DriveApp.getFolderById(DRIVE_FOLDER_ID).createFile(blob)
    : DriveApp.createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: driveFile.getId(),
    url: driveFile.getUrl(),
    mediaType: inferMediaType(file.mimeType)
  };
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

  return {
    nextRowId: maxRowId + 1,
    nextContentId: `C${String(maxContentNumber + 1).padStart(3, "0")}`
  };
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
  return normalizeValue(row.publish_mode) === "SCHEDULED" && normalizeValue(row.status) === "READY";
}

function getRequiredSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return sheet;
}
