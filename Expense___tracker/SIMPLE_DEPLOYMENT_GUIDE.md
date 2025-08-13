# 🚀 Simple Deployment Guide

## **Option 1: Vercel + Railway (Recommended - Easiest)**

### **Step 1: Deploy Backend to Railway**

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub
3. **Click "New Project"** → "Deploy from GitHub repo"
4. **Select your repository**
5. **Set Root Directory to**: `Expense___tracker/backend`
6. **Add Environment Variables**:
   ```
   FLASK_ENV=production
   FLASK_APP=app.py
   ```
7. **Railway will auto-deploy** - wait for it to complete
8. **Copy the generated URL** (e.g., `https://your-app-name.railway.app`)

### **Step 2: Deploy Frontend to Vercel**

1. **Go to [Vercel.com](https://vercel.com)**
2. **Sign up/Login** with GitHub
3. **Click "New Project"** → Import your repository
4. **Set Root Directory to**: `Expense___tracker/frontend`
5. **Add Environment Variable**:
   ```
   VITE_API_URL=https://your-railway-backend-url.railway.app
   ```
6. **Click Deploy** - Vercel will auto-deploy

### **Step 3: Test Your App**

1. **Frontend URL**: `https://your-app-name.vercel.app`
2. **Backend URL**: `https://your-app-name.railway.app`
3. **Test the health endpoint**: `https://your-app-name.railway.app/health`

---

## **Option 2: Render (Alternative)**

### **Backend on Render:**

1. **Go to [Render.com](https://render.com)**
2. **Create New** → "Web Service"
3. **Connect GitHub repo**
4. **Set Root Directory**: `Expense___tracker/backend`
5. **Environment**: Python 3
6. **Build Command**: `pip install -r requirements.txt`
7. **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
8. **Add Environment Variables**:
   ```
   FLASK_ENV=production
   FLASK_APP=app.py
   ```

### **Frontend on Render:**

1. **Create New** → "Static Site"
2. **Set Root Directory**: `Expense___tracker/frontend`
3. **Build Command**: `npm install && npm run build`
4. **Publish Directory**: `dist`
5. **Add Environment Variable**:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

---

## **Troubleshooting**

### **Common Issues:**

1. **CORS Errors**: Backend already has CORS configured
2. **Build Failures**: Check if all dependencies are in requirements.txt
3. **Runtime Errors**: Ensure environment variables are set correctly
4. **Database Issues**: SQLite database will be created automatically

### **Quick Fixes:**

- **If Railway fails**: Try Render instead
- **If Vercel fails**: Try Netlify instead
- **If build fails**: Check the logs for missing dependencies

---

## **Success Indicators**

✅ **Backend Health Check**: `https://your-backend-url/health` returns `{"status": "healthy"}`

✅ **Frontend Loads**: No console errors, API calls work

✅ **File Upload Works**: Can upload and process PDF files

✅ **Authentication Works**: Can login/register users

---

**Need Help?** Check the deployment logs in your platform's dashboard for specific error messages.
