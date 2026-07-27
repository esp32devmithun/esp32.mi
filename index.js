const express = require('express');
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

const app = express();
const upload = multer({ dest: 'uploads/' });

const WIT_AI_TOKEN = process.env.WIT_AI_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

app.post('/process-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No audio file uploaded.');
        }

        const audioPath = req.file.path;
        const audioBuffer = fs.readFileSync(audioPath);

        console.log("Sending audio to Wit.ai...");
        const witResponse = await axios.post('https://api.wit.ai/speech', audioBuffer, {
            headers: {
                'Authorization': `Bearer ${WIT_AI_TOKEN}`,
                'Content-Type': 'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little'
            }
        });

        let userText = "";
        if (typeof witResponse.data === 'string') {
            const lines = witResponse.data.trim().split('\n');
            const lastLine = JSON.parse(lines[lines.length - 1]);
            userText = lastLine.text || "";
        } else {
            userText = witResponse.data.text || "";
        }

        console.log("User Said:", userText);
        fs.unlinkSync(audioPath);

        if (!userText) {
            return res.status(400).send("Speech not recognized.");
        }

        console.log("Sending text to Gemini...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userText,
            config: {
                systemInstruction: "You are a helpful voice assistant. Keep your responses short, natural, and under 2-3 sentences for clear speech output."
            }
        });

        const replyText = response.text;
        console.log("Gemini Output:", replyText);

        const ttsUrl = googleTTS.getAudioUrl(replyText, {
            lang: 'bn',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
        });

        const audioStream = await axios.get(ttsUrl, { responseType: 'arraybuffer' });
        
        res.set('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioStream.data));

    } catch (error) {
        console.error("Error Processing Request:", error.message);
        res.status(500).send("Internal Server Error");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
