import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import webpush from "web-push";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cron from "node-cron";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

dotenv.config();

// Configure Firebase for server-side settings fetching
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyD0n_CaZPieu8UvFJlY1RZUi7CztAvfb34",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "cronogramasec.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "cronogramasec",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "cronogramasec.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "848884905231",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:848884905231:web:5876c6f1c529121d303a7a",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function getCloudinaryConfig() {
  // Try environment variables first (highest priority)
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    return {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    };
  }

  // Try fetching from Firestore settings
  try {
    const settingsRef = doc(db, "settings", "app_config");
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.cloudinaryCloudName && data.cloudinaryApiKey && data.cloudinaryApiSecret) {
        console.log("Usando configuração do Cloudinary do Firestore.");
        return {
          cloud_name: data.cloudinaryCloudName,
          api_key: data.cloudinaryApiKey,
          api_secret: data.cloudinaryApiSecret,
        };
      }
    }
  } catch (error) {
    console.error("Erro ao buscar config do Cloudinary no Firestore:", error);
  }

  return null;
}

const app = express();
const PORT = 3000;

// Configure multer for temporary file storage before Cloudinary upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// VAPID keys should be in your .env file
const publicVapidKey = process.env.VITE_VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || "mailto:example@yourdomain.com";

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(vapidEmail, publicVapidKey, privateVapidKey);
} else {
  console.warn("VAPID keys not found. Push notifications will not work.");
}

app.use(bodyParser.json());

// Upload endpoint with Cloudinary integration
app.post("/api/upload", async (req, res) => {
  console.log("Recebendo upload para Cloudinary...");
  
  // Ensure Cloudinary is configured
  const config = await getCloudinaryConfig();
  if (config) {
    cloudinary.config(config);
  } else {
    console.error("Cloudinary não configurado!");
    return res.status(500).json({ error: "Cloudinary não configurado. Por favor, configure nas configurações do sistema." });
  }

  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Erro Multer:", err.code);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "O arquivo é muito grande. O limite é de 10MB." });
      }
      return res.status(400).json({ error: `Erro no upload: ${err.message}` });
    } else if (err) {
      console.error("Erro Upload:", err.message);
      return res.status(500).json({ error: `Erro interno: ${err.message}` });
    }

    if (!req.file) {
      console.warn("Nenhum arquivo recebido.");
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    
    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "logos",
        resource_type: "auto",
      });

      // Delete temporary file
      fs.unlinkSync(req.file.path);

      console.log("Upload Cloudinary bem-sucedido:", result.secure_url);
      res.json({ 
        url: result.secure_url,
        public_id: result.public_id
      });
    } catch (cloudinaryErr: any) {
      console.error("Erro Cloudinary:", cloudinaryErr);
      // Clean up temp file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Erro ao enviar para o Cloudinary: " + (cloudinaryErr.message || "Erro desconhecido") });
    }
  });
});

// Delete endpoint for Cloudinary
app.post("/api/upload/delete", async (req, res) => {
  const { public_id } = req.body;
  
  if (!public_id) {
    return res.status(400).json({ error: "public_id é obrigatório." });
  }

  // Ensure Cloudinary is configured
  const config = await getCloudinaryConfig();
  if (config) {
    cloudinary.config(config);
  } else {
    return res.status(500).json({ error: "Cloudinary não configurado." });
  }

  try {
    console.log(`Deletando recurso do Cloudinary: ${public_id}`);
    const result = await cloudinary.uploader.destroy(public_id);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error("Erro ao deletar do Cloudinary:", err);
    res.status(500).json({ error: "Erro ao deletar do Cloudinary: " + (err.message || "Erro desconhecido") });
  }
});

// Serve uploaded files (legacy support or other uses)
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// In-memory storage for subscriptions (In a real app, save this to Firestore)
// But since we want it to work even when the site is closed, we need a way to access them.
// I'll provide a route to trigger notifications from the client.
let subscriptions: any[] = [];

app.post("/api/notifications/subscribe", (req, res) => {
  const subscription = req.body;
  // Check if subscription already exists
  const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
  }
  res.status(201).json({});
});

app.post("/api/notifications/unsubscribe", (req, res) => {
  const subscription = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
  res.status(200).json({});
});

app.post("/api/notifications/send", async (req, res) => {
  const { title, message, url } = req.body;
  const payload = JSON.stringify({ title, message, url });

  const promises = subscriptions.map(subscription => 
    webpush.sendNotification(subscription, payload).catch(err => {
      console.error("Error sending notification:", err);
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription has expired or is no longer valid
        subscriptions = subscriptions.filter(s => s.endpoint !== subscription.endpoint);
      }
    })
  );

  await Promise.all(promises);
  res.status(200).json({ success: true });
});

// Cron job for birthdays (runs every day at 09:00)
cron.schedule("0 9 * * *", async () => {
  console.log("Checking for birthdays...");
  // Note: In a real full-stack app, you'd fetch from Firestore here.
  // Since we are in a hybrid environment, we might need a different approach if we want the server to be the source of truth.
  // For now, I'll implement the trigger from the client side when the app is open, 
  // but the push system allows it to reach closed tabs.
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
