const CONFIG = window.CONTENT_QUEUE_CONFIG || {};
const API_URL = CONFIG.apiUrl || "";
const FALLBACK_PAGES = [
  "Axtion Dietary Supplement",
  "Rusiren ตัวช่วยแก้ปัญหานอนไม่หลับ ลดอาการกรน",
  "Krachter อาหารเสริมสุขภาพกระดูก",
  "Rusiren แก้นอนกรน แก้นอนไม่หลับ หายขาดได้ 100%",
  "รูไซเรน แก้นอนกรน แก้นอนไม่หลับ",
  "Rusiren แก้นอนกรน เห็นผล 100%",
  "Ruxicah ลดผมร่วง ล้าน บาง ขึ้นใหม่100%",
  "หายกรน ถาวร100% Rusiren",
  "กรดไหลย้อน",
  "Tendrix-ฟื้นฟูกระดูกอ่อนและน้ำเลี้ยงไขข้อ",
  "ลดอาการแสบร้อนในช่องท้อง แก้ไม่หาย",
  "Axtion คัดสรรสกัดจากธรรมชาติ ช่วยฟื้นฟูระบบย่อยอาหารอย่างอ่อนโยน",
  "Axtion-ช่วยลดอาการเรอเปรี้ยว เรอบ่อย รสขมของน้ำดีท้องอืด แสบคอ แก้ไม่หาย"
];

const state = {
  pages: FALLBACK_PAGES,
  rows: [],
  nextRowId: 1,
  nextContentId: "C001",
  currentPage: 1
};

const PAGE_SIZE = 15;
let editingRowId = null;

const els = {
  form: document.querySelector("#queueForm"),
  caption: document.querySelector("#caption"),
  mediaType: document.querySelector("#mediaType"),
  publishMode: document.querySelector("#publishMode"),
  scheduledAt: document.querySelector("#scheduledAt"),
  mediaFile: document.querySelector("#mediaFile"),
  filePreview: document.querySelector("#filePreview"),
  pageList: document.querySelector("#pageList"),
  toggleAllPages: document.querySelector("#toggleAllPages"),
  submitButton: document.querySelector("#submitButton"),
  refreshButton: document.querySelector("#refreshButton"),
  reloadTable: document.querySelector("#reloadTable"),
  queueBody: document.querySelector("#queueBody"),
  apiState: document.querySelector("#apiState"),
  formMessage: document.querySelector("#formMessage"),
  totalRows: document.querySelector("#totalRows"),
  nextIds: document.querySelector("#nextIds"),
  pageRange: document.querySelector("#pageRange"),
  pageIndicator: document.querySelector("#pageIndicator"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage")
};

function setApiState(text, mode = "") {
  els.apiState.textContent = text;
  els.apiState.className = `status-pill ${mode}`.trim();
}

function setMessage(text, isError = false) {
  els.formMessage.textContent = text;
  els.formMessage.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeValue(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isEditableRow(row) {
  return normalizeValue(row.publish_mode) === "SCHEDULED" && normalizeValue(row.status) === "READY";
}

function renderPages() {
  els.pageList.innerHTML = state.pages
    .map((page, index) => `
      <label class="page-option">
        <input type="checkbox" name="page_name" value="${escapeHtml(page)}" ${index === 0 ? "checked" : ""} />
        <span>${escapeHtml(page)}</span>
      </label>
    `)
    .join("");
}

function renderRows() {
  els.totalRows.textContent = String(state.rows.length);
  els.nextIds.textContent = `${state.nextRowId} / ${state.nextContentId}`;

  if (!state.rows.length) {
    els.queueBody.innerHTML = `<tr><td colspan="9" class="empty-state">ยังไม่มีข้อมูล หรือยังไม่ได้เชื่อมต่อ API</td></tr>`;
    renderPagination(0, 0, 0);
    return;
  }

  const pageCount = Math.max(Math.ceil(state.rows.length / PAGE_SIZE), 1);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), pageCount);
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageRows = state.rows.slice(start, start + PAGE_SIZE);

  els.queueBody.innerHTML = pageRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.row_id)}</td>
      <td>${escapeHtml(row.content_id)}</td>
      <td><div class="caption-cell">${escapeHtml(row.caption)}</div></td>
      <td>${escapeHtml(row.media_type)}</td>
      <td>${escapeHtml(row.page_name)}</td>
      <td>${escapeHtml(row.scheduled_at)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.publish_mode)}</td>
      <td>${renderEditButton(row)}</td>
    </tr>
  `).join("");
  renderPagination(start + 1, start + pageRows.length, pageCount);
}

function renderPagination(start, end, pageCount) {
  if (!els.pageRange || !els.pageIndicator || !els.prevPage || !els.nextPage) return;

  els.pageRange.textContent = state.rows.length ? `${start}-${end} / ${state.rows.length}` : "0 / 0";
  els.pageIndicator.textContent = state.rows.length ? `หน้า ${state.currentPage} / ${pageCount}` : "หน้า 0 / 0";
  els.prevPage.disabled = state.currentPage <= 1 || !state.rows.length;
  els.nextPage.disabled = state.currentPage >= pageCount || !state.rows.length;
}

function renderEditButton(row) {
  if (!isEditableRow(row)) return "";
  return `<button type="button" class="table-action" data-edit-row="${escapeHtml(row.row_id)}">แก้ไข</button>`;
}

function selectedPages() {
  return Array.from(document.querySelectorAll('input[name="page_name"]:checked')).map((input) => input.value);
}

function toBangkokIso(datetimeLocal) {
  if (!datetimeLocal) return "";
  return `${datetimeLocal}:00+07:00`;
}

function toDateTimeLocal(isoText) {
  const match = String(isoText || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : "";
}

function inferMediaType(file) {
  if (!file) return "text";
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function apiRequest(payload) {
  if (!API_URL) {
    throw new Error("ยังไม่ได้ตั้งค่า apiUrl ใน config.js");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "บันทึกไม่สำเร็จ");
  }
  return data;
}

async function loadMeta() {
  if (!API_URL) {
    setApiState("รอตั้งค่า API", "warn");
    renderPages();
    renderRows();
    return;
  }

  try {
    setApiState("กำลังโหลด", "warn");
    const data = await apiRequest({ action: "list" });
    state.pages = data.pages?.length ? data.pages : FALLBACK_PAGES;
    state.rows = data.rows || [];
    state.nextRowId = data.nextRowId || 1;
    state.nextContentId = data.nextContentId || "C001";
    state.currentPage = 1;
    renderPages();
    renderRows();
    setApiState("เชื่อมต่อแล้ว", "ready");
  } catch (error) {
    setApiState("เชื่อมต่อไม่ได้", "warn");
    setMessage(error.message, true);
    renderPages();
    renderRows();
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  setMessage("");

  const pages = selectedPages();
  if (!pages.length) {
    setMessage("กรุณาเลือกอย่างน้อย 1 เพจ", true);
    return;
  }

  if (els.publishMode.value === "SCHEDULED" && !els.scheduledAt.value) {
    setMessage("กรุณาเลือกวันเวลาเมื่อใช้ SCHEDULED", true);
    return;
  }

  const file = els.mediaFile.files[0] || null;
  els.submitButton.disabled = true;
  els.submitButton.textContent = "กำลังบันทึก...";

  try {
    const fileBase64 = await readFileAsBase64(file);
    const payload = {
      action: editingRowId ? "update" : "create",
      row_id: editingRowId,
      caption: els.caption.value.trim(),
      media_type: els.mediaType.value,
      scheduled_at: toBangkokIso(els.scheduledAt.value),
      publish_mode: els.publishMode.value,
      page_names: pages,
      file: file ? {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: fileBase64
      } : null
    };

    const result = await apiRequest(payload);
    state.rows = result.rows || state.rows;
    state.nextRowId = result.nextRowId || state.nextRowId;
    state.nextContentId = result.nextContentId || state.nextContentId;
    if (!result.updated) {
      state.currentPage = 1;
    }
    renderRows();
    els.form.reset();
    editingRowId = null;
    renderPages();
    els.filePreview.textContent = "ยังไม่ได้เลือกไฟล์";
    els.submitButton.textContent = "บันทึกลงชีต";
    setMessage(result.updated ? "แก้ไขสำเร็จ" : `บันทึกสำเร็จ ${result.created || pages.length} บรรทัด`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    els.submitButton.disabled = false;
    els.submitButton.textContent = "บันทึกลงชีต";
  }
}

els.mediaFile.addEventListener("change", () => {
  const file = els.mediaFile.files[0];
  if (file) {
    const inferred = inferMediaType(file);
    if (["photo", "video"].includes(inferred)) {
      els.mediaType.value = inferred;
    }
  }
  els.filePreview.textContent = file ? `${file.name} · ${Math.ceil(file.size / 1024).toLocaleString()} KB` : "ยังไม่ได้เลือกไฟล์";
});

els.toggleAllPages.addEventListener("click", () => {
  const boxes = Array.from(document.querySelectorAll('input[name="page_name"]'));
  const shouldCheck = boxes.some((box) => !box.checked);
  boxes.forEach((box) => {
    box.checked = shouldCheck;
  });
  els.toggleAllPages.textContent = shouldCheck ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด";
});

els.queueBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-row]");
  if (!button) return;

  const row = state.rows.find((item) => String(item.row_id) === String(button.dataset.editRow));
  if (!row) return;

  editingRowId = row.row_id;
  els.caption.value = row.caption || "";
  els.mediaType.value = row.media_type || "text";
  els.publishMode.value = row.publish_mode || "SCHEDULED";
  els.scheduledAt.value = toDateTimeLocal(row.scheduled_at);
  els.mediaFile.value = "";
  els.filePreview.textContent = row.drive_file_id ? `ใช้ไฟล์เดิม: ${row.drive_file_id}` : "ยังไม่ได้เลือกไฟล์";
  renderPages();
  document.querySelectorAll('input[name="page_name"]').forEach((input) => {
    input.checked = input.value === row.page_name;
  });
  els.submitButton.textContent = "บันทึกการแก้ไข";
  setMessage(`กำลังแก้ไข row ${row.row_id}`);
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
});

els.form.addEventListener("submit", handleSubmit);
els.refreshButton.addEventListener("click", loadMeta);
els.reloadTable.addEventListener("click", loadMeta);
els.prevPage.addEventListener("click", () => {
  state.currentPage -= 1;
  renderRows();
});
els.nextPage.addEventListener("click", () => {
  state.currentPage += 1;
  renderRows();
});

loadMeta();
