async function handleLogin(event) {
    event.preventDefault(); n

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
            window.location.href = `/user/${data.userId}`;
        } else {
            alert(data.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred during login. Please try again later.');
    }
}

document.getElementById('login-form').addEventListener('submit', handleLogin);
