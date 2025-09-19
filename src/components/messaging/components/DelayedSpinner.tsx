import { SpinLoading } from "antd-mobile";
import { useEffect, useState } from "react";

// DelayedSpinner component that shows spinner after 400ms delay
export const DelayedSpinner = ({ 
  isLoading, 
  delay = 400, 
  spinnerProps = {} 
}) => {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    let timeoutId;

    if (isLoading) {
      // Set a timeout to show the spinner after the delay
      timeoutId = setTimeout(() => {
        setShowSpinner(true);
      }, delay);
    } else {
      // If not loading, immediately hide the spinner
      setShowSpinner(false);
    }

    // Cleanup timeout on unmount or when isLoading changes
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay]);

  // Only render spinner if both conditions are met:
  // 1. Currently loading
  // 2. Delay period has passed
  return isLoading && showSpinner ? (
    <SpinLoading {...spinnerProps} />
  ) : null;
};