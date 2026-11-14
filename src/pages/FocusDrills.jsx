import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRILL, SHEETS } from "../data/drill/drillQuestions.js";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import drillApi from "../services/drillApi";
import { domainTitle, sectionTitle } from "../utils/studyLabels";
import "./focusDrills.css";

// Built-in copy, used only when the server cannot be reached. Option 0 is right.
const LOCAL = DRILL.map((q) => ({ id: q.id, t: q.t, q: q.q, o: q.o, why: q.why, mem: q.mem }));
const SETS = [
  { key: "neuro", tag: "Focus 1", name: "Neuroanatomy and correlation" },
  { key: "peds", tag: "Focus 2", name: "Paediatric syndromes" },
  { key: "meds", tag: "Focus 3", name: "Medications and the EEG" },
  { key: "acns", tag: "Focus 4", name: "ACNS guidelines" },
  { key: "mixed", tag: "All topics", name: "Mixed" },
  { key: "missed", tag: "Review", name: "My missed questions" },
];
const TOPIC = { neuro: "Neuroanatomy", peds: "Paediatrics", meds: "Medications", acns: "ACNS guidelines" };
const SHEET_TABS = [["neuro", "Neuroanatomy"], ["peds", "Paediatrics"], ["meds", "Medications"], ["acns", "ACNS guidelines"]];
const EXAM = new Date(2026, 11, 14);
const EMPTY = { stats: {}, missed: [] };

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
  return EMPTY;
}

const lookupOf = (list) => Object.fromEntries(list.map((q) => [q.id, q]));

/** A question with its options in a fresh random order (idx = position as stored). */
const present = (by, id) => {
  const q = by[id];
  return q ? { ...q, order: shuffle(q.o.map((text, idx) => ({ text, idx }))) } : null;
};

export default function FocusDrills() {
  const { user } = useAuth();
  const { currentTheme } = useTheme() || {};
  const storageKey = `neurolinea.drill.${user?.id || "guest"}`;
  // "loading" | "server" (the drill bank, scored and saved on the server) | "local" (built-in copy, saved in this browser)
  const [source, setSource] = useState("loading");
  const [questions, setQuestions] = useState([]);
  const [store, setStore] = useState(EMPTY);
  const [mode, setMode] = useState("neuro");
  const [queue, setQueue] = useState([]);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [current, setCurrent] = useState(null);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [answerError, setAnswerError] = useState(null);
  const [requeued, setRequeued] = useState(() => new Set());
  const [sheet, setSheet] = useState("neuro");
  const [confirmReset, setConfirmReset] = useState(false);
  const nextRef = useRef(null);
  const firstOptRef = useRef(null);
  const shownAt = useRef(0);

  const by = useMemo(() => lookupOf(questions), [questions]);

  const begin = useCallback((k, list, missed, lookup) => {
    const ids = k === "mixed" ? list.map((q) => q.id) : k === "missed" ? [...missed] : list.filter((q) => q.t === k).map((q) => q.id);
    const q = shuffle(ids.filter((id) => lookup[id]));
    setMode(k); setQueue(q); setPos(0); setScore({ right: 0, total: 0 }); setRequeued(new Set());
    setCurrent(q[0] ? present(lookup, q[0]) : null); setPicked(null); setResult(null); setAnswerError(null);
    shownAt.current = Date.now();
  }, []);

  // Load the drill bank and this member's progress; fall back to the built-in copy.
  useEffect(() => {
    let cancelled = false;
    Promise.all([drillApi.getQuestions(), drillApi.getProgress()])
      .then(([qs, prog]) => {
        if (cancelled) return;
        if (!qs?.questions?.length) throw new Error("empty drill bank");
        const list = qs.questions.map((q) => ({ id: q.questionId, t: q.drillSet, q: q.stem, o: q.options, domainId: q.domainId, sectionId: q.sectionId }));
        const st = { stats: prog?.stats || {}, missed: prog?.missed || [] };
        setQuestions(list); setStore(st); setSource("server");
        begin("neuro", list, st.missed, lookupOf(list));
      })
      .catch(() => {
        if (cancelled) return;
        const st = loadStore(storageKey);
        setQuestions(LOCAL); setStore(st); setSource("local");
        begin("neuro", LOCAL, st.missed, lookupOf(LOCAL));
      });
    return () => { cancelled = true; };
  }, [storageKey, begin]);

  // Only the built-in copy keeps progress in the browser.
  useEffect(() => {
    if (source !== "local") return;
    try { localStorage.setItem(storageKey, JSON.stringify(store)); } catch { /* storage unavailable */ }
  }, [store, storageKey, source]);

  const idsFor = useCallback((k) => (
    k === "mixed" ? questions.map((q) => q.id)
      : k === "missed" ? store.missed.filter((id) => by[id])
        : questions.filter((q) => q.t === k).map((q) => q.id)
  ), [questions, store.missed, by]);

  const start = (k) => begin(k, questions, store.missed, by);

  const record = useCallback((id, ok) => {
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
  }, [mode, requeued, pos]);

  const answer = useCallback(async (i) => {
    if (!current || picked !== null) return;
    const id = current.id;
    const chosen = current.order[i].idx;
    setPicked(i); setAnswerError(null);
    if (source === "local") {
      const r = { isCorrect: chosen === 0, correctIndex: 0, explanation: current.why, memoryAid: current.mem };
      setResult(r); record(id, r.isCorrect);
      return;
    }
    try {
      const r = await drillApi.answer(id, chosen, Date.now() - shownAt.current);
      setResult(r); record(id, r.isCorrect);
    } catch (err) {
      setPicked(null);
      setAnswerError(err.message || "Could not record that answer. Try again.");
    }
  }, [current, picked, source, record]);

  const next = useCallback(() => {
    const p = pos + 1;
    setPos(p); setPicked(null); setResult(null); setAnswerError(null);
    setCurrent(queue[p] ? present(by, queue[p]) : null);
    shownAt.current = Date.now();
  }, [pos, queue, by]);

  const resetProgress = async () => {
    if (source === "server") {
      try { await drillApi.reset(); } catch (err) { setAnswerError(err.message || "Could not reset progress."); return; }
    }
    setStore(EMPTY); setConfirmReset(false);
    begin(mode === "missed" ? "neuro" : mode, questions, [], by);
  };

  useEffect(() => { if (result) nextRef.current?.focus({ preventScroll: true }); }, [result]);
  useEffect(() => { if (pos > 0 && picked === null) firstOptRef.current?.focus({ preventScroll: true }); }, [pos, picked]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input,textarea,select")) return;
      if (/^[1-4]$/.test(e.key) && current && picked === null && current.order[+e.key - 1]) answer(+e.key - 1);
      else if ((e.key === "Enter" || e.key === "n") && result && document.activeElement !== nextRef.current) { e.preventDefault(); next(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, picked, result, answer, next]);

  const days = Math.ceil((EXAM - new Date()) / 86400000);
  const finished = pos >= queue.length;
  const ok = !!result?.isCorrect;

  const dayCards = useMemo(() => SETS.map((s) => {
    const ids = idsFor(s.key);
    return { ...s, total: ids.length, seen: ids.filter((id) => store.stats[id]).length, right: ids.filter((id) => store.stats[id]?.last === 1).length };
  }), [idsFor, store.stats]);

  return (
    <div className="tdd" data-dark={currentTheme === "dark" ? "true" : "false"}>
      <div className="tdd-wrap">
        <header className="tdd-head">
          <span className="tdd-eyebrow">R. EEG T. exam prep</span>
          <h1>Focus Drills</h1>
          <p className="tdd-lede">
            Four focused sets: neuroanatomy and clinical correlation, paediatric epilepsy syndromes, medication effects on the EEG,
            and the ACNS guidelines (Guidelines 1 to 7, the 2021 critical care terminology and cEEG duties).
            Every answer comes with the reasoning and a hook to remember it. Anything you miss goes into your review pile until you get it right.
          </p>
          <span className="tdd-count">{days > 0 ? `${days} days to the exam (14 December 2026)` : "Exam day has arrived. Good luck."}</span>
        </header>

        <section aria-label="Choose a set" className="tdd-days">
          {dayCards.map((s) => (
            <button key={s.key} type="button" className="tdd-day" aria-pressed={mode === s.key} disabled={source === "loading"} onClick={() => start(s.key)}>
              <span className="tdd-tag">{s.tag}</span>
              <strong>{s.key === "mixed" ? `Mixed: all ${s.total}` : s.name}</strong>
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
          {source === "loading" ? (
            <div className="tdd-done"><p className="tdd-hint">Loading the drill…</p></div>
          ) : queue.length === 0 ? (
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
                  const cls = picked === null ? ""
                    : !result ? (i === picked ? " is-pending" : " is-dim")
                      : o.idx === result.correctIndex ? " is-right" : i === picked ? " is-wrong" : " is-dim";
                  return (
                    <button key={o.text} ref={i === 0 ? firstOptRef : undefined} type="button" className={`tdd-opt${cls}`} disabled={picked !== null} onClick={() => answer(i)}>
                      <kbd>{i + 1}</kbd><span>{o.text}</span>
                    </button>
                  );
                })}
              </div>
              {answerError && <p className="tdd-hint tdd-err" role="alert">{answerError}</p>}
              {result && (
                <div className="tdd-fb">
                  <div className={`tdd-verdict ${ok ? "ok" : "no"}`}>{ok ? "Correct" : "Not quite"}</div>
                  {current.domainId && <span className="tdd-where">{domainTitle(current.domainId)} · {sectionTitle(current.sectionId)}</span>}
                  <p className="tdd-why">{result.explanation}</p>
                  <div className="tdd-mem"><b>Remember it</b>{result.memoryAid}</div>
                  <div className="tdd-row">
                    <span className="tdd-hint">
                      {ok ? "" : source === "server"
                        ? "Added to your review pile, and to Review Incorrect under its domain."
                        : "Added to your review pile. You will see it again shortly."}
                    </span>
                    <button ref={nextRef} className="tdd-btn" type="button" onClick={next}>Next question</button>
                  </div>
                </div>
              )}
              <p className="tdd-hint">Keys: 1-4 to answer, Enter for the next question.</p>
            </>
          )}
        </section>

        <section className="tdd-sheets" aria-labelledby="tdd-sheets-h">
          <div className="tdd-row"><h2 id="tdd-sheets-h">Memory sheets</h2><span className="tdd-hint">Read these before and after each drill.</span></div>
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
          Original questions written for exam practice, not copied from any exam. Check anything that matters clinically against your current references and local protocols.{" "}
          {source === "local"
            ? "The server could not be reached, so this is the built-in copy and progress is saved in this browser only."
            : "Progress is saved to your account, so it follows you to any device."}{" "}
          {confirmReset ? (
            <span>
              <button className="tdd-btn" type="button" onClick={resetProgress}>Yes, reset</button>{" "}
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
