import { useState, useEffect, useRef } from 'react';

export const useWebSocket = (pollId) => {
  const [results, setResults] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!pollId) return;

    const fetchResults = async () => {
      try {
        const response = await fetch(`https://poll-app-worker.urlcut01.workers.dev/api/polls/${pollId}`);
        if (response.ok) {
          const poll = await response.json();
          setResults(poll.votes || []);
          setIsConnected(true);
        }
      } catch (e) {
        setIsConnected(false);
      }
    };

    fetchResults();
    intervalRef.current = setInterval(fetchResults, 2000);

    return () => clearInterval(intervalRef.current);
  }, [pollId]);

  return { results, isConnected };
}
