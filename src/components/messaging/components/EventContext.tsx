// used for welcome message feature, to open the (+) button
import React, { createContext, useState, useContext } from 'react';

const EventContext = createContext();

export function EventProvider({ children }) {
  const [events, setEvents] = useState({});
  
  const emit = (eventName, data) => {
    setEvents(prev => ({
      ...prev,
      [eventName]: data
    }));
  };
  
  return (
    <EventContext.Provider value={{ events, emit }}>
      {children}
    </EventContext.Provider>
  );
}

export function useEvent(eventName) {
  const { events } = useContext(EventContext);
  return events[eventName];
}

export function useEmit() {
  const { emit } = useContext(EventContext);
  return emit;
}