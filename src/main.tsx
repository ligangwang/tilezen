import { createRoot } from "react-dom/client";
import "./tilezen.css";
import { connect } from "../sdk/dingn-sdk.js";
import { DingnProvider } from "./dingn";
import { TileZen } from "./game";
import { loadSaved, parsePrefs } from "./save";

const sdk = await connect();
const [saved, prefs] = await Promise.all([
  loadSaved(sdk),
  sdk.storage.get("prefs").catch(() => null),
]);
// While developing: ?cleared=40 starts as if 40 levels were cleared, and
// ?signedin plays as a signed-in player (nothing is really saved or paid).
if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search);
  if (q.has("cleared")) saved.cleared = Number(q.get("cleared")) || 0;
  if (q.has("signedin")) sdk.player = { ...sdk.player, signedIn: true };
  if (q.has("lang")) sdk.locale = q.get("lang")!;
}
createRoot(document.getElementById("root")!).render(
  <DingnProvider sdk={sdk}>
    <TileZen initial={saved} prefs={parsePrefs(prefs)} />
  </DingnProvider>,
);
sdk.ready();
