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
Erstelle ein individuelles, fehlerfreies Anschreiben nach diesen Kriterien:

▸ **Datenquellen**:  
- Lebenslauf: ${cvText}  
- Stellenanzeige: ${jobText}  

▸ **Struktur**:  
1. **Kopfbereich**: Meine Kontaktdaten, Datum, Empfängeradresse.  
2. **Betreff**: „Bewerbung als [exakte Stellenbezeichnung] – [Referenznummer]“.  
3. **Anrede**: Namen recherchieren (falls nicht möglich: „Sehr geehrtes Team [Unternehmen]“).  
4. **Einleitung**:  
   - Nenne 1 aktuelles Unternehmensprojekt/-wert aus der Stellenanzeige/Website.  
   - Verknüpfe es mit meiner Motivation („Warum ihr?“ + „Warum ich?“).  
5. **Hauptteil**:  
   - **Top-2 Hard Skills** aus dem Lebenslauf, die exakt den „Must-Haves“ der Anzeige entsprechen – jeweils mit Story (Kontext + Aktion + Ergebnis).  
   - **1 Soft Skill** + Beispiel, wie er im Job eingesetzt wird.  
   - **UVP-Satz**: „Meine Kombination aus [X] + [Y] ermöglicht [konkreten Nutzen für das Unternehmen].“  
6. **Schluss**:  
   - „Ich würde gerne in einem Gespräch erläutern, wie ich [spezielles Unternehmensziel] unterstützen kann.“  
   - Kurzer Dank.  

▸ **Regeln**:  
- **1 Seite**, aktiv formuliert („Ich entwickelte…“, „Ich steigerte…“).  
- **0 Floskeln** – stattdessen Keywords aus der Anzeige (z. B. „agile Prozesse“, „Kundenjourney“).  
- **Design**: Wie Lebenslauf (Schriftart, Größe), keine Farben/Logos.  
- **Tonalität**: Professionell, aber dynamisch (kein „sehr geehrte Damen und Herren“).

**Antworte NUR mit dem fertigen Anschreiben – keine Erklärungen oder Markdown.**
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