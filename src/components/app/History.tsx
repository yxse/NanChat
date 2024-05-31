import {
  ActionSheet,
  Button,
  DotLoading,
  ErrorBlock,
  List,
  SafeArea,
  Space,
  SwipeAction,
  Toast,
} from "antd-mobile";
import { useEffect, useState } from "react";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import { getAccount } from "../Settings";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { networks } from "../../utils/networks";
import RPC from "../../nano/rpc";
import useSWR from "swr";
import { BiSend, BiSolidSend } from "react-icons/bi";
import { useNavigate } from "react-router-dom";
import { Action } from "antd-mobile/es/components/action-sheet";

const fetchHistory = async (ticker) => {
  const account = await getAccount(ticker);
  let history = await new RPC(ticker).acocunt_history(account);
  return history.history;
};

export default function History({ ticker }: { ticker: string }) {
  const { data: history, isLoading } = useSWR("history-" + ticker, () =>
    fetchHistory(ticker),
  );
  const [visible, setVisible] = useState(false);
  const [activeTx, setActiveTx] = useState(null);
  const navigate = useNavigate();
  const actions = [
    {
      text: "Create contact",
      key: "add-to-contacts",
      bold: true,
    },
    {
      text: "Copy address",
      key: "copy-address",
      onClick: () => {
        navigator.clipboard.writeText(activeTx.account).then(
          () => {
            Toast.show({
              content: "Copied!",
              duration: 1000,
            });
          },
          (err) => {
            Toast.show({
              content: "Failed to copy",
            });
          },
        );
      },
    },
    {
      text: "View Details",
      key: "view-details",
      onClick: () =>
        window.open(
          `https://nanexplorer.com/${networks[ticker].id}/block/${activeTx.hash}`,
        ),
    },
  ];
  return (
    <>
      <div className="w-full overflow-scroll h-screen scroll-smooth mb-4 pb-96">
        {isLoading && (
          <div className="divide-y divide-solid divide-gray-700 w-full">
            {[1, 2, 3, 4, 5, 6].map((_, idx) => (
              <List key={idx}>
                <List.Item>
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
                    <div className="w-1/2 h-4 bg-gray-500 rounded"></div>
                  </div>
                </List.Item>
              </List>
            ))}
          </div>
        )}
        {!isLoading && history.length == 0 && (
          <ErrorBlock
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 8,
            }}
            status="empty"
            title="Transaction will appear here"
            description=""
          />
        )}
        {!isLoading && history.length > 0 && (
          <div className="divide-y divide-solid divide-gray-700 w-full">
            {history.map((tx, idx) => (
              <List
                key={tx.hash + "-list"}
                header={
                  new Date(+tx.local_timestamp * 1000).toLocaleDateString() !==
                  new Date(
                    +history[idx - 1]?.local_timestamp * 1000,
                  ).toLocaleDateString() && (
                    <div className="">
                      {new Date(
                        +tx.local_timestamp * 1000,
                      ).toLocaleDateString()}
                    </div>
                  )
                }
              >
                <SwipeAction
                  key={tx.hash + "-swipe"}
                  rightActions={[
                    {
                      key: "send-again",
                      color: "#108ee9",
                      onClick: () => {
                        navigate(
                          `/${ticker}/send?to=${tx.account}&amount=${+rawToMega(ticker, tx.amount)}`,
                        );
                      },
                      text: (
                        <>
                          <BiSolidSend size={18} />
                        </>
                      ),
                    },
                  ]}
                >
                  <List.Item
                    onClick={() => {
                      setVisible(true);
                      setActiveTx(tx);
                    }}
                    key={tx.hash}
                  >
                    {/* <a
                    href={`https://nanexplorer.com/${networks[ticker].id}/block/${tx.hash}`}
                    target="_blank"
                    className="text-blue-300"
                  > */}
                    <div className="flex items-center space-x-4 text-sm justify-between">

                      <div className="flex items-center space-x-2">
                        <div className="">
                          {tx.type === "send" && <SlArrowUpCircle size={18} />}
                          {tx.type === "receive" && (
                            <SlArrowDownCircle size={18} />
                          )}
                        </div>
                        <div>
                          {tx.type === "send" && "Sent"}
                          {tx.type === "receive" && "Received"}
                          <div className="text-gray-400">
                            {+rawToMega(ticker, tx.amount)} {ticker}
                          </div>
                        </div>
                      </div>
                      <div className="text-gray-400 text-sm text-right font-mono">
                        {tx.account.slice(0, 10)}...{tx.account.slice(-6)}
                      </div>
                      {/* <div>
                    {tx.hash}
                  </div> */}
                    </div>
                    {/* </a> */}
                  </List.Item>
                </SwipeAction>
              </List>
            ))}
            <ActionSheet
              visible={visible}
              actions={actions}
              onClose={() => setVisible(false)}
            />
          </div>
        )}
        <div className="text-center mt-4">
          <Button color="primary" className="mt-4">
            Buy {ticker}
          </Button>
        </div>
      </div>
    </>
  );
}
