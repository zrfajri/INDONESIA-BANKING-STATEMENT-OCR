import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function convertPdfToImages(file: File, password?: string): Promise<{ data: string; mimeType: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password,
    });
    const pdf = await loadingTask.promise;
    
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not get canvas context");
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      } as any).promise;
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const base64Data = dataUrl.split(",")[1];
      
      images.push({
        data: base64Data,
        mimeType: "image/jpeg",
      });
    }
    
    return images;
  } catch (error: any) {
    if (error.name === "PasswordException") {
      throw new Error("PASSWORD_REQUIRED");
    }
    throw error;
  }
}

export async function convertImageToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1];
      resolve({
        data: base64Data,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
