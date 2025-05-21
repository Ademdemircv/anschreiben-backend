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
Erstelle ein vollständiges, druckfertiges und überzeugendes Bewerbungsschreiben auf Deutsch für die untenstehende Stellenanzeige – auf Basis des Lebenslaufs.

▸ Datenquellen:
- Lebenslauf: ${cvText}
- Stellenanzeige: ${jobText}

▸ Format:  
Erzeuge den Text in folgender Form (mit Zeilenumbrüchen):

1. Absender (Name, Adresse, PLZ Ort, Telefon, E-Mail)
2. Leerzeile
3. Empfänger (Unternehmen, Ansprechpartner – wenn möglich, Adresse, Ort)
4. Leerzeile
5. Ort, aktuelles Datum Rechtsbündig: „[Ort], [TT. Monat JJJJ]“ (z. B. „Berlin, 15. Juni 2024“) (finde aktuelles datum heraus)
6. Leerzeile
7. Betreffzeile fett formatiert, präzise: „Bewerbung als [Position] – Ref.-Nr. [XYZ]“.
8. Leerzeile
9. Persönliche Anrede, Alternativ: „Sehr geehrtes Recruiting-Team [Firma],“.
10. Einleitung mit Begeisterung für das Unternehmen und Bezug auf Projekt/Wert/Produkt und Unternehmensbezug
11. Hauptteil mit SAR-Statements (mit Story als Kontext, falls keine Informationen für eine Story vorhanden erfinde etwas passendes) (2–3 zentrale Kompetenzen + Resultate)
12. UVP-Satz (nicht zu passiv): „Meine Kombination aus [A] + [B] ermöglicht [Nutzen für Unternehmen]“
13. Bezug auf 2–3 Schlüsselbegriffe aus der Anzeige
14. Schluss mit Gesprächsaufforderung & Dank
15. Leerzeile
16. Grußformel („Mit freundlichen Grüßen“) (ohne , danach)
17. Name

▸ Stil:
- Maximal 1 DIN-A4-Seite
- Aktive Sprache („Ich optimierte…“, „Ich steigerte…“)
- Keine Floskeln – stattdessen echte Branchensprache und Stellenbezug
- Klar strukturiert für direkte PDF-Ausgabe

▸ WICHTIG:
- Antworte **nur mit dem finalen Fließtext**
- Keine Erklärungen, Platzhalter oder Markdown
- Setze sinnvolle Absätze & Leerzeilen für gute Lesbarkeit
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