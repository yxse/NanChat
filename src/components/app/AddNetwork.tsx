import { networks } from "../../utils/networks";
import {
  Button, Form,
  Input, NavBar,
  NoticeBar, Toast
} from "antd-mobile";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";

export default function AddNetwork({ }) {

  const [searchParams] = useSearchParams();
  const [developerMode, setDeveloperMode] = useLocalStorageState("developer-mode", {defaultValue: false});
  const navigate = useNavigate();
  return (
    <div className="">
      <div className="container  relative mx-auto">
        <div className="text-center text-2xl flex-col">
          <NavBar 
          className="app-navbar "
          onBack={() => navigate("/")}>Add custom nano network</NavBar>
        </div>
        <NoticeBar className="mb-2 text-sm" wrap content="Add only trusted networks. A malicious network can potentially steal your funds, even on other networks."
          color="alert" />
          {
            developerMode ? 
            <Form
            initialValues={{
              name: searchParams.get("name") || "",
              ticker: searchParams.get("ticker") || "",
              rpc: searchParams.get("rpc") || "",
              decimals: searchParams.get("decimals") || "",
              prefix: searchParams.get("prefix") || "",
            }}
            onFinish={(values) => {
              console.log(values);
              if (networks[values.ticker]) {
                Toast.show({
                  icon: 'fail',
                  content: `Network ${values.ticker} already exists.`
                });
                return;
              }
              let newCustomNetworks = JSON.parse(localStorage.getItem("customNetworks"));
              if (!newCustomNetworks) {
                newCustomNetworks = {};
              }
            newCustomNetworks[values.ticker] = values;
            newCustomNetworks[values.ticker].decimals = parseInt(values.decimals);
            newCustomNetworks[values.ticker].logo = window.location.origin + "/public/img/crypto/unknown.svg";
            newCustomNetworks[values.ticker].custom = true;
            
            localStorage.setItem("customNetworks", JSON.stringify(newCustomNetworks));
            Toast.show({
              icon: 'success',
              content: `Network ${values.ticker} added.`
            });
            navigate("/wallet");
          }}>
          <Form.Item label="Name" name={"name"} required={false} rules={[{ required: true, message: "Please enter a name" }]}>
            <Input placeholder="MyNano" />
          </Form.Item>
          <Form.Item label="Ticker" name={"ticker"} required={false} rules={[{ required: true, message: "Please enter a ticker" }]}>
            <Input placeholder="MXNO" />
          </Form.Item>
          <Form.Item label="RPC URL" name={"rpc"} required={false} rules={[{ required: true, message: "Please enter a valid RPC URL", type: "url" }]}>
            <Input placeholder="http://localhost:4242" />
          </Form.Item>
          <Form.Item label="Decimals" name={"decimals"} required={false} rules={[{ required: true, message: "Please enter a decimals" }]}>
            <Input placeholder="30" />
          </Form.Item>
          <Form.Item label="Prefix" name={"prefix"} required={false} rules={[{ required: true, message: "Please enter a prefix" }]}>
            <Input placeholder="nani" />
          </Form.Item>
          <Form.Item>
            <Button color="primary" type="submit">Add network</Button>
          </Form.Item>
        </Form>
        : 
        <div className="p-2 text-center">
          Developer mode is disabled.
          <br />
          <b>Only</b> enable developer mode if you'd like to use your own node.
          </div>
    }
      </div>
      </div>
    );
  }
  