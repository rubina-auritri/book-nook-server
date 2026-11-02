
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { jwtVerify, createRemoteJWKSet } from 'jose'


const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

let bookCollection;

const JWKS = createRemoteJWKSet(
  new URL(`http://localhost:3000/api/auth/jwks`),
);


const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({
      success: false,
      message: "Authorization header is blocked",
    });
  }
const token = authHeader.split(" ")[1]; 
if (!token) {
    return res.status(401).send({
      success: false,
      message: "Token is missing",
    });
  }

  try {
    
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'http://localhost:3000',
      audience: 'http://localhost:3000',
    });
    console.log("JWT Payload:", payload);
    req.user = payload; // Attach the decoded payload to the request object
  } catch (error) {
    return res.status(401).send({
      success: false,
      message: "Invalid token",
    });
  }
  // Add token verification logic here
  next();
};

// Test route
app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// GET all books
app.get("/books", async (req, res) => {
  try {
    const books = await bookCollection.find().toArray();
    res.send(books);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// POST a new book
app.post("/books",  async (req, res) => {
  try {
    const bookData = {
      ...req.body,
      addedDate: new Date(),
    };

    const result = await bookCollection.insertOne(bookData);

    res.status(201).send({
      success: true,
      message: "Book added successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

// GET single book by ID
app.get("/books/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid book ID",
      });
    }

    const book = await bookCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!book) {
      return res.status(404).send({
        success: false,
        message: "Book not found",
      });
    }

    res.send(book);
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});



app.get("/my-books",verifyToken, async (req, res) => {
  const email = req.query.email;

  const result = await bookCollection
    .find({ userEmail: email })
    .toArray();

  res.send(result);
});

app.get("/my-books/:email",verifyToken, async (req, res) => {
  try {
    const email = req.params.email;

    const result = await bookCollection
      .find({ userEmail: email })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch books",
    });
  }
});

app.put("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      author,
      category,
      image,
      description,
      userEmail,
    } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    const result = await bookCollection.updateOne(
      {
        _id: new ObjectId(id),
        userEmail: userEmail,
      },
      {
        $set: {
          title,
          author,
          category,
          image,
          description,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Book not found or unauthorized",
      });
    }

    res.send({
      success: true,
      message: "Book updated successfully",
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to update book",
    });
  }
});

app.delete("/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { ObjectId } = await import("mongodb");

    const result = await bookCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    res.send({
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to delete book",
    });
  }
});



// Start server
async function startServer() {
  try {
    await client.connect();

    console.log("MongoDB connected!");

    const db = client.db("Book-Nook");
    bookCollection = db.collection("books");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server error:", error);
  }
}

startServer();
