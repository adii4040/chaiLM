import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import path from "node:path";

/**
 * Loads a PDF file and extracts its page content as LangChain Documents
 * @param {string} filePath - Absolute or relative local path to the uploaded PDF file
 * @param {string} [originalName] - Original uploaded filename
 * @returns {Promise<Array>} Array of LangChain Document objects
 */
export async function loadPDF(filePath, originalName) {
  try {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    const title = originalName || path.basename(filePath);

    return docs.map((doc, index) => {
      const pageNum = doc.metadata?.loc?.pageNumber || index + 1;
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          title: title,
          source: originalName || filePath,
          sourceType: "pdf",
          pageNumber: pageNum,
        },
      };
    });
  } catch (error) {
    console.error("PDF Loader Error:", error);
    throw new Error(`Failed to parse PDF document: ${error.message}`);
  }
}