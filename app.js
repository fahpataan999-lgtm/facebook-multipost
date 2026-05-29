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
const PAGE_SIZE = 15;
const state = { pages: FALLBACK_PAGES, rows: [], currentPage: 1, nextRowId: 1, nextContentId: "C001", blockCount: 0, editingRowId: null };
const els = {
  form: document.querySelector("#queueForm"), contentBlocks: document.querySelector("#contentBlocks"), addContentBlock: document.querySelector("#addContentBlock"), submitButton: document.querySelector("#submitButton"), refreshButton: document.querySelector("#refreshButton"), reloadTable: document.querySelector("#reloadTable"), queueList: document.querySelector("#queueList"), apiState: document.querySelector("#apiState"), formMessage: document.querySelector("#formMessage"), totalRows: document.querySelector("#totalRows"), nextIds: document.querySelector("#nextIds"), pageRange: document.querySelector("#pageRange"), pageIndicator: document.querySelector("#pageIndicator"), prevPage: document.querySelector("#prevPage"), nextPage: document.querySelector("#nextPage"), lightbox: document.querySelector("#mediaLightbox"), lightboxMedia: document.querySelector("#lightboxMedia"), closeLightbox: document.querySelector("#closeLightbox")
};
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function normalizeValue(value) { return String(value ?? "").trim().toUpperCase(); }
function isEditableRow(row) { const status = normalizeValue(row.status); return normalizeValue(row.publish_mode) === "SCHEDULED" && ["READY", "SCHEDULED"].includes(status); }
function setApiState(text, mode = "") { els.apiState.textContent = text; els.apiState.className = `status-pill ${mode}`.trim(); }
function setMessage(text, isError = false) { els.formMessage.textContent = text; els.formMessage.classList.toggle("error", isError); }
function renderPageOptions(selected = []) { const selectedSet = new Set(selected); return state.pages.map((page, index) => { const checked = selectedSet.size ? selectedSet.has(page) : index === 0; return `<label class="page-option"><input type="checkbox" name="page_name" value="${escapeHtml(page)}" ${checked ? "checked" : ""} /><span>${escapeHtml(page)}</span></label>`; }).join(""); }
function getBlockPages(block) { return Array.from(block.querySelectorAll('input[name="page_name"]:checked')).map((input) => input.value); }
function addContentBlock(values = {}) {
  state.blockCount += 1;
  const id = state.blockCount;
  const block = document.createElement("section");
  block.className = "content-block";
  block.dataset.blockId = String(id);
  block.dataset.uploadedIds = values.drive_file_id || "";
  block.dataset.uploadedLinks = values.link || "";
  block.innerHTML = `
    <div class="content-block-head"><div><p class="eyebrow">New content</p><h3>รายการโพสต์ที่ ${id}</h3></div><button type="button" class="icon-button remove-block" aria-label="ลบ New content">×</button></div>
    <label class="field field-full"><span>Caption</span><textarea class="caption-input" rows="7" placeholder="วางข้อความโพสต์ที่นี่" required>${escapeHtml(values.caption || "")}</textarea></label>
    <div class="field-grid"><label class="field"><span>Publish mode</span><select class="publish-mode" required><option value="SCHEDULED" ${values.publish_mode !== "NOW" ? "selected" : ""}>SCHEDULED</option><option value="NOW" ${values.publish_mode === "NOW" ? "selected" : ""}>NOW</option></select></label><label class="field"><span>Scheduled at</span><input class="scheduled-at" type="datetime-local" value="${escapeHtml(toDateTimeLocal(values.scheduled_at))}" /></label></div>
    <div class="upload-box"><label class="field"><span>Media type</span><select class="media-type" required><option value="text" ${values.media_type === "text" || !values.media_type ? "selected" : ""}>text</option><option value="photo" ${values.media_type === "photo" ? "selected" : ""}>photo</option><option value="video" ${values.media_type === "video" ? "selected" : ""}>video</option></select></label><label class="upload-action"><input class="media-file" type="file" accept="image/*,video/*" /><span>เลือกไฟล์</span></label><div class="file-preview">${values.drive_file_id ? `ใช้ไฟล์เดิม: ${escapeHtml(values.drive_file_id)}` : "ยังไม่ได้เลือกไฟล์"}</div><label class="field"><span>drive_file_id</span><input class="drive-file-id" type="text" value="${escapeHtml(values.drive_file_id || "")}" readonly /></label></div>
    <section class="page-picker" aria-label="Page name"><div class="picker-head"><span class="field-title">Page name</span><button class="ghost-button toggle-pages" type="button">เลือกทั้งหมด</button></div><div class="page-list">${renderPageOptions(values.page_name ? [values.page_name] : values.page_names || [])}</div></section>
    <div class="locked-fields"><div><span>Timezone</span><strong>Asia/Bangkok</strong></div><div><span>Status</span><strong>READY</strong></div></div>`;
  els.contentBlocks.appendChild(block);
  syncMediaInput(block);
}
function resetContentBlocks(values = null) { els.contentBlocks.innerHTML = ""; state.blockCount = 0; addContentBlock(values || {}); updateRemoveButtons(); }
function updateAllPagePickers() { getBlocks().forEach((block) => { const selected = getBlockPages(block); block.querySelector(".page-list").innerHTML = renderPageOptions(selected); }); }
function updateRemoveButtons() { const blocks = getBlocks(); blocks.forEach((block) => { block.querySelector(".remove-block").disabled = blocks.length === 1 || Boolean(state.editingRowId); }); }
function getBlocks() { return Array.from(document.querySelectorAll(".content-block")); }
function syncMediaInput(block) { const mediaType = block.querySelector(".media-type").value; const input = block.querySelector(".media-file"); input.multiple = mediaType === "photo"; input.accept = mediaType === "photo" ? "image/*" : mediaType === "video" ? "video/*" : "image/*,video/*"; }
function renderRows() {
  els.totalRows.textContent = String(state.rows.length);
  els.nextIds.textContent = `${state.nextRowId} / ${state.nextContentId}`;
  if (!state.rows.length) { els.queueList.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูล หรือยังไม่ได้เชื่อมต่อ API</div>`; renderPagination(0, 0, 0); return; }
  const pageCount = Math.max(Math.ceil(state.rows.length / PAGE_SIZE), 1);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), pageCount);
  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageRows = state.rows.slice(start, start + PAGE_SIZE);
  els.queueList.innerHTML = pageRows.map((row) => { const hasMedia = getMediaItems(row).length > 0; return `<article class="queue-card"><div class="queue-main"><div class="queue-caption">${escapeHtml(row.caption)}</div><div class="queue-meta"><span>row ${escapeHtml(row.row_id)}</span><span>${escapeHtml(row.content_id)}</span><span>${escapeHtml(row.media_type || "text")}</span><span>${escapeHtml(row.page_name)}</span><span>${escapeHtml(row.scheduled_at)}</span></div></div><div class="queue-status"><strong>${escapeHtml(row.status)}</strong><span>${escapeHtml(row.publish_mode)}</span></div><div class="queue-actions"><button type="button" class="table-action" data-view-media="${escapeHtml(row.row_id)}" ${hasMedia ? "" : "disabled"}>ดูสื่อ</button>${isEditableRow(row) ? `<button type="button" class="table-action" data-edit-row="${escapeHtml(row.row_id)}">แก้ไข</button>` : ""}</div></article>`; }).join("");
  renderPagination(start + 1, start + pageRows.length, pageCount);
}
function renderPagination(start, end, pageCount) { els.pageRange.textContent = state.rows.length ? `${start}-${end} / ${state.rows.length}` : "0 / 0"; els.pageIndicator.textContent = state.rows.length ? `หน้า ${state.currentPage} / ${pageCount}` : "หน้า 0 / 0"; els.prevPage.disabled = state.currentPage <= 1 || !state.rows.length; els.nextPage.disabled = state.currentPage >= pageCount || !state.rows.length; }
function toBangkokIso(datetimeLocal) { return datetimeLocal ? `${datetimeLocal}:00+07:00` : ""; }
function toDateTimeLocal(isoText) { const match = String(isoText || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/); return match ? `${match[1]}T${match[2]}` : ""; }
function readFileAsBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const result = String(reader.result || ""); resolve(result.includes(",") ? result.split(",")[1] : result); }; reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
async function filesToPayloads(files) { return Promise.all(files.map(async (file) => ({ name: file.name, mimeType: file.type || "application/octet-stream", base64: await readFileAsBase64(file) }))); }
async function collectEntries() {
  const entries = [];
  for (const block of getBlocks()) {
    const caption = block.querySelector(".caption-input").value.trim();
    const publishMode = block.querySelector(".publish-mode").value;
    const scheduledAt = block.querySelector(".scheduled-at").value;
    const mediaType = block.querySelector(".media-type").value;
    const files = Array.from(block.querySelector(".media-file").files || []);
    const uploadedIds = block.dataset.uploadedIds || "";
    const uploadedLinks = block.dataset.uploadedLinks || "";
    const pageNames = getBlockPages(block);
    if (!caption) throw new Error("กรุณากรอก Caption ให้ครบทุกฟอร์ม");
    if (!pageNames.length) throw new Error("กรุณาเลือกอย่างน้อย 1 เพจให้ครบทุกฟอร์ม");
    if (publishMode === "SCHEDULED" && !scheduledAt) throw new Error("กรุณาเลือกวันเวลาให้รายการ SCHEDULED");
    if (mediaType === "video" && files.length > 1) throw new Error("วิดีโอเลือกได้ครั้งละ 1 ไฟล์");
    entries.push({ caption, page_names: pageNames, media_type: mediaType, scheduled_at: toBangkokIso(scheduledAt), publish_mode: publishMode, uploaded_ids: uploadedIds, uploaded_links: uploadedLinks, uploaded_files: uploadedIds ? uploadedIds.split(",").map((fileId, index) => ({ id: fileId.trim(), url: (uploadedLinks.split(",")[index] || "").trim(), mediaType })) : [], files: uploadedIds ? [] : await filesToPayloads(mediaType === "photo" ? files : files.slice(0, 1)) });
  }
  return entries;
}
async function uploadSelectedFiles(block, files) {
  const mediaType = block.querySelector(".media-type").value;
  const driveInput = block.querySelector(".drive-file-id");
  const preview = block.querySelector(".file-preview");
  if (!files.length) { block.dataset.uploadedIds = ""; block.dataset.uploadedLinks = ""; driveInput.value = ""; return; }
  if (!API_URL) { preview.textContent = "ยังไม่ได้ตั้งค่า API จึงยังอัปโหลดไม่ได้"; return; }
  preview.textContent = "กำลังอัปโหลดไฟล์...";
  const payloadFiles = await filesToPayloads(mediaType === "photo" ? files : files.slice(0, 1));
  const result = await apiRequest({ action: "upload", files: payloadFiles });
  block.dataset.uploadedIds = result.drive_file_id || "";
  block.dataset.uploadedLinks = result.link || "";
  driveInput.value = result.drive_file_id || "";
  preview.textContent = result.drive_file_id ? `อัปโหลดแล้ว: ${result.drive_file_id}` : "อัปโหลดแล้ว แต่ไม่พบ ID ไฟล์";
}
async function apiRequest(payload) { if (!API_URL) throw new Error("ยังไม่ได้ตั้งค่า apiUrl ใน config.js"); const response = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok || data.ok === false) throw new Error(data.error || "บันทึกไม่สำเร็จ"); return data; }
async function loadMeta() {
  if (!API_URL) { setApiState("รอตั้งค่า API", "warn"); resetContentBlocks(); renderRows(); return; }
  try { setApiState("กำลังโหลด", "warn"); const data = await apiRequest({ action: "list" }); state.pages = data.pages?.length ? data.pages : FALLBACK_PAGES; state.rows = data.rows || []; state.nextRowId = data.nextRowId || 1; state.nextContentId = data.nextContentId || "C001"; state.currentPage = 1; updateAllPagePickers(); renderRows(); setApiState("เชื่อมต่อแล้ว", "ready"); }
  catch (error) { setApiState("เชื่อมต่อไม่ได้", "warn"); setMessage(error.message, true); updateAllPagePickers(); renderRows(); }
}
async function handleSubmit(event) {
  event.preventDefault(); setMessage(""); els.submitButton.disabled = true; els.submitButton.textContent = "กำลังบันทึก...";
  try { const entries = await collectEntries(); const payload = { action: state.editingRowId ? "update" : "create", row_id: state.editingRowId, entries }; const result = await apiRequest(payload); state.rows = result.rows || state.rows; state.nextRowId = result.nextRowId || state.nextRowId; state.nextContentId = result.nextContentId || state.nextContentId; state.currentPage = 1; state.editingRowId = null; renderRows(); resetContentBlocks(); setMessage(result.updated ? "แก้ไขสำเร็จ" : `บันทึกสำเร็จ ${result.created || 0} บรรทัด`); }
  catch (error) { setMessage(error.message, true); }
  finally { els.submitButton.disabled = false; els.submitButton.textContent = "บันทึกลงชีต"; updateRemoveButtons(); }
}
function getMediaItems(row) { const ids = String(row.drive_file_id || "").split(",").map((item) => item.trim()).filter(Boolean); const links = String(row.link || "").split(",").map((item) => item.trim()).filter(Boolean); const count = Math.max(ids.length, links.length); return Array.from({ length: count }, (_, index) => ({ id: ids[index] || "", link: links[index] || "" })).filter((item) => item.id || item.link); }
function openLightbox(row) { const items = getMediaItems(row); els.lightboxMedia.innerHTML = items.length ? items.map((item) => { const preview = item.id ? `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview` : item.link; return `<div class="lightbox-item"><iframe src="${escapeHtml(preview)}" allow="autoplay" loading="lazy"></iframe>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">เปิดไฟล์ต้นฉบับ</a>` : ""}</div>`; }).join("") : `<div class="empty-state">ไม่มีสื่อสำหรับรายการนี้</div>`; els.lightbox.classList.add("open"); els.lightbox.setAttribute("aria-hidden", "false"); }
function closeLightbox() { els.lightbox.classList.remove("open"); els.lightbox.setAttribute("aria-hidden", "true"); els.lightboxMedia.innerHTML = ""; }
els.contentBlocks.addEventListener("change", async (event) => {
  const block = event.target.closest(".content-block"); if (!block) return;
  if (event.target.matches(".media-type")) { syncMediaInput(block); block.querySelector(".media-file").value = ""; block.dataset.uploadedIds = ""; block.dataset.uploadedLinks = ""; block.querySelector(".drive-file-id").value = ""; block.querySelector(".file-preview").textContent = "ยังไม่ได้เลือกไฟล์"; }
  if (event.target.matches(".media-file")) { const files = Array.from(event.target.files || []); const mediaType = block.querySelector(".media-type").value; if (mediaType === "video" && files.length > 1) { event.target.value = ""; block.querySelector(".file-preview").textContent = "วิดีโอเลือกได้ 1 ไฟล์"; return; } block.querySelector(".file-preview").textContent = files.length ? files.map((file) => `${file.name} (${Math.ceil(file.size / 1024).toLocaleString()} KB)`).join(", ") : "ยังไม่ได้เลือกไฟล์"; try { await uploadSelectedFiles(block, files); } catch (error) { block.dataset.uploadedIds = ""; block.dataset.uploadedLinks = ""; block.querySelector(".drive-file-id").value = ""; block.querySelector(".file-preview").textContent = error.message; } }
});
els.contentBlocks.addEventListener("click", (event) => { const removeButton = event.target.closest(".remove-block"); if (removeButton && !removeButton.disabled) { removeButton.closest(".content-block").remove(); updateRemoveButtons(); return; } const toggleButton = event.target.closest(".toggle-pages"); if (!toggleButton) return; const block = toggleButton.closest(".content-block"); const boxes = Array.from(block.querySelectorAll('input[name="page_name"]')); const shouldCheck = boxes.some((box) => !box.checked); boxes.forEach((box) => { box.checked = shouldCheck; }); toggleButton.textContent = shouldCheck ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"; });
els.addContentBlock.addEventListener("click", () => { addContentBlock(); updateRemoveButtons(); });
els.queueList.addEventListener("click", (event) => { const mediaButton = event.target.closest("[data-view-media]"); if (mediaButton) { const row = state.rows.find((item) => String(item.row_id) === String(mediaButton.dataset.viewMedia)); if (row) openLightbox(row); return; } const editButton = event.target.closest("[data-edit-row]"); if (!editButton) return; const row = state.rows.find((item) => String(item.row_id) === String(editButton.dataset.editRow)); if (!row) return; state.editingRowId = row.row_id; resetContentBlocks(row); els.submitButton.textContent = "บันทึกการแก้ไข"; setMessage(`กำลังแก้ไข row ${row.row_id}`); els.form.scrollIntoView({ behavior: "smooth", block: "start" }); });
els.form.addEventListener("submit", handleSubmit); els.refreshButton.addEventListener("click", loadMeta); els.reloadTable.addEventListener("click", loadMeta); els.prevPage.addEventListener("click", () => { state.currentPage -= 1; renderRows(); }); els.nextPage.addEventListener("click", () => { state.currentPage += 1; renderRows(); }); els.closeLightbox.addEventListener("click", closeLightbox); els.lightbox.addEventListener("click", (event) => { if (event.target === els.lightbox) closeLightbox(); }); document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeLightbox(); });
resetContentBlocks();
loadMeta();
