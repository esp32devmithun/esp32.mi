const express = require('express');
const multer = require('multer');
const googleTTS = require('google-tts-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('ESP32 Voice Assistant Backend is Running!');
});

// Main endpoint for ESP32 voice / text prompt handling
app.post('/process-voice', upload.single('audio'), async (req, res) => {
  try {
    const prompt = req.body.prompt || "Hello, tell me a short greeting.";

    // 1. Generate response from Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("Gemini Response:", responseText);

    // 2. Generate Audio TTS URL
    const ttsUrl = googleTTS.getAudioUrl(responseText, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    res.json({
      success: true,
      text: responseText,
      audioUrl: ttsUrl
    });

  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
