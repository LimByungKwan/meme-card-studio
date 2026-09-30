"use strict";

const STORAGE_KEY = "memeCardStudio.templates.v2";
const RATIO_SIZES = Object.freeze({
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
});

const state = {
  ratio: "1:1",
  text: "오늘의 한 장면\n짤·카드 스튜디오",
  textX: 50,
  textY: 12,
  fontSize: 60,
  textColor: "#ffffff",
  textAlign: "center",
  image: null,
  imageName: "",
  imageType: "",
  sourceType: "own",
  sourceUrl: "",
  licenseText: "",
  activeTemplateId: null,
};

let templates = [];
let activeImageObjectUrl = null;

const $ = (id) => document.getElementById(id);
const refs = {
  imageInput: $("imageInput"),
  imageInfo: $("imageInfo"),
  captionInput: $("captionInput"),
  textX: $("textX"),
  textY: $("textY"),
  fontSize: $("fontSize"),
  textColor: $("textColor"),
  textAlign: $("textAlign"),
  textXValue: $("textXValue"),
  textYValue: $("textYValue"),
  fontSizeValue: $("fontSizeValue"),
  resetBtn: $("resetBtn"),
  downloadPngBtn: $("downloadPngBtn"),
  downloadJpegBtn: $("downloadJpegBtn"),
  templateName: $("templateName"),
  saveTemplateBtn: $("saveTemplateBtn"),
  updateTemplateBtn: $("updateTemplateBtn"),
  templateList: $("templateList"),
  templateStatus: $("templateStatus"),
  templateCount: $("templateCount"),
  exportJsonBtn: $("exportJsonBtn"),
  importJsonBtn: $("importJsonBtn"),
  jsonFileInput: $("jsonFileInput"),
  sourceUrl: $("sourceUrl"),
  licenseText: $("licenseText"),
  externalSourceFields: $("externalSourceFields"),
  statusMessage: $("statusMessage"),
  ratioInfo: $("ratioInfo"),
  canvasInfo: $("canvasInfo"),
  canvasStage: $("canvasStage"),
  canvas: $("previewCanvas"),
};
const ctx = refs.canvas.getContext("2d", { alpha: false });

function initialize() {
  templates = loadTemplates();
  bindEvents();
  syncControls();
  renderTemplateList();
  drawCanvas();
}

function bindEvents() {
  refs.imageInput.addEventListener("change", handleImageUpload);
  refs.captionInput.addEventListener("input", () => { state.text = refs.captionInput.value; drawCanvas(); });
  refs.textX.addEventListener("input", () => { state.textX = Number(refs.textX.value); refs.textXValue.value = `${state.textX}%`; drawCanvas(); });
  refs.textY.addEventListener("input", () => { state.textY = Number(refs.textY.value); refs.textYValue.value = `${state.textY}%`; drawCanvas(); });
  refs.fontSize.addEventListener("input", () => { state.fontSize = Number(refs.fontSize.value); refs.fontSizeValue.value = `${state.fontSize}px`; drawCanvas(); });
  refs.textColor.addEventListener("input", () => { state.textColor = refs.textColor.value; drawCanvas(); });
  refs.textAlign.addEventListener("change", () => { state.textAlign = refs.textAlign.value; drawCanvas(); });
  refs.resetBtn.addEventListener("click", resetEditor);

  document.querySelectorAll(".ratio-button").forEach((button) => {
    button.addEventListener("click", () => setRatio(button.dataset.ratio));
  });

  refs.downloadPngBtn.addEventListener("click", () => downloadCanvas("image/png"));
  refs.downloadJpegBtn.addEventListener("click", () => downloadCanvas("image/jpeg"));

  refs.saveTemplateBtn.addEventListener("click", createTemplate);
  refs.updateTemplateBtn.addEventListener("click", updateTemplate);
  refs.exportJsonBtn.addEventListener("click", exportTemplates);
  refs.importJsonBtn.addEventListener("click", () => refs.jsonFileInput.click());
  refs.jsonFileInput.addEventListener("change", importTemplates);

  document.querySelectorAll('input[name="sourceType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state.sourceType = radio.value;
      updateSourceFields();
    });
  });
  refs.sourceUrl.addEventListener("input", () => { state.sourceUrl = refs.sourceUrl.value.trim(); });
  refs.licenseText.addEventListener("input", () => { state.licenseText = refs.licenseText.value.trim(); });
}

function resetEditor() {
  state.ratio = "1:1";
  state.text = "오늘의 한 장면\n짤·카드 스튜디오";
  state.textX = 50;
  state.textY = 12;
  state.fontSize = 60;
  state.textColor = "#ffffff";
  state.textAlign = "center";
  state.activeTemplateId = null;
  state.sourceType = "own";
  state.sourceUrl = "";
  state.licenseText = "";
  clearImage();
  refs.templateName.value = "";
  syncControls();
  renderTemplateList();
  drawCanvas();
  setStatus("편집 내용을 초기화했습니다. 저장된 템플릿은 그대로 유지됩니다.", "info");
}

function clearImage() {
  state.image = null;
  state.imageName = "";
  state.imageType = "";
  refs.imageInput.value = "";
  if (activeImageObjectUrl) URL.revokeObjectURL(activeImageObjectUrl);
  activeImageObjectUrl = null;
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const typeResult = await inspectImageType(file);
  if (!typeResult.ok) {
    refs.imageInput.value = "";
    setStatus(`${typeResult.reason} 기존 편집 내용은 유지되었습니다.`, "error");
    return;
  }

  const candidateUrl = URL.createObjectURL(file);
  const candidateImage = new Image();
  candidateImage.decoding = "async";

  candidateImage.onload = () => {
    if (activeImageObjectUrl) URL.revokeObjectURL(activeImageObjectUrl);
    activeImageObjectUrl = candidateUrl;
    state.image = candidateImage;
    state.imageName = file.name;
    state.imageType = typeResult.mime;
    refs.imageInfo.textContent = `현재 이미지: ${file.name} · ${candidateImage.naturalWidth}×${candidateImage.naturalHeight}`;
    drawCanvas();
    setStatus(`${typeResult.label} 이미지를 안전하게 불러왔습니다. 문구 편집이 미리보기에 즉시 반영됩니다.`, "success");
  };

  candidateImage.onerror = () => {
    URL.revokeObjectURL(candidateUrl);
    refs.imageInput.value = "";
    setStatus("이미지 데이터를 해석할 수 없습니다. 파일이 손상되었을 수 있습니다. 기존 작업은 유지되었습니다.", "error");
  };

  candidateImage.src = candidateUrl;
}

async function inspectImageType(file) {
  if (file.size === 0) return { ok: false, reason: "빈 파일은 이미지로 사용할 수 없습니다." };
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng = header.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => header[i] === v);
  const isJpeg = header.length >= 3 && header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (isPng) return { ok: true, mime: "image/png", label: "PNG" };
  if (isJpeg) return { ok: true, mime: "image/jpeg", label: "JPEG" };
  return { ok: false, reason: "지원하지 않는 파일입니다. 실제 PNG 또는 JPEG 파일만 사용할 수 있습니다." };
}

function setRatio(ratio) {
  if (!RATIO_SIZES[ratio]) return;
  state.ratio = ratio;
  document.querySelectorAll(".ratio-button").forEach((button) => button.classList.toggle("is-active", button.dataset.ratio === ratio));
  drawCanvas();
}

function drawCanvas() {
  const { width, height } = RATIO_SIZES[state.ratio];
  if (refs.canvas.width !== width) refs.canvas.width = width;
  if (refs.canvas.height !== height) refs.canvas.height = height;
  refs.ratioInfo.textContent = state.ratio;
  refs.canvasInfo.textContent = `${width} × ${height}`;
  refs.canvasStage.dataset.ratio = state.ratio;

  ctx.save();
  ctx.fillStyle = "#e7ebf2";
  ctx.fillRect(0, 0, width, height);
  if (state.image) drawImageCover(state.image, width, height);
  else drawPlaceholder(width, height);
  drawCaption(width, height);
  ctx.restore();
}

function drawImageCover(image, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sx = 0, sy = 0, sw = image.naturalWidth, sh = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function drawPlaceholder(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#9ea7ff");
  gradient.addColorStop(1, "#564ce9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const circles = [[.14,.18,.09],[.84,.14,.06],[.72,.78,.13],[.18,.82,.07],[.52,.43,.04]];
  ctx.fillStyle = "rgba(255,255,255,.13)";
  circles.forEach(([x,y,r]) => {
    ctx.beginPath();
    ctx.arc(width * x, height * y, Math.min(width, height) * r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(255,255,255,.82)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(Math.min(width,height)*0.044)}px ${fontStack()}`;
  ctx.fillText("PNG / JPEG 이미지를 불러오세요", width / 2, height * .58);
}

function drawCaption(width, height) {
  const rawText = String(state.text ?? "");
  if (!rawText) return;

  const margin = Math.round(width * .055);
  const requestedX = (state.textX / 100) * width;
  const x = clamp(requestedX, margin, width - margin);
  const requestedY = (state.textY / 100) * height;
  const fontSize = clamp(Number(state.fontSize) || 60, 16, 140);
  const lineHeight = Math.round(fontSize * 1.27);

  ctx.font = `800 ${fontSize}px ${fontStack()}`;
  ctx.textAlign = state.textAlign;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, Math.round(fontSize * .085));
  ctx.strokeStyle = "rgba(0,0,0,.72)";
  ctx.fillStyle = state.textColor;

  const maxWidth = calculateTextWidthLimit(width, margin, x, state.textAlign);
  const lines = wrapText(ctx, rawText, maxWidth);
  const totalHeight = lines.length * lineHeight;
  const y = clamp(requestedY, margin, Math.max(margin, height - margin - totalHeight));

  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    ctx.strokeText(line, x, lineY, maxWidth);
    ctx.fillText(line, x, lineY, maxWidth);
  });
}

function calculateTextWidthLimit(width, margin, x, align) {
  if (align === "left") return Math.max(80, width - margin - x);
  if (align === "right") return Math.max(80, x - margin);
  return Math.max(80, 2 * Math.min(x - margin, width - margin - x));
}

function wrapText(context, text, maxWidth) {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const lines = [];
  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const graphemes = segmentGraphemes(paragraph);
    let line = "";
    for (const grapheme of graphemes) {
      const candidate = line + grapheme;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = grapheme;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

function segmentGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((entry) => entry.segment);
  }
  return Array.from(text);
}

function fontStack() {
  return '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", Arial, sans-serif';
}

function downloadCanvas(mimeType) {
  if (!state.image) {
    setStatus("완성 이미지로 저장하려면 먼저 PNG/JPEG 이미지를 불러오세요.", "error");
    return;
  }
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const ratioSlug = state.ratio.replace(":", "x");
  refs.canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("파일을 생성하지 못했습니다. 다시 시도해 주세요.", "error");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meme-card-${ratioSlug}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStatus(`${extension.toUpperCase()} 완성 이미지를 저장했습니다. 미리보기와 동일한 Canvas를 사용했습니다.`, "success");
  }, mimeType, mimeType === "image/jpeg" ? .92 : undefined);
}

function getTemplatePayload() {
  return {
    ratio: state.ratio,
    text: state.text,
    textX: state.textX,
    textY: state.textY,
    fontSize: state.fontSize,
    textColor: state.textColor,
    textAlign: state.textAlign,
    sourceType: state.sourceType,
    sourceUrl: state.sourceUrl,
    licenseText: state.licenseText,
  };
}

function createTemplate() {
  const name = refs.templateName.value.trim();
  if (!name) return setStatus("템플릿 이름을 입력해 주세요.", "error");
  const now = new Date().toISOString();
  const template = { id: makeId(), name, ...getTemplatePayload(), createdAt: now, updatedAt: now };
  templates.push(template);
  state.activeTemplateId = template.id;
  persistTemplates();
  renderTemplateList();
  syncTemplateStatus();
  setStatus(`템플릿 “${name}”을 새로 저장했습니다. 새로고침 후에도 유지됩니다.`, "success");
}

function updateTemplate() {
  if (!state.activeTemplateId) return setStatus("수정할 템플릿을 먼저 불러와 주세요.", "error");
  const name = refs.templateName.value.trim();
  if (!name) return setStatus("템플릿 이름을 입력해 주세요.", "error");
  const index = templates.findIndex((item) => item.id === state.activeTemplateId);
  if (index < 0) return setStatus("선택된 템플릿을 찾지 못했습니다.", "error");
  templates[index] = { ...templates[index], name, ...getTemplatePayload(), updatedAt: new Date().toISOString() };
  persistTemplates();
  renderTemplateList();
  syncTemplateStatus();
  setStatus(`템플릿 “${name}”을 수정했습니다. 안정된 ID로 같은 템플릿을 갱신했습니다.`, "success");
}

function loadTemplate(id) {
  const template = templates.find((item) => item.id === id);
  if (!template) return setStatus("불러올 템플릿을 찾지 못했습니다.", "error");
  state.activeTemplateId = template.id;
  state.ratio = template.ratio;
  state.text = template.text;
  state.textX = template.textX;
  state.textY = template.textY;
  state.fontSize = template.fontSize;
  state.textColor = template.textColor;
  state.textAlign = template.textAlign;
  state.sourceType = template.sourceType;
  state.sourceUrl = template.sourceUrl || "";
  state.licenseText = template.licenseText || "";
  refs.templateName.value = template.name;
  syncControls();
  renderTemplateList();
  drawCanvas();
  setStatus(`템플릿 “${template.name}”을 불러왔습니다.`, "success");
}

function deleteTemplate(id) {
  const template = templates.find((item) => item.id === id);
  if (!template) return setStatus("삭제할 템플릿을 찾지 못했습니다.", "error");
  if (!window.confirm(`“${template.name}” 템플릿을 삭제할까요?`)) return;
  templates = templates.filter((item) => item.id !== id);
  if (state.activeTemplateId === id) {
    state.activeTemplateId = null;
    refs.templateName.value = "";
  }
  persistTemplates();
  renderTemplateList();
  syncTemplateStatus();
  setStatus(`템플릿 “${template.name}”을 삭제했습니다.`, "success");
}

function renderTemplateList() {
  refs.templateList.replaceChildren();
  refs.templateCount.textContent = `${templates.length}개`;
  if (!templates.length) {
    const li = document.createElement("li");
    li.className = "template-empty";
    li.textContent = "저장된 템플릿이 없습니다.";
    refs.templateList.append(li);
    return;
  }
  templates.forEach((template) => {
    const li = document.createElement("li");
    li.className = `template-item${template.id === state.activeTemplateId ? " is-active" : ""}`;

    const name = document.createElement("div");
    name.className = "template-name";
    name.textContent = template.name;

    const detail = document.createElement("div");
    detail.className = "template-detail";
    detail.textContent = `${template.ratio} · ${template.fontSize}px · ${template.textAlign}`;

    const actions = document.createElement("div");
    actions.className = "template-actions";
    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "불러오기";
    load.addEventListener("click", () => loadTemplate(template.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => deleteTemplate(template.id));
    actions.append(load, remove);
    li.append(name, detail, actions);
    refs.templateList.append(li);
  });
}

function persistTemplates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
function loadTemplates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isStoredTemplateUsable) : [];
  } catch {
    return [];
  }
}
function isStoredTemplateUsable(item) {
  return item && typeof item.id === "string" && typeof item.name === "string" && RATIO_SIZES[item.ratio];
}

function exportTemplates() {
  const payload = { version: 1, app: "meme-card-studio", exportedAt: new Date().toISOString(), templates };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meme-card-templates.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus(`템플릿 ${templates.length}개를 JSON으로 내보냈습니다.`, "success");
}

function importTemplates(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const validated = validateImportPayload(parsed);
      templates = validated;
      persistTemplates();
      if (state.activeTemplateId && !templates.some((item) => item.id === state.activeTemplateId)) state.activeTemplateId = null;
      renderTemplateList();
      syncTemplateStatus();
      setStatus(`정상 JSON을 확인한 뒤 템플릿 ${validated.length}개를 복원했습니다.`, "success");
    } catch (error) {
      setStatus(`${error.message} 기존 템플릿은 변경하지 않았습니다.`, "error");
    } finally {
      refs.jsonFileInput.value = "";
    }
  };
  reader.onerror = () => {
    refs.jsonFileInput.value = "";
    setStatus("JSON 파일을 읽지 못했습니다. 기존 템플릿은 변경하지 않았습니다.", "error");
  };
  reader.readAsText(file, "utf-8");
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("JSON 최상위 형식이 올바르지 않습니다.");
  if (payload.version !== 1) throw new Error("지원하지 않는 JSON 버전입니다.");
  if (!Array.isArray(payload.templates)) throw new Error("필수 항목 templates 배열이 없습니다.");
  const seen = new Set();
  return payload.templates.map((item, index) => validateTemplate(item, index, seen));
}

function validateTemplate(item, index, seen) {
  const label = `템플릿 ${index + 1}`;
  if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label} 데이터가 객체가 아닙니다.`);
  const stringFields = ["id", "name", "ratio", "text", "textColor", "textAlign", "sourceType"];
  const numberFields = ["textX", "textY", "fontSize"];
  for (const field of stringFields) if (typeof item[field] !== "string") throw new Error(`${label}의 필수 항목 ${field}가 누락되었거나 형식이 잘못되었습니다.`);
  for (const field of numberFields) if (!Number.isFinite(item[field])) throw new Error(`${label}의 필수 항목 ${field}가 누락되었거나 숫자가 아닙니다.`);
  if (!item.id || seen.has(item.id)) throw new Error(`${label}의 ID가 비어 있거나 중복되었습니다.`);
  seen.add(item.id);
  if (!item.name.trim() || item.name.length > 120) throw new Error(`${label}의 이름 길이가 올바르지 않습니다.`);
  if (!RATIO_SIZES[item.ratio]) throw new Error(`${label}의 화면비가 허용되지 않습니다.`);
  if (item.text.length > 2000) throw new Error(`${label}의 문구가 너무 깁니다.`);
  if (!(item.textX >= 0 && item.textX <= 100 && item.textY >= 0 && item.textY <= 100)) throw new Error(`${label}의 문구 위치가 허용 범위를 벗어났습니다.`);
  if (!(item.fontSize >= 16 && item.fontSize <= 140)) throw new Error(`${label}의 글자 크기가 허용 범위를 벗어났습니다.`);
  if (!/^#[0-9a-fA-F]{6}$/.test(item.textColor)) throw new Error(`${label}의 색상 값이 올바르지 않습니다.`);
  if (!new Set(["left","center","right"]).has(item.textAlign)) throw new Error(`${label}의 정렬 값이 올바르지 않습니다.`);
  if (!new Set(["own","external"]).has(item.sourceType)) throw new Error(`${label}의 출처 유형이 올바르지 않습니다.`);
  if (item.sourceType === "external") {
    if (typeof item.sourceUrl !== "string" || !item.sourceUrl.trim()) throw new Error(`${label}의 외부 이미지 원본 URL이 없습니다.`);
    if (typeof item.licenseText !== "string" || !item.licenseText.trim()) throw new Error(`${label}의 사용 허가 근거가 없습니다.`);
  }
  return {
    id: item.id,
    name: item.name,
    ratio: item.ratio,
    text: item.text,
    textX: item.textX,
    textY: item.textY,
    fontSize: item.fontSize,
    textColor: item.textColor,
    textAlign: item.textAlign,
    sourceType: item.sourceType,
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : "",
    licenseText: typeof item.licenseText === "string" ? item.licenseText : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
  };
}

function syncControls() {
  refs.captionInput.value = state.text;
  refs.textX.value = state.textX;
  refs.textY.value = state.textY;
  refs.fontSize.value = state.fontSize;
  refs.textColor.value = state.textColor;
  refs.textAlign.value = state.textAlign;
  refs.textXValue.value = `${state.textX}%`;
  refs.textYValue.value = `${state.textY}%`;
  refs.fontSizeValue.value = `${state.fontSize}px`;
  refs.sourceUrl.value = state.sourceUrl;
  refs.licenseText.value = state.licenseText;
  document.querySelectorAll('input[name="sourceType"]').forEach((radio) => radio.checked = radio.value === state.sourceType);
  document.querySelectorAll(".ratio-button").forEach((button) => button.classList.toggle("is-active", button.dataset.ratio === state.ratio));
  refs.imageInfo.textContent = state.imageName ? `현재 이미지: ${state.imageName}` : "현재 이미지: 없음";
  updateSourceFields();
  syncTemplateStatus();
}
function syncTemplateStatus() {
  const selected = templates.find((item) => item.id === state.activeTemplateId);
  refs.templateStatus.textContent = `선택된 템플릿: ${selected ? selected.name : "없음"}`;
}
function updateSourceFields() { refs.externalSourceFields.hidden = state.sourceType !== "external"; }
function setStatus(message, kind = "info") { refs.statusMessage.textContent = message; refs.statusMessage.className = `status status--${kind}`; }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function makeId() { return crypto.randomUUID ? crypto.randomUUID() : `tmpl-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

initialize();
