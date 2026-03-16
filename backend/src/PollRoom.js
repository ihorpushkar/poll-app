export class PollRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = [];
    this.pollId = null; // Store pollId for KV sync
    console.log('PollRoom constructor called');
    console.log('PollRoom env available:', !!env);
    console.log('PollRoom state available:', !!state);
  }

  async fetch(request) {
    console.log('PollRoom fetch called:', request.method, request.url);
    console.log('PollRoom pathname:', new URL(request.url).pathname);
    
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/state':
        if (request.method === 'GET') {
          return this.handleGetState();
        }
        break;
        
      case '/init':
        if (request.method === 'POST') {
          return this.handleInitPoll(request);
        }
        break;
        
      case '/vote':
        if (request.method === 'POST') {
          return this.handlePostVote(request);
        }
        break;
        
      case '/websocket':
        if (request.method === 'GET') {
          return this.handleWebSocket(request);
        }
        break;
    }
    
    return new Response('Not Found', { status: 404 });
  }

  async handleInitPoll(request) {
    console.log('Initializing poll in Durable Object');
    try {
      const { poll } = await request.json();
      
      // Store pollId from initialization request
      this.pollId = poll.id;
      
      // Check if this.state exists before using it
      if (!this.state) {
        console.error('Poll state not available');
        return new Response(JSON.stringify({ error: 'Poll state not available' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await this.state.storage.put("poll", poll);
      console.log('Poll initialized in Durable Object:', poll);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error initializing poll:', error);
      return new Response(JSON.stringify({ error: 'Failed to initialize poll' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleGetState() {
    console.log('Getting poll state');
    const state = await this.getState();
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handlePostVote(request) {
    console.log('Handling POST vote');
    try {
      const { optionIndex } = await request.json();
      console.log('Vote received for option:', optionIndex);
      
      const result = await this.handleVote(optionIndex);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error handling vote:', error);
      return new Response('Invalid request', { status: 400 });
    }
  }

  async handleWebSocket(request) {
    console.log('Upgrading to WebSocket');
    
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.sessions.push(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async getState() {
    try {
      const poll = await this.state.storage.get("poll");
      console.log('Retrieved poll state:', poll);
      return poll || null;
    } catch (error) {
      console.error('Error getting state:', error);
      return null;
    }
  }

  async broadcast(data) {
    console.log('Broadcasting to', this.sessions.length, 'sessions');
    console.log('Broadcast data:', data);
    const message = JSON.stringify(data);
    
    this.sessions = this.sessions.filter(session => {
      try {
        session.send(message);
        return true;
      } catch (error) {
        console.log('Removing dead session, error:', error);
        return false;
      }
    });
  }

  async handleVote(optionIndex) {
    console.log('Handling vote for option:', optionIndex);
    
    const poll = await this.getState();
    console.log('Retrieved poll in handleVote:', poll);
    console.log('Poll votes before vote:', poll?.votes);
    
    if (!poll || !poll.votes || poll.votes[optionIndex] === undefined) {
      throw new Error('Invalid poll or option index');
    }
    
    // Increment vote count
    poll.votes[optionIndex]++;
    poll.totalVotes = (poll.totalVotes || 0) + 1;
    
    console.log('Updated poll state:', poll);
    console.log('Votes after increment:', poll.votes);
    
    // Save to storage
    await this.state.storage.put("poll", poll);
    
    // Sync to KV using stored pollId
    try {
      const pollData = await this.env.POLLS_KV.get(this.pollId);
      if (pollData) {
        const currentPoll = JSON.parse(pollData);
        // Merge current poll with updated votes
        const mergedPoll = { ...currentPoll, ...poll };
        await this.env.POLLS_KV.put(this.pollId, JSON.stringify(mergedPoll));
        console.log('Synced to KV:', mergedPoll);
      }
    } catch (e) {
      console.error('Failed to sync to KV:', e);
    }
    
    // Broadcast to all connected clients
    await this.broadcast({
      type: 'voteUpdate',
      poll: poll
    });
    
    return poll;
  }

  getPollId() {
    // Extract pollId from Durable Object name or environment
    return this.env.POLL_ROOM.name || 'default-poll';
  }
}
