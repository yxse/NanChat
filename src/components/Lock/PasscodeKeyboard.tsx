import React, { useState } from 'react';
import '../../styles/PasscodeKeyboard.css';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { HapticsImpact } from '../../utils/haptic';
const PasscodeKeyboard = ({ passcode, setPasscode, maxLength = 6 }) => {

  const handleKeyPress = (number) => {
    HapticsImpact({
      style: ImpactStyle.Light,
    });
    if (passcode.length < maxLength) {
      const newPasscode = passcode + number;
      setPasscode(newPasscode);
    }
  };

  const handleDelete = () => {
    const newPasscode = passcode.slice(0, -1);
    setPasscode(newPasscode);
    HapticsImpact({
      style: ImpactStyle.Light,
    });
  };

  return (
    <div className="passcode-keyboard">
      <div className="keyboard-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0].map((number) => (
          <button
            key={number}
            onClick={() => handleKeyPress(number)}
            className="keyboard-button"
          >
            {number}
          </button>
        ))}
        <button
          onClick={handleDelete}
          className="keyboard-button delete-button"
        >
          ←
        </button>
      </div>
    </div>
  );
};


export default PasscodeKeyboard;