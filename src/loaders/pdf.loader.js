import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

/**
 * Loads a PDF file and extracts its content as LangChain Documents
 */
export async function loadPDF(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  return docs;
}