import { useEffect, useRef } from "react";
import socket from "./socket";

// Subscribes to the backend's "db:change" events (emitted by store.js
// after every insert/update/remove) and re-runs `reload` whenever one of
// `collectionNames` changes — keeping the view live across tabs/sessions
// without polling. `reload` is called via a ref so the hook always
// invokes the latest closure (e.g. Reports.jsx's reload depends on
// `period` state) without needing to resubscribe on every render.
export default function useLiveCollection(collectionNames, reload) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    const handler = (event) => {
      if (collectionNames.includes(event.collection)) {
        reloadRef.current();
      }
    };
    socket.on("db:change", handler);
    return () => socket.off("db:change", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionNames.join(",")]);
}
