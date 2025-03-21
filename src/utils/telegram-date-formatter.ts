function formatTelegramDate(date) {
    const now = new Date();
    const messageDate = new Date(date);
    
    // Helper to check if dates are the same day
    const isSameDay = (d1, d2) => {
        return d1.getDate() === d2.getDate() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getFullYear() === d2.getFullYear();
    };
    
    // Format time as HH:mm
    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    // Check if message is from today
    if (isSameDay(messageDate, now)) {
        return formatTime(messageDate);
    }
    
    // Check if message is from yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(messageDate, yesterday)) {
        return 'Yesterday';
    }
    
    // Check if message is from this week
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    
    if (messageDate >= lastWeek) {
        return messageDate.toLocaleDateString(undefined, { weekday: 'long' });
    }
    
    // For older messages, return date in DD/MM/YYYY format
    return messageDate.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatOnlineStatus(date) {
    return null
    if (!date) {
        return undefined;
    }
    const now = new Date();
    const messageDate = new Date(date);
    
    // if date is less than 5 minutes ago, user is online
    if (now - messageDate < 5 * 60 * 1000) {
        return 'Online';
    }

    return formatTelegramDate(date);

}
export { formatTelegramDate , formatOnlineStatus };