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
Erstelle ein individuelles, fehlerfreies und überzeugendes Bewerbungsschreiben auf Deutsch für die untenstehende Stellenanzeige – basierend auf dem Lebenslauf.

▸ Datenquellen:
- Lebenslauf: ${cvText}
- Stellenanzeige: ${jobText}

▸ Struktur:
1. Kopfbereich: Kontaktdaten, aktuelles Datum, Empfängeradresse
2. Betreffzeile: „Bewerbung als [exakter Stellentitel] – [Referenznummer]“
3. Persönliche Anrede (wenn Name fehlt: „Sehr geehrtes Recruiting Team von [Unternehmen]“)
4. Einleitung: Persönliche Motivation und Bezug zum Unternehmen (inkl. Projekt, Wert oder Produkt – falls nennbar)
5. Hauptteil:
   - Zwei konkrete Stärken aus dem Lebenslauf, formuliert als SAR-Statements (Situation, Aktion, Resultat)
   - Eine Soft Skill + Kontextbeispiel
   - UVP-Satz: „Meine Kombination aus [Fähigkeit A] + [Fähigkeit B] ermöglicht [klaren Nutzen für das Unternehmensziel aus der Anzeige]“
   - Bezug zu drei Schlüsselwörtern aus der Stellenanzeige
6. Schluss:
   - „Gerne erläutere ich im Gespräch, wie ich [konkretes Unternehmensziel] unterstützen kann.“
   - Kurzer Dank, professionelle Grußformel

▸ Stilregeln:
- Maximal 1 DIN-A4-Seite
- Aktive Formulierungen („Ich realisierte…“, „Ich steigerte…“)
- Keine Floskeln – sondern Begriffe aus der Stellenanzeige und Branche
- Ton: Professionell, klar, dynamisch

▸ Wichtige Regeln:
- Antworte nur mit dem finalen Bewerbungsanschreiben als reiner Fließtext.
- Keine Einleitungen, Erklärungen oder Formatierungen.
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