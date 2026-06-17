export async function pdfToImageBlob(pdfUrl, scale = 2) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const pdf  = await pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png');
  });
}
