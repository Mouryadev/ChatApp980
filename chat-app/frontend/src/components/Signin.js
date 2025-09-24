import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Signin.css';
import { toast, ToastContainer } from 'react-toastify';

function Signin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  // Initialize Particles.js with dark theme
 useEffect(() => {
  if (window.particlesJS) {
    window.particlesJS('particles-js', {
      particles: {
        number: { value: 100, density: { enable: true, value_area: 800 } },
        color: { value: '#87eefb' }, 
        shape: { type: 'circle' },
        opacity: { value: 0.3, random: false }, // lighter opacity
        size: { value: 2.5, random: true }, 
        line_linked: { 
          enable: true, 
          distance: 140, 
          color: '#87eefb', 
          opacity: 0.25, // lighter lines
          width: 1 
        },
        move: { 
          enable: true, 
          speed: 1, 
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
            distance: 160, 
            line_linked: { opacity: 0.5, color: '#87eefb' } // softer on hover
          }, 
          push: { particles_nb: 3 } 
        }
      },
      retina_detect: true
    });
  }
}, []);


  const handleSignin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://chatapp980.onrender.com/api/signin', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.username);
      navigate('/chat');
    } catch (error) {
      toast(error.response.data.message);
    }
  };

  // Framer Motion variants for animations
  const formVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut', delay: 0.2 } }
  };

  const buttonVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.08, rotate: 2, transition: { type: 'spring', stiffness: 300 } },
    tap: { scale: 0.95 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gray-900">
      <div id="particles-js" className="absolute inset-0 z-0"></div>
      <motion.div
        className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full z-10 border-2 border-transparent gradient-border"
        variants={formVariants}
        initial="hidden"
        animate="visible"
        whileHover={{ boxShadow: '0 15px 30px rgba(0, 0, 0, 0.5), 0 10px 10px rgba(0, 0, 0, 0.3)' }}
      >
        <h2 className="text-3xl font-extrabold text-center text-white mb-6">Sign In</h2>
        <form onSubmit={handleSignin} className="space-y-5">
          <motion.div variants={inputVariants} initial="hidden" animate="visible">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 transition-all"
            />
          </motion.div>
          <motion.div variants={inputVariants} initial="hidden" animate="visible">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 transition-all"
            />
          </motion.div>
          <button
            type="submit"
            className="w-full btn bg-blue-600 text-white py-3 rounded-lg font-semibold"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400">
          Don't have an account?{' '}
          <a href="/signup" className="text-blue-400 hover:underline">
            Sign up
          </a>
        </p>
      </motion.div>
      <ToastContainer />
    </div>
  );
}

export default Signin;