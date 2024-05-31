import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";

export default function Protocol_handler() {
  // hacky way to handle protocol handler (web+nano://)
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const params = searchParams.get("params"); // %s token https://developer.mozilla.org/en-US/docs/Web/Manifest/protocol_handlers
    const to = params?.split("to=")[1]?.split("&")[0] || "";
    const amount = params?.split("amount=")[1]?.split("&")[0] || "";
    const ticker = params?.split("ticker=")[1]?.split("&")[0] || "XNO";
    console.log(to, amount, ticker);
    navigate(`/${ticker}/send?to=${to}&amount=${amount}`, { replace: true });
  }, []);
  return <div>Redirecting...</div>;
}
