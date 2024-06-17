import { useState } from "react";

import Start from "./Start";
import Password from "./create/Password";
import Mnemonic from "./create/Mnemonic";
import Done from "./create/Done";
import ImportPhrase from "./restore/Phrase";
import ImportPassword from "./restore/Password";

import "../../styles/initialize.css";

export default function InitializeScreen({
  theme,
  setAppLoggedIn
}: {
  theme: "dark" | "light";
  setAppLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [wizardI, setWizardI] = useState<number>(0);
  return (
    <>
      {wizardI == 0 && <Start setW={setWizardI} theme={theme} setAppLoggedIn={setAppLoggedIn}/>}
      {wizardI == 1 && <Password setW={setWizardI} theme={theme} />}
      {wizardI == 2 && <Mnemonic setW={setWizardI} theme={theme} />}
      {wizardI == 3 && <Done setW={setWizardI} theme={theme} />}
      {wizardI == 4 && <ImportPhrase setW={setWizardI} />}
      {wizardI == 5 && <ImportPassword setW={setWizardI} />}

      {wizardI == 420 && <Done setW={setWizardI} prevStep={5} theme={theme} />}
    </>
  );
}
