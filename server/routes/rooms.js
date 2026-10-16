// server/routes/rooms.js

const express = require('express');
const router = express.Router();

// We will pass the 'io' instance from index.js to this route
module.exports = function(io) {
  router.get('/', (req, res) => {
    const rooms = io.sockets.adapter.rooms;
    const activeRooms = [];

    // The 'rooms' map also includes rooms for each individual socket ID.
    // We need to filter those out to only get the custom rooms users have joined.
    for (const [roomId, sids] of rooms.entries()) {
      // If the roomId is not the same as a socket ID, it's a custom room
      if (!sids.has(roomId)) {
        activeRooms.push(roomId);
      }
    }
    
    res.json(activeRooms);
  });

  return router;
};