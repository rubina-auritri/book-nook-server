
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { jwtVerify, createRemoteJWKSet } from "jose";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

let bookCollection;
let borrowCollection;
let dbPromise;

async function connectDB() {
  if (!dbPromise) {
    dbPromise = client.connect()
      .then(() => {
        console.log("MongoDB connected!");

        const db = client.db("Book-Nook");

        bookCollection = db.collection("books");
        borrowCollection = db.collection("borrows");
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}

// Connect database before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).send({
      success: false,
      message: "Database connection failed",
    });
  }
});

// JWT Configuration
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.AUTH_BASE_URL}/api/auth/jwks`)
);

// Verify Token
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
      issuer: process.env.AUTH_BASE_URL,
      audience: process.env.AUTH_BASE_URL,
    });

    console.log("JWT Payload:", payload);
    req.user = payload;

  } catch (error) {
    return res.status(401).send({
      success: false,
      message: "Invalid token",
    });
  }

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
app.post("/books", verifyToken, async (req, res) => {
  try {
    const bookData = {
      ...req.body,
      userEmail: req.user.email,
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
app.get("/books/:id", verifyToken, async (req, res) => {
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

// GET my books
app.get("/my-books", verifyToken, async (req, res) => {
  const email = req.query.email;

  const result = await bookCollection
    .find({ userEmail: email })
    .toArray();

  res.send(result);
});

app.get("/my-books/:email", verifyToken, async (req, res) => {
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

// UPDATE book
app.put("/books/:id", verifyToken, async (req, res) => {
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

// DELETE book
app.delete("/books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

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

// POST borrow book
app.post("/borrows", verifyToken, async (req, res) => {
  try {
    const { bookId, bookTitle, bookImage } = req.body;
    const userEmail = req.user.email;

    // Check existing borrow
    const alreadyBorrowed = await borrowCollection.findOne({
      bookId: bookId,
      userEmail: userEmail,
    });

    if (alreadyBorrowed) {
      return res.status(400).send({
        success: false,
        message: "You have already borrowed this book!",
      });
    }

    const borrowDate = new Date();
    const returnDate = new Date();

    returnDate.setDate(returnDate.getDate() + 14);

    const borrowData = {
      bookId,
      bookTitle,
      bookImage,
      userEmail,
      borrowDate,
      returnDate,
    };

    const result = await borrowCollection.insertOne(borrowData);

    res.send({
      success: true,
      message: "Book borrowed successfully",
      insertedId: result.insertedId,
    });

  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// GET my borrows
app.get("/my-borrows", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;

    const result = await borrowCollection
      .find({ userEmail })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(result);

  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

// RETURN book
app.delete("/borrows/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid borrow ID",
      });
    }

    const result = await borrowCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        message: "Borrow record not found",
      });
    }

    res.send({
      message: "Book returned successfully",
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to return book",
    });
  }
});


// Get latest 6 books


// GET latest 6 books (New Arrivals)
app.get("/new-arrivals", async (req, res) => {
  try {
    const latestBooks = await bookCollection
      .find({})
      .sort({ addedDate: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(latestBooks);

  } catch (error) {
    console.error("New Arrivals Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch new arrivals",
      error: error.message,
    });
  }
});


// Local development only
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;
