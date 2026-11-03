/* The live side of the search dialog (D105): the query is sent to the server 150 ms after the last key, and only the
 * newest answer counts (an older one that arrives late is dropped). Nothing is sent for a query under 2 characters. */
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { SearchResult } from "../../lib/types";
import { canSearch, DEBOUNCE_MS } from "./searchModel";

export type SearchStatus = "idle" | "ready" | "error";
export interface SearchState {
  status: SearchStatus;
  results: SearchResult[];
  /** The query the results are for (they are marked with it and the empty state names it). */
  searched: string;
}

const IDLE: SearchState = { status: "idle", results: [], searched: "" };

export function useSearch(query: string, active: boolean): SearchState {
  const [state, setState] = useState<SearchState>(IDLE);
  const turn = useRef(0);
  useEffect(() => {
    const mine = ++turn.current;
    if (!active || !canSearch(query)) {
      setState(IDLE);
      return;
    }
    const clean = query.trim();
    const timer = window.setTimeout(() => {
      api.searchSessions(clean).then(
        (results) => { if (turn.current === mine) setState({ status: "ready", results, searched: clean }); },
        () => { if (turn.current === mine) setState({ status: "error", results: [], searched: clean }); },
      );
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, active]);
  return state;
}
