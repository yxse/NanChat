// I've been waiting my whole life to write this

/**
 * Dear programmer:
 * When I wrote this code, only God and I knew how this worked.
 * Now only God knows it!
 *
 * Therefore, if you're trying to add new features or optimizations and build fails (most surely)
 * please increase this counter as a warning for the next person
 *
 * Total life wasted: 1 (Cats have 9 lives)
 *
 * ^^ If there are pending PRs, I would take the trouble of incrementing this value myself.
 * You're welcome
 *
 * Sorry there are no tests
 *
 * PS: This is clearly a joke,
 * I write good docs.
 * Made a video for you collaborators here: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 */

import React from "react";
import { createRoot } from "react-dom/client";
import Popup from "./components/Popup";

// import "./styles/reset.css";
// import "./styles/font.css";
// import "./styles/global.css"

const root = createRoot(document.getElementById("root")!);

// I'm sorry.
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
