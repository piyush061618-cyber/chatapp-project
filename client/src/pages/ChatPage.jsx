// import React, { useState, useEffect, useRef } from 'react';
// import UserList from '../components/UserList';
// // import socket from '../socket.js';
// import socket from '../socket.js';

// function ChatPage({ username, room }) {
//   const [currentMessage, setCurrentMessage] = useState('');
//   const [chatHistory, setChatHistory] = useState([]);
//   const [users, setUsers] = useState([]);
//   const [typingUsers, setTypingUsers] = useState([]);
//   const chatEndRef = useRef(null);
//   const typingTimeoutRef = useRef(null);

//   // Effect to handle incoming messages, user lists, and typing indicators
//   useEffect(() => {
//     const handleReceiveMessage = (data) => {
//        console.log('[RECEIVED MESSAGE ON CLIENT]', data); // <-- ADD THIS
//       setChatHistory((list) => [...list, { ...data, fromMe: false }]);
//     };
//     const handleUpdateUserList = (userList) => setUsers(userList);
//     const handleUserTyping = (typingUsername) => {
//       setTypingUsers((currentTypingUsers) => [...new Set([...currentTypingUsers, typingUsername])]);
//     };
//     const handleUserStoppedTyping = (typingUsername) => {
//       setTypingUsers((currentTypingUsers) => currentTypingUsers.filter((u) => u !== typingUsername));
//     };

//     socket.on('receive_message', handleReceiveMessage);
//     socket.on('update_user_list', handleUpdateUserList);
//     socket.on('user_typing', handleUserTyping);
//     socket.on('user_stopped_typing', handleUserStoppedTyping);

//     // Cleanup listeners on component unmount
//     return () => {
//       socket.off('receive_message', handleReceiveMessage);
//       socket.off('update_user_list', handleUpdateUserList);
//       socket.off('user_typing', handleUserTyping);
//       socket.off('user_stopped_typing', handleUserStoppedTyping);
//     };
//   }, []);

//   // Effect to scroll to the bottom of the chat on new messages
//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [chatHistory, typingUsers]);

//   const sendMessage = async () => {
//     if (currentMessage.trim() !== '') {
//       const messageData = {
//         room: room,
//         author: username,
//         message: currentMessage,
//         time: new Date(Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//       };
//        console.log('[EMITTING MESSAGE FROM CLIENT]', messageData); // <-- ADD THIS
//       await socket.emit('send_message', messageData);
//       setChatHistory((list) => [...list, { ...messageData, fromMe: true }]);
//       setCurrentMessage('');
//       socket.emit('stop_typing', { room, username }); // Also stop typing when message is sent
//     }
//   };
  
//   const handleTyping = (e) => {
//     setCurrentMessage(e.target.value);
//     socket.emit('typing', { room, username });

//     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

//     typingTimeoutRef.current = setTimeout(() => {
//       socket.emit('stop_typing', { room, username });
//     }, 2000); // 2 seconds of inactivity
//   };


//   return (
//     <div className="chat-container">
//       <UserList users={users} />
//       <div className="chat-window">
//         <div className="chat-header">
//           <p>Live Chat - Room: {room}</p>
//         </div>
//         <div className="chat-body">
//           <div className="message-container">
//             {chatHistory.map((msg, index) => (
//               <div key={index} className={`message ${msg.fromMe ? 'me' : 'other'}`}>
//                 <div className="message-content">
//                   <p>{msg.message}</p>
//                 </div>
//                 <div className="message-meta">
//                   <p>{msg.time}</p>
//                   <p><strong>{msg.fromMe ? 'You' : msg.author}</strong></p>
//                 </div>
//               </div>
//             ))}
//              <div className="typing-indicator">
//               {typingUsers.length > 0 &&
//                 `${typingUsers.join(', ')} is typing...`}
//             </div>
//             <div ref={chatEndRef} />
//           </div>
//         </div>
//         <div className="chat-footer">
//           <input
//             type="text"
//             value={currentMessage}
//             placeholder="Type a message..."
//             onChange={handleTyping}
//             onKeyPress={(event) => event.key === 'Enter' && sendMessage()}
//           />
//           <button onClick={sendMessage}>&#9658;</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default ChatPage;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Picker from 'emoji-picker-react'; 
import { BsEmojiSmileFill } from 'react-icons/bs'; // A nice emoji icon
import './ChatPage.css';
import { useAuth } from '../hooks/useAuth'; // To get the username
import socket from '../socket'; // Your configured socket instance
 // Make sure you have a corresponding CSS file
import { MdVerified } from 'react-icons/md'; 
import axios from 'axios'; // Make sure axios is imported

function ChatPage() {
  const [room, setRoom] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const chatBodyRef = useRef(null);
  const { token } = useAuth(); // Assuming useAuth provides the token

  const { logout } = useAuth(); // Get the logout function from your context
  const navigate = useNavigate(); // Initialize the navigate function
   // Add a new state for the list of available rooms
  const [availableRooms, setAvailableRooms] = useState([]);
  
   // 2. Add a new state for the picker visibility
  const [showPicker, setShowPicker] = useState(false);
   const onEmojiClick = (emojiObject) => {
    setCurrentMessage(prevInput => prevInput + emojiObject.emoji);
    setShowPicker(false); // Hide the picker after selection
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/rooms');
        setAvailableRooms(response.data);
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
      }
    };
    
    fetchRooms();
  }, []);
  // Decode username from JWT token
  const getUsernameFromToken = () => {
    try {
      if (!token) return 'Guest';
      return JSON.parse(atob(token.split('.')[1])).username;
    } catch (e) {
      console.error('Error decoding token:', e);
      return 'Guest';
    }
  };
  const username = getUsernameFromToken();

  // Effect to scroll down when new messages are added
  useEffect(() => {
    socket.connect();
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Effect to set up all socket event listeners
  useEffect(() => {
    if (!socket || !showChat) return; // Only set up listeners if we are in a room

    // Listener for receiving messages
    const handleReceiveMessage = (data) => {
       console.log('[STEP 4: RECEIVER GOT MESSAGE]', data);
      setChatHistory((list) => [...list, { ...data, fromMe: data.author === username }]);
    };
    socket.on('receive_message', handleReceiveMessage);
     const handleUpdateUsrList = (userList) => {
      setUsers(userList);
    };
    socket.on('update_user_list', handleUpdateUsrList);

    // Listener for loading message history
    const handleLoadHistory = (history) => {
      const formattedHistory = history.map(msg => ({
        ...msg,
        author: msg.sender.username,
        message: msg.message,
        time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fromMe: msg.sender.username === username
      }));
      setChatHistory(formattedHistory);
    };
    socket.on('load_history', handleLoadHistory);

    // Listener for user list updates
    const handleUpdateUserList = (userList) => {
      setUsers(userList);
    };
    socket.on('update_user_list', handleUpdateUserList);

    // Listeners for typing indicators
    const handleUserTyping = (typingUsername) => {
      if (!typingUsers.includes(typingUsername)) {
        setTypingUsers(prev => [...prev, typingUsername]);
      }
    };
    const handleUserStoppedTyping = (stoppedUsername) => {
      setTypingUsers(prev => prev.filter(u => u !== stoppedUsername));
    };
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    // Cleanup: remove all listeners when the component unmounts or room changes
    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('load_history', handleLoadHistory);
      socket.off('update_user_list', handleUpdateUserList);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      // ... your other socket.off() calls
      socket.off('update_user_list', handleUpdateUserList);
    };
  }, [socket, showChat, username]); // Re-run if socket or showChat changes

  // Function to join a room
  const joinRoom = () => {
    if (room.trim() !== '') {
      socket.emit('join_room', { room });
      setShowChat(true); // This will hide the form and show the chat
    } else {
      alert("Please enter a room name.");
    }
  };

  // Function to send a message
  const sendMessage = async () => {
    if (currentMessage.trim() !== '') {
      const messageData = {
        room: room, // Now 'room' has the correct value
        message: currentMessage,
      };
      console.log('[STEP 1: SENDING]', messageData); // Your debug log
      await socket.emit('send_message', messageData);
      
      // Also update your own chat history immediately
      setChatHistory((list) => [...list, { 
        ...messageData, 
        author: username, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        fromMe: true 
      }]);
      setCurrentMessage('');
      socket.emit('stop_typing', { room });
    }
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    if (e.target.value) {
      socket.emit('typing', { room });
    } else {
      socket.emit('stop_typing', { room });
    }
  };

  // Render the "Join Room" form if showChat is false
  if (!showChat) {
    return (
      <div className="join-chat-container">
        <h3>Join a Chat Room</h3>
        <p>Welcome, {username}!</p>
        <input
          type="text"
          placeholder="Enter Room Name..."
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          onKeyPress={(event) => event.key === 'Enter' && joinRoom()}
        />
        <button onClick={joinRoom}>Join Room</button>

         {/* Display the list of available rooms */}
        <div className="available-rooms">
          <h4>Available Rooms:</h4>
          {availableRooms.length > 0 ? (
            <ul>
              {availableRooms.map((roomName) => (
                <li key={roomName} onClick={() => setRoom(roomName)}>
                  {roomName}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active rooms. Create one!</p>
          )}
        </div>
      </div>
    );
  }
 // 2. Create the handleLogout function
  const handleLogout = () => {
    logout(); // This clears the token from context and localStorage
    navigate('/login'); // Redirect the user to the login page
  };
  // Render the chat interface if showChat is true
  return (
     <div className="chat-container">
      {/* The new sidebar for the user list */}
      <div className="users-sidebar">
        <h4>🟢 Online Users</h4>
        <ul>
          {users.map((user) => (
            <li key={user.id}>{user.username}</li>
          ))}
        </ul>
      </div>

    <div className="chat-window">
      <div className="chat-header">
        <p>Live Chat - Group: {room}</p>
         <div className="header-right">
        {/* THIS IS THE SECTION TO UPDATE */}
        <div className="user-avatar">
          {/* Replace the initial with an img tag */}
          <img 
            src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${username}`} 
            alt="avatar" 
          />
        </div>
        <p className="header-username">{username}
         
           <MdVerified className="verified-tick" />
        </p>
        <button onClick={handleLogout} className="logout-button">Logout</button>
       </div>
       

      </div>
      <div className="chat-body" ref={chatBodyRef}>
        {chatHistory.map((msg, index) => (
          <div key={index} className={`message ${msg.fromMe ? "you" : "other"}`}>
            <div className="message-content"><p>{msg.message}</p></div>
            <div className="message-meta">
              <p>{msg.fromMe ? "You" : msg.author}</p>
              <p>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="typing-indicator">
        {typingUsers.length > 0 && <p>{typingUsers.join(', ')} is typing...</p>}
      </div>
      <div className="chat-footer">
        <div className="emoji">
          <BsEmojiSmileFill onClick={() => setShowPicker(val => !val)} />
          {showPicker && (
            <div className="emoji-picker-react">
              <Picker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
        <input
          type="text"
          value={currentMessage}
          placeholder="Hey..."
          onChange={handleTyping}
          onKeyPress={(event) => event.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>&#9658;</button>
      </div>
    </div>
  </div>
  );
}

export default ChatPage;