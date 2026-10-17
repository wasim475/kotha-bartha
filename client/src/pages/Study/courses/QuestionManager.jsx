import { useCallback, useEffect, useState } from "react";
import { api } from "../../../utility/api";

const blankQuestion = () => ({ type: "mcq", prompt: "", options: [{ text: "", correct: false }, { text: "", correct: false }], acceptedAnswers: "", explanation: "" });
const messageFor = (error) => error.response?.data?.error?.message || "Could not save the question changes.";

function QuestionFields({ value, onChange }) {
  const change = (key, next) => onChange({ ...value, [key]: next });
  const updateOption = (index, key, next) => change("options", value.options.map((option, i) => i === index ? { ...option, [key]: next } : option));
  return <div className="course-question-fields">
    <label>Question type<select value={value.type} onChange={(event) => change("type", event.target.value)}><option value="mcq">Multiple choice</option><option value="short_answer">Short answer / fill in the blank</option><option value="sentence">Sentence-based answer</option></select></label>
    <label>Question text<textarea required maxLength="1000" rows="2" value={value.prompt} onChange={(event) => change("prompt", event.target.value)} placeholder="Write the question"/></label>
    {value.type === "mcq" ? <fieldset className="course-options"><legend>Options — tick every correct answer</legend>{value.options.map((option, index) => <div className="course-option-row" key={index}><input aria-label={`Option ${index + 1}`} required value={option.text} onChange={(event) => updateOption(index, "text", event.target.value)} placeholder={`Option ${index + 1}`}/><label><input type="checkbox" checked={option.correct} onChange={(event) => updateOption(index, "correct", event.target.checked)}/> Correct</label><button type="button" disabled={value.options.length <= 2} aria-label={`Remove option ${index + 1}`} onClick={() => change("options", value.options.filter((_, i) => i !== index))}>Remove</button></div>)}{value.options.length < 10 && <button type="button" className="course-button secondary" onClick={() => change("options", [...value.options, { text: "", correct: false }])}>Add option</button>}</fieldset> : <label>Accepted answers<textarea required rows="2" value={value.acceptedAnswers} onChange={(event) => change("acceptedAnswers", event.target.value)} placeholder="in, on, at"/><small>Separate alternatives with commas. A learner may answer with any one of them.</small></label>}
    <label>Explanation (optional)<textarea maxLength="1000" rows="2" value={value.explanation} onChange={(event) => change("explanation", event.target.value)}/></label>
  </div>;
}

function toEditor(question) {
  return { ...question, acceptedAnswers: (question.acceptedAnswers || []).join(", "), options: question.options?.length ? question.options.map((option) => ({ ...option })) : blankQuestion().options };
}

export default function QuestionManager({ lesson, onClose }) {
  const [saved, setSaved] = useState([]); const [published, setPublished] = useState(lesson.testPublished); const [drafts, setDrafts] = useState([blankQuestion()]);
  const [editing, setEditing] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const refresh = useCallback(async () => { try { const { data } = await api.get(`/staff/courses/lessons/${lesson._id}/questions`); setSaved(data.data.questions); setPublished(data.data.testPublished); setError(""); } catch (err) { setError(messageFor(err)); } finally { setLoading(false); } }, [lesson._id]);
  useEffect(() => {
    let live = true;
    api.get(`/staff/courses/lessons/${lesson._id}/questions`)
      .then(({ data }) => { if (live) { setSaved(data.data.questions); setPublished(data.data.testPublished); setError(""); } })
      .catch((err) => { if (live) setError(messageFor(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [lesson._id]);
  const saveBulk = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await api.post(`/staff/courses/lessons/${lesson._id}/questions`, { questions: drafts.map((q) => ({ ...q, acceptedAnswers: q.acceptedAnswers })) }); setDrafts([blankQuestion()]); await refresh(); } catch (err) { setError(messageFor(err)); } finally { setBusy(false); } };
  const saveEdit = async (event) => { event.preventDefault(); if (!editing) return; setBusy(true); setError(""); try { await api.patch(`/staff/courses/questions/${editing._id}`, { ...editing, acceptedAnswers: editing.acceptedAnswers }); setEditing(null); await refresh(); } catch (err) { setError(messageFor(err)); } finally { setBusy(false); } };
  const remove = async (question) => { if (!window.confirm("Delete this test question?")) return; setBusy(true); try { await api.delete(`/staff/courses/questions/${question._id}`); await refresh(); } catch (err) { setError(messageFor(err)); } finally { setBusy(false); } };
  const move = async (index, direction) => { const otherIndex = index + direction; if (otherIndex < 0 || otherIndex >= saved.length) return; const reordered = [...saved]; [reordered[index], reordered[otherIndex]] = [reordered[otherIndex], reordered[index]]; setBusy(true); try { await Promise.all(reordered.map((question, order) => api.patch(`/staff/courses/questions/${question._id}`, { order }))); await refresh(); } catch (err) { setError(messageFor(err)); } finally { setBusy(false); } };
  const togglePublished = async () => { setBusy(true); setError(""); try { const { data } = await api.patch(`/staff/courses/lessons/${lesson._id}/test`, { published: !published }); setPublished(data.data.published); } catch (err) { setError(messageFor(err)); } finally { setBusy(false); } };

  return <section className="question-manager" aria-label={`Questions for ${lesson.title}`}><header><div><span className="courses-eyebrow">Lesson test</span><h3>{lesson.title}</h3><p>{saved.length} questions · exactly 3 per attempt</p></div><button className="course-button secondary" onClick={onClose}>Close</button></header>
    {error && <div className="course-error" role="alert">{error}</div>}{loading ? <p>Loading questions…</p> : <>
      <div className="test-publication-row"><span>{published ? "Test published" : "Test draft"}{saved.length < 3 && ` · Add ${3 - saved.length} more to publish`}</span><button className="course-button" disabled={busy || (!published && saved.length < 3)} onClick={togglePublished}>{published ? "Unpublish test" : "Publish test"}</button></div>
      <div className="saved-questions">{saved.map((question, index) => <article className="saved-question" key={question._id}><div><b>{index + 1}. {question.prompt}</b><small>{question.type === "mcq" ? question.options.map((option) => `${option.correct ? "✓ " : ""}${option.text}`).join(" · ") : `Accepted: ${question.acceptedAnswers.join(", ")}`}</small></div><div className="question-actions"><button disabled={busy || index === 0} aria-label={`Move question ${index + 1} up`} onClick={() => move(index, -1)}>↑</button><button disabled={busy || index === saved.length - 1} aria-label={`Move question ${index + 1} down`} onClick={() => move(index, 1)}>↓</button><button disabled={busy} onClick={() => setEditing(toEditor(question))}>Edit</button><button disabled={busy} onClick={() => remove(question)}>Delete</button></div></article>)}</div>
      {editing && <form className="question-form" onSubmit={saveEdit}><h4>Edit question</h4><QuestionFields value={editing} onChange={setEditing}/><button className="course-button" disabled={busy}>{busy ? "Saving…" : "Save question"}</button><button type="button" className="course-button secondary" onClick={() => setEditing(null)}>Cancel</button></form>}
      <form className="question-form" onSubmit={saveBulk}><h4>Add questions</h4>{drafts.map((question, index) => <fieldset className="question-draft" key={index}><legend>New question {index + 1}</legend><QuestionFields value={question} onChange={(value) => setDrafts((old) => old.map((item, i) => i === index ? value : item))}/><button type="button" className="question-remove-draft" disabled={drafts.length <= 1} onClick={() => setDrafts((old) => old.filter((_, i) => i !== index))}>Remove question</button></fieldset>)}<div className="question-actions"><button type="button" className="course-button secondary" onClick={() => setDrafts((old) => [...old, blankQuestion()])}>Add another question</button><button className="course-button" disabled={busy}>{busy ? "Saving…" : `Save ${drafts.length} question${drafts.length === 1 ? "" : "s"}`}</button></div></form>
    </>}
  </section>;
}
