import React from 'react';

function UserList({ users }) {
  return (
    <div className="users-list-container">
      <h3>Users in Room</h3>
      <ul className="users-list">
        {users.map((user) => (
          <li key={user.id} className="user-item">
            {user.username}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserList;