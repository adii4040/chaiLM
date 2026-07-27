/**
 * Formats total seconds into HH:MM:SS or MM:SS string
 * @param {number} totalSeconds
 * @returns {string} Formatted timestamp string e.g. "00:03:44"
 */
export function formatSecondsToTimestamp(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) {
    return "00:00:00";
  }

  const secs = Math.floor(Number(totalSeconds));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const remainingSeconds = secs % 60;

  const pad = (num) => String(num).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }

  return `00:${pad(minutes)}:${pad(remainingSeconds)}`;
}
