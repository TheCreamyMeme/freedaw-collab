// Load users from JSON
fetch('users.json')
  .then(response => response.json())
  .then(data => {
    const dropdown = document.getElementById('usernameDropdown');
    data.users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.username;
      option.textContent = user.username;
      dropdown.appendChild(option);
    });
  })
  .catch(error => console.error('Error loading users:', error));

// Handle form submission
document.getElementById('addUserForm').addEventListener('submit', function(event) {
  event.preventDefault();
  
  const usernameInput = document.getElementById('newUsername');
  const username = usernameInput.value.trim();
  
  if (username === '') {
    alert('Please enter a username');
    return;
  }
  
  // Check if username already exists
  fetch('users.json')
    .then(response => response.json())
    .then(data => {
      if (data.users.some(user => user.username === username)) {
        alert('Username already exists');
        return;
      }
      
      // Add new user to the list
      const newUser = { username };
      const updatedUsers = [...data.users, newUser];
      
      // Save updated users back to users.json
      fetch('users.json', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ users: updatedUsers })
      })
      .then(response => {
        if (!response.ok) throw new Error('Failed to save users');
        return response.json();
      })
      .then(data => {
        alert('User added successfully');
        usernameInput.value = '';
        // Refresh dropdown with updated users
        const dropdown = document.getElementById('usernameDropdown');
        dropdown.innerHTML = '';
        data.users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.username;
          option.textContent = user.username;
          dropdown.appendChild(option);
        });
      })
      .catch(error => console.error('Error saving users:', error));
    })
    .catch(error => console.error('Error checking username:', error));
});

// Handle form submission
document.getElementById('userForm').addEventListener('submit', function(event) {
  event.preventDefault();
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  
  if (name && email) {
    // Add new user to the users array
    const newUser = { id: Date.now(), name, email };
    
    // Update users.json with new user
    fetch('users.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([newUser, ...JSON.parse(localStorage.getItem('users') || '[]')])
    })
    .then(response => response.json())
    .then(() => {
      // Re-populate dropdown
      const dropdown = document.getElementById('myDropdown');
      dropdown.innerHTML = '';
      fetch('users.json')
        .then(response => response.json())
        .then(data => {
          data.forEach(user => {
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = user.name;
            dropdown.appendChild(option);
          });
        });
    });
  }
});