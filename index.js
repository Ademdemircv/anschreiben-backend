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
Erstelle ein vollständiges, druckfertiges und überzeugendes Bewerbungsschreiben auf Deutsch für die untenstehende Stellenanzeige – auf Basis des Lebenslaufs. Berücksichtige dabei automatisch:

▸ Zielgruppe:
Erkenne aus dem Profil, ob es sich um Berufsanfänger, Quereinsteiger oder erfahrene Fachkräfte handelt.

▸ Tonalität (automatisch erkennen & anpassen):
- Klassisch-seriös für Banken, Industrie, Recht.
- Modern-aktiv für IT, Startups, Technik.
- Kreativ für Marketing, Design, Agenturen.

▸ Datenquellen:
- Lebenslauf: ${cvText}
- Stellenanzeige: ${jobText}

▸ Format:
1. Absender (Name, Adresse, PLZ Ort, Telefon, E-Mail)
2. Leerzeile
3. Empfänger (Unternehmen, Ansprechpartner, Adresse)
4. Leerzeile
5. Ort + aktuelles Datum (rechtsbündig)
6. Leerzeile
7. Betreff fett: „Bewerbung als [Position] – [Referenznummer]“
8. Leerzeile
9. Anrede (wenn Name nicht da: „Sehr geehrtes Recruiting-Team von [Firma]“)
10. Einleitung: Begeisterung + Bezug auf Projekt/Produkt/Wert aus Anzeige
11. Hauptteil: 
   ▸ 2–3 relevante Stärken als SAR-Statements (Situation – Aktion – Resultat)
   ▸ UVP-Satz: „Meine Kombination aus [A] + [B] ermöglicht [Nutzen für das Unternehmen]“
   ▸ Bezug auf 2–3 Begriffe aus Anzeige
12. Schluss: Gesprächswunsch + Dank
13. Leerzeile
14. Grußformel: „Mit freundlichen Grüßen“
15. Name

▸ Stilregeln:
- Max. 1 DIN-A4-Seite, aktiv formuliert („Ich steigerte…“, „Ich konzipierte…“)
- Keine Floskeln, kein Copy-Paste-Stil
- Sinnvolle Absätze & Zeilenumbrüche für saubere PDF-Ausgabe

▸ WICHTIG:
Antworte ausschließlich mit dem finalen Fließtext. Kein Markdown, keine Erklärungen.
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