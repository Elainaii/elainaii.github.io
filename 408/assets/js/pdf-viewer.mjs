import { getDocument, GlobalWorkerOptions } from '../vendor/pdfjs/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const params = new URLSearchParams(location.search);
const kind = params.get('kind') === 'answer' ? 'answers' : 'questions';
const pdfUrl = new URL(`../pdfs/${kind}.pdf`, import.meta.url).href;
const status = document.getElementById('status');
const canvas = document.getElementById('pdf-canvas');
const scroll = document.getElementById('pdf-scroll');
const pageInput = document.getElementById('page-number');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const fitWidth = document.getElementById('fit-width');
const original = document.getElementById('original');
let pdf, pageNumber = Math.max(1, Math.trunc(Number(params.get('page'))) || 1);
let zoom = 1, renderTask = null, generation = 0, queue = Promise.resolve();

function updateControls() {
  pageInput.value = pageNumber;
  pageInput.max = pdf.numPages;
  pageInput.disabled = false;
  document.getElementById('page-total').textContent = `/ ${pdf.numPages} 页`;
  document.getElementById('jump').disabled = false;
  previous.disabled = pageNumber <= 1;
  next.disabled = pageNumber >= pdf.numPages;
  zoomOut.disabled = zoom <= .5;
  zoomIn.disabled = zoom >= 3;
  fitWidth.disabled = false;
  document.getElementById('zoom-level').textContent = `${Math.round(zoom * 100)}%`;
  original.href = `${pdfUrl}#page=${pageNumber}`;
}
function showError(error) {
  status.className = 'error';
  status.textContent = `原页加载失败：${error.message || error}。可点击“打开原文件”查看。`;
}
async function renderPage(request) {
  if (request !== generation) return;
  const page = await pdf.getPage(pageNumber);
  if (request !== generation) return;
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(160, scroll.clientWidth - 24) / base.width * zoom;
  const viewport = page.getViewport({ scale });
  // Limit backing pixels for large pages on mobile browsers.
  const ratio = Math.min(window.devicePixelRatio || 1, 2,
    Math.sqrt(16000000 / (viewport.width * viewport.height)));
  canvas.width = Math.ceil(viewport.width * ratio);
  canvas.height = Math.ceil(viewport.height * ratio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  canvas.hidden = true;
  renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport,
    transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0], background: '#fff' });
  await renderTask.promise;
  if (request !== generation) return;
  canvas.hidden = false;
  canvas.setAttribute('aria-label', `PDF 第 ${pageNumber} 页，共 ${pdf.numPages} 页`);
  canvas.setAttribute('role', 'img');
  status.className = '';
  status.textContent = `第 ${pageNumber} / ${pdf.numPages} 页 · 可翻页、输入页码或缩放查看`;
  renderTask = null;
}
function requestRender(resetScroll = false) {
  if (!pdf) return;
  const request = ++generation;
  renderTask?.cancel();
  canvas.hidden = true;
  status.className = '';
  status.textContent = `正在显示第 ${pageNumber} 页…`;
  updateControls();
  if (resetScroll) scroll.scrollTo({ top: 0, left: 0 });
  queue = queue.catch(() => {}).then(() => renderPage(request)).catch(error => {
    if (request === generation && error.name !== 'RenderingCancelledException') showError(error);
  });
}
function goToPage(value) {
  if (!pdf) return;
  const target = Number(value);
  if (!Number.isFinite(target)) { pageInput.value = pageNumber; return; }
  pageNumber = Math.min(pdf.numPages, Math.max(1, Math.trunc(target)));
  requestRender(true);
}
previous.addEventListener('click', () => goToPage(pageNumber - 1));
next.addEventListener('click', () => goToPage(pageNumber + 1));
document.getElementById('page-form').addEventListener('submit', event => {
  event.preventDefault(); goToPage(pageInput.value);
});
zoomIn.addEventListener('click', () => { zoom = Math.min(3, +(zoom + .25).toFixed(2)); requestRender(); });
zoomOut.addEventListener('click', () => { zoom = Math.max(.5, +(zoom - .25).toFixed(2)); requestRender(); });
fitWidth.addEventListener('click', () => { zoom = 1; requestRender(); });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => requestRender(), 120); });
original.href = `${pdfUrl}#page=${pageNumber}`;
try {
  const loading = getDocument({ url: pdfUrl,
    cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href, cMapPacked: true,
    useWasm: false, isEvalSupported: false, useSystemFonts: true });
  pdf = await loading.promise;
  pageNumber = Math.min(pageNumber, pdf.numPages);
  requestRender(true);
} catch (error) { showError(error); }
