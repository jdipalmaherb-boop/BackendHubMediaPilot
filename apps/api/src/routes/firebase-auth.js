import express from "express";
import { auth, db } from "../config/firebase.js";

const router = express.Router();

/**
 * POST /api/firebase-auth/signup
 * Create a new user with Firebase Auth
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required" 
      });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: displayName || null,
      emailVerified: false,
    });

    // Optionally store additional user data in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: displayName || null,
      createdAt: new Date().toISOString(),
      role: "user",
    });

    res.status(201).json({ 
      message: "User created successfully",
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (err) {
    console.error("Signup error:", err);
    
    // Handle specific Firebase errors
    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({ 
        error: "Email already exists" 
      });
    }
    if (err.code === "auth/invalid-email") {
      return res.status(400).json({ 
        error: "Invalid email format" 
      });
    }
    if (err.code === "auth/weak-password") {
      return res.status(400).json({ 
        error: "Password is too weak. Must be at least 6 characters" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/firebase-auth/login
 * Note: Client-side should use Firebase Client SDK to sign in
 * This endpoint can be used to generate custom tokens or verify credentials
 */
router.post("/login", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ 
        error: "User ID is required" 
      });
    }

    // Get user from Firebase Auth
    const userRecord = await auth.getUser(uid);

    // Get additional user data from Firestore
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      message: "User authenticated",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        ...userData,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/firebase-auth/custom-token
 * Generate a custom token for a user (useful for server-side auth)
 */
router.post("/custom-token", async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ 
        error: "User ID is required" 
      });
    }

    const customToken = await auth.createCustomToken(uid);

    res.json({
      message: "Custom token generated",
      customToken,
    });
  } catch (err) {
    console.error("Custom token error:", err);
    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * GET /api/firebase-auth/user/:uid
 * Get user information by UID
 */
router.get("/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Get user from Firebase Auth
    const userRecord = await auth.getUser(uid);

    // Get additional user data from Firestore
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    res.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
        ...userData,
      },
    });
  } catch (err) {
    console.error("Get user error:", err);
    
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * PUT /api/firebase-auth/user/:uid
 * Update user information
 */
router.put("/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const { email, displayName, password, disabled } = req.body;

    const updateData = {};
    if (email) updateData.email = email;
    if (displayName) updateData.displayName = displayName;
    if (password) updateData.password = password;
    if (typeof disabled === "boolean") updateData.disabled = disabled;

    // Update user in Firebase Auth
    const userRecord = await auth.updateUser(uid, updateData);

    // Update additional data in Firestore if needed
    if (displayName) {
      await db.collection("users").doc(uid).update({
        displayName,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({
      message: "User updated successfully",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
      },
    });
  } catch (err) {
    console.error("Update user error:", err);
    
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }
    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({ 
        error: "Email already exists" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * DELETE /api/firebase-auth/user/:uid
 * Delete a user
 */
router.delete("/user/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Delete user from Firebase Auth
    await auth.deleteUser(uid);

    // Delete user data from Firestore
    await db.collection("users").doc(uid).delete();

    res.json({
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Delete user error:", err);
    
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/firebase-auth/verify-email/:uid
 * Generate email verification link
 */
router.post("/verify-email/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Get user email
    const userRecord = await auth.getUser(uid);
    
    // Generate email verification link
    const link = await auth.generateEmailVerificationLink(userRecord.email);

    res.json({
      message: "Email verification link generated",
      link,
    });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

/**
 * POST /api/firebase-auth/password-reset
 * Generate password reset link
 */
router.post("/password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: "Email is required" 
      });
    }

    // Generate password reset link
    const link = await auth.generatePasswordResetLink(email);

    res.json({
      message: "Password reset link generated",
      link,
    });
  } catch (err) {
    console.error("Password reset error:", err);
    
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ 
        error: "User not found" 
      });
    }

    res.status(500).json({ 
      error: err.message || "Internal server error" 
    });
  }
});

export default router;

