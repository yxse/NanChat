
import { Button, Toast, CheckList, Modal, List, Input, Form, NavBar, Divider, Switch } from "antd-mobile";
import { MdOutlineFingerprint, MdOutlinePassword, MdOutlineTimer } from "react-icons/md";
import * as webauthn from '@passwordless-id/webauthn';
import { decrypt, encrypt } from "../../worker/crypto";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useState } from "react";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";

function DeveloperSettings() {
    const navigate = useNavigate();
    const [developerMode, setDeveloperMode] = useLocalStorageState("developer-mode", {defaultValue: false});
    return (
    <div>
        <NavBar
        className="app-navbar "
        onBack={() => {
          navigate("/settings/security");
        }}
        backArrow={true}>
          <span className="">Developer Mode</span>
        </NavBar>
        <List mode="card">
          <List.Item
          extra={<Switch
          checked={developerMode}
          onChange={(checked) => {
            if (!checked) {
              setDeveloperMode(checked);
              return;
            }
            let actionSheet = showActionSheet({
              actions: [
                { key: '1',
                  text: 'Enable', 
                  danger: true,
                  description: '',
                  onClick: () => {
                  setDeveloperMode(checked);
                  actionSheet.close()
                }
              },
              { 
                key: '2',
                text: 'Cancel', onClick: () => {
                  actionSheet.close()
                }
              }
              ]
              , extra: <div 
              className="text-center">
              When Developer Mode is turned on, wallet security is reduced. Adding a malicious network can result in loss of funds.</div>
            })
          }}
          />}
          >
            Developer Mode
          </List.Item>
        </List>
        <div className="p-4">
            If you're developing a network your can enable Developer Mode to add custom networks.
            When Developer Mode is turned on, wallet security is reduced. Adding a malicious network can result in loss of funds.
            <br />
        </div>
    </div>
  )
}

export default DeveloperSettings