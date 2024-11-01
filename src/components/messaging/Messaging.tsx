import React, { useState } from 'react';
import ChatRoom from './components/ChatRoom';
import ChatList from './components/ChatList';
import { useNavigate } from 'react-router-dom';

const App: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="">
        <ChatList 
          onChatSelect={(chatId) => navigate(`/messages/${chatId}`)}
        />
    </div>
  );
};

export default App;