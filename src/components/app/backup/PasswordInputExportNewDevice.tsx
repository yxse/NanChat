import React, { useState, useRef, useEffect } from 'react';
import { Input, Card, Form, Space } from 'antd-mobile';


const PasswordInputExportNewDevice = ({ onPasswordEntered }) => {
  const [section1, setSection1] = useState('');
  const [section2, setSection2] = useState('');
  const [section3, setSection3] = useState('');

  const input1Ref = useRef(null);
  const input2Ref = useRef(null);
  const input3Ref = useRef(null);

  useEffect(() => {
  // Add a small timeout to ensure the input is rendered
  const timer = setTimeout(() => {
    if (input1Ref.current) {
      input1Ref.current.focus();
    }
  }, 10);
  return () => clearTimeout(timer);
}, []);
  // Handle complete password updates
  useEffect(() => {
    const handlePassword = async () => {
      const fullPassword = `${section1}-${section2}-${section3}`;
  
      if (section1.length === 6 && section2.length === 6 && section3.length === 6) {
        if (onPasswordEntered) {
          try {
            await onPasswordEntered(fullPassword);
            // Handle success if needed
          } catch (error) {
            console.error('Password validation failed:', error);
            // Handle error
          }
        }
      }
    };
  
    handlePassword();
  }, [section1, section2, section3]);

  // Handle input changes and auto-focus
  const handleChange = (value, section, nextInputRef) => {
    // Strip any hyphens that might get pasted
    value = value.replace(/-/g, '');

    // Limit to 6 characters
    if (value.length <= 6) {
      // Update the appropriate section
      if (section === 1) setSection1(value);
      else if (section === 2) setSection2(value);
      else if (section === 3) setSection3(value);

      // Auto-focus next input when this one is complete
      if (value.length === 6 && nextInputRef) {
        nextInputRef.current.focus();
      }
    }
  };

  // Handle paste event
  const handlePaste = (e, section) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');

    // Try to parse the full password format (e.g., "xxxxxx-xxxxxx-xxxxxx")
    const parts = pastedText.split('-');

    if (parts.length === 3 && 
        parts[0].length <= 6 && 
        parts[1].length <= 6 && 
        parts[2].length <= 6) {
      // It seems to be a complete password
      setSection1(parts[0]);
      setSection2(parts[1]);
      setSection3(parts[2]);

      // Focus the last input or blur if all sections are complete
      if (parts[2].length === 6) {
        input3Ref.current.blur();
      } else {
        input3Ref.current.focus();
      }
    } else {
      // Just paste at the current position and try to distribute
      let remainingText = pastedText.replace(/-/g, '');

      // Fill current section first
      if (section === 1) {
        const forSection1 = remainingText.slice(0, 6);
        setSection1(forSection1);
        remainingText = remainingText.slice(forSection1.length);

        if (remainingText.length > 0) {
          const forSection2 = remainingText.slice(0, 6);
          setSection2(forSection2);
          remainingText = remainingText.slice(forSection2.length);

          if (remainingText.length > 0) {
            setSection3(remainingText.slice(0, 6));
          }

          // Focus appropriate field
          if (forSection1.length === 6) {
            if (forSection2.length === 6) {
              input3Ref.current.focus();
            } else {
              input2Ref.current.focus();
            }
          }
        }
      } else if (section === 2) {
        const forSection2 = remainingText.slice(0, 6);
        setSection2(forSection2);
        remainingText = remainingText.slice(forSection2.length);

        if (remainingText.length > 0) {
          setSection3(remainingText.slice(0, 6));
        }

        // Focus appropriate field
        if (forSection2.length === 6) {
          input3Ref.current.focus();
        }
      } else if (section === 3) {
        setSection3(remainingText.slice(0, 6));
      }
    }
  };

  return (
    <div className='py-4'>
      <div style={{ marginBottom: '16px', textAlign: 'center', marginTop: '16px' }} className='text-xl'>
        Enter Export Password
      </div>

      <Form layout="horizontal" className="form-list high-contrast" mode="card">
        <Space block justify="center" className="ios-password-container">
          <Input
            ref={input1Ref}
            className="password-section"
            maxLength={6}
            value={section1}
            onChange={(v) => handleChange(v, 1, input2Ref)}
            onPaste={(e) => handlePaste(e, 1)}
            placeholder="xxxxxx"
            autoCapitalize='none'
            autoCorrect='off'
            autoFocus={true}
          />
          <span className="password-separator">-</span>
          <Input
            ref={input2Ref}
            className="password-section"
            maxLength={6}
            value={section2}
            onChange={(v) => handleChange(v, 2, input3Ref)}
            onPaste={(e) => handlePaste(e, 2)}
            placeholder="xxxxxx"
            autoCapitalize='none'
            autoCorrect='off'
          />
          <span className="password-separator">-</span>
          <Input
            ref={input3Ref}
            className="password-section"
            maxLength={6}
            value={section3}
            onChange={(v) => handleChange(v, 3, null)}
            onPaste={(e) => handlePaste(e, 3)}
            placeholder="xxxxxx"
            autoCapitalize='none'
            autoCorrect='off'
          />
        </Space>
      </Form>
    </div>
  );
};

export default PasswordInputExportNewDevice;