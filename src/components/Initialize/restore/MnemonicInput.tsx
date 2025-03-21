import React, { useState } from "react";

// Import the words list to validate inputs
import words from "../../../utils/words";
import { Button, Form, TextArea } from "antd-mobile";

interface MnemonicInputProps {
  mode: "import" | "verify";
  onImport: (mnemonicInputs: string[]) => void;
}

export const MnemonicInput: React.FC<MnemonicInputProps> = ({
  mode = "import",
  onImport,
}) => {
    const [mnemonicInputs, setMnemonicInputs] = useState<string[]>(
        new Array(0).fill(""),
      );
  const [activeInputs, setActiveInputs] = React.useState<number | null>(null);
  const [canContinue, setCanContinue] = useState<boolean>(false);
  const [errorInputs, setErrorInputs] = useState<boolean[]>(
    new Array(24).fill(false),
  );
  const handleInputChange = (index: number, value: string) => {
    const newInputs = [...mnemonicInputs];
    newInputs[index] = value;
    setMnemonicInputs(newInputs);
    validateMnemonic(newInputs);
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === " ") {
      event.preventDefault();
      const nextIndex = index === 23 ? 0 : index + 1;
      document.getElementById(`mnemonic-input-${nextIndex}`)?.focus();
    }
  };

  const validateMnemonic = (inputs: string[]) => {
    if (inputs[0].length === 64 || inputs[0].length === 128) {
      setCanContinue(true);
      setErrorInputs(new Array(24).fill(false));
      return
    }
    const isValid = inputs.every((word) => words.includes(word.trim())) && inputs.length === 24;
    setCanContinue(isValid);
    setErrorInputs(inputs.map((word) => !words.includes(word.trim())));
  };

  const handleInputBlur = (index: number) => {
    console.log(index);
    validateMnemonic(mnemonicInputs);
    setActiveInputs(null);
  };

  return (
    <div>
        <Form.Item
          label="Recovery Phrase">
        <TextArea
        style={{backgroundColor: "var(--main-background-color)", padding: 8, borderRadius: 6}}
          className="mt-4"
          autoSize
          value={mnemonicInputs.join(" ")}
          onChange={(v) => {
            setMnemonicInputs(v.split(" "));
            validateMnemonic(v.split(" "));
          }}
          placeholder="Enter your 24 word recovery phrase or a 64/128 hex characters seed" />
          </Form.Item>
        <Button
          size="large"
          color={"primary"}
          disabled={!canContinue}
          style={{width: "100%"}}
          shape="rounded"
          onClick={() => onImport(mnemonicInputs)}
          >
            {mode === "import" ? "Import Wallet" : "Verify Secret Phrase"}
          </Button>
    
    <div className="justify-items-center m-3" style={{maxHeight: 200, overflowY: 'auto'}}>
      <div className="bg-transparent w-full scroll-auto overflow-y-auto rounded-md">
        <div className="w-full grid grid-cols-3 gap-3">
          {mnemonicInputs.map((input, index) => (
            <div
              className={`grid-input-r border-2 ${
                activeInputs === index && "!border-blue-500"
              } ${errorInputs[index] && "!border-red-500"}`}
              key={index}
            >
              <p className="grid-input-r-p">{index + 1}.</p>
              <input
                style={{ padding: 0 }}
                id={`mnemonic-input-${index}`}
                pattern="[A-Za-z\s]+"
                autoCorrect="false"
                spellCheck="false"
                className={`grid-input-r-i ${
                  input.trim() && !words.includes(input.trim())
                    ? "invalid-input"
                    : ""
                }`}
                value={input}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleInputKeyDown(e, index)}
                onBlur={() => handleInputBlur(index)}
                onFocus={() => setActiveInputs(index)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
};
