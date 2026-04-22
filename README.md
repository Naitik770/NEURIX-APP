<h1>NEURIX App</h1>

NEURIX is a habit builder and mind training app 


---

**🚀 Features**

⚡ AI-powered responses using Gemini API

🔥 Real-time database with Firebase Firestore

🌐 Fast frontend powered by Vite

🔐 Secure environment configuration

🧩 Modular and scalable architecture



---

**📦 Installation**

Clone the repository:

https://github.com/Naitik770/NEURIX-APP.git

Install dependencies:

npm install


---

**⚙️ Environment Setup**

🧪 Local Development

Create a .env file in your root directory:

GEMINI_API_KEY=YOUR_KEY <br>
VITE_GEMINI_API_KEY=SAME_KEY_HERE_ALSO

> ⚠️ Important: These variables are only for local development.
❌ Do NOT upload your .env file to GitHub.




---

**🚀 Production Setup (Very Important 🔐)**

When deploying your app (Vercel, Netlify, etc.), DO NOT rely on .env file.

Instead, set environment variables directly in your deployment platform:

Steps:

1. Go to your hosting dashboard


2. Open Project Settings → Environment Variables


3. Add the following:



GEMINI_API_KEY=YOUR_KEY <br>
VITE_GEMINI_API_KEY=SAME_KEY_HERE_ALSO

> ✅ This keeps your API key secure and prevents exposure in your code.




---

**🤖 Gemini API Setup**

1. Go to your Gemini API provider dashboard


2. Generate your API key


3. Add it to:

.env file (for local)

Hosting environment variables (for production)





---

**🔥 Firebase Setup (Optional but Recommended)**

If you want to use your own Firebase project:

Step 1: Create Firebase Project

Go to Firebase Console

Click Create Project

Add a Web App



---

Step 2: Enable Testing Mode

While setting up Firestore, select Testing Mode



---

Step 3: Get Firebase Credentials

After creating the web app, Firebase will provide config credentials

Copy those credentials



---

Step 4: Configure Project

Open firebase_applet.json

Paste your Firebase credentials into this file



---

**🗄️ Firestore Setup**

1. Go to Firestore Database


2. Click Create Database


3. Select your preferred region


4. After setup:

Open firestore.rules file in your project

Copy its contents

Paste into Firebase → Firestore → Rules Tab





---

**▶️ Running the App**

Start development server:

npm run dev

Build for production:

npm run build

Preview production build:

npm run preview


---

**🛠️ Tech Stack**

Frontend: Typescript 

AI: Gemini API

Backend/Database: Firebase Firestore



---

**🔐 Security Best Practices**

❌ Never hardcode API keys

❌ Never commit .env file

✅ Always use environment variables in production

🔁 Rotate API keys if exposed

---

**📄 License**

This project is licensed under the MIT License.
