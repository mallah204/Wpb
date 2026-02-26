const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// Yeh keys abhi bhi kaam kar rahi hain to chal sakti hain — warna naye proxy/API dhundna padega
const API_KEYS = [
  'Koja-64118e456c1d20ec4b75a9914ec70f6a',
  'Koja-3ce2fd6170ea41e13acf3e7e347a5719',
  'Koja-096a3b8e8046783b1b59643a548ae35d',
  'Koja-3b4890c331f417fa032e5cb742536388',
  'Koja-d9f9832a9b1807464b1c29aa85d33884',
  'Koja-bb2fc781169ad50d3280bf439172a791',
  'Koja-de9c2119108b41d707c5373d17743775',
  'Koja-9a6e21a46b350a2db52e6153f949c5d3',
  'Koja-ef5212fc41c708ef3f9ff64c59c64a15',
  'Koja-efa906b944d62eff99ac2865b99d852c',
  'Koja-16ce4852551ef858de2e5ae9892d7740',
  'Koja-f3d5f82f027dddb837f6a3af343eb732',
  'Koja-a66bb0884f9877fd0fffec8774d40c05'
];

const BASE_URL = 'https://kojaxd-api.vercel.app/ai/sunoai';

async function createTask(prompt, style, title, apiKey) {
  const url = `\( {BASE_URL}?apikey= \){apiKey}&action=create&prompt=\( {encodeURIComponent(prompt)}&style= \){encodeURIComponent(style)}&title=${encodeURIComponent(title)}`;
  const response = await axios.get(url);
  if (response.data.status) {
    return response.data.task_id;
  }
  throw new Error(response.data.message || 'Task create nahi hua');
}

async function checkTaskStatus(taskId, apiKey) {
  const url = `\( {BASE_URL}?apikey= \){apiKey}&action=status&task_id=${taskId}`;
  const response = await axios.get(url);
  if (response.data.status) {
    return response.data.result;
  }
  throw new Error('Status check fail hua');
}

async function sunoCommand(sock, chatId, message) {
  try {
    const text = message.message?.conversation || 
                 message.message?.extendedTextMessage?.text || "";

    // suno prompt | style | title
    const args = text.split(' ').slice(1).join(' ').trim();
    
    if (!args) {
      return await sock.sendMessage(chatId, { 
        text: "Usage:\nsuno gaane ke bol | style | title\n\nMisal:\nsuno meri mohabbat sun le | sad romantic | dil tut gya" 
      }, { quoted: message });
    }

    const content = args.split("|");
    const prompt = content[0]?.trim();
    const style  = content[1]?.trim() || "Pop";
    const title  = content[2]?.trim() || "AI Song by Raza-Bot";

    if (!prompt) {
      return await sock.sendMessage(chatId, { 
        text: "Lyrics ya prompt to likho bhai!\n\nsuno [lyrics] | [style] | [title]" 
      }, { quoted: message });
    }

    await sock.sendMessage(chatId, { 
      text: "🎼 AI gaana ban raha hai...\n30–90 second wait karo bhai 🎧\nStyle: " + style + " | Title: " + title 
    }, { quoted: message });

    // Random API key
    const apiKey = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];

    const taskId = await createTask(prompt, style, title, apiKey);

    let audioUrl = null;
    let attempts = 0;
    const maxAttempts = 15; // ~2.5 min max wait

    while (!audioUrl && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 10000)); // 10 sec wait
      attempts++;

      try {
        const result = await checkTaskStatus(taskId, apiKey);

        if (result && Array.isArray(result) && result.length > 0) {
          const data = result[0]?.data?.data?.[0] || result[0];
          if (data?.audioUrl) {
            audioUrl = data.audioUrl;
          }
        } else if (result && typeof result === 'object') {
          const data = result.data?.data?.[0] || result;
          if (data?.audioUrl) {
            audioUrl = data.audioUrl;
          }
        }
      } catch (e) {
        // silent fail — continue polling
      }
    }

    if (!audioUrl) {
      return await sock.sendMessage(chatId, { 
        text: "❌ Timeout ho gaya ya generation fail ho gaya.\nThodi der baad try karna ya prompt change kar ke dekho." 
      }, { quoted: message });
    }

    // Audio file download → temporary save
    const filePath = path.join(__dirname, "temp", `suno_${Date.now()}.mp3`);
    await fs.ensureDir(path.dirname(filePath));

    const audioResponse = await axios({
      method: 'get',
      url: audioUrl,
      responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, Buffer.from(audioResponse.data));

    // WhatsApp pe audio bhej do
    await sock.sendMessage(chatId, {
      audio: { url: filePath },
      mimetype: "audio/mpeg",
      fileName: `${title}.mp3`,
      caption: `🎶 *Suno AI Song*\n━━━━━━━━━━━━━━━\n📝 **Prompt:** ${prompt}\n🎭 **Style:** ${style}\n🏷️ **Title:** ${title}\n\nPowered by Raza-Bot`
    }, { quoted: message });

    // Cleanup
    setTimeout(() => {
      fs.unlink(filePath).catch(() => {});
    }, 30000);

  } catch (error) {
    console.error('Suno command error:', error);
    await sock.sendMessage(chatId, { 
      text: `❌ Error: ${error.message || "Kuch to gadbad hai..."}` 
    }, { quoted: message });
  }
}

module.exports = sunoCommand;

/* Powered by Raza-Bot
   Credits: Raza Engineering (original Messenger version) */
