import User from "../models/user.js";
import { generateToken } from "../utils/auth.js";

// Create a new user
export async function createUser(req, reply) {
  try {
    const user = new User(req.body);
    const savedUser = await user.save();
    reply.status(201).send(savedUser);
  } catch (err) {
    reply.status(400).send({ message: "Error creating user", error: err.message });
  }
}

// Retrieve all users
export async function getUsers(req, reply) {
  try {
    const users = await User.find();
    reply.send(users);
  } catch (err) {
    reply.status(500).send({ message: "Error retrieving users", error: err.message });
  }
}

// Retrieve a specific user by ID
export async function getUserById(req, reply) {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return reply.status(404).send({ message: "User not found" });
    reply.send(user);
  } catch (err) {
    reply.status(500).send({ message: "Error retrieving user", error: err.message });
  }
}

// Update user details
export async function updateUser(req, reply) {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, req.body, { new: true });
    if (!updatedUser) return reply.status(404).send({ message: "User not found" });
    reply.send(updatedUser);
  } catch (err) {
    reply.status(500).send({ message: "Error updating user", error: err.message });
  }
}

// Soft delete a user
export async function deleteUser(req, reply) {
  try {
    const deletedUser = await User.findByIdAndUpdate(req.params.userId, { status: "Inactive" }, { new: true });
    if (!deletedUser) return reply.status(404).send({ message: "User not found" });
    reply.send(deletedUser);
  } catch (err) {
    reply.status(500).send({ message: "Error deleting user", error: err.message });
  }
}

// User login
export async function userLogin(req, reply) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = generateToken(user);
    reply.send({ token });
  } catch (err) {
    reply.status(500).send({ message: "Error logging in", error: err.message });
  }
}
