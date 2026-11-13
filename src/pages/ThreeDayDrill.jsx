import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRILL, SHEETS } from "../data/drill/drillQuestions.js";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import "./threeDayDrill.css";

const BY = Object.fromEntries(DRILL.map((q) => [q.id, q]));
const SETS = [
  { key: "neuro", tag: "Day 1", name: "Neuroanatomy and correlation" },
  { key: "peds", tag: "Day 2", name: "Paediatric syndromes" },
  { key: "meds", tag: "Day 3", name: "Medications and the EEG" },
  { key: "mixed", tag: "Any day", name: "Mixed: all 90" },
  { key: "missed", tag: "Review", name: "My missed questions" },
];
const TOPIC = { neuro: "Neuroanatomy", peds: "Paediatrics", meds: "Medications" };
const SHEET_TABS = [["neuro", "Neuroanatomy"], ["peds", "Paediatrics"], ["meds", "Medications"]];
const EXAM = new Date(2026, 11, 14);

const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function loadStore(key) {
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    if (s && s.stats) return s;
  } catch { /* storage unavailable */ }
  return { stats: {}, missed: [] };
}

/** Build a question with its options in a fresh random order. */
const present = (id) => {
  const q = BY[id];
  return { ...q, order: shuffle(q.o.map((text, i) => ({ text, correct: i === 0 }))) };
};

export default function ThreeDayDrill() {
  const { user } = useAuth();
  const { currentTheme } = useTheme() || {};
  const storageKey = `neurolinea.drill.${user?.id || "guest"}`;
  const [store, setStore] = useState(() => loadStore(storageKey));
  const [mode, setMode] = useState("neuro");
  const [queue, setQueue] = useState(() => shuffle(DRILL.filter((q) => q.t === "neuro").map((q) => q.id)));
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [current, setCurrent] = useState(() => (queue[0] ? present(queue[0]) : null));
  const [picked, setPicked] = useState(null);
  const [requeued, setRequeued] = useState(() => new Set());
  const [sheet, setSheet] = useState("neuro");
  const [confirmReset, setConfirmReset] = useState(false);
  const nextRef = useRef(null);
  const firstOptRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(store)); } catch { /* storage unavailable */ }
  }, [store, storageKey]);

  const idsFor = useCallback((k) => (
    k === "mixed" ? DRILL.map((q) => q.id) : k === "missed" ? [...store.missed] : DRILL.filter((q) => q.t === k).map((q) => q.id)
  ), [store.missed]);

  const start = (k) => {
    const q = shuffle(idsFor(k));
    setMode(k); setQueue(q); setPos(0); setScore({ right: 0, total: 0 }); setRequeued(new Set());
    setCurrent(q[0] ? present(q[0]) : null); setPicked(null);
  };

  const answer = useCallback((i) => {
    if (!current || picked !== null) return;
    const ok = current.order[i].correct;
    const id = current.id;
    setPicked(i);
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    setStore((s) => {
      const st = { ...(s.stats[id] || { seen: 0, right: 0 }) };
      st.seen += 1; if (ok) st.right += 1; st.last = ok ? 1 : 0;
      const missed = ok ? s.missed.filter((x) => x !== id) : s.missed.includes(id) ? s.missed : [...s.missed, id];
      return { stats: { ...s.stats, [id]: st }, missed };
    });
    // A missed question comes back a few questions later in this session (once).
    if (!ok && mode !== "missed" && !requeued.has(id)) {
      setRequeued((r) => new Set(r).add(id));
      setQueue((q) => { const n = [...q]; n.splice(Math.min(pos + 4, n.length), 0, id); return n; });
    }
  }, [current, picked, mode, requeued, pos]);

  const next = useCallback(() => {
    const p = pos + 1;
    setPos(p); setPicked(null);
    setCurrent(queue[p] ? present(queue[p]) : null);
  }, [pos, queue]);

  useEffect(() => { if (picked !== null) nextRef.current?.focus({ preventScroll: true }); }, [picked]);
  useEffect(() => { if (pos > 0 && picked === null) firstOptRef.current?.focus({ preventScroll: true }); }, [pos, picked]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input,textarea,select")) return;
      if (/^[1-4]$/.test(e.key) && current && picked === null && current.order[+e.key - 1]) answer(+e.key - 1);
      else if ((e.key === "Enter" || e.key === "n") && picked !== null && document.activeElement !== nextRef.current) { e.preventDefault(); next(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, picked, answer, next]);

  const days = Math.ceil((EXAM - new Date()) / 86400000);
  const finished = pos >= queue.length;
  const ok = picked !== null && current?.order[picked]?.correct;

  const dayCards = useMemo(() => SETS.map((s) => {
    const ids = idsFor(s.key);
    return { ...s, total: ids.length, seen: ids.filter((id) => store.stats[id]).length, right: ids.filter((id) => store.stats[id]?.last === 1).length };
  }), [idsFor, store.stats]);

  return (
    <div className="tdd" data-dark={currentTheme === "dark" ? "true" : "false"}>
      <div className="tdd-wrap">
        <header className="tdd-head">
          <span className="tdd-eyebrow">R. EEG T. exam prep</span>
          <h1>Three-Day Drill</h1>
          <p className="tdd-lede">
            Day 1 neuroanatomy and clinical correlation, Day 2 paediatric epilepsy syndromes, Day 3 medication effects on the EEG.
            Every answer comes with the reasoning and a hook to remember it. Anything you miss goes into your review pile until you get it right.
          </p>
          <span className="tdd-count">{days > 0 ? `${days} days to the exam (14 December 2026)` : "Exam day has arrived. Good luck."}</span>
        </header>

        <section aria-label="Choose a set" className="tdd-days">
          {dayCards.map((s) => (
            <button key={s.key} type="button" className="tdd-day" aria-pressed={mode === s.key} onClick={() => start(s.key)}>
              <span className="tdd-tag">{s.tag}</span>
              <strong>{s.name}</strong>
              {s.key === "missed" ? <small>{s.total} to review</small> : (
                <>
                  <div className="tdd-bar" aria-hidden="true"><i style={{ width: `${s.total ? Math.round((s.right / s.total) * 100) : 0}%` }} /></div>
                  <small>{s.right} of {s.total} correct last time · {s.seen} attempted</small>
                </>
              )}
            </button>
          ))}
        </section>

        <section className="tdd-drill" aria-live="polite">
          {queue.length === 0 ? (
            <div className="tdd-done"><h2>Nothing to review</h2><p className="tdd-hint">Questions you get wrong land here. Pick a day above to start.</p></div>
          ) : finished ? (
            <div className="tdd-done">
              <span className="tdd-eyebrow">Set complete</span>
              <div className="tdd-big">{score.total ? Math.round((score.right / score.total) * 100) : 0}%</div>
              <p>{score.right} of {score.total} answers right. {store.missed.length ? `${store.missed.length} question${store.missed.length > 1 ? "s" : ""} in your review pile.` : "Your review pile is empty."}</p>
              <div className="tdd-row tdd-center">
                <button className="tdd-btn" type="button" onClick={() => start(mode)}>Go again</button>
                {store.missed.length > 0 && <button className="tdd-btn tdd-ghost" type="button" onClick={() => start("missed")}>Review missed</button>}
              </div>
            </div>
          ) : current && (
            <>
              <div className="tdd-meta"><span className="tdd-chip">{TOPIC[current.t]}</span><span>Question {pos + 1} of {queue.length} · score {score.right}/{score.total}</span></div>
              <p className="tdd-q">{current.q}</p>
              <div className="tdd-opts" role="group" aria-label="Answer options">
                {current.order.map((o, i) => {
                  const cls = picked === null ? "" : o.correct ? " is-right" : i === picked ? " is-wrong" : " is-dim";
                  return (
                    <button key={o.text} ref={i === 0 ? firstOptRef : undefined} type="button" className={`tdd-opt${cls}`} disabled={picked !== null} onClick={() => answer(i)}>
                      <kbd>{i + 1}</kbd><span>{o.text}</span>
                    </button>
                  );
                })}
              </div>
              {picked !== null && (
                <div className="tdd-fb">
                  <div className={`tdd-verdict ${ok ? "ok" : "no"}`}>{ok ? "Correct" : "Not quite"}</div>
                  <p className="tdd-why">{current.why}</p>
                  <div className="tdd-mem"><b>Remember it</b>{current.mem}</div>
                  <div className="tdd-row">
                    <span className="tdd-hint">{ok ? "" : "Added to your review pile. You will see it again shortly."}</span>
                    <button ref={nextRef} className="tdd-btn" type="button" onClick={next}>Next question</button>
                  </div>
                </div>
              )}
              <p className="tdd-hint">Keys: 1-4 to answer, Enter for the next question.</p>
            </>
          )}
        </section>

        <section className="tdd-sheets" aria-labelledby="tdd-sheets-h">
          <div className="tdd-row"><h2 id="tdd-sheets-h">Memory sheets</h2><span className="tdd-hint">Read these before and after each day's drill.</span></div>
          <div className="tdd-tabs" role="tablist">
            {SHEET_TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={sheet === k} onClick={() => setSheet(k)}>{label}</button>
            ))}
          </div>
          <div className="tdd-sheet">
            {SHEETS[sheet].map(([title, head, rows]) => (
              <React.Fragment key={title}>
                <h3>{title}</h3>
                <div className="tdd-scroll">
                  <table>
                    <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>

        <footer className="tdd-foot">
          Original questions written for exam practice, not copied from any exam. Check anything that matters clinically against your current references and local protocols.
          Progress is saved in this browser for your account.{" "}
          {confirmReset ? (
            <span>
              <button className="tdd-btn" type="button" onClick={() => { setStore({ stats: {}, missed: [] }); setConfirmReset(false); start(mode); }}>Yes, reset</button>{" "}
              <button className="tdd-btn tdd-ghost" type="button" onClick={() => setConfirmReset(false)}>Keep it</button>
            </span>
          ) : (
            <button className="tdd-btn tdd-ghost" type="button" onClick={() => setConfirmReset(true)}>Reset my progress</button>
          )}
        </footer>
      </div>
    </div>
  );
}
