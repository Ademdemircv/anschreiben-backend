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

Du bist ein Experte für berufliche Kommunikation und erstellst **maßgeschneiderte Bewerbungsschreiben**. Deine Aufgabe ist es, auf Basis eines Bewerber-Lebenslaufs und einer Stellenanzeige ein professionelles **Anschreiben** zu verfassen.

**Kontext:** Bewerbung für die Position **[STELLENBEZEICHNUNG]** bei **[UNTERNEHMENSNAME]**.

**Stellenanzeige:**  
[Stellenanzeige einfügen]

**Lebenslauf des Bewerbers:**  
[Lebenslauf einfügen]

**Anforderungen an das Anschreiben:**  
- **Format:** Enthält Absender (Name, Anschrift des Bewerbers aus dem Lebenslauf), Empfänger (Unternehmensname und Adresse aus der Stellenanzeige), Ort und aktuelles Datum (Ort = Wohnort des Bewerbers, Datum im Format "TT. Monat JJJJ"), Betreff mit Stellenbezeichnung, Anrede (mit Namen der Ansprechperson laut Anzeige; falls unbekannt, "Sehr geehrte Damen und Herren"), Einleitung, Hauptteil, Schlussabsatz, Grußformel ("Mit freundlichen Grüßen") und den vollen Namen des Bewerbers. Das Anschreiben soll maximal **eine DIN-A4-Seite** lang sein (ca. 350 Wörter).  
- **Tonfall:** Passe Sprache und Stil automatisch der Branche und Unternehmenskultur an. Für konservative Branchen (z. B. Banken, Recht) wähle einen klassisch-seriösen Ton. Für Tech/Startup-Unternehmen wähle einen modern-dynamischen, motivierten Ton. Für kreative Branchen (z. B. Design, Marketing) wähle einen kreativ-lockeren, trotzdem professionellen Ton.  
- **Inhalt & Struktur:** Nutze die Informationen aus Lebenslauf und Stellenanzeige, um ein **individuelles** Anschreiben zu formulieren. Hebe relevante **Qualifikationen, Erfahrungen und Erfolge** des Bewerbers hervor, die zur Stelle passen. Integriere im Hauptteil **1–2 prägnante Erfolgsbeispiele nach dem SAR-Prinzip** (Situation – Aktion – Resultat), um die Fähigkeiten des Bewerbers zu belegen. Gehe auf Anforderungen und **Keywords** aus der Stellenanzeige ein und zeige, wie der Bewerber diese erfüllt. Baue außerdem einen **UVP-Satz** ein, der die einzigartige Kombination des Bewerbers hervorhebt (z. B.: *„Meine Kombination aus X und Y ermöglicht Z.“*). Stelle einen Bezug zum **Unternehmen** her (z. B. Werte, Projekte oder Erfolge der Firma, die den Bewerber motivieren).  
- **Stil:** Formuliere **aktiv**, präzise und fehlerfrei. Vermeide Konjunktiv-Floskeln wie "würde" oder abgenutzte Phrasen. Schreibe selbstbewusst, klar und **überzeugend**, ohne übertriebene Ausschmückungen.

**Ausgabe:**  
Gib das vollständige Anschreiben als **finalen, druckfertigen Fließtext** aus – ohne Markdown, Aufzählungszeichen oder Platzhalter. Der Text soll wie ein fertiges Dokument klingen, das der Bewerber direkt versenden kann.
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