const axios = require('axios');

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

const BASE_URL = 'https://api.kojaxd.dpdns.org/ai/sunoai';

function getRandomApiKey() {
    return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
}

async function createTask(prompt, style, title, apiKey) {
    const url = `${BASE_URL}?apikey=${apiKey}&action=create&prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style)}&title=${encodeURIComponent(title)}`;
    const response = await axios.get(url);
    if (response.data.status) {
        return response.data.task_id;
    }
    throw new Error(response.data.message || 'Failed to create task');
}

async function checkTaskStatus(taskId, apiKey) {
    const url = `${BASE_URL}?apikey=${apiKey}&action=status&task_id=${taskId}`;
    const response = await axios.get(url);
    if (response.data.status) {
        return response.data.result;
    }
    throw new Error(response.data.message || 'Failed to get task status');
}

async function sunoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        if (!text) return;

        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: "❌ Usage: .suno prompt | style | title"
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎵', key: message.key } });

        // Split input into prompt, style, title
        const segments = query.split('|').map(s => s.trim());
        const prompt = segments[0] || "Dark villain theme song";
        const style = segments[1] || "Villain";
        const title = segments[2] || "Raza Villain AI Song";

        // Force Villain prompt adjustments to avoid anthem
        const finalPrompt = `${prompt}. Dark villain theme song. Intense. No anthem. No stadium chorus. Deep cinematic vibe.`;

        const apiKey = getRandomApiKey();
        const taskId = await createTask(finalPrompt, style, title, apiKey);

        let audioUrl = null;
        let attempts = 0;
        const maxAttempts = 25;

        while (!audioUrl && attempts < maxAttempts) {
            attempts++;
            const result = await checkTaskStatus(taskId, apiKey);

            if (result && result.length > 0 && result[0].data?.data?.length > 0) {
                const songData = result[0].data.data[0];
                audioUrl = songData.audioUrl;
                const imageUrl = songData.imageUrl;
                const songTitle = songData.title || title;

                if (audioUrl) {
                    await sock.sendMessage(chatId, {
                        audio: { url: audioUrl },
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: message });

                    if (imageUrl) {
                        await sock.sendMessage(chatId, {
                            image: { url: imageUrl },
                            caption: `🎵 ${songTitle}\nStyle: ${style}`
                        }, { quoted: message });
                    }

                    return;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 8000));
        }

        throw new Error('Generation timed out.');

    } catch (error) {
        console.error('Suno Command Error:', error);
        await sock.sendMessage(chatId, {
            text: `❌ Error: ${error.message}`
        }, { quoted: message });
    }
}

module.exports = sunoCommand;
