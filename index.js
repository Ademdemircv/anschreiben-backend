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

// CORS für lokale Entwicklung + Vercel-Frontend
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
Erstelle ein überzeugendes, individuelles Anschreiben auf Deutsch für eine Bewerbung. Verwende folgende Daten:

▸ **Lebenslauf**:
${cvText}

▸ **Stellenanzeige**:
${jobText}

▸ **Ziel**:
Ein Bewerbungsschreiben mit maximal einer Seite Länge, das präzise, fehlerfrei und verkaufsstark ist. 

▸ **Struktur**:

1. **Kopfbereich**  
   – Kontaktdaten des Bewerbers  
   – Datum  
   – Empfängeradresse  

2. **Betreff**  
   – „Bewerbung als [exakte Stellenbezeichnung] – [Referenznummer]“  

3. **Anrede**  
   – Falls kein Name: „Sehr geehrtes Recruiting Team von [Unternehmen]“  

4. **Einleitung**  
   – Sofortiger Nutzenversprechen: „Als [Beruf] mit Erfahrung in [relevantem Bereich]…“  
   – Konkrete Motivation: Bezug zu Unternehmenswerten, Projekten oder Standort  

5. **Hauptteil**  
   – Hebe **2–3 Hard Skills** mit konkreten Erfolgsbeispielen hervor (inkl. Kontext, Handlung, Ergebnis)  
   – Zeige **1 Soft Skill** in einer glaubwürdigen Alltagssituation  
   – Formuliere einen **UVP-Satz**: „Meine Kombination aus [X] + [Y] ermöglicht [konkreter Mehrwert]“  

6. **Schluss**  
   – Aktive Einladung zum Gespräch  
   – Kurzer, positiver Abschlusssatz und Grußformel  

▸ **Stilvorgaben**:  
– Aktiv formulieren („Ich leitete…“, „Ich erzielte…“)  
– Keine Floskeln oder Wiederholungen  
– Nutze Keywords aus der Stellenanzeige  
– Keine Metaphern oder emotional aufgeladene Sprache  
– Kein „Hiermit bewerbe ich mich…“

▸ **Wichtig**:  
Antworte **ausschließlich mit dem fertigen Anschreiben** – kein Kommentar, keine Erklärungen.
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