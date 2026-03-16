import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [joinPollId, setJoinPollId] = useState('');
  const navigate = useNavigate();

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = async () => {
    const filled = options.filter(o => o.trim() !== '');
    if (!question.trim()) { setError('Please enter a question'); return; }
    if (filled.length < 2) { setError('Please add at least 2 options'); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('https://poll-app-worker.urlcut01.workers.dev/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), options: filled }),
      });
      if (!res.ok) throw new Error('Failed to create poll');
      const { pollId } = await res.json();
      navigate(`/poll/${pollId}`);
    } catch {
      setError('Failed to create poll, try again');
    }
    setIsSubmitting(false);
  };

  const handleJoin = () => {
    if (!joinPollId.trim()) return;
    
    let id = joinPollId.trim();
    
    if (id.includes('/poll/')) {
      id = id.split('/poll/').pop();
    }
    
    id = id.replace(/\//g, '');
    
    if (id) navigate(`/poll/${id}`);
  };

  return (
    <div className="page">
      <div className="noise" />
      <div className="glow1" />
      <div className="glow2" />

      <div className="container">
        <div className="header">
          <div className="badge">LIVE POLLING</div>
          <h1 className="title">
            Ask the<br />
            <span className="titleAccent">crowd.</span>
          </h1>
          <p className="subtitle">Real-time votes. Zero friction. Pure signal.</p>
        </div>

        <div className="card">
          <div className="cardInner">
            <label className="label">YOUR QUESTION</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="What's on your mind?"
              className="textarea"
              rows={2}
            />

            <label className="label">OPTIONS</label>
            <div className="optionsList">
              {options.map((opt, i) => (
                <div key={i} className="optionRow">
                  <div className="optionNum">{i + 1}</div>
                  <input
                    value={opt}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="optionInput"
                  />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="removeBtn">×</button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button onClick={addOption} className="addBtn">
                <span>+</span> Add option
              </button>
            )}

            {error && <div className="error">{error}</div>}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`submitBtn ${isSubmitting ? 'submitting' : ''}`}
            >
              {isSubmitting ? 'Creating...' : 'Launch Poll →'}
            </button>
          </div>
        </div>

        <div className="divider">
          <div className="dividerLine" />
          <span className="dividerText">or join existing</span>
          <div className="dividerLine" />
        </div>

        <div className="joinRow">
          <input
            value={joinPollId}
            onChange={e => setJoinPollId(e.target.value)}
            placeholder="Paste poll ID..."
            className="joinInput"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button onClick={handleJoin} className="joinBtn">Join</button>
        </div>
      </div>
    </div>
  );
}
