/**
 * Safely formats a date string to a localized string.
 * If the date is invalid, returns 'N/A'.
 * @param {string} dateString - The date string to format.
 * @returns {string} - The formatted date or 'N/A' if invalid.
 */
export const formatDate = (dateString) => {
  if (!dateString) {
    return 'N/A';
  }

  const date = new Date(dateString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
};