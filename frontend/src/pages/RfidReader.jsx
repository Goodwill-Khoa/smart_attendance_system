import { useEffect, useState } from "react";
import BaseLayout from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
};

const buttonStyle = {
  border: 0,
  borderRadius: "8px",
  padding: "10px 14px",
  color: "white",
  background: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

function ReaderList({ title, items, statusColor }) {
  return (
    <section style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px" }}>
      <h2 style={{ marginTop: 0, color: statusColor }}>{title} ({items?.length || 0})</h2>
      {items?.length ? (
        <ul style={{ marginBottom: 0, paddingLeft: "20px" }}>
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} style={{ marginBottom: "6px" }}>
              {item.name}{item.status && item.status !== title.toUpperCase() ? ` · ${item.status}` : ""}
            </li>
          ))}
        </ul>
      ) : <p style={{ marginBottom: 0 }}>No students</p>}
    </section>
  );
}

export default function RfidReader() {
  const BASE_URL = getApiBaseUrl();
  const [readerId, setReaderId] = useState(localStorage.getItem("rfid_reader_id") || "");
  const [readerKey, setReaderKey] = useState(localStorage.getItem("rfid_reader_key") || "");
  const [saved, setSaved] = useState(Boolean(localStorage.getItem("rfid_reader_id") && localStorage.getItem("rfid_reader_key")));
  const [state, setState] = useState(null);
  const [cardId, setCardId] = useState("");
  const [eventType, setEventType] = useState("ENTRY");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!saved || !readerId || !readerKey) return undefined;
    let mounted = true;
    const poll = async () => {
      try {
        const response = await fetch(`${BASE_URL}/rfid/reader/state`, {
          headers: { "X-Reader-ID": readerId, "X-Reader-Key": readerKey },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Reader authentication failed");
        if (mounted) {
          setState(data);
          setError("");
        }
      } catch (err) {
        if (mounted) setError(err.message || "Could not load reader state.");
      }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [BASE_URL, readerId, readerKey, saved]);

  const saveReader = (event) => {
    event.preventDefault();
    const normalizedId = readerId.trim();
    const normalizedKey = readerKey.trim();
    if (!normalizedId || !normalizedKey) {
      setError("Enter both the registered reader ID and its API key.");
      return;
    }
    localStorage.setItem("rfid_reader_id", normalizedId);
    localStorage.setItem("rfid_reader_key", normalizedKey);
    setReaderId(normalizedId);
    setReaderKey(normalizedKey);
    setSaved(true);
    setError("");
  };

  const clearReader = () => {
    localStorage.removeItem("rfid_reader_id");
    localStorage.removeItem("rfid_reader_key");
    setReaderId("");
    setReaderKey("");
    setSaved(false);
    setState(null);
  };

  const submitTestTap = async (event) => {
    event.preventDefault();
    if (!cardId.trim()) {
      setError("Enter a card identifier for the test tap.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BASE_URL}/rfid/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Reader-ID": readerId,
          "X-Reader-Key": readerKey,
        },
        body: JSON.stringify({ card_id: cardId.trim(), event_type: eventType }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Tap was rejected");
      setNotice(data.message || "Tap accepted.");
      setCardId("");
      const refreshed = await fetch(`${BASE_URL}/rfid/reader/state`, {
        headers: { "X-Reader-ID": readerId, "X-Reader-Key": readerKey },
      });
      if (refreshed.ok) setState(await refreshed.json());
    } catch (err) {
      setError(err.message || "Could not submit tap.");
    } finally {
      setBusy(false);
    }
  };

  const session = state?.session;

  return (
    <BaseLayout headerTitle="RFID Room Reader" maxWidth="1000px">
      {!saved ? (
        <section style={{ background: "white", borderRadius: "12px", padding: "18px" }}>
          <h2 style={{ marginTop: 0 }}>Connect this reader display</h2>
          <p>Use the reader ID and one-time API key created by an administrator for this room.</p>
          <form onSubmit={saveReader} style={{ display: "grid", gap: "12px" }}>
            <label>
              Reader ID
              <input style={inputStyle} value={readerId} onChange={(event) => setReaderId(event.target.value)} />
            </label>
            <label>
              Reader API key
              <input type="password" style={inputStyle} value={readerKey} onChange={(event) => setReaderKey(event.target.value)} />
            </label>
            <button type="submit" style={buttonStyle}>Connect reader</button>
          </form>
        </section>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ marginBottom: "4px" }}>{state?.room_name || "Connecting to room..."}</h2>
              <p style={{ marginTop: 0 }}>Reader state refreshes every 5 seconds.</p>
            </div>
            <button type="button" style={{ ...buttonStyle, background: "#475569" }} onClick={clearReader}>Disconnect</button>
          </div>
          {session ? (
            <section style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
              <h2 style={{ marginTop: 0, marginBottom: "6px" }}>{session.course_name}</h2>
              <div>{session.starts_at} — {session.ends_at}</div>
              <div>Official snapshot: {session.snapshot_at} · {session.snapshot_complete ? "finalized" : "waiting"}</div>
            </section>
          ) : (
            <section style={{ background: "#f8fafc", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
              No current or upcoming scheduled class for this room.
            </section>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <ReaderList title="Waiting" items={state?.waiting} statusColor="#9a6700" />
            <ReaderList title="Present" items={state?.present} statusColor="#15803d" />
            <ReaderList title="Late" items={state?.late} statusColor="#b45309" />
            <ReaderList title="Left" items={state?.left} statusColor="#475569" />
          </div>
          <form onSubmit={submitTestTap} style={{ background: "white", borderRadius: "12px", padding: "16px", marginTop: "14px" }}>
            <h3 style={{ marginTop: 0 }}>Manual test tap</h3>
            <p>Use only for a hardware-free check. A deployed reader gateway should post taps directly to the API.</p>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 140px auto", gap: "10px" }}>
              <input style={inputStyle} value={cardId} onChange={(event) => setCardId(event.target.value)} placeholder="Card identifier" />
              <select style={inputStyle} value={eventType} onChange={(event) => setEventType(event.target.value)}>
                <option value="ENTRY">Entry</option>
                <option value="EXIT">Exit</option>
              </select>
              <button type="submit" style={buttonStyle} disabled={busy}>Submit test tap</button>
            </div>
          </form>
        </>
      )}
      {error && <p role="alert" style={{ color: "#991b1b", fontWeight: 700 }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#166534", fontWeight: 700 }}>{notice}</p>}
      <p style={{ color: "#64748b", fontSize: "12px" }}>
        This page keeps the reader API key in this browser's local storage. Use a dedicated kiosk/device and disconnect before handing it to someone else.
      </p>
    </BaseLayout>
  );
}
