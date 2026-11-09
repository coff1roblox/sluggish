import { useEffect, useState } from "react";

export type Route = "write" | "results" | "saved" | "business";

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  if (h === "results" || h === "saved" || h === "business") return h;
  return "write";
}

export function useRoute(): [Route, (r: Route, opts?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = (r: Route, opts?: { replace?: boolean }) => {
    const hash = r === "write" ? "#/" : `#/${r}`;
    if (opts?.replace) {
      window.history.replaceState(null, "", hash);
      setRoute(r);
    } else if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  };
  return [route, go];
}
