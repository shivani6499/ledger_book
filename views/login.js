// Function to handle form submission
async function handleLogin(event) {
    event.preventDefault(); // Prevent default form submission

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Please fill out both username and password.');
        return;
    }

    const loginData = {
        username: username,
        password: password
    };

    try {
        // Send POST request to the backend API
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Login successful!');
            // Redirect to user-specific page using the received userId
            window.location.href = `/user/${data.userId}`;
        } else {
            // If login failed, show error message
            alert(data.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred during login. Please try again later.');
    }
}

// Attach the form submission event to the login form
document.getElementById('login-form').addEventListener('submit', handleLogin);
