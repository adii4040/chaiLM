import { getPdfUnits, getYoutubeUnits, getWebUnits, scrapWebsite } from "../loaders/index.js";

/**
 * Unified loader to extract structural Units from any source type.
 *
 * @param {Object} sourcePayload
 * @param {string} sourcePayload.type - "pdf" | "youtube" | "website"
 * @param {string} [sourcePayload.url] - Source URL for youtube or website
 * @param {string} [sourcePayload.filePath] - File path for PDF
 * @param {string} [sourcePayload.originalName] - Original name for PDF
 * @returns {Promise<{ units: Array, title: string, videoId?: string }>}
 */
export async function loadUnitsForSource(sourcePayload) {
  const { type, url, filePath, originalName } = sourcePayload;
  const normalizedType = (type || "").toLowerCase().trim();

  console.log(`[Studio Unit Loader] Loading structural units for type: '${normalizedType}'...`);

  if (normalizedType === "pdf") {
    const inputTarget = filePath || url;
    if (!inputTarget) {
      throw new Error("Missing filePath or url for PDF unit extraction");
    }
    return await getPdfUnits(inputTarget, originalName);
  }

  if (normalizedType === "youtube") {
    if (!url) {
      throw new Error("Missing url for YouTube transcript unit extraction");
    }
    return await getYoutubeUnits(url);
  }

  if (normalizedType === "website") {
    if (!url) {
      throw new Error("Missing url for Website unit extraction");
    }
    const { markdown, title } = await scrapWebsite(url);
    const { units } = getWebUnits(markdown, title);
    return { units, title };
  }

  throw new Error(`Unsupported source type '${type}' for Studio outline extraction`);
}
