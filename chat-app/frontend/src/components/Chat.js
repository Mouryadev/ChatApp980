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
  const [selectedFile, setSelectedFile] = useState(null);
  const [quotedMessage, setQuotedMessage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const token = localStorage.getItem('token');
  const currentUserData = token ? JSON.parse(atob(token.split('.')[1])) : null;
  const currentUserId = currentUserData?.id;
  const currentUsername = localStorage.getItem('username');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
    console.log('Selected file:', e.target.files[0]?.name);
  };

  const groupMessagesByDate = (messages) => {
    const grouped = {};
    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateLabel = msgDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      if (msgDate.toDateString() === today.toDateString()) dateLabel = "Today";
      else if (msgDate.toDateString() === yesterday.toDateString()) dateLabel = "Yesterday";

      if (!grouped[dateLabel]) grouped[dateLabel] = [];
      grouped[dateLabel].push(msg);
    });
    return grouped;
  };

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

  const toggleUserList = () => {
    setIsUserListOpen(!isUserListOpen);
  };

  const handleQuoteReply = (msg) => {
    setQuotedMessage(msg);
    console.log('Quoted message set:', msg);
  };

  useEffect(() => {
    if (selectedUser) {
      socket.emit('messageSeen', {
        senderId: selectedUser._id,
        receiverId: currentUserId,
      });
    }

    socket.on("userTyping", (data) => {
      if (data.senderId === selectedUser?._id) setIsTyping(true);
    });
    socket.on("userStopTyping", (data) => {
      if (data.senderId === selectedUser?._id) setIsTyping(false);
    });
    socket.on('receiveMessage', (newMessage) => {
      console.log('Received message:', newMessage);
      if (
        (newMessage.sender._id === currentUserId && newMessage.receiver === selectedUser?._id) ||
        (newMessage.sender._id === selectedUser?._id && newMessage.receiver === currentUserId)
      ) {
        setMessages((prev) => {
          const updatedMessages = [...prev, { ...newMessage, delivered: true }];
          console.log('Updated messages with new message:', updatedMessages);
          return updatedMessages;
        });
        if (newMessage.sender._id !== currentUserId) {
          socket.emit('messageDelivered', {
            messageId: newMessage._id,
            senderId: newMessage.sender._id,
            receiverId: currentUserId,
          });
        }
      }
    });
    socket.on('onlineUsers', (onlineUsersArray) => {
      setOnlineUsers(new Set(onlineUsersArray));
      console.log('Online users updated:', onlineUsersArray);
    });
    socket.on('messageDelivered', ({ messageId }) => {
      setMessages((prev) => {
        const updatedMessages = prev.map((msg) =>
          msg._id === messageId ? { ...msg, delivered: true } : msg
        );
        console.log('Message marked as delivered:', messageId, updatedMessages);
        return updatedMessages;
      });
    });
    socket.on('messageSeen', ({ messageIds }) => {
      setMessages((prev) => {
        const updatedMessages = prev.map((msg) =>
          messageIds.includes(msg._id) ? { ...msg, seen: true, delivered: true } : msg
        );
        console.log('Messages marked as seen:', messageIds, updatedMessages);
        return updatedMessages;
      });
    });
    return () => {
      socket.off("userTyping");
      socket.off("userStopTyping");
      socket.off('receiveMessage');
      socket.off('onlineUsers');
      socket.off('messageDelivered');
      socket.off('messageSeen');
    };
  }, [selectedUser, currentUserId]);

  useEffect(() => {
    if (window.particlesJS) {
      window.particlesJS('particles-js', {
        particles: {
          number: { value: 110, density: { enable: true, value_area: 800 } },
          color: { value: ['#87eefb', '#aeeffb', '#4db8ff'] },
          shape: { type: 'circle' },
          opacity: { value: 0.25, random: true },
          size: { value: 3, random: true },
          line_linked: {
            enable: true,
            distance: 150,
            color: '#87eefb',
            opacity: 0.2,
            width: 1
          },
          move: {
            enable: true,
            speed: 0.8,
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
              line_linked: { opacity: 0.6, color: '#87eefb' }
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

    const fetchMessages = async () => {
      if (selectedUser) {
        try {
          const response = await axios.get(`https://chatapp980.onrender.com/api/messages/${selectedUser._id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log('Fetched messages:', response.data);
          setMessages(response.data);
          socket.emit('messageSeen', {
            senderId: selectedUser._id,
            receiverId: currentUserId,
          });
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };
    fetchMessages();
  }, [token, selectedUser, currentUserId]);

  useEffect(scrollToBottom, [messages]);

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setIsUserListOpen(false);
    try {
      const response = await axios.get(`https://chatapp980.onrender.com/api/messages/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Messages fetched on user click:', response.data);
      setMessages(response.data);
      socket.emit('messageSeen', {
        senderId: user._id,
        receiverId: currentUserId,
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() && !selectedFile) return;
    let fileUrl = null;

    if (selectedFile) {
      const formData = new FormData();
      formData.append('file', selectedFile);
      try {
        const response = await axios.post('https://chatapp980.onrender.com/api/upload', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        fileUrl = response.data.fileUrl;
        console.log('Uploaded fileUrl:', fileUrl);
      } catch (error) {
        console.error('File upload error:', error);
      }
    }

    const newMessage = {
      senderId: currentUserId,
      receiverId: selectedUser._id,
      content: message,
      fileUrl,
      quotedMessageId: quotedMessage?._id,
      seen: false,
      delivered: false,
    };
    console.log('Sending message:', newMessage);
    setMessages((prev) => [...prev, { ...newMessage, _id: `temp-${Date.now()}`, sender: { _id: currentUserId, username: currentUsername } }]);
    socket.emit('sendMessage', newMessage);

    setMessage('');
    setSelectedFile(null);
    setQuotedMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-900">
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      <motion.div className="chat-container max-w-6xl mx-auto my-8 flex rounded-xl shadow-2xl z-10 border-2 border-transparent gradient-border">
        <div className="sm:hidden absolute top-4 left-4 z-20">
          <button onClick={toggleUserList} className="text-white p-2 rounded-full bg-gray-700 hover:bg-gray-600">
            {selectedUser ? (
              <img
                src={`https://picsum.photos/seed/${selectedUser._id}/35`}
                alt={selectedUser.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <i className="fas fa-bars text-lg"></i>
            )}
          </button>
        </div>
        <motion.div
          className={`user-list bg-gray-800 p-6 rounded-l-xl sm:w-1/3 w-full absolute sm:static z-10 transition-all duration-300 sm:!translate-x-0 ${
            isUserListOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <img
              src={currentUserId ? `https://picsum.photos/seed/${currentUserId}/35` : 'default-avatar.png'}
              alt="me"
              className="w-12 h-12 rounded-full object-cover border border-gray-500"
            />
            <h3 className="text-xl font-bold text-white flex-1">{currentUsername}</h3>
          </div>
          <motion.div animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            {users.map((user) => (
              <motion.div
                key={user._id}
                className={`user flex items-center gap-3 p-3 rounded-lg cursor-pointer text-gray-300 transition-all ${selectedUser?._id === user._id ? 'bg-blue-600 text-white' : ''}`}
                onClick={() => handleUserClick(user)}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <img
                    src={`https://picsum.photos/seed/${user._id}/40`}
                    alt="profile"
                    className="w-12 h-12 rounded-full object-cover border border-gray-500"
                  />
                  {onlineUsers.has(user._id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-gray-800"></span>
                  )}
                </div>
                <span>{user.username}{user._id === currentUserId ? ' (You)' : ''}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
        <motion.div className="chat-box bg-gray-800 p-6 rounded-r-xl flex flex-col flex-1">
          {selectedUser ? (
            <>
              <div className="flex items-center gap-3 mb-4 chat-header">
                <h3 className="text-xl font-bold text-white flex-1">
                  Chat with {selectedUser.username}
                  {onlineUsers.has(selectedUser._id) && (
                    <span className="text-green-400 text-sm ml-2">Online</span>
                  )}
                </h3>
                <img
                  src={`https://picsum.photos/seed/${selectedUser._id}/40`}
                  alt={selectedUser.username}
                  className="w-12 h-12 rounded-full object-cover border border-gray-500"
                />
              </div>
              <div className="messages flex-grow overflow-y-auto bg-gray-700 rounded-lg p-4">
                {Object.entries(groupMessagesByDate(messages)).map(([dateLabel, msgs]) => (
                  <div key={dateLabel}>
                    <div className="text-gray-400 text-xs text-center my-2">{dateLabel}</div>
                    {msgs.map((msg, index) => (
                      <div key={index} className={`flex items-start gap-2 mb-3 ${msg.sender.username === currentUsername ? 'justify-end flex-row-reverse' : 'justify-start'} relative`}>
                        <img src={`https://picsum.photos/seed/${msg.sender._id}/35`} alt="profile" className="profile-pic w-11 h-11 rounded-full object-cover border border-gray-500" />
                        <div className={`p-2 max-w-xs rounded-lg ${msg.sender.username === currentUsername ? 'my-message text-white' : 'other-message text-gray-200'}`}>
                          {msg.quotedMessageId && msg.quotedMessageId.content && (
                            <div className="quote-box bg-gray-600 p-2 mb-2 rounded-lg border-l-4 border-blue-400 text-gray-100 italic">
                              <strong className="text-blue-300">Quoted from {msg.quotedMessageId.sender.username}:</strong>
                              <p className="ml-2">{msg.quotedMessageId.content}</p>
                            </div>
                          )}
                          <div className="content-wrapper">
                            <strong>{msg.sender.username}: </strong>{msg.content}
                          </div>
                          {msg.fileUrl && (
                            (console.log('Rendering fileUrl:', msg.fileUrl, 'IsImage:', msg.fileUrl.match(/\.(jpeg|jpg|png|gif)$/i)),
                            msg.fileUrl.match(/\.(jpeg|jpg|png|gif)$/i)) ? (
                              <img src={msg.fileUrl} alt="uploaded" className="mt-2 max-w-xs rounded" onError={(e) => console.error('Image load error:', msg.fileUrl)} />
                            ) : (
                              <a href={msg.fileUrl} target="_blank" className="text-blue-400 underline mt-2 block">
                                {msg.fileUrl.split('/').pop()}
                              </a>
                            )
                          )}
                          <div className="flex items-center justify-end text-xs text-gray-400 mt-1">
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.sender.username === currentUsername && (
                              <span className="ml-1">
                                {msg.seen ? (
                                  <i className="fas fa-check-double text-blue-400"></i>
                                ) : msg.delivered ? (
                                  <i className="fas fa-check-double text-gray-400"></i>
                                ) : (
                                  <i className="fas fa-check text-gray-400"></i>
                                )}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleQuoteReply(msg)}
                            className="absolute top-2 right-2 text-blue-400 hover:text-blue-300"
                          >
                            <i className="fas fa-reply"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {isTyping && <div className="text-gray-400 italic animate-pulse">{selectedUser.username} is typing...</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className="mt-4">
                {quotedMessage && (
                  <div className="bg-gray-600 p-2 rounded-lg mb-2 border-l-4 border-blue-500 text-gray-200 italic">
                    <strong>{quotedMessage.sender.username}:</strong> {quotedMessage.content}
                    <button
                      onClick={() => setQuotedMessage(null)}
                      className="ml-2 text-red-400 hover:underline text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onInput={handleTyping}
                    placeholder="Type a message..."
                    className="flex-grow px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                  />
                  <button type="submit" className="send-btn bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700">&gt;</button>
                  <label htmlFor="file-upload" className="upload-btn bg-gray-700 text-white px-4 py-2 rounded-lg cursor-pointer flex items-center justify-center border border-gray-600 hover:bg-gray-600">
                    <i className="fas fa-paperclip text-lg"></i>
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    className="hidden"
                  />
                </form>
              </div>
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