
import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Test route (no MongoDB required)
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

app.get("/books", async (req, res) => {
  try {
    const data = {
      ...req.body,
      addedDate: new Date(),
    };
    const db = client.db("Book-Nook");
    const bookCollection = db.collection("books");
    const books = await bookCollection.find().toArray();
    res.json(books);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


const client = new MongoClient(process.env.MONGODB_URI);

async function startServer() {
  try {
    await client.connect();

    console.log("MongoDB connected!");

    const db = client.db("Book-Nook");
    const bookCollection = db.collection("books");

    // POST API
    app.post("/books", async (req, res) => {
      try {
        const result = await bookCollection.insertOne({
          ...req.body,
          addedDate: new Date(),
        });

        res.status(201).json({
          success: true,
          message: "Book added successfully!",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Server error:", error);
  }
}

startServer();
