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
  nextContentId: "C001"
};

const els = {
  form: document.querySelector("#queueForm"),
  caption: document.querySelector("#caption"),
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
  nextIds: document.querySelector("#nextIds")
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
    els.queueBody.innerHTML = `<tr><td colspan="8" class="empty-state">ยังไม่มีข้อมูล หรือยังไม่ได้เชื่อมต่อ API</td></tr>`;
    return;
  }

  els.queueBody.innerHTML = state.rows.slice(0, 80).map((row) => `
    <tr>
      <td>${escapeHtml(row.row_id)}</td>
      <td>${escapeHtml(row.content_id)}</td>
      <td><div class="caption-cell">${escapeHtml(row.caption)}</div></td>
      <td>${escapeHtml(row.media_type)}</td>
      <td>${escapeHtml(row.page_name)}</td>
      <td>${escapeHtml(row.scheduled_at)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.publish_mode)}</td>
    </tr>
  `).join("");
}

function selectedPages() {
  return Array.from(document.querySelectorAll('input[name="page_name"]:checked')).map((input) => input.value);
}

function toBangkokIso(datetimeLocal) {
  if (!datetimeLocal) return "";
  return `${datetimeLocal}:00+07:00`;
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
      action: "create",
      caption: els.caption.value.trim(),
      media_type: inferMediaType(file),
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
    renderRows();
    els.form.reset();
    renderPages();
    els.filePreview.textContent = "ยังไม่ได้เลือกไฟล์";
    setMessage(`บันทึกสำเร็จ ${result.created || pages.length} บรรทัด`);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    els.submitButton.disabled = false;
    els.submitButton.textContent = "บันทึกลงชีต";
  }
}

els.mediaFile.addEventListener("change", () => {
  const file = els.mediaFile.files[0];
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

els.form.addEventListener("submit", handleSubmit);
els.refreshButton.addEventListener("click", loadMeta);
els.reloadTable.addEventListener("click", loadMeta);

loadMeta();
