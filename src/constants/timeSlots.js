// CONFIRMED from index.html orderTime select (lines 988–1004)
export const TIME_SLOTS = [
  '8:00 صباحاً',
  '9:00 صباحاً',
  '10:00 صباحاً',
  '11:00 صباحاً',
  '12:00 ظهراً',
  '1:00 مساءً',
  '2:00 مساءً',
  '3:00 مساءً',
  '4:00 مساءً',
  '5:00 مساءً',
  '6:00 مساءً',
  '7:00 مساءً',
  '8:00 مساءً',
  '9:00 مساءً',
];

export const DEFAULT_TIME = '3:00 مساءً';

/**
 * Compare two delivery time slots chronologically.
 * @param {string} timeA
 * @param {string} timeB
 * @returns {number} Negative if timeA is earlier, positive if timeB is earlier
 */
export function compareDeliveryTimes(timeA, timeB) {
  if (timeA === timeB) return 0;
  if (!timeA) return 1;
  if (!timeB) return -1;
  const indexA = TIME_SLOTS.indexOf(timeA);
  const indexB = TIME_SLOTS.indexOf(timeB);
  if (indexA !== -1 && indexB !== -1) {
    return indexA - indexB;
  }
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return timeA.localeCompare(timeB);
}
