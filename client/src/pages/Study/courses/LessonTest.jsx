import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../utility/api";
import { COURSES_BASE_PATH, coursePath, lessonPath } from "./courseRoutes";

const errorData = (error) => error.response?.data?.error || { message: "The test could not be loaded." };

function TestFeedback({ result }) {
  return <section className={`test-result ${result.passed ? "passed" : "failed"}`} aria-live="polite"><span className="courses-eyebrow">{result.passed ? "Passed" : "Try again"}</span><h2>{result.score}/3 correct</h2><p>{result.passed ? "You passed. The next lesson test is now unlocked." : "You need at least 2 correct answers to pass."}</p>
    <div className="test-feedback-list">{result.feedback.map((item, index) => <article className={`test-feedback ${item.correct ? "correct" : "incorrect"}`} key={item.questionId}><h3><span aria-hidden="true">{item.correct ? "✓" : "×"}</span> Question {index + 1}</h3><p>{item.prompt}</p><p><b>Correct answer{item.correctAnswers.length === 1 ? "" : "s"}:</b> {item.correctAnswers.join(", ") || "No answer was selected."}</p>{!item.correct && item.submittedAnswer && <p><b>Your answer:</b> {Array.isArray(item.submittedAnswer) ? item.submittedAnswer.join(", ") : item.submittedAnswer}</p>}{item.explanation && <p><b>Explanation:</b> {item.explanation}</p>}</article>)}</div>
  </section>;
}

export default function LessonTest() {
  const { lessonId } = useParams();
  const [state, setState] = useState(null); const [lessonInfo, setLessonInfo] = useState(null); const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({}); const [result, setResult] = useState(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [testResponse, lessonResponse] = await Promise.all([api.get(`/courses/lessons/${lessonId}/test`), api.get(`/courses/lessons/${lessonId}`)]);
      setState(testResponse.data.data); setLessonInfo(lessonResponse.data.data);
    } catch (cause) { setError(errorData(cause).message); }
    finally { setLoading(false); }
  }, [lessonId]);
  useEffect(() => {
    let live = true;
    Promise.all([api.get(`/courses/lessons/${lessonId}/test`), api.get(`/courses/lessons/${lessonId}`)])
      .then(([testResponse, lessonResponse]) => { if (live) { setState(testResponse.data.data); setLessonInfo(lessonResponse.data.data); } })
      .catch((cause) => { if (live) setError(errorData(cause).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [lessonId]);

  const start = async () => {
    setBusy(true); setError("");
    try { const { data } = await api.post(`/courses/lessons/${lessonId}/test/start`); setAttempt(data.data); setAnswers({}); setResult(null); }
    catch (cause) { const failure = errorData(cause); setError(failure.message); if (failure.code === "REREAD_REQUIRED") setState((old) => ({ ...old, state: "reread_required", canStart: false })); else if (failure.code === "READ_REQUIRED") setState((old) => ({ ...old, state: "unread", canStart: false })); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!attempt || busy) return;
    setBusy(true); setError("");
    try {
      const payload = attempt.questions.map((question) => ({ questionId: question.questionId, ...(question.type === "mcq" ? { selectedOptions: answers[question.questionId] || [] } : { text: answers[question.questionId] || "" }) }));
      const { data } = await api.post(`/courses/lessons/${lessonId}/test/submit`, { attemptId: attempt.attemptId, answers: payload });
      setResult(data.data); setAttempt(null); await refresh();
    } catch (cause) { const failure = errorData(cause); setError(failure.message); if (["REREAD_REQUIRED", "READ_REQUIRED"].includes(failure.code)) await refresh(); }
    finally { setBusy(false); }
  };

  const toggleOption = (questionId, option) => setAnswers((old) => {
    const selected = old[questionId] || [];
    return { ...old, [questionId]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
  });
  const complete = attempt?.questions.every((question) => question.type === "mcq" ? (answers[question.questionId] || []).length > 0 : String(answers[question.questionId] || "").trim().length > 0);

  if (loading) return <div className="course-message">Loading lesson test…</div>;
  if (error && !lessonInfo) return <div className="course-message"><h2>Test unavailable</h2><p>{error}</p><Link to={COURSES_BASE_PATH} className="course-link">Back to courses</Link></div>;
  const lesson = lessonInfo?.lesson; const course = lessonInfo?.course;
  return <div className="lesson-test-page"><div className="lesson-breadcrumb"><Link to={COURSES_BASE_PATH}>Courses</Link><span>›</span><Link to={coursePath(course?._id)}>{course?.title || "Course"}</Link><span>›</span><Link to={lessonPath(lessonId)}>{lesson?.title || "Lesson"}</Link><span>›</span><span>Lesson test</span></div>
    <header className="test-heading"><span className="courses-eyebrow">Check your understanding</span><h1>{lesson?.title} test</h1><p>3 questions · 2 correct answers to pass</p><Link to={lessonPath(lessonId)} className="course-back">← Return to lesson</Link></header>
    {error && <div className="course-error" role="alert">{error}</div>}
    {result ? <><TestFeedback result={result}/>{result.passed && lessonInfo?.next && <Link className="course-button test-next-lesson" to={lessonPath(lessonInfo.next._id)}>Continue to {lessonInfo.next.title} →</Link>}{!result.passed && state?.state !== "reread_required" && <button className="course-button" disabled={busy} onClick={start}>Try again</button>}{state?.state === "reread_required" && <Link className="course-button" to={lessonPath(lessonId)}>Reread lesson</Link>}</> : attempt ? <section className="test-attempt"><p className="test-progress">3 questions · answer all to submit</p>{attempt.questions.map((question, index) => <fieldset className="learner-test-question" key={question.questionId}><legend>{index + 1}. {question.prompt}</legend>{question.type === "mcq" ? <>{question.options.map((option) => <label className="test-answer-option" key={option}><input type="checkbox" checked={(answers[question.questionId] || []).includes(option)} onChange={() => toggleOption(question.questionId, option)}/><span>{option}</span></label>)}<small>Select every correct option.</small></> : <label className="test-text-answer"><span>Your answer</span><input autoComplete="off" value={answers[question.questionId] || ""} onChange={(event) => setAnswers((old) => ({ ...old, [question.questionId]: event.target.value }))}/></label>}</fieldset>)}<button className="course-button" disabled={busy || !complete} onClick={submit}>{busy ? "Submitting…" : "Submit answers"}</button></section> : state?.state === "unavailable" ? <div className="course-message"><h2>Test not published yet</h2><p>Your lesson is available to read while its test is being prepared.</p></div> : state?.state === "locked" ? <div className="test-locked"><h2>Test locked</h2><p>Pass the previous lesson test to unlock this one.</p></div> : state?.state === "insufficient_questions" ? <div className="test-locked"><h2>Test being prepared</h2><p>{state.questionsNeeded} more question{state.questionsNeeded === 1 ? " is" : "s are"} needed before this test is ready.</p></div> : state?.state === "unread" ? <div className="test-locked"><h2>Read the lesson first</h2><p>Complete the lesson, then return here to start the test.</p><Link className="course-button" to={lessonPath(lessonId)}>Read lesson</Link></div> : state?.state === "reread_required" ? <div className="test-locked"><h2>Reread before retrying</h2><p>Five minutes have passed since your last attempt. Revisit the entire lesson before taking this test again.</p><Link className="course-button" to={lessonPath(lessonId)}>Reread lesson</Link></div> : state?.state === "passed" ? <section className="test-result passed"><span className="courses-eyebrow">Passed · {state.score}/3</span><h2>You passed this lesson test</h2><p>You can take it again, or continue learning.</p>{lessonInfo?.next && <Link className="course-button" to={lessonPath(lessonInfo.next._id)}>Continue to next lesson →</Link>}<button className="course-button secondary" disabled={busy} onClick={start}>Retake test</button></section> : state?.state === "available" ? <section className="test-locked"><h2>Ready when you are</h2>{state.score !== null && state.score !== undefined && <p>Latest score: {state.score}/3</p>}<button className="course-button" disabled={busy} onClick={start}>Start 3-question test</button></section> : <div className="course-message"><h2>Test unavailable</h2><Link to={lessonPath(lessonId)}>Return to lesson</Link></div>}
  </div>;
}
