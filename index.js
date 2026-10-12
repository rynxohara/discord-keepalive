const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN = process.env.DISCORD_TOKEN;
const STATUS = process.env.STATUS || 'dnd'; // online | idle | dnd
const CUSTOM_STATUS = process.env.CUSTOM_STATUS || '';
const GUILD_ID = process.env.GUILD_ID || '';
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID || '';

app.get('/', (req, res) => {
  res.send('Account is running 24/7 safely!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

let ws;
let heartbeatInterval;
let sequence = null;
let currentUserId = null;
let rejoinTimeout = null;

function joinVoice() {
  if (ws && ws.readyState === WebSocket.OPEN && GUILD_ID && VOICE_CHANNEL_ID) {
    ws.send(
      JSON.stringify({
        op: 4,
        d: {
          guild_id: GUILD_ID,
          channel_id: VOICE_CHANNEL_ID,
          self_mute: true,
          self_deaf: true,
        },
      })
    );
    console.log('🔊 Joined Voice Channel 24/7!');
  }
}

function connectGateway() {
  if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN is missing in Environment Variables!');
    return;
  }

  ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

  ws.on('open', () => {
    console.log('🔄 Connecting to Discord Gateway...');
  });

  ws.on('message', (data) => {
    const payload = JSON.parse(data);
    const { t, s, op, d } = payload;

    if (s) sequence = s;

    if (op === 10) {
      const interval = d.heartbeat_interval;
      clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 1, d: sequence }));
        }
      }, interval);

      const activities = CUSTOM_STATUS
        ? [{ name: 'Custom Status', type: 4, state: CUSTOM_STATUS }]
        : [];

      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: TOKEN,
            properties: {
              os: 'Windows',
              browser: 'Chrome',
              device: '',
            },
            presence: {
              status: STATUS,
              since: 0,
              activities: activities,
              afk: false,
            },
          },
        })
      );
    }

    if (t === 'READY') {
      currentUserId = d.user.id;
      console.log(`✅ Connected as: ${d.user.username}`);
      joinVoice();
    }

    // إلا شي واحد خرجك من الروم (Disconnect) أو حولك لروم آخر، يرجع أوتوماتيكياً بعد 3 ثواني
    if (t === 'VOICE_STATE_UPDATE' && currentUserId && d.user_id === currentUserId) {
      if (GUILD_ID && VOICE_CHANNEL_ID && d.channel_id !== VOICE_CHANNEL_ID) {
        console.log('⚠️ Someone disconnected/moved the account from voice! Rejoining in 3s...');
        clearTimeout(rejoinTimeout);
        rejoinTimeout = setTimeout(() => {
          joinVoice();
        }, 3000);
      }
    }
  });

  ws.on('close', (code) => {
    console.log(`⚠️ Disconnected (Code: ${code}). Reconnecting in 5 seconds...`);
    clearInterval(heartbeatInterval);
    setTimeout(connectGateway, 5000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err.message);
  });
}

connectGateway();
