const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI =
  "mongodb+srv://mouryapooja980:Mourya980%40@chatapp.vuwmqvf.mongodb.net/chat-app?retryWrites=true&w=majority";
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);


// Message Schema
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(400).json({ message: 'Username already exists' });
  }
});

// Signin
app.post('/api/signin', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, username });
});

// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  const users = await User.find({}, 'username').lean();
  res.json(users.filter(user => user._id.toString() !== req.user.id));
});

// Get messages between two users
app.get('/api/messages/:receiverId', authenticateToken, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: req.params.receiverId },
      { sender: req.params.receiverId, receiver: req.user.id }
    ]
  }).populate('sender', 'username').lean();
  res.json(messages);
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

    socket.on("typing", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("userTyping", { senderId });
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("userStopTyping", { senderId });
  });
  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('sendMessage', async ({ senderId, receiverId, content }) => {
    const message = new Message({ sender: senderId, receiver: receiverId, content });
    await message.save();
    const populatedMessage = await Message.findById(message._id).populate('sender', 'username').lean();
    io.to(receiverId).emit('receiveMessage', populatedMessage);
    io.to(senderId).emit('receiveMessage', populatedMessage);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(5000, () => console.log('Server running on port 5000'));