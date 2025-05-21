const express = require('express');
const multer = require('multer');
const cors = require('cors');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ storage: multer.memoryStorage() });

// ✅ CORS-Freigabe (für Entwicklung und Vercel-Frontend)
const corsOptions = {
  origin: ['http://localhost:3000', 'https://online-anschreiben.vercel.app'],
  methods: ['POST'],
};
app.use(cors(corsOptions));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromFile(file) {
  if (file.mimetype === 'application/pdf') {
    return (await pdfParse(file.buffer)).text;
  } else if (file.mimetype.startsWith('image/')) {
    const result = await Tesseract.recognize(file.buffer, 'deu');
    return result.data.text;
  } else {
    throw new Error('Unsupported file type');
  }
}

app.post('/generate', upload.fields([{ name: 'cv' }, { name: 'job' }]), async (req, res) => {
  try {
    const cvText = await extractTextFromFile(req.files['cv'][0]);
    const jobText = await extractTextFromFile(req.files['job'][0]);

    const prompt = `
Erstelle ein perfektes Anschreiben für die angehängte Stellenanzeige, basierend auf meinem Lebenslauf.

📌 Halte dich an diese Struktur:
1. Kopfbereich mit meinen Kontaktdaten, Datum und Empfängeradresse.
2. Präziser Betreff (inkl. Stellenbezeichnung und Referenznummer, falls vorhanden).
3. Persönliche Anrede (recherchieren; falls unbekannt: "Sehr geehrtes Team [Unternehmensname]").
4. Einleitung: Begeisterung für das Unternehmen + Motivation für die Bewerbung.
5. Hauptteil: 2–3 relevante Fähigkeiten aus meinem Lebenslauf mit konkretem Bezug zur Stellenanzeige und echten Beispielen.
6. Schluss: Aktive Handlungsaufforderung (z. B. Einladung zum Gespräch), höflicher Abschluss.
7. Formell korrekte Grußformel.

📝 Stil & Regeln:
- Max. 1 Seite
- Keine Floskeln
- Aktiv-Formulierungen (z. B. „Ich habe erreicht...“)
- Klare, saubere Sprache (z. B. Arial 11pt)
- Fehlerfrei
- Individuell und passgenau auf die Stelle zugeschnitten

📄 Daten zur Verarbeitung:
Lebenslauf:
${cvText}

Stellenanzeige:
${jobText}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({ text: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Fehler bei der Verarbeitung' });
  }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});