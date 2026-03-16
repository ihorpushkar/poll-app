import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './Poll.css';

export default function Poll() {
  const { id } = useParams();
  const { results, isConnected } = useWebSocket(id);

  const [poll, setPoll] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const hasVotedRef = useRef(false);

  useEffect(() => {
    if (id) {
      const voted = localStorage.getItem(`voted_${id}`) === 'true';
      hasVotedRef.current = voted;
      setHasVoted(voted);
      
      const saved = localStorage.getItem(`selected_${id}`);
      if (saved !== null) setSelectedOption(parseInt(saved));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchPoll = async () => {
      try {
        const res = await fetch(`https://poll-app-worker.urlcut01.workers.dev/api/polls/${id}`);
        if (!res.ok) throw new Error('Poll not found');
        const data = await res.json();
        setPoll(data);
        setLoading(false);
      } catch {
        setError('Poll not found');
        setLoading(false);
      }
    };
    fetchPoll();
  }, [id]);

  const handleVote = async (optionIndex) => {
    if (hasVotedRef.current) return;
    setSelectedOption(optionIndex);
    try {
      const res = await fetch(`https://poll-app-worker.urlcut01.workers.dev/api/polls/${id}/room/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex }),
      });
      if (!res.ok) throw new Error('Failed');
      localStorage.setItem(`voted_${id}`, 'true');
      localStorage.setItem(`selected_${id}`, optionIndex.toString());
      hasVotedRef.current = true;
      setHasVoted(true);
    } catch {
      setSelectedOption(null);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyId = () => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) return (
    <div className="center">
      <div className="spinner" />
      <p className="loadingText">Loading poll...</p>
    </div>
  );

  if (error) return (
  <div className="errorPage">
    <div className="errorContainer">
      <div className="errorCode">404</div>
      <h2 className="errorTitle">Poll not found</h2>
      <p className="errorSubtitle">This poll doesn't exist or has expired.</p>
      <a href="/" className="errorBtn">← Create a new poll</a>
    </div>
  </div>
);

  if (!poll) return null;

  const currentVotes = results.length > 0 ? results : poll.votes;
  const totalVotes = currentVotes.reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...currentVotes, 1);

  return (
    <div className="page">
      <div className="noise" />
      <div className="glow" />

      <div className="container">
        <div className="topRow">
          <div className="liveIndicator">
            <div className={`liveDot ${isConnected ? 'live' : 'offline'}`} />
            <span className={`liveText ${isConnected ? 'live' : 'offline'}`}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>

          <div className="voteBadge">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </div>
        </div>

        <h1 className="question">{poll.question}</h1>

        {!hasVoted && (
          <p className="hint">Choose your answer ↓</p>
        )}

        <div className="optionsList">
          {poll.options.map((option, index) => {
            const votes = currentVotes[index] || 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isSelected = selectedOption === index;
            const isWinning = votes === maxVotes && totalVotes > 0;

            return (
              <button
                key={index}
                onClick={() => handleVote(index)}
                disabled={hasVoted}
                className={`optionBtn ${isSelected ? 'selected' : ''} ${isWinning && hasVoted ? 'winning' : ''}`}
              >
                {/* Progress bar */}
                <div 
                  className={`progressBar ${isSelected ? 'selected' : 'default'}`}
                  style={{ width: hasVoted ? `${percentage}%` : '0%' }}
                />

                <div className="optionContent">
                  <div className="optionLeft">
                    <div className={`optionDot ${isSelected ? 'selected' : ''}`}>
                      {isSelected && <span className="checkmark">✓</span>}
                    </div>
                    <span className={`optionText ${isSelected ? 'selected' : 'default'}`}>
                      {option}
                    </span>
                  </div>

                  {hasVoted && (
                    <div className="optionRight">
                      <span className="voteCount">{votes}</span>
                      <span className={`percentBadge ${isSelected ? 'selected' : 'default'}`}>
                        {percentage}%
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {hasVoted && (
          <div className="votedBanner">
            <span className="votedIcon">✓</span>
            <span>Your vote has been counted</span>
          </div>
        )}

        <div className="shareSection">
          <p className="shareLabel">SHARE THIS POLL</p>
          <div className="shareRow">
            <input
              readOnly
              value={window.location.href}
              className="shareInput"
              onClick={e => e.target.select()}
            />
            <button onClick={copyUrl} className="copyBtn">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="shareSection">
          <p className="shareLabel">POLL ID</p>
          <div className="shareRow">
            <input
              readOnly
              value={id}
              className="shareInput"
              onClick={e => e.target.select()}
            />
            <button onClick={copyId} className="copyBtn">
              {copiedId ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
          70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
