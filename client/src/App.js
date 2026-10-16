// //client/src/App.js

// import React, { useState, useEffect, useRef } from 'react';
// import io from 'socket.io-client';
// import './App.css';

// // Connect to the backend server.
// // We don't specify the URL here because the server and client will be on the same domain in production.
// // For development, the proxy in package.json will handle this.
// const socket = io.connect("http://localhost:3001");

// function App() {
//   const [username, setUsername] = useState("");
//   const [currentMessage, setCurrentMessage] = useState("");
//   const [chatHistory, setChatHistory] = useState([]);
//   const chatEndRef = useRef(null);

//   const sendMessage = async () => {
//     if (currentMessage !== "" && username !== "") {
//       const messageData = {
//         author: username,
//         message: currentMessage,
//         time: new Date(Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//       };

//       // Emit the message to the server
//       await socket.emit("send_message", messageData);
      
//       // Add our own message to our chat history
//       setChatHistory((list) => [...list, { ...messageData, fromMe: true }]);
//       setCurrentMessage("");
//     }
//   };

//   // Effect to handle incoming messages
//   useEffect(() => {
//     const receiveMessageHandler = (data) => {
//       setChatHistory((list) => [...list, { ...data, fromMe: false }]);
//     };
    
//     // Listen for the 'receive_message' event
//     socket.on("receive_message", receiveMessageHandler);

//     // Clean up the event listener on component unmount
//     return () => {
//       socket.off("receive_message", receiveMessageHandler);
//     };
//   }, [socket]);
  
//   // Effect to scroll to the bottom of the chat
//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [chatHistory]);

//   return (
//     <div className="chat-window">
//       <div className="chat-header">
//         <p>Live Chat</p>
//       </div>
//       <div className="chat-body">
//         {!username ? (
//           <div className="join-chat-container">
//             <h3>Join Chat</h3>
//             <input
//               type="text"
//               placeholder="Enter your name..."
//               onChange={(event) => setUsername(event.target.value)}
//               onKeyPress={(event) => event.key === 'Enter' && setUsername(event.target.value)}
//             />
//           </div>
//         ) : (
//           <>
//             <div className="message-container">
//               {chatHistory.map((msg, index) => (
//                 <div key={index} className={`message ${msg.fromMe ? "me" : "other"}`}>
//                   <div className="message-content">
//                     <p>{msg.message}</p>
//                   </div>
//                   <div className="message-meta">
//                     <p>{msg.time}</p>
//                     <p><strong>{msg.fromMe ? 'You' : msg.author}</strong></p>
//                   </div>
//                 </div>
//               ))}
//               <div ref={chatEndRef} />
//             </div>
//             <div className="chat-footer">
//               <input
//                 type="text"
//                 value={currentMessage}
//                 placeholder="Type a message..."
//                 onChange={(event) => setCurrentMessage(event.target.value)}
//                 onKeyPress={(event) => event.key === 'Enter' && sendMessage()}
//               />
//               <button onClick={sendMessage}>&#9658;</button>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;