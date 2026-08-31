# Setup Guide

1. **MongoDB Atlas Setup:**
   - Create a free MongoDB Atlas cluster named "sentinel".
   - Create a database user with a username and password.
   - Go to Network Access and allow access from anywhere (`0.0.0.0/0`).
   - Copy the connection string.

2. **Environment Variables:**
   - Everyone on the team uses the SAME connection string. 
   - Ensure the connection string is shared privately and **never committed to git**.
   - Create a `.env` file in the root directory (make sure it's in `.gitignore`) and copy the contents of `.env.example` into it, replacing the placeholders with the actual values.

3. **Running the Server:**
   - Run `npm install` to install dependencies.
   - Run `npm run dev` to start the server locally on port 5000 using Nodemon.
