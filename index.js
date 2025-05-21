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
Erstelle ein individuelles, überzeugendes und fehlerfreies Anschreiben auf Deutsch basierend auf den folgenden Daten:

▸ Lebenslauf: ${cvText}  
▸ Stellenanzeige: ${jobText}  

Halte dich an diese Struktur und Regeln:

1. Kopfbereich  
   – Mein Name, Adresse, E-Mail, Telefonnummer  
   – Datum automatisch generieren  
   – Empfängeradresse (aus Stellenanzeige oder „thyssenkrupp Bilstein GmbH“)

2. Betreff  
   – „Bewerbung als [Stellenbezeichnung] – [Referenznummer]“

3. Anrede  
   – Falls kein Name vorhanden: „Sehr geehrtes Recruiting-Team der thyssenkrupp Bilstein GmbH“

4. Einleitung  
   – Begeisterung für das Unternehmen (z. B. technologische Marktführerschaft, Motorsport etc.)  
   – Warum diese Position? Warum ich?

5. Hauptteil  
   – Zwei konkrete Hard Skills aus dem Lebenslauf, passend zu den Must-Haves der Anzeige  
   – Ein Soft Skill mit Beispiel (z. B. interkulturelle Kommunikation)  
   – Bezug auf Osteuropa-Erfahrung oder internationale Kundenarbeit  
   – Vertragsverhandlung/CRM-Systeme erwähnen, wenn im Lebenslauf vorhanden  
   – Nutzenversprechen: Was bringt meine Kombination dem Unternehmen?

6. Schluss  
   – Gesprächsbereitschaft signalisieren  
   – Dank für die Zeit  
   – Formell abschließen: „Mit freundlichen Grüßen, Adem Demir“

Weitere Regeln:  
– Max. 1 Seite, aktive Sprache („Ich steigerte…“)  
– Keine Floskeln  
– Formaler, aber dynamischer Ton (kein „Sehr geehrte Damen und Herren“)  
– Nur das fertige Anschreiben zurückgeben, keine Erklärungen oder Markdown
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