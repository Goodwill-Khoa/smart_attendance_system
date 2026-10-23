import { useState } from "react";
import BaseLayout from "../components/BaseLayout";
import { getApiBaseUrl } from "../services/apiBase";

const cardStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "16px",
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "14px",
};

export default function RfidDemo() {
  const BASE_URL = getApiBaseUrl();
  const [demo, setDemo] = useState(null);
  const [cardId, setCardId] = useState("");
  const [customCardId, setCustomCardId] = useState("");
  const [eventType, setEventType] = useState("ENTRY");
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const readResponse = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `Request failed (${response.status})`);
    }
    return data;
  };

  const prepareDemo = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BASE_URL}/rfid/simulator/schedule-setup`, { method: "POST" });
      const data = await readResponse(response);
      setDemo(data);
      setCardId(data.cards[0]?.card_id || "");
      setCustomCardId("");
      setEvents([]);
      setNotice("Schedule demo ready. The virtual clock starts at 07:55; no hardware is connected.");
    } catch (err) {
      setError(err.message || "Could not prepare the virtual schedule demo.");
    } finally {
      setBusy(false);
    }
  };

  const refreshState = async () => {
    const response = await fetch(`${BASE_URL}/rfid/simulator/state`);
    const data = await readResponse(response);
    setDemo((current) => current ? {
      ...current,
      current_time: data.current_time,
      reader_state: data.reader_state,
    } : current);
  };

  const tapCard = async (selectedCardId = cardId) => {
    if (!demo || !selectedCardId.trim()) {
      setError("Select a demo card or enter a card identifier.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BASE_URL}/rfid/simulator/tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_id: selectedCardId.trim(),
          event_type: eventType,
        }),
      });
      const data = await readResponse(response);
      setEvents((current) => [{ ...data, accepted: true }, ...current]);
      setNotice(data.message);
      await refreshState();
    } catch (err) {
      setEvents((current) => [{
        event_type: eventType,
        student_name: selectedCardId,
        message: err.message || "The virtual tap was rejected.",
        accepted: false,
      }, ...current]);
      setError(err.message || "The virtual tap was rejected.");
      try {
        await refreshState();
      } catch {
        // Preserve the original tap error; the next poll can refresh the board.
      }
    } finally {
      setBusy(false);
    }
  };

  const advanceTime = async (minutes) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${BASE_URL}/rfid/simulator/advance-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      const data = await readResponse(response);
      setDemo((current) => current ? {
        ...current,
        current_time: data.current_time,
        reader_state: data.reader_state,
      } : current);
      setNotice(`Virtual clock advanced by ${minutes} minutes.`);
    } catch (err) {
      setError(err.message || "Could not advance the virtual clock.");
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (value) => value
    ? new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Budapest",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
    : "—";

  const state = demo?.reader_state;
  const session = state?.session;
  const renderNames = (items) => items?.length
    ? items.map((item) => item.name).join(", ")
    : "None";

  return (
    <BaseLayout headerTitle="Scheduled RFID Virtual Demo" maxWidth="820px">
      <div style={{ ...cardStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
        <strong>Hardware-free schedule simulation</strong>
        <p style={{ marginBottom: 0 }}>
          A separate virtual reader tracks room occupancy against two recurring class slots.
          The virtual clock lets you demonstrate the 15-minute snapshot and next-class carryover.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ ...cardStyle, color: "#991b1b", background: "#fef2f2" }}>
          {error}
          {error.includes("RFID simulator is disabled") && (
            <p style={{ marginBottom: 0 }}>
              Set the local backend simulator flag and HMAC key as described in the README, then restart it.
            </p>
          )}
        </div>
      )}
      {notice && <div role="status" style={{ ...cardStyle, color: "#166534", background: "#f0fdf4" }}>{notice}</div>}

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>1. Prepare the virtual room</h2>
        <p>Creates an 08:00 class, a 09:00 next class, a demo reader, and synthetic student cards.</p>
        <button type="button" style={buttonStyle} disabled={busy} onClick={prepareDemo}>
          {busy ? "Please wait..." : "Prepare / reset schedule demo"}
        </button>
        {demo && (
          <p style={{ marginBottom: 0, marginTop: "12px" }}>
            Room: <strong>{demo.room_name}</strong> · virtual time: <strong>{formatTime(demo.current_time)}</strong>
          </p>
        )}
      </section>

      {demo && (
        <>
          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>2. Tap a virtual card</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
              <label>
                <span style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Student card</span>
                <select style={inputStyle} value={cardId} onChange={(event) => setCardId(event.target.value)}>
                  {demo.cards.map((card) => (
                    <option key={card.card_id} value={card.card_id}>
                      {card.student_name} — {card.active ? "active" : "revoked"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Tap event</span>
                <select style={inputStyle} value={eventType} onChange={(event) => setEventType(event.target.value)}>
                  <option value="ENTRY">Entry</option>
                  <option value="EXIT">Exit</option>
                </select>
              </label>
            </div>
            <button type="button" style={{ ...buttonStyle, marginTop: "14px" }} disabled={busy} onClick={() => tapCard()}>
              Tap virtual card
            </button>
            <label style={{ display: "block", marginTop: "16px" }}>
              <span style={{ display: "block", fontWeight: 700, marginBottom: "6px" }}>Test an unknown identifier</span>
              <input
                style={inputStyle}
                value={customCardId}
                onChange={(event) => setCustomCardId(event.target.value)}
                placeholder="UNKNOWN-CARD"
              />
            </label>
            <button
              type="button"
              style={{ ...buttonStyle, marginTop: "10px", background: "#475569" }}
              disabled={busy || !customCardId.trim()}
              onClick={() => tapCard(customCardId)}
            >
              Try unknown card
            </button>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>3. Advance the virtual clock</h2>
            <p>Clock: <strong>{formatTime(demo.current_time)}</strong></p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {[5, 15, 20, 45].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  style={buttonStyle}
                  disabled={busy}
                  onClick={() => advanceTime(minutes)}
                >
                  +{minutes} minutes
                </button>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>4. Live schedule register</h2>
            {session ? (
              <>
                <p>
                  <strong>{session.course_name}</strong> · {formatTime(session.starts_at)}–{formatTime(session.ends_at)}
                  {" · snapshot "}{formatTime(session.snapshot_at)}
                </p>
                <p>Snapshot: <strong>{session.snapshot_complete ? "complete" : "waiting"}</strong></p>
              </>
            ) : <p>No current or upcoming slot for this room.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
              {[
                ["Waiting", renderNames(state?.waiting)],
                ["Present", renderNames(state?.present)],
                ["Late", renderNames(state?.late)],
                ["Left", renderNames(state?.left)],
              ].map(([label, names]) => (
                <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px" }}>
                  <strong>{label}</strong>
                  <p style={{ marginBottom: 0, overflowWrap: "anywhere" }}>{names}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>5. Tap responses</h2>
            {events.length === 0 ? (
              <p>No taps recorded yet.</p>
            ) : (
              <ul style={{ paddingLeft: "20px", marginBottom: 0 }}>
                {events.map((event, index) => (
                  <li key={`${event.occurred_at || "rejected"}-${index}`} style={{ marginBottom: "8px" }}>
                    <strong style={{ color: event.accepted ? "#15803d" : "#b91c1c" }}>
                      {event.accepted ? "ACCEPTED" : "REJECTED"}
                    </strong>
                    {" · "}{event.event_type} · {event.student_name} — {event.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </BaseLayout>
  );
}
