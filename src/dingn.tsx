// The game's link to dingn: the SDK connection, shared through React context,
// plus the translations Tile Zen needs, in the player's language.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DingnGame } from "../sdk/dingn-sdk.js";
import { translate } from "./i18n";

const DingnContext = createContext<DingnGame | null>(null);

export function DingnProvider({
  sdk,
  children,
}: {
  sdk: DingnGame;
  children: ReactNode;
}) {
  // Re-render when the player signs in or out.
  const [player, setPlayer] = useState(sdk.player);
  useEffect(() => sdk.onPlayer(setPlayer), [sdk]);
  // And when they switch language while playing: the game keeps going, in
  // the new language. Older dingn builds have no onLanguage.
  const [locale, setLocale] = useState(sdk.locale);
  useEffect(() => sdk.onLanguage?.(setLocale), [sdk]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" || locale === "ur-PK" ? "rtl" : "ltr";
  }, [locale]);
  return (
    <DingnContext.Provider value={{ ...sdk, player, locale }}>
      {children}
    </DingnContext.Provider>
  );
}

export function useDingn() {
  const sdk = useContext(DingnContext);
  if (!sdk) throw new Error("DingnProvider missing");
  return sdk;
}

export function useLocale() {
  const { locale } = useDingn();
  // t("Level {0}", "3") fills in the English, then translates it, so a
  // pattern such as "Level {0}" in locales/<lang>.json matches.
  const t = (text: string, ...args: string[]) =>
    translate(
      args.reduce((s, a, i) => s.replace(`{${i}}`, a), text),
      locale,
    );
  return { locale, t };
}
