import { Button, DotLoading, ErrorBlock, List, Space } from "antd-mobile";
import { useEffect, useState } from "react";
import { getWalletRPC, rawToMega } from "../../nano/accounts";
import { getAccount } from "../Settings";
import { SlArrowDownCircle, SlArrowUpCircle } from "react-icons/sl";
import { networks } from "../../utils/networks";
import RPC from "../../nano/rpc";

export default function History({ticker}: {ticker: string}) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const account = await getAccount(ticker);
      try {
        let history = await new RPC(ticker).acocunt_history(account);
        if (!history.error){
          setHistory(history.history);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      }
      finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);
  return (
    <>
        <div className="w-full overflow-scroll h-screen scroll-smooth mb-4 pb-96">
          {
            loading &&  
            <div className="divide-y divide-solid divide-gray-700 w-full">
              {[1,2,3,4,5,6].map((_, idx) => (
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
          }
          {
            !loading && history.length == 0 &&
      <ErrorBlock 
      style={{width: "100%", display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8}}
      status='empty' title="Transaction will appear here" 
      description="" />
      }
      {
        !loading && history.length > 0 &&
          <div className="divide-y divide-solid divide-gray-700 w-full">
            {history.map((tx, idx) => (
            <List header={(new Date(+tx.local_timestamp*1000).toLocaleDateString() !== new Date(+history[idx-1]?.local_timestamp*1000).toLocaleDateString()) && (
              <div className="">
              {new Date(+tx.local_timestamp*1000).toLocaleDateString()}
            </div>)}>
               <List.Item key={tx.hash}>
               <a href={`https://nanexplorer.com/${networks[ticker].id}/block/${tx.hash}`} target="_blank" className="text-blue-300" >
                <div className="flex items-center space-x-4">
                  
                  <div className="">
                    {tx.type === "send" && <SlArrowUpCircle size={18} />}
                    {tx.type === "receive" && <SlArrowDownCircle size={18} />}
                  </div>
                  <div className="">
                    {tx.type === "send" && "Sent"}
                    {tx.type === "receive" && "Received"} 
                    <div className="text-gray-400">
                    {+rawToMega(ticker, tx.amount)} {ticker}
                    </div>
                  </div>
                  {/* <div>
                    {tx.hash}
                  </div> */}
                </div></a>
                </List.Item>
            </List>
            ))}
          </div>
      }
      <div className="text-center mt-4">
        <Button color='primary' className="mt-4">Buy {ticker}</Button>
        </div>
      </div>
    </>
  );
}
