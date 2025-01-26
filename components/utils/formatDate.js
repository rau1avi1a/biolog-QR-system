export function formatDate(dateString) {
    if (!dateString) return "N/A";
  
    const date = new Date(dateString);
  
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
  
    // Use local date parts to prevent time zone issues
    const day = date.getDate() + 1; // Local day
    const month = date.getMonth() + 1; // Local month (0-indexed, so +1)
    const year = date.getFullYear(); // Local year
  
    // Pad month and day with leading zero if needed
    const paddedDay = String(day).padStart(2, "0");
    const paddedMonth = String(month).padStart(2, "0");
  
    return `${paddedMonth}/${paddedDay}/${year}`;
  }
  