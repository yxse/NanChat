import { FaCircleQuestion } from "react-icons/fa6";

export default function Navbar({ theme }: { theme: "dark" | "light" }) {
  return (
    <section
      className={`${
        theme == "light" && "!bg-white !text-black !border-slate-400"
      } lockscreen-nav select-none`}
    >
      <div style={{ width: "10px" }}></div>
      {/* <span
        className={`${
          theme == "light" && "text-slate-600"
        } text-slate-400 text-xl`}
      >
        cesium
      </span> */}
      <div
        className="lockscreen-nav-q"
        role="button"
        onClick={() =>
          chrome.tabs.create({ url: "https://nano.gift/docs/cesium" })
        }
      >
        <FaCircleQuestion
          size={16}
          className={`text-slate-400 hover:text-slate-200 ${
            theme == "light" && "text-slate-600 hover:text-slate-400"
          }`}
        />
      </div>
    </section>
  );
}
