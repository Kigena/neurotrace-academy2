import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import studyApi from "../services/studyApi";
import { DOMAIN_SHORT, domainTitle, sectionTitle, tagTitle } from "../utils/studyLabels";
import { SOURCE_LABELS, SOURCE_TONE, accuracyTone, groupByDomain } from "../utils/incorrectGroups";

/**
 * Review Incorrect: questions whose most recent attempt was wrong, from any
 * bank or test, grouped by ABRET domain and section so the weak spots show.
 * Retrying records a NEW attempt; the original incorrect attempt is kept.
 */

function OptionList({ options, selectedIndex, correctIndex, onPick, disabled }) {
  return (
    <div className="space-y-2">
      {options.map((opt, idx) => {
        let cls = "w-full text-left rounded-md border px-3 py-2 text-sm";
        if (correctIndex !== undefined && idx === correctIndex) cls += " border-green-500 bg-green-50 text-green-900";
        else if (selectedIndex === idx && correctIndex !== undefined) cls += " border-red-500 bg-red-50 text-red-900";
        else if (selectedIndex === idx) cls += " border-blue-400 bg-blue-50";
        else cls += " border-slate-200 bg-white" + (onPick && !disabled ? " hover:bg-slate-50" : "");
        const content = (
          <>
            <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
            {opt}
            {correctIndex !== undefined && idx === correctIndex && <span className="ml-2 text-xs font-semibold">✓ correct</span>}
            {correctIndex !== undefined && selectedIndex === idx && idx !== correctIndex && (
              <span className="ml-2 text-xs font-semibold">✗ your answer</span>
            )}
          </>
        );
        return onPick ? (
          <button key={idx} type="button" className={cls} disabled={disabled} onClick={() => onPick(idx)}>
            {content}
          </button>
        ) : (
          <div key={idx} className={cls}>{content}</div>
        );
      })}
    </div>
  );
}

function MemoryAid({ text }) {
  if (!text) return null;
  return (
    <div className="rounded-md bg-amber-50 p-3 text-sm text-slate-800">
      <span className="block text-xs font-semibold uppercase tracking-wide text-amber-800">Remember it</span>
      {text}
    </div>
  );
}

function IncorrectCard({ item }) {
  const [mode, setMode] = useState("review"); // review | retry | result
  const [retry, setRetry] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const startedAt = useRef(0);

  const startRetry = async () => {
    setError(null);
    try {
      const res = await studyApi.getRetryQuestion(item.questionId);
      setRetry(res.question);
      setResult(null);
      startedAt.current = Date.now();
      setMode("retry");
    } catch (err) {
      setError(err.message || "Could not load the question.");
    }
  };

  const answer = async (idx) => {
    setError(null);
    try {
      const res = await studyApi.submitRetry(item.questionId, idx, Date.now() - startedAt.current);
      setResult(res);
      setMode("result");
    } catch (err) {
      setError(err.message || "Could not record the retry.");
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">{DOMAIN_SHORT[item.domainId] || domainTitle(item.domainId)}</span>
        {item.source && (
          <span className={`rounded px-2 py-0.5 ${SOURCE_TONE[item.source] || SOURCE_TONE.bank}`}>
            Missed in: {SOURCE_LABELS[item.source] || item.source}
          </span>
        )}
        {/* Section and topic tags can name the answer: hidden while retrying. */}
        {mode !== "retry" && (
          <>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{sectionTitle(item.sectionId)}</span>
            {item.topicTags.filter((t) => !t.startsWith("drill-") && t !== "three-day-drill").slice(0, 4).map((t) => (
              <span key={t} className="rounded bg-slate-50 px-2 py-0.5 text-slate-500">#{tagTitle(t)}</span>
            ))}
          </>
        )}
        <span className="ml-auto text-slate-400">
          missed {item.timesIncorrect}× · {new Date(item.lastAttemptAt).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm font-medium text-slate-900">{(retry || item).stem}</p>

      {mode === "review" && (
        <>
          <OptionList options={item.options} selectedIndex={item.selectedIndex} correctIndex={item.correctIndex} />
          {item.selectedIndex === null && (
            <p className="text-xs text-slate-500">Your earlier selection was not recorded for this attempt.</p>
          )}
          {item.explanation && (
            <div className="rounded bg-slate-50 p-3 text-sm text-slate-700">
              <span className="font-semibold">Explanation:</span> {item.explanation}
            </div>
          )}
          <MemoryAid text={item.memoryAid} />
        </>
      )}

      {mode === "retry" && retry && (
        <>
          <p className="text-xs text-slate-500">Retry: choose an answer. Your earlier attempt stays in your history.</p>
          <OptionList options={retry.options} onPick={answer} />
        </>
      )}

      {mode === "result" && result && (
        <>
          <OptionList options={retry.options} selectedIndex={result.selectedIndex} correctIndex={result.correctIndex} />
          <div className={`rounded p-3 text-sm ${result.isCorrect ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
            <div className="font-semibold">{result.isCorrect ? "Correct — recorded as a new study attempt." : "Still incorrect — recorded."}</div>
            {result.explanation && <div className="text-slate-700 mt-1">{result.explanation}</div>}
            {result.misconception && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                <div className="text-xs font-semibold uppercase tracking-wide">Common mistake: {result.misconception.title}</div>
                <div className="mt-1">{result.misconception.tip}</div>
              </div>
            )}
          </div>
          <MemoryAid text={result.memoryAid} />
        </>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        {mode !== "retry" && (
          <button onClick={startRetry} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
            {mode === "result" ? "RETRY AGAIN" : "RETRY"}
          </button>
        )}
        {mode !== "review" && (
          <button onClick={() => setMode("review")} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50">
            Back to review
          </button>
        )}
      </div>
    </div>
  );
}

/** One card per domain: questions still to review, accuracy over all answers, weakest sections. */
function DomainSummary({ breakdown, active, onPick }) {
  if (!breakdown?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {breakdown.map((d) => {
        const isActive = active === d.domainId;
        const weak = d.sections.filter((s) => s.outstanding > 0).slice(0, 3);
        return (
          <button
            key={d.domainId}
            type="button"
            aria-pressed={isActive}
            onClick={() => onPick(isActive ? null : d.domainId)}
            className={`rounded-lg border bg-white p-4 text-left space-y-2 hover:border-indigo-400 ${isActive ? "border-indigo-600 ring-2 ring-indigo-600" : "border-slate-200"}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{DOMAIN_SHORT[d.domainId] || domainTitle(d.domainId)}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${d.outstanding ? "text-red-700" : "text-emerald-700"}`}>{d.outstanding}</span>
              <span className="text-sm text-slate-600">to review</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
              <div className={`h-full ${accuracyTone(d.accuracy)}`} style={{ width: `${d.accuracy ?? 0}%` }} />
            </div>
            <div className="text-xs text-slate-500">
              {d.accuracy === null ? "No answers yet" : `${d.accuracy}% right over ${d.attempts} answer${d.attempts === 1 ? "" : "s"}`}
            </div>
            {weak.length > 0 && (
              <ul className="space-y-0.5 text-xs text-slate-700">
                {weak.map((s) => (
                  <li key={s.sectionId} className="flex justify-between gap-2">
                    <span className="truncate">{sectionTitle(s.sectionId)}</span>
                    <span className="shrink-0 font-semibold text-red-700">{s.outstanding}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ReviewIncorrect() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [domain, setDomain] = useState(null);
  const [source, setSource] = useState("all");

  useEffect(() => {
    let cancelled = false;
    studyApi
      .getIncorrect(500)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load incorrect questions.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => data?.items || [], [data]);
  const sourceCounts = useMemo(() => {
    const c = {};
    for (const i of items) c[i.source || "bank"] = (c[i.source || "bank"] || 0) + 1;
    return c;
  }, [items]);
  const groups = useMemo(() => {
    const shown = items.filter((i) => (source === "all" || (i.source || "bank") === source) && (!domain || i.domainId === domain));
    return groupByDomain(shown, data?.byDomain);
  }, [items, source, domain, data]);
  const shownCount = groups.reduce((n, g) => n + g.count, 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Incorrect</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Every question you last answered wrong, from the question bank, Challenge Bank, mock exams and the Three-Day Drill,
            grouped by ABRET domain and section so you can see exactly where your weak spots are. The weakest domain comes first.
            A correct retry takes a question off this list; the original wrong answer stays in your history.
          </p>
        </div>
        <Link to="/study" className="text-sm text-indigo-600 hover:underline">← Study dashboard</Link>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!data && !error && <p className="text-sm text-slate-600">Loading…</p>}
      {data && items.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Nothing to review — no questions are currently marked incorrect.
        </div>
      )}

      {data && items.length > 0 && (
        <>
          <DomainSummary breakdown={data.byDomain} active={domain} onPick={setDomain} />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Where the question was missed">
            {["all", "bank", "challenge", "mock", "drill"].filter((k) => k === "all" || sourceCounts[k]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={source === k}
                onClick={() => setSource(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${source === k ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {k === "all" ? `All (${items.length})` : `${SOURCE_LABELS[k]} (${sourceCounts[k]})`}
              </button>
            ))}
            {domain && (
              <button type="button" onClick={() => setDomain(null)} className="text-xs text-indigo-600 hover:underline">
                Show all domains
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              Showing {shownCount} of {data.total}
            </span>
          </div>

          {groups.length === 0 && <p className="text-sm text-slate-600">No missed questions match this filter.</p>}

          {groups.map((g) => (
            <div key={g.domainId} className="space-y-3">
              <h2 className="flex items-baseline gap-2 border-b border-slate-200 pb-1 text-lg font-semibold text-slate-900">
                {domainTitle(g.domainId)}
                <span className="text-sm font-normal text-slate-500">{g.count} to review</span>
              </h2>
              {g.sections.map((s) => (
                <div key={s.sectionId} className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {sectionTitle(s.sectionId)} <span className="font-normal text-slate-500">· {s.items.length}</span>
                  </h3>
                  {s.items.map((item) => (
                    <IncorrectCard key={item.questionId} item={item} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

export default ReviewIncorrect;
