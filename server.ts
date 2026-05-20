import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please add it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini-Powered PHP Academic Companion
  app.post("/api/chat-assistant", async (req, res) => {
    try {
      const { textInput, dbConfig, projectsCount, tasksCount } = req.body;

      if (!textInput || typeof textInput !== "string") {
        res.status(400).json({ error: "Missing or invalid prompt query textInput" });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are a friendly, highly skilled computer science teaching assistant specializing in PHP, MySQL, Apache, and standard server-side paradigms (like XAMPP, MAMP, and PDO).
The user is building a 'Project & Task Management' backend in PHP for a class project, corresponding to a modern React dashboard.
Here is information about their project status:
- Active projects count: ${projectsCount || 0}
- Active tasks count: ${tasksCount || 0}
- Configured PHP driver: PDO MySQL
- Target DB Name: ${dbConfig?.dbName || 'project_manager'}
- User table: ${dbConfig?.tableNameProjects || 'projects'} and ${dbConfig?.tableNameTasks || 'tasks'}

When answering:
1. Keep replies educational, straightforward, concise, and focused on helping a student score top marks in their PHP class.
2. Provide clear, modern PHP code block examples using standard PHP PDO (prepared statements and parameter binding) rather than the deprecated mysqli library or raw string interpolations.
3. Suggest best practices like password hashing (\`password_hash()\`), cross-origin resource sharing (CORS headers in PHP like \`header("Access-Control-Allow-Origin: *")\`), and proper try-catch connection error management.
4. Keep the explanation clean and readable. Use markdown formatting.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: textInput,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ answer: response.text });
    } catch (error: any) {
      console.error("Gemini assistant error:", error);
      res.status(500).json({ 
        error: error.message || "An error occurred while connecting to the Gemini classroom assistant." 
      });
    }
  });

  // Serve static assets or mount Vite dev server
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
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
});
