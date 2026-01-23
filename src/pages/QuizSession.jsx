import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import abretQuestionsData from "../data/abret-questions.json";
import workflowData from "../data/workflow-domains.json";
import mockExamPresets from "../data/mockExamPresets.json";
import {
  createQuizSession,
  loadQuizSession,
  updateQuizSession,
  saveAnswer,
  finishQuizSession,
  calculateSessionScore,
  clearQuizSession,
} from "../utils/quizSession.js";
import {
  saveAttemptEvent,
  addScoreToHistory,
  saveBestScore,
} from "../utils/progressTracking.js";

/**
 * QuizSession Page - ABRET Domain Practice Quiz
 * Full quiz interface with configuration, question display, and results
 */

function QuizSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Configuration state
  const [config, setConfig] = useState({
    mode: "practice", // "practice" | "timed" | "mock"
    domains: [],
    sections: [],
    tags: [],
    difficulty: [],
    shuffle: true,
    questionCount: 10,
    timeLimitSec: null,
  });

  // Quiz state
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [timeSpent, setTimeSpent] = useState({}); // questionId -> timeMs
  const [flagged, setFlagged] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set()); // Track answered questions for immediate feedback

  // Timer
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const questionStartTimeRef = useRef(null);

  // Get all domains and sections for filters
  const allDomains = useMemo(() => workflowData.domains || [], []);
  const allSections = useMemo(() => {
    const sections = [];
    allDomains.forEach((domain) => {
      domain.sections?.forEach((section) => {
        sections.push({ ...section, domainId: domain.id, domainTitle: domain.title });
      });
    });
    return sections;
  }, [allDomains]);

  // Get all unique tags from questions
  const allTags = useMemo(() => {
    const tagSet = new Set();
    abretQuestionsData.questions?.forEach((q) => {
      q.topicTags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, []);

  // Shuffle array helper
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Filter available questions based on config
  const availableQuestions = useMemo(() => {
    if (!abretQuestionsData.questions) return [];

    return abretQuestionsData.questions.filter((q) => {
      if (config.domains.length > 0 && !config.domains.includes(q.domainId)) return false;
      if (config.sections.length > 0 && !config.sections.includes(q.sectionId)) return false;
      if (config.difficulty.length > 0 && !config.difficulty.includes(q.difficulty)) return false;
      if (config.tags.length > 0 && !config.tags.some((tag) => q.topicTags?.includes(tag))) return false;
      return true;
    });
  }, [config]);

  // Initialize from URL params
  useEffect(() => {
    const sectionParam = searchParams.get("section");
    const tagsParam = searchParams.get("tags");
    const questionsParam = searchParams.get("questions");
    const modeParam = searchParams.get("mode");

    if (sectionParam) {
      setConfig((prev) => ({ ...prev, sections: [sectionParam] }));
    }
    if (tagsParam) {
      // Filter out empty tags
      const tags = tagsParam.split(",").filter(tag => tag.trim() !== "");
      if (tags.length > 0) {
        setConfig((prev) => ({ ...prev, tags }));
      }
    }
    if (questionsParam) {
      const count = parseInt(questionsParam, 10);
      if (!isNaN(count) && count > 0) {
        setConfig((prev) => ({ ...prev, questionCount: count }));
      }
    }
    if (modeParam && ["practice", "timed", "mock"].includes(modeParam)) {
      setConfig((prev) => ({ ...prev, mode: modeParam }));
    }
  }, [searchParams]);

  // Timer effect
  useEffect(() => {
    if (!session || session.mode === "practice" || !session.timeLimitSec) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      if (!session.startTime) return;

      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      const remaining = session.timeLimitSec - elapsed;

      if (remaining <= 0) {
        handleFinishQuiz();
        return;
      }

      setTimeLeft(remaining);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  // Track question start time
  useEffect(() => {
    if (session && questions.length > 0 && currentIndex < questions.length) {
      questionStartTimeRef.current = Date.now();
    }
  }, [currentIndex, session, questions]);

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Handler for starting mock exam from preset
  const handleMockExam = async (presetId) => {
    const preset = mockExamPresets.presets.find((p) => p.id === presetId);
    if (!preset) return;

    // Select questions based on preset configuration
    const selectedQuestions = selectQuestionsForMockExam(preset);

    if (selectedQuestions.length === 0) {
      alert("No questions available for this mock exam. Please try another preset.");
      return;
    }

    const timeLimit = preset.timeLimitMinutes * 60; // Convert to seconds

    const newSession = await createQuizSession({
      mode: "mock",
      domains: preset.domainDistribution.map((d) => d.domainId),
      sections: [],
      tags: [],
      difficulty: [],
      shuffle: preset.shuffle,
      questionCount: selectedQuestions.length,
      timeLimitSec: timeLimit,
      questions: selectedQuestions,
    });

    const questionIds = newSession.questionIds;
    const questionMap = new Map(selectedQuestions.map((q) => [q.id, q]));
    const sessionQuestions = questionIds.map((id) => questionMap.get(id)).filter(Boolean);

    // Shuffle options for each question (if enabled)
    // BUT skip shuffling for questions with "Both X and Y" patterns to preserve meaning
    const shuffledQuestions = preset.shuffle ? sessionQuestions.map((q) => {
      // Check if question has "Both X and Y" pattern
      const hasBothPattern = q.options.some(opt => {
        if (typeof opt !== 'string') return false;
        const bothPattern = /Both\s+[A-D]\s+and\s+[A-D]/i.test(opt);
        const otherPatterns =
          opt.includes('All of the above') ||
          opt.includes('None of the above') ||
          opt.includes('All of above') ||
          opt.includes('None of above');
        return bothPattern || otherPatterns;
      });

      if (hasBothPattern) {
        return q;
      }

      const options = [...q.options];
      const answerIndex = q.answerIndex;
      const shuffledIndices = shuffleArray([...Array(options.length).keys()]);
      const shuffledOptions = shuffledIndices.map((i) => options[i]);
      const newAnswerIndex = shuffledIndices.indexOf(answerIndex);
      return { ...q, options: shuffledOptions, answerIndex: newAnswerIndex };
    }) : sessionQuestions;

    setSession(newSession);
    setQuestions(shuffledQuestions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setStartTime(Date.now());
    setTimeSpent({});
    setFlagged(new Set());
    setShowResults(false);
    setReviewMode(false);
    setAnsweredQuestions(new Set());
    setTimeLeft(timeLimit);
  };

  // Select questions based on mock exam preset configuration
  const selectQuestionsForMockExam = (preset) => {
    const allQuestions = abretQuestionsData.questions || [];
    const selected = [];

    // Group questions by domain and difficulty
    const domainGroups = {};
    preset.domainDistribution.forEach((dist) => {
      domainGroups[dist.domainId] = {
        easy: [],
        medium: [],
        hard: [],
      };
    });

    // Categorize all questions
    allQuestions.forEach((q) => {
      if (domainGroups[q.domainId]) {
        domainGroups[q.domainId][q.difficulty].push(q);
      }
    });

    // Select questions for each domain according to distribution
    preset.domainDistribution.forEach((dist) => {
      const domainQs = domainGroups[dist.domainId];
      if (!domainQs) return;

      const targetCount = dist.count;
      const easyCount = Math.round(targetCount * preset.difficultyDistribution.easy);
      const mediumCount = Math.round(targetCount * preset.difficultyDistribution.medium);
      const hardCount = targetCount - easyCount - mediumCount;

      // Shuffle and select from each difficulty
      const easySelected = shuffleArray([...domainQs.easy]).slice(0, Math.min(easyCount, domainQs.easy.length));
      const mediumSelected = shuffleArray([...domainQs.medium]).slice(0, Math.min(mediumCount, domainQs.medium.length));
      const hardSelected = shuffleArray([...domainQs.hard]).slice(0, Math.min(hardCount, domainQs.hard.length));

      selected.push(...easySelected, ...mediumSelected, ...hardSelected);
    });

    // Final shuffle
    return shuffleArray(selected).slice(0, preset.questionCount);
  };

  const handleStartQuiz = async () => {
    if (availableQuestions.length === 0) {
      alert("No questions match the selected filters. Please adjust your selection.");
      return;
    }

    const count = Math.min(config.questionCount, availableQuestions.length);
    const timeLimit = config.mode === "timed" ? 60 * 60 : config.mode === "mock" ? 120 * 60 : null;

    const newSession = await createQuizSession({
      mode: config.mode,
      domains: config.domains,
      sections: config.sections,
      tags: config.tags,
      difficulty: config.difficulty,
      shuffle: config.shuffle,
      questionCount: count,
      timeLimitSec: timeLimit,
      questions: availableQuestions,
    });

    const questionIds = newSession.questionIds;
    const questionMap = new Map(availableQuestions.map((q) => [q.id, q]));
    const sessionQuestions = questionIds.map((id) => questionMap.get(id)).filter(Boolean);

    // Shuffle options for each question (if shuffle is enabled)
    // BUT skip shuffling for questions with "Both X and Y" patterns to preserve meaning
    const shuffledQuestions = config.shuffle ? sessionQuestions.map((q) => {
      // Check if question has "Both X and Y" pattern (where X and Y are any letters A-D)
      // or other patterns that reference specific option positions
      const hasBothPattern = q.options.some(opt => {
        if (typeof opt !== 'string') return false;
        // Match "Both [A-D] and [A-D]" pattern (case insensitive)
        const bothPattern = /Both\s+[A-D]\s+and\s+[A-D]/i.test(opt);
        // Also check for other position-dependent patterns
        const otherPatterns =
          opt.includes('All of the above') ||
          opt.includes('None of the above') ||
          opt.includes('All of above') ||
          opt.includes('None of above');
        return bothPattern || otherPatterns;
      });

      // Don't shuffle options for questions with "Both" patterns or position-dependent options
      if (hasBothPattern) {
        return q; // Return question unchanged
      }

      const options = [...q.options];
      const answerIndex = q.answerIndex;
      const shuffledIndices = shuffleArray([...Array(options.length).keys()]);
      const shuffledOptions = shuffledIndices.map((i) => options[i]);
      const newAnswerIndex = shuffledIndices.indexOf(answerIndex);
      return { ...q, options: shuffledOptions, answerIndex: newAnswerIndex };
    }) : sessionQuestions;

    setSession(newSession);
    setQuestions(shuffledQuestions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setStartTime(Date.now());
    setTimeSpent({});
    setFlagged(new Set());
    setShowResults(false);
    setReviewMode(false);
    setAnsweredQuestions(new Set());
    setTimeLeft(timeLimit);
  };

  const handleAnswerSelect = async (questionId, answerIndex) => {
    if (!session || showResults) return;

    // Track time spent on this question
    if (questionStartTimeRef.current) {
      const timeMs = Date.now() - questionStartTimeRef.current;
      setTimeSpent((prev) => ({ ...prev, [questionId]: (prev[questionId] || 0) + timeMs }));
      questionStartTimeRef.current = Date.now();
    }

    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
    setAnsweredQuestions((prev) => new Set([...prev, questionId])); // Mark as answered for feedback

    const question = questions.find((q) => q.id === questionId);
    if (question) {
      const isCorrect = answerIndex === question.answerIndex;
      await saveAnswer(questionId, answerIndex, isCorrect, timeSpent[questionId] || 0);

      // Save attempt event immediately for practice mode
      if (session.mode === "practice") {
        await saveAttemptEvent({
          questionId: question.id,
          domainId: question.domainId,
          sectionId: question.sectionId,
          topicTags: question.topicTags || [],
          difficulty: question.difficulty,
          isCorrect,
          timestamp: Date.now(),
          timeMs: timeSpent[questionId] || 0,
          mode: session.mode,
        });
      }
    }
  };

  const handleToggleFlag = (questionId) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleJumpToQuestion = (index) => {
    setCurrentIndex(index);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinishQuiz = async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Save all attempt events
      // Use Promise.allSettled to ensure one failure doesn't block the rest
      await Promise.allSettled(questions.map(async (q) => {
        const answer = selectedAnswers[q.id];
        if (answer !== undefined) {
          const isCorrect = answer === q.answerIndex;
          const timeMs = timeSpent[q.id] || 0;

          await saveAttemptEvent({
            questionId: q.id,
            domainId: q.domainId,
            sectionId: q.sectionId,
            topicTags: q.topicTags || [],
            difficulty: q.difficulty,
            isCorrect,
            timestamp: Date.now(),
            timeMs,
            mode: session.mode,
          });
        }
      }));

      const finishedSession = await finishQuizSession();

      // Construct a reliable session object for scoring using local state
      // This ensures results show even if backend sync failed or is stale
      const finalSessionForScore = {
        ...session,
        ...(finishedSession || {}),
        answers: {
          ...(session?.answers || {}),
          ...Object.entries(selectedAnswers).reduce((acc, [qId, idx]) => {
            const q = questions.find(question => question.id === qId);
            acc[qId] = {
              chosenIndex: idx,
              isCorrect: q ? idx === q.answerIndex : false,
              timeMs: timeSpent[qId] || 0
            };
            return acc;
          }, {})
        },
        endTime: Date.now()
      };

      setSession(finalSessionForScore);

      // Calculate and save score
      const score = calculateSessionScore(finalSessionForScore, questions);
      if (score) {
        // Save to score history
        await addScoreToHistory({
          percent: score.percent,
          correct: score.correct,
          total: score.total,
          attempted: score.attempted,
          mode: session.mode,
          timestamp: Date.now(),
        });

        // Save best score if better
        await saveBestScore({
          percent: score.percent,
          correct: score.correct,
          total: score.total,
          attempted: score.attempted,
          mode: session.mode,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("Error during quiz finish:", error);
      // Fallback: Show results anyway using local state calculation if needed
    } finally {
      setIsSubmitting(false);
      setShowResults(true);
      setReviewMode(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleReset = () => {
    clearQuizSession();
    setSession(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setStartTime(null);
    setTimeSpent({});
    setFlagged(new Set());
    setShowResults(false);
    setReviewMode(false);
    setTimeLeft(null);
  };

  const score = useMemo(() => {
    if (!session || !showResults) return null;
    return calculateSessionScore(session, questions);
  }, [session, questions, showResults]);

  const currentQuestion = questions[currentIndex];
  const unansweredIds = useMemo(() => {
    return questions.filter((q) => selectedAnswers[q.id] === undefined).map((q) => q.id);
  }, [questions, selectedAnswers]);

  // Quick-start domain quiz
  const handleDomainQuiz = async (domainId) => {
    const domain = allDomains.find((d) => d.id === domainId);
    if (!domain) return;

    // Get all questions from this domain
    const domainQuestions = availableQuestions.filter((q) => q.domainId === domainId);
    if (domainQuestions.length === 0) {
      alert(`No questions available for ${domain.title}. Please check your question bank.`);
      return;
    }

    // Balance across subsections (25-40 questions)
    const questionCount = Math.min(35, domainQuestions.length);

    // Group by section and balance
    const sectionGroups = {};
    domainQuestions.forEach((q) => {
      if (!sectionGroups[q.sectionId]) {
        sectionGroups[q.sectionId] = [];
      }
      sectionGroups[q.sectionId].push(q);
    });

    // Distribute questions across sections
    const questionsPerSection = Math.ceil(questionCount / Object.keys(sectionGroups).length);
    const selectedQuestions = [];

    Object.values(sectionGroups).forEach((sectionQs) => {
      const shuffled = shuffleArray([...sectionQs]);
      selectedQuestions.push(...shuffled.slice(0, Math.min(questionsPerSection, sectionQs.length)));
    });

    // Shuffle final selection
    const finalQuestions = shuffleArray(selectedQuestions).slice(0, questionCount);

    const newSession = await createQuizSession({
      mode: "timed",
      domains: [domainId],
      sections: [],
      tags: [],
      difficulty: [],
      shuffle: true,
      questionCount: finalQuestions.length,
      timeLimitSec: 60 * 60, // 1 hour
      questions: finalQuestions,
    });

    const questionIds = newSession.questionIds;
    const questionMap = new Map(finalQuestions.map((q) => [q.id, q]));
    const sessionQuestions = questionIds.map((id) => questionMap.get(id)).filter(Boolean);

    // Shuffle options for each question
    // BUT skip shuffling for questions with "Both X and Y" patterns to preserve meaning
    const shuffledQuestions = sessionQuestions.map((q) => {
      // Check if question has "Both X and Y" pattern (where X and Y are any letters A-D)
      // or other patterns that reference specific option positions
      const hasBothPattern = q.options.some(opt => {
        if (typeof opt !== 'string') return false;
        // Match "Both [A-D] and [A-D]" pattern (case insensitive)
        const bothPattern = /Both\s+[A-D]\s+and\s+[A-D]/i.test(opt);
        // Also check for other position-dependent patterns
        const otherPatterns =
          opt.includes('All of the above') ||
          opt.includes('None of the above') ||
          opt.includes('All of above') ||
          opt.includes('None of above');
        return bothPattern || otherPatterns;
      });

      // Don't shuffle options for questions with "Both" patterns or position-dependent options
      if (hasBothPattern) {
        return q; // Return question unchanged
      }

      const options = [...q.options];
      const answerIndex = q.answerIndex;
      const shuffledIndices = shuffleArray([...Array(options.length).keys()]);
      const shuffledOptions = shuffledIndices.map((i) => options[i]);
      const newAnswerIndex = shuffledIndices.indexOf(answerIndex);
      return { ...q, options: shuffledOptions, answerIndex: newAnswerIndex };
    });

    setSession(newSession);
    setQuestions(shuffledQuestions);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setStartTime(Date.now());
    setTimeSpent({});
    setFlagged(new Set());
    setShowResults(false);
    setReviewMode(false);
    setAnsweredQuestions(new Set());
    setTimeLeft(60 * 60);
  };

  // Configuration Screen
  if (!session) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">ABRET Domain Practice Quiz</h1>
          <p className="text-sm text-slate-700 max-w-3xl">
            Configure your quiz session. Select domains, sections, difficulty levels, and tags to customize your practice.
          </p>
        </div>

        {/* Quick Start: Domain Quizzes */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Quick Start: Domain Quizzes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allDomains.map((domain) => {
              const domainQuestionCount = availableQuestions.filter((q) => q.domainId === domain.id).length;
              return (
                <button
                  key={domain.id}
                  onClick={() => handleDomainQuiz(domain.id)}
                  disabled={domainQuestionCount === 0}
                  className="px-4 py-3 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  <div className="font-semibold">{domain.title}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    {domainQuestionCount > 0 ? `${domainQuestionCount} questions` : "No questions"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ABRET Mock Exams */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">ABRET Mock Exams</h2>

          {/* Full Mock Exam */}
          <div className="mb-4">
            <button
              onClick={() => handleMockExam("mock-full-130")}
              className="w-full px-4 py-3 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Full ABRET Mock Exam (130 Questions, 2 hours)
            </button>
            <p className="text-xs text-slate-600 mt-1 text-center">
              Complete exam covering all domains with official distribution
            </p>
          </div>

          {/* Mock Exam Sets (30 questions each) */}
          <div className="mb-4">
            <h3 className="text-xs font-medium text-slate-700 mb-2">Mock Exam Sets (30 Questions Each)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {mockExamPresets.presets
                .filter((p) => p.id.startsWith("mock-set-"))
                .map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleMockExam(preset.id)}
                    className="px-3 py-2 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    {preset.title}
                  </button>
                ))}
            </div>
          </div>

          {/* Domain-Specific Mocks */}
          <div>
            <h3 className="text-xs font-medium text-slate-700 mb-2">Domain-Specific Mock Exams</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {mockExamPresets.presets
                .filter((p) => p.id.startsWith("mock-domain-"))
                .map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleMockExam(preset.id)}
                    className="px-3 py-2 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
                  >
                    {preset.title}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Quiz Configuration</h2>

              {/* Mode Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Mode</label>
                <div className="flex gap-2">
                  {["practice", "timed", "mock"].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleConfigChange("mode", mode)}
                      className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${config.mode === mode
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                    >
                      {mode === "practice" ? "Practice" : mode === "timed" ? "Timed" : "Mock Exam"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Number of Questions: {config.questionCount}
                </label>
                <input
                  type="range"
                  min="5"
                  max={Math.min(50, availableQuestions.length)}
                  value={config.questionCount}
                  onChange={(e) => handleConfigChange("questionCount", parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-slate-500 mt-1">
                  {availableQuestions.length} questions available
                </div>
              </div>

              {/* Domain Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Domains</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {allDomains.map((domain) => (
                    <label key={domain.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={config.domains.includes(domain.id)}
                        onChange={(e) => {
                          const newDomains = e.target.checked
                            ? [...config.domains, domain.id]
                            : config.domains.filter((d) => d !== domain.id);
                          handleConfigChange("domains", newDomains);
                        }}
                        className="rounded"
                      />
                      <span>{domain.title} ({domain.examWeightPercent}%)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Sections</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {allSections.map((section) => (
                    <label key={section.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={config.sections.includes(section.id)}
                        onChange={(e) => {
                          const newSections = e.target.checked
                            ? [...config.sections, section.id]
                            : config.sections.filter((s) => s !== section.id);
                          handleConfigChange("sections", newSections);
                        }}
                        className="rounded"
                      />
                      <span className="text-slate-600">{section.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Difficulty</label>
                <div className="flex gap-2">
                  {["easy", "medium", "hard"].map((diff) => (
                    <label key={diff} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={config.difficulty.includes(diff)}
                        onChange={(e) => {
                          const newDiff = e.target.checked
                            ? [...config.difficulty, diff]
                            : config.difficulty.filter((d) => d !== diff);
                          handleConfigChange("difficulty", newDiff);
                        }}
                        className="rounded"
                      />
                      <span className="capitalize">{diff}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Tags Selection */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 mb-2">Topic Tags</label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {allTags.slice(0, 20).map((tag) => (
                    <label key={tag} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={config.tags.includes(tag)}
                        onChange={(e) => {
                          const newTags = e.target.checked
                            ? [...config.tags, tag]
                            : config.tags.filter((t) => t !== tag);
                          handleConfigChange("tags", newTags);
                        }}
                        className="rounded"
                      />
                      <span className="text-slate-600">{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Shuffle */}
              <div className="mb-4">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={config.shuffle}
                    onChange={(e) => handleConfigChange("shuffle", e.target.checked)}
                    className="rounded"
                  />
                  <span>Shuffle questions</span>
                </label>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartQuiz}
                disabled={availableQuestions.length === 0}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Start Quiz ({config.questionCount} questions)
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Preview</h2>
            <div className="space-y-2 text-xs text-slate-700">
              <div>
                <span className="font-medium">Mode:</span> {config.mode}
              </div>
              <div>
                <span className="font-medium">Questions Available:</span> {availableQuestions.length}
              </div>
              <div>
                <span className="font-medium">Selected:</span> {config.questionCount}
              </div>
              {config.domains.length > 0 && (
                <div>
                  <span className="font-medium">Domains:</span> {config.domains.length}
                </div>
              )}
              {config.sections.length > 0 && (
                <div>
                  <span className="font-medium">Sections:</span> {config.sections.length}
                </div>
              )}
              {config.difficulty.length > 0 && (
                <div>
                  <span className="font-medium">Difficulty:</span> {config.difficulty.join(", ")}
                </div>
              )}
              {config.tags.length > 0 && (
                <div>
                  <span className="font-medium">Tags:</span> {config.tags.slice(0, 5).join(", ")}
                  {config.tags.length > 5 && ` +${config.tags.length - 5} more`}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Results Screen
  if (showResults && score) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Quiz Results</h1>
          <p className="text-sm text-slate-700">
            {session.mode === "practice" ? "Practice" : session.mode === "timed" ? "Timed" : "Mock Exam"} completed
          </p>
        </div>

        {/* Score Summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Score</h2>
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50"
            >
              Start New Quiz
            </button>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-5xl font-bold text-blue-700 bg-blue-50 px-6 py-4 rounded-lg border border-blue-200">
              {score.percent}%
            </div>
            <div className="text-sm text-slate-700">
              <div className="font-medium text-slate-900 mb-1">
                {score.correct} / {score.attempted} correct
              </div>
              <div className="text-xs text-slate-500">
                {score.total - score.attempted} unanswered
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Domain */}
        {Object.keys(score.breakdown.byDomain).length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Performance by Domain</h3>
            <div className="space-y-2">
              {Object.entries(score.breakdown.byDomain).map(([domainId, stats]) => {
                const domain = allDomains.find((d) => d.id === domainId);
                const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={domainId} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{domain?.title || domainId}</span>
                    <span className="font-medium text-slate-900">
                      {stats.correct}/{stats.total} ({percent}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Breakdown by Difficulty */}
        {Object.keys(score.breakdown.byDifficulty).length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Performance by Difficulty</h3>
            <div className="space-y-2">
              {Object.entries(score.breakdown.byDifficulty).map(([difficulty, stats]) => {
                const percent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return (
                  <div key={difficulty} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 capitalize">{difficulty}</span>
                    <span className="font-medium text-slate-900">
                      {stats.correct}/{stats.total} ({percent}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Review Mode Toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setReviewMode(!reviewMode)}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
          >
            {reviewMode ? "Hide Review" : "Review Questions"}
          </button>
          <button
            onClick={() => navigate("/progress")}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            View Progress →
          </button>
        </div>

        {/* Review Questions */}
        {reviewMode && (
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const selected = selectedAnswers[q.id];
              const isCorrect = selected === q.answerIndex;
              return (
                <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-slate-500">Question {idx + 1}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                    >
                      {isCorrect ? "Correct" : "Incorrect"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 mb-3">{q.stem}</p>
                  <div className="space-y-2">
                    {q.options.map((option, optIdx) => {
                      const isSelected = selected === optIdx;
                      const isAnswer = optIdx === q.answerIndex;
                      let optionClass = "w-full text-left rounded-md border px-3 py-2 text-sm";
                      if (isAnswer) {
                        optionClass += " border-green-500 bg-green-50";
                      } else if (isSelected && !isAnswer) {
                        optionClass += " border-red-500 bg-red-50";
                      } else {
                        optionClass += " border-slate-200 bg-white";
                      }
                      return (
                        <div key={optIdx} className={optionClass}>
                          <span className="font-semibold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                          {option}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && (
                    <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded">
                      <span className="font-semibold">Explanation:</span> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // Quiz in Progress
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ABRET Practice Quiz</h1>
          <p className="text-xs text-slate-500">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {timeLeft !== null && (
            <div className="text-sm font-medium text-slate-700">
              Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </div>
          )}
          <button
            onClick={handleFinishQuiz}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-70 disabled:cursor-wait"
          >
            {isSubmitting ? "Saving..." : "Finish Quiz"}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Navigation Grid */}
      <div className="flex flex-wrap gap-1">
        {questions.map((q, idx) => {
          const isAnswered = selectedAnswers[q.id] !== undefined;
          const isFlagged = flagged.has(q.id);
          const isCurrent = idx === currentIndex;
          let buttonClass = "w-8 h-8 rounded text-xs font-medium transition-colors";
          if (isCurrent) {
            buttonClass += " bg-blue-600 text-white";
          } else if (isFlagged) {
            buttonClass += " bg-yellow-100 text-yellow-800 border-2 border-yellow-400";
          } else if (isAnswered) {
            buttonClass += " bg-green-100 text-green-800";
          } else {
            buttonClass += " bg-slate-100 text-slate-600 hover:bg-slate-200";
          }
          return (
            <button
              key={q.id}
              onClick={() => handleJumpToQuestion(idx)}
              className={buttonClass}
              title={q.stem.substring(0, 50)}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question */}
      {currentQuestion && (() => {
        const selectedAnswer = selectedAnswers[currentQuestion.id];

        return (
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                  {currentQuestion.difficulty}
                </span>
                <span className="text-xs text-slate-500">
                  {currentQuestion.topicTags?.slice(0, 2).join(", ")}
                </span>
              </div>
              <button
                onClick={() => handleToggleFlag(currentQuestion.id)}
                className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
              >
                {flagged.has(currentQuestion.id) ? "★ Flagged" : "☆ Flag"}
              </button>
            </div>

            <p className="text-sm font-medium text-slate-900 mb-4">{currentQuestion.stem}</p>

            <div className="space-y-2">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedAnswer === idx;
                let optionClass =
                  "w-full text-left rounded-md border px-4 py-3 text-sm transition";

                // Only show selection state, no correct/incorrect feedback during quiz
                if (isSelected) {
                  optionClass += " border-blue-400 bg-blue-50 text-blue-900 font-medium";
                } else {
                  optionClass += " border-slate-200 hover:bg-slate-50";
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswerSelect(currentQuestion.id, idx)}
                    className={optionClass}
                  >
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>

        <div className="text-xs text-slate-500">
          {unansweredIds.length} unanswered
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex === questions.length - 1}
          className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </section>
  );
}

export default QuizSession;

