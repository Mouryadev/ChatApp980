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

  // Get logged-in user info from token
  const currentUserData = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const currentUserId = currentUserData?.id;
  const currentUsername = localStorage.getItem('username');

  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);

  const handleTyping = () => {
    if (!selectedUser) return;

    socket.emit("typing", {
      senderId: currentUserId,
      receiverId: selectedUser._id,
    });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", {
        senderId: currentUserId,
        receiverId: selectedUser._id,
      });
    }, 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    socket.on("userTyping", (data) => {
      if (data.senderId === selectedUser?._id) setIsTyping(true);
    });
    socket.on("userStopTyping", (data) => {
      if (data.senderId === selectedUser?._id) setIsTyping(false);
    });
    return () => {
      socket.off("userTyping");
      socket.off("userStopTyping");
    };
  }, [selectedUser]);

useEffect(() => {
  if (window.particlesJS) {
    window.particlesJS('particles-js', {
      particles: {
        number: { value: 110, density: { enable: true, value_area: 800 } },
        color: { value: ['#87eefb', '#aeeffb', '#4db8ff'] }, // soft gradient shades
        shape: { type: 'circle' },
        opacity: { value: 0.25, random: true }, // soft & varied
        size: { value: 3, random: true }, // some small, some medium
        line_linked: { 
          enable: true, 
          distance: 150, 
          color: '#87eefb', 
          opacity: 0.2, // very soft lines
          width: 1 
        },
        move: { 
          enable: true, 
          speed: 0.8, // smoother, slower movement
          direction: 'none', 
          random: true, 
          straight: false, 
          out_mode: 'out' 
        }
      },
      interactivity: {
        detect_on: 'canvas',
        events: { 
          onhover: { enable: true, mode: 'grab' }, 
          onclick: { enable: true, mode: 'push' } 
        },
        modes: { 
          grab: { 
            distance: 170, 
            line_linked: { opacity: 0.6, color: '#87eefb' } // subtle highlight on hover
          }, 
          push: { particles_nb: 4 } 
        }
      },
      retina_detect: true
    });
  }
}, []);


  useEffect(() => {
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

    if (currentUserId) socket.emit('join', currentUserId);

    socket.on('receiveMessage', (newMessage) => {
      if (
        (newMessage.sender._id === currentUserId && newMessage.receiver === selectedUser?._id) ||
        (newMessage.sender._id === selectedUser?._id && newMessage.receiver === currentUserId)
      ) {
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    return () => socket.off('receiveMessage');
  }, [token, selectedUser, currentUserId]);

  useEffect(scrollToBottom, [messages]);

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

    const newMessage = {
      senderId: currentUserId,
      receiverId: selectedUser._id,
      content: message
    };
    socket.emit('sendMessage', newMessage);
    setMessage('');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-900">
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      <motion.div className="chat-container max-w-6xl mx-auto my-8 flex rounded-xl shadow-2xl z-10 border-2 border-transparent gradient-border">

        {/* User List */}
        <motion.div className="user-list bg-gray-800 p-6 rounded-l-xl">
          <div className="flex items-center gap-3 mb-4 user-toggle">
            <img
              src={currentUserId ? `https://picsum.photos/seed/${currentUserId}/35` : 'default-avatar.png'}
              alt="me"
              className="w-12 h-12 rounded-full object-cover border border-gray-500"
            />
            <h3 className="text-xl font-bold text-white mb-4 cursor-pointer sm:cursor-default flex items-center justify-between"
              onClick={() => setIsOpen(!isOpen)}>
               {currentUsername} <span className="sm:hidden">{isOpen ? "▲" : "▼"}</span>
            </h3>
          </div>

          <motion.div initial={false} animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }} transition={{ duration: 0.3 }} className="overflow-hidden sm:!h-auto sm:!opacity-100">
            {users.map((user) => (
              <motion.div
                key={user._id}
                className={`user flex items-center gap-3 p-3 rounded-lg cursor-pointer text-gray-300  transition-all ${selectedUser?._id === user._id ? "bg-blue-600 text-white" : ""
                  }`}
                onClick={() => handleUserClick(user)}
              
                whileTap={{ scale: 0.95 }}
              >
                <img
                  src={`https://picsum.photos/seed/${user._id}/40`}
                  alt="profile"
                  className="w-12 h-12 rounded-full object-cover border border-gray-500"
                />
                <span>{user.username}{user._id === currentUserId ? " (You)" : ""}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Chat Box */}
        <motion.div className="chat-box bg-gray-800 p-6 rounded-r-xl flex flex-col">
          {selectedUser ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xl font-bold text-white flex-1">Chat with {selectedUser.username}</h3>
                <img
                  src={`https://picsum.photos/seed/${selectedUser._id}/40`}
                  alt={selectedUser.username}
                  className="w-12 h-12 rounded-full object-cover border border-gray-500"
                />
              </div>

              <div className="messages flex-grow overflow-y-auto bg-gray-700 rounded-lg p-4">
                {messages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-2 mb-3 ${msg.sender.username === currentUsername ? "justify-end flex-row-reverse" : "justify-start"}`}>
                    <img src={`https://picsum.photos/seed/${msg.sender._id}/35`} alt="profile" className="w-11 h-11 rounded-full object-cover border border-gray-500" />
                  <div className={`p-2 max-w-xs rounded-lg ${msg.sender.username === currentUsername ? "my-message text-white" : "other-message text-gray-200"}`}>
                        <div className="content-wrapper">
  <strong>{msg.sender.username}: </strong>{msg.content}
  </div>
  <div className="text-xs text-gray-400 mt-1 text-right">
    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </div>

</div>
                  </div>
                ))}
                {isTyping && <div className="text-gray-300 italic animate-pulse">{selectedUser.username} is typing...</div>}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="mt-4 flex space-x-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onInput={handleTyping}
                  placeholder="Type a message..."
                  className="flex-grow px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
                <button type="submit" className="bg-blue-600 sub-btn text-white px-4 py-2 rounded-lg font-semibold">Send</button>
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
