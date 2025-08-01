import { useState } from "react";

import Start from "./Start";
import Password from "./create/Password";
import Mnemonic from "./create/Mnemonic";
import Done from "./create/Done";
import ImportPhrase from "./restore/Phrase";
import ImportPassword from "./restore/Password";

import "../../styles/initialize.css";
import SetName from "../messaging/components/SetName";
import { SafeArea } from "antd-mobile";
import Register from "../messaging/components/Register";

export default function InitializeScreen({
  onCreated,
  theme,
  setWalletState,
}: {
  onCreated: () => any;
  theme: "dark" | "light";
  setWalletState: React.Dispatch<React.SetStateAction<"locked" | "unlocked" | "no-wallet" | "loading">>;
}) {
  const [wizardI, setWizardI] = useState<number>(0);
  return (
    <div className="app">
       <div 
            style={{
                "paddingTop": "var(--safe-area-inset-top)",
                backgroundColor: "var(--adm-color-background)"
            }}></div>
       {/* <SafeArea position="top" 
            style={{
              backgroundColor: "var(--main-background-color)"
            }}
            /> */}
      {wizardI == 6 && <Register setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 0 && <Start setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated}/>}
      {wizardI == 1 && <Mnemonic setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 2 && <Password setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 3 && <Done setW={setWizardI} theme={theme} />}
      {wizardI == 4 && <ImportPhrase setW={setWizardI} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 5 && <ImportPassword setW={setWizardI} />}

      {wizardI == 420 && <Done setW={setWizardI} prevStep={5} theme={theme} />}
    </div>
  );
}
