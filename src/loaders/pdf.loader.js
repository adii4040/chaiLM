import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import path from "node:path";
import { config } from "../config/env.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.utils.js";


async function extractPDF(filePath) {
  const cloudinaryResult = await uploadOnCloudinary(filePath);

  if (!cloudinaryResult) {
    throw new Error("Failed to upload PDF file to Cloudinary");
  }

  const cloudinaryUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
  console.log(`[PDF Processor] Cloudinary upload successful: ${cloudinaryUrl}`);

  console.log("[PDF Processor] Fetching PDF from Cloudinary URL for parsing...");
  const response = await fetch(cloudinaryUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from Cloudinary: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const pdfBlob = new Blob([arrayBuffer], { type: "application/pdf" });
  return {pdfBlob, cloudinaryUrl, publicId: cloudinaryResult.public_id || null}
}

/**
 * Uploads a local PDF to Cloudinary, fetches the PDF from Cloudinary URL,
 * parses its content into text chunks using PDFLoader with blob, and attaches metadata.
 * @param {string} filePath - Absolute or relative local path to the uploaded PDF file
 * @param {string} [originalName] - Original uploaded filename
 * @returns {Promise<Object>} Object containing chunks, title, sourceUrl, cloudinaryUrl, publicId
 */
export async function processPDF(filePath, originalName) {
  try {
    console.log("[PDF Processor] Uploading PDF file to Cloudinary...");
    const { pdfBlob, cloudinaryUrl, publicId } = await extractPDF(filePath);

    console.log("[PDF Processor] Loading PDF content from blob...");
    const loader = new PDFLoader(pdfBlob);
    const rawDocs = await loader.load();

    const title = originalName || path.basename(filePath);

    const formattedDocs = rawDocs.map((doc, index) => {
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

    console.log("[PDF Processor] Splitting PDF document content into text chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking?.chunkSize || 600,
      chunkOverlap: config.chunking?.chunkOverlap || 150,
    });

    const chunks = await splitter.splitDocuments(formattedDocs);

    return {
      chunks,
      title,
      sourceUrl: cloudinaryUrl,
      cloudinaryUrl,
      publicId,
    };
  } catch (error) {
    console.error("PDF Processor Error:", error);
    throw new Error(`Failed to process PDF document: ${error.message}`);
  }
}