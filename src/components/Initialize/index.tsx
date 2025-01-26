import { useState } from "react";

import Start from "./Start";
import Password from "./create/Password";
import Mnemonic from "./create/Mnemonic";
import Done from "./create/Done";
import ImportPhrase from "./restore/Phrase";
import ImportPassword from "./restore/Password";

import "../../styles/initialize.css";

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
    <>
      {wizardI == 0 && <Start setW={setWizardI} theme={theme} setWalletState={setWalletState} />}
      {wizardI == 1 && <Mnemonic setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 2 && <Password setW={setWizardI} theme={theme} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 3 && <Done setW={setWizardI} theme={theme} />}
      {wizardI == 4 && <ImportPhrase setW={setWizardI} setWalletState={setWalletState} onCreated={onCreated} />}
      {wizardI == 5 && <ImportPassword setW={setWizardI} />}

      {wizardI == 420 && <Done setW={setWizardI} prevStep={5} theme={theme} />}
    </>
  );
}
