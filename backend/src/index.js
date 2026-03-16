import { PollRoom } from './PollRoom.js';

export default {
  async fetch(request, env, ctx) {
    console.log("Incoming request:", request.method, request.url);
    
    const url = new URL(request.url);
    console.log('PATH:', url.pathname);
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": 'https://poll-app.pages.dev',
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      console.log('Handling OPTIONS preflight request');
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }
    
    // Route: POST /api/polls - Create new poll
    if (url.pathname === '/api/polls' && request.method === 'POST') {
      return this.handleCreatePoll(request, env, corsHeaders);
    }
    
    // Route: GET /api/polls/:id - Get poll by ID
    const pollMatch = url.pathname.match(/^\/api\/polls\/([^\/]+)$/);
    if (pollMatch && request.method === 'GET') {
      const pollId = pollMatch[1];
      return this.handleGetPoll(pollId, env, corsHeaders);
    }
    
    // Route: ALL /api/polls/:id/room/* - Forward to Durable Object
    const roomMatch = url.pathname.match(/^\/api\/polls\/([^\/]+)\/room(?:\/(.*))?$/);
    console.log('Room URL match:', roomMatch);
    if (roomMatch) {
      const pollId = roomMatch[1];
      const subPath = roomMatch[2] || '/';
      console.log('Extracted pollId from room URL:', pollId);
      console.log('Extracted subPath from room URL:', subPath);
      return this.handleRoomRequest(request, env, pollId, corsHeaders);
    }
    
    // Default response
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });
  },
  
  async handleCreatePoll(request, env, corsHeaders) {
    console.log('Creating new poll');
    try {
      const { question, options } = await request.json();
      
      if (!question || !options || !Array.isArray(options) || options.length < 2) {
        return new Response(JSON.stringify({ error: 'Invalid poll data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const pollId = crypto.randomUUID();
      const poll = {
        id: pollId,
        question,
        options,
        votes: new Array(options.length).fill(0),
        totalVotes: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000  // 24 hours
      };
      
      console.log('Creating poll:', poll);
      
      await env.POLLS_KV.put(pollId, JSON.stringify(poll), { expirationTtl: 86400 });
      // 86400 seconds = 24 hours - KV will auto-delete after this time
      
      return new Response(JSON.stringify({ pollId }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Error creating poll:', error);
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
  
  async handleGetPoll(pollId, env, corsHeaders) {
    console.log('Getting poll:', pollId);
    try {
      const pollData = await env.POLLS_KV.get(pollId);
      
      if (!pollData) {
        console.log('Poll not found:', pollId);
        return new Response(JSON.stringify({ error: 'Poll not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const poll = JSON.parse(pollData);
      
      // Check if poll has expired
      if (poll.expiresAt && Date.now() > poll.expiresAt) {
        console.log('Poll expired:', pollId);
        await env.POLLS_KV.delete(pollId);
        return new Response(JSON.stringify({ error: 'Poll has expired' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('Retrieved poll:', poll);
      
      return new Response(pollData, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Error getting poll:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
  
  async handleRoomRequest(request, env, pollId, corsHeaders) {
    console.log('Forwarding to Durable Object for poll:', pollId);
    try {
      const id = env.POLL_ROOM.idFromName(pollId);
      const stub = env.POLL_ROOM.get(id);

      // Always ensure poll is initialized in DO before forwarding
      const reqUrl = new URL(request.url);
      const pathMatch = reqUrl.pathname.match(/^\/api\/polls\/([^\/]+)\/room(\/.*)?$/);
      const subPath = pathMatch ? pathMatch[2] || '/' : '/';
      
      if (subPath !== '/websocket') {
        const pollData = await env.POLLS_KV.get(pollId);
        if (pollData) {
          const currentState = await stub.fetch(new Request('http://do/state', { method: 'GET' }));
          const state = await currentState.json();
          if (!state) {
            await stub.fetch(new Request('http://do/init', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ poll: JSON.parse(pollData) })
            }));
          }
        }
      }

      const doRequest = new Request('http://do' + subPath, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? request.body : undefined
      });

      const response = await stub.fetch(doRequest);
      let responseClone = null;
      
      // WebSocket responses should be returned as-is
      if (response.status === 101) {
        return response;
      }

      if (subPath === '/vote' && response.ok) {
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://poll-app.pages.dev',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        });
      }

      return new Response(response.body, {
        status: response.status,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://poll-app.pages.dev',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      
    } catch (error) {
      console.error('Error forwarding to Durable Object:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

export { PollRoom };
