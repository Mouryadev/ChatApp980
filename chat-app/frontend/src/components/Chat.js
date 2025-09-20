import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { motion } from 'framer-motion';
import './Chat.css';

const socket = io('https://chatapp980.onrender.com', { autoConnect: true });

function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');
  const currentUser = localStorage.getItem('username');
  const messagesEndRef = useRef(null);
 const [isOpen, setIsOpen] = useState(false);

const [isTyping, setIsTyping] = useState(false); // other user typing?
const typingTimeout = useRef(null);

// Emit typing event
const handleTyping = () => {
  if (!selectedUser) return;
  const userId = JSON.parse(atob(token.split('.')[1])).id;

  socket.emit("typing", {
    senderId: userId,
    receiverId: selectedUser._id,
  });

  // Agar banda stop kare toh after 2s "stopTyping" bhejna
  if (typingTimeout.current) clearTimeout(typingTimeout.current);
  typingTimeout.current = setTimeout(() => {
    socket.emit("stopTyping", {
      senderId: userId,
      receiverId: selectedUser._id,
    });
  }, 2000);
};
  // Auto-scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

useEffect(() => {
  socket.on("userTyping", (data) => {
    if (data.senderId === selectedUser?._id) {
      setIsTyping(true);
    }
  });

  socket.on("userStopTyping", (data) => {
    if (data.senderId === selectedUser?._id) {
      setIsTyping(false);
    }
  });

  return () => {
    socket.off("userTyping");
    socket.off("userStopTyping");
  };
}, [selectedUser]);

  
  // Initialize Particles.js
  useEffect(() => {
    if (window.particlesJS) {
      window.particlesJS('particles-js', {
        particles: {
          number: { value: 100, density: { enable: true, value_area: 800 } },
          color: { value: ['#8b5cf6', '#d946ef', '#ffffff'] },
          shape: { type: 'circle' },
          opacity: { value: 0.4, random: true },
          size: { value: 2, random: true },
          line_linked: { enable: true, distance: 120, color: '#8b5cf6', opacity: 0.3, width: 1 },
          move: { enable: true, speed: 1.5, direction: 'none', random: true }
        },
        interactivity: {
          detect_on: 'canvas',
          events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' } },
          modes: { grab: { distance: 140 }, push: { particles_nb: 3 } }
        },
        retina_detect: true
      });
    }
  }, []);

  useEffect(() => {
    // Fetch all users
    const fetchUsers = async () => {
      try {
        const response = await axios.get('https://chatapp980.onrender.com/api/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();

    // Join socket room with user ID
    const userId = token ? JSON.parse(atob(token.split('.')[1])).id : null;
    if (userId) {
      socket.emit('join', userId);
    }

    // Listen for new messages
    socket.on('receiveMessage', (newMessage) => {
      if (
        (newMessage.sender._id === userId && newMessage.receiver === selectedUser?._id) ||
        (newMessage.sender._id === selectedUser?._id && newMessage.receiver === userId)
      ) {
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    return () => {
      socket.off('receiveMessage');
    };
  }, [token, selectedUser]);

  // Auto-scroll when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat history when a user is selected
  const handleUserClick = async (user) => {
    setSelectedUser(user);
    try {
      const response = await axios.get(`https://chatapp980.onrender.com/api/messages/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;

    const userId = JSON.parse(atob(token.split('.')[1])).id;
    const newMessage = {
      senderId: userId,
      receiverId: selectedUser._id,
      content: message
    };

    socket.emit('sendMessage', newMessage);
    setMessage('');
  };

  // Framer Motion variants
  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } }
  };

  const userListVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const chatBoxVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.1, transition: { type: 'spring', stiffness: 400, damping: 10 } },
    tap: { scale: 0.95 }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-900">
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      <motion.div
        className="chat-container max-w-6xl mx-auto my-8 flex rounded-xl shadow-2xl z-10 border-2 border-transparent gradient-border"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5), 0 10px 10px rgba(0, 0, 0, 0.3)' }}
      >
      <motion.div
      className="user-list bg-gray-800 p-6 rounded-l-xl"
      initial="hidden"
      animate="visible"
    >
      {/* Heading */}
      <h3
        className="text-xl font-bold text-white mb-4 cursor-pointer sm:cursor-default flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        Users
        {/* mobile pe hi arrow dikhana */}
        <span className="sm:hidden">
          {isOpen ? "▲" : "▼"}
        </span>
      </h3>

      {/* User list */}
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden sm:!h-auto sm:!opacity-100"
      >
        {users.map((user) => (
          <motion.div
            key={user._id}
            className={`user p-3 rounded-lg cursor-pointer text-gray-300 hover:bg-gray-700 hover:text-white transition-all ${
              selectedUser?._id === user._id
                ? "bg-purple-600 text-white"
                : ""
            }`}
            onClick={() => handleUserClick(user)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {user.username}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
        <motion.div
          className="chat-box bg-gray-800 p-6 rounded-r-xl flex flex-col"
          variants={chatBoxVariants}
          initial="hidden"
          animate="visible"
        >
          {selectedUser ? (
            <>
              <h3 className="text-xl font-bold text-white mb-4">Chat with {selectedUser.username}</h3>
              <div className="messages flex-grow overflow-y-auto bg-gray-700 rounded-lg p-4">
  {messages.map((msg, index) => (
    <motion.div
      key={index}
      className={`p-2 mb-2 rounded-lg ${
        msg.sender.username === currentUser
          ? "my-message bg-purple-600 text-white ml-auto"
          : "other-message bg-gray-600 text-gray-200 mr-auto"
      }`}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
    >
      <strong>{msg.sender.username}: </strong>
      {msg.content}
    </motion.div>
  ))}

  {/* Typing Indicator */}
  {isTyping && (
    <div className="text-gray-300 italic animate-pulse">
      {selectedUser.username} is typing...
    </div>
  )}

  <div ref={messagesEndRef} />
</div>

              <form onSubmit={handleSendMessage} className="mt-4 flex space-x-2">
               <input
  type="text"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  onInput={handleTyping}   // << yahan call
  placeholder="Type a message..."
  className="flex-grow px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
/>
                <button
                  type="submit"
                  className="bg-purple-600 sub-btn text-white px-4 py-2 rounded-lg font-semibold"
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            <p className="text-gray-400 text-center flex-grow flex items-center justify-center">Select a user to start chatting</p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Chat;