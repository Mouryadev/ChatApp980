const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage: storage });

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('Uploads'));

const MONGO_URI =
  "mongodb+srv://mouryapooja980:Mourya980%40@chatapp.vuwmqvf.mongodb.net/chat-app?retryWrites=true&w=majority";
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  fileUrl: String,
  timestamp: { type: Date, default: Date.now },
  quotedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  seen: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });

  const baseUrl = process.env.BASE_URL || 'https://chatapp980.onrender.com';
  const fullUrl = `${baseUrl}/uploads/${file.filename}`;
  console.log('Generated fileUrl:', fullUrl);
  res.json({ fileUrl: fullUrl });
});

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

app.post('/api/signin', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, username });
});

app.get('/api/users', authenticateToken, async (req, res) => {
  const users = await User.find({}, 'username').lean();
  res.json(users.filter(user => user._id.toString() !== req.user.id));
});

app.get('/api/messages/:receiverId', authenticateToken, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: req.params.receiverId },
      { sender: req.params.receiverId, receiver: req.user.id }
    ]
  }).populate('sender', 'username').populate('quotedMessageId', 'content sender').lean();
  console.log('API response for messages:', messages);
  res.json(messages);
});

const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    onlineUsers.add(userId);
    io.emit('onlineUsers', Array.from(onlineUsers));
    console.log('Online users:', Array.from(onlineUsers));
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("userTyping", { senderId });
  });

  socket.on("stopTyping", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("userStopTyping", { senderId });
  });

  socket.on('sendMessage', async ({ senderId, receiverId, content, fileUrl, quotedMessageId, seen, delivered }) => {
    console.log('Received message data:', { senderId, receiverId, content, fileUrl, quotedMessageId, seen, delivered });
    const message = new Message({ sender: senderId, receiver: receiverId, content, fileUrl, quotedMessageId, seen, delivered });
    await message.save();
    const populatedMessage = await Message.findById(message._id).populate('sender', 'username').populate('quotedMessageId', 'content sender').lean();
    console.log('Populated message sent:', populatedMessage);
    io.to(receiverId).emit('receiveMessage', populatedMessage);
    io.to(senderId).emit('receiveMessage', populatedMessage);
    if (onlineUsers.has(receiverId)) {
      await Message.updateOne({ _id: message._id }, { $set: { delivered: true } });
      io.to(senderId).emit('messageDelivered', { messageId: message._id });
      console.log('Message marked as delivered:', message._id);
    }
  });

  socket.on('messageDelivered', async ({ messageId, senderId, receiverId }) => {
    await Message.updateOne({ _id: messageId }, { $set: { delivered: true } });
    io.to(senderId).emit('messageDelivered', { messageId });
    console.log('Message marked as delivered:', messageId);
  });

  socket.on('messageSeen', async ({ senderId, receiverId }) => {
    const messages = await Message.find({
      sender: senderId,
      receiver: receiverId,
      seen: false
    });
    const messageIds = messages.map(msg => msg._id.toString());
    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { seen: true, delivered: true } }
      );
      io.to(senderId).emit('messageSeen', { messageIds });
      console.log('Messages marked as seen:', messageIds);
      const updatedMessages = await Message.find({ _id: { $in: messageIds } })
        .populate('sender', 'username')
        .populate('quotedMessageId', 'content sender')
        .lean();
      io.to(receiverId).emit('receiveMessage', updatedMessages);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let userId of onlineUsers) {
      if (socket.rooms.has(userId)) {
        onlineUsers.delete(userId);
        io.emit('onlineUsers', Array.from(onlineUsers));
        console.log('Online users after disconnect:', Array.from(onlineUsers));
        break;
      }
    }
  });
});

server.listen(5000, () => console.log('Server running on port 5000'));