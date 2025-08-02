import { useTranslation } from "react-i18next";

const isYesterday = (date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toLocaleDateString() === new Date(date).toLocaleDateString();
}

const isToday = (date) => {
  return new Date(date).toLocaleDateString() === new Date().toLocaleDateString();
}
export const DateHeader = ({ timestamp, timestampPrev, timestampNext }) => {
  const { t } = useTranslation();
  const FormatDate = ({ timestamp }) => {
    return (
      <>
        {
          isToday(timestamp) ? "" :
            isYesterday(timestamp) ? t('yesterday') :
        new Date(timestamp).toLocaleDateString(undefined, {
          // weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        })} {new Date(timestamp).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </>
    )
  }

  // Check if we should show the date based on time difference (5 minutes = 300000 milliseconds)
  const shouldShowDate = (current, previous) => {
    if (!previous) return false;
    return Math.abs(new Date(current) - new Date(previous)) > 300000;
  }

  // Handle the case where this is the last message
  if (timestampNext == null) return <FormatDate timestamp={timestamp} />;
  
  // Handle the case where this is the first message
  // if (timestampNext == null) return null;
  
  return (
    <>
      {
      shouldShowDate(timestamp, timestampNext) 
      && (
        <div className="mb-4 mt-4">
             <FormatDate timestamp={timestamp} />
        </div>
      )}
    </>
  )
}