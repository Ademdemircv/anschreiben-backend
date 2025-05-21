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
Erstelle ein individuelles, fehlerfreies und überzeugendes Anschreiben auf Deutsch für die angehängte Stellenanzeige – basierend auf dem Lebenslauf. Beachte folgende Vorgaben:

▸ **Datenquellen**:  
- Lebenslauf: ${cvText}  
- Stellenanzeige: ${jobText}  

▸ **Struktur**:  
1. Kopfbereich mit Kontaktdaten, Datum, Empfängeradresse  
2. Aussagekräftiger Betreff: „Bewerbung als [Stellentitel] – [Referenznummer]“  
3. Persönliche Anrede (wenn Name fehlt: „Sehr geehrtes Recruiting Team von [Unternehmen]“)  
4. Einleitung: Persönliche Motivation & Bezug zum Unternehmen (Nennung eines aktuellen Projekts/Werts, falls auffindbar)  
5. Hauptteil:  
   - **2–3 zentrale Stärken** aus dem Lebenslauf als SAR-Statements:  
     *Situation* (Problem/Kontext) → *Aktion* (deine Maßnahme) → *Resultat* (quantifiziert).  
   - **UVP-Satz**: „Meine Kombination aus [Fähigkeit A] + [Fähigkeit B] ermöglicht [konkreten Nutzen für Unternehmensziel aus der Anzeige].“  
   - Bezug zu **3 Schlüsselwörtern** aus der Stellenanzeige (z. B. „OEM-Kunden“, „agile Transformation“)  
6. Schluss:  
   - „Gerne erläutere ich im Gespräch, wie ich [Unternehmensziel] vorantreiben kann.“  
   - Kurzer Dank + Grußformel  

▸ **Stilregeln**:  
- Max. 1 Seite, aktiv formuliert („Ich initiierte…“, „Ich steigerte…“)  
- **0 Floskeln** – stattdessen Fachjargon der Branche/Stellenanzeige  
- Tonalität: Dynamisch-professionell (Vermeide Passivsätze wie „Es wurde umgesetzt…“)  

▸ **Wichtig**:  
- Antworte **nur mit dem finalen Fließtext**.  
- Keine Markdown, Erklärungen oder Platzhalter.
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